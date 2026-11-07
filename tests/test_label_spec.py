"""The reference labeler must agree with the examples in LABEL_SPEC.md, and its action rules must hold for every combination."""
import csv
import hashlib
import importlib.util
import itertools
import json
import pathlib

SPEC = pathlib.Path(__file__).resolve().parents[1] / "eval" / "spec"
_s = importlib.util.spec_from_file_location("reference_labeler", SPEC / "reference_labeler.py")
R = importlib.util.module_from_spec(_s)
_s.loader.exec_module(R)
EXAMPLES = json.loads((SPEC / "ambiguous_examples.json").read_text())
DOC = (SPEC / "LABEL_SPEC.md").read_text()
OK = {"distance_cm": 300, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}
# one record per risk, plus the values that clear it
TRIGGER = {"CRITICAL_OBSTACLE": {"distance_cm": 10}, "OVERHEAT": {"temperature_c": 75}, "LOW_HEALTH": {"hp": 30},
           "LOW_BATTERY": {"battery_pct": 12}, "OVERSPEED": {"velocity_ms": 3}}


def test_every_example_matches_the_reference_rules():
    for e in EXAMPLES:
        r = R.compose(e["input"], e["note_status"], e["estop"])
        a = r["action"]
        assert r["primary"] == e["expected_primary"], e["id"]
        assert (a["motion"], a["goal"], a["deferred"]) == (e["expected_motion"], e["expected_goal"], e["expected_deferred"]), e["id"]
        if e["expected_conflict"] is not None:
            assert r["note"]["conflicts_with_telemetry"] == e["expected_conflict"], e["id"]


def test_examples_are_in_the_document_and_marked_dev_public():
    ids = [e["id"] for e in EXAMPLES]
    assert len(ids) == len(set(ids))
    for e in EXAMPLES:
        assert f"| {e['id']} |" in DOC and e["split"] == "dev_public"


def test_every_note_status_has_a_public_example():
    assert {e["note_status"] for e in EXAMPLES if e["note_status"]} == set(R.NOTE_STATUSES)


def test_every_threshold_is_exclusive_at_the_boundary():
    for field, edge in [("distance_cm", 30), ("temperature_c", 60), ("velocity_ms", 2.5), ("battery_pct", 20), ("hp", 50)]:
        assert R.label({**OK, field: edge})["primary"] == "NORMAL_NAV", field


def test_a_note_can_add_a_risk_but_never_remove_one():
    for risks in itertools.chain.from_iterable(itertools.combinations(TRIGGER, n) for n in range(6)):
        rec = {**OK}
        for r in risks:
            rec.update(TRIGGER[r])
        for status in [None, *R.NOTE_STATUSES]:
            out = R.compose(rec, status)
            assert set(R.risk_set(rec)) <= set(out["risk_set"]), (risks, status)
            if status != "AFFIRMED_CURRENT":
                assert out["risk_set"] == R.risk_set(rec)
            else:
                assert "CRITICAL_OBSTACLE" in out["risk_set"]


def test_halt_always_wins_and_never_travels_to_the_charger():
    for risks in itertools.chain.from_iterable(itertools.combinations(TRIGGER, n) for n in range(6)):
        rec = {**OK}
        for r in risks:
            rec.update(TRIGGER[r])
        for estop in (False, True):
            out = R.compose(rec, None, estop)
            a = out["action"]
            must_halt = estop or out["gate"] == "SKIP" or any(r in R.HALT_RISKS for r in risks)
            assert (a["motion"] == "HALT") == must_halt, (risks, estop)
            if a["motion"] == "HALT":
                assert a["goal"] == "NONE" and a["speed_cap"] is False
                assert ("RETURN_TO_CHARGE" in a["deferred"]) == ("LOW_BATTERY" in risks)  # kept as a follow-up
            else:
                assert a["goal"] == ("CHARGER" if "LOW_BATTERY" in risks else "CONTINUE")
                assert a["speed_cap"] == ("OVERSPEED" in risks)


def test_physical_gate_constrains_the_final_action():
    for rec in ({**OK, "hp": 0}, {**OK, "battery_pct": 4.9}):
        a = R.compose(rec)["action"]
        assert R.gate(rec) == "SKIP" and a["motion"] == "HALT" and "GATE" in a["halt_reasons"] and a["goal"] == "NONE"
    assert R.gate({**OK, "battery_pct": 5}) == "PASS"


def test_emergency_stop_is_a_flag_and_free_text_is_never_read():
    assert R.compose(OK, None, True)["action"]["halt_reasons"] == ["ESTOP"]
    assert R.compose(OK, "IRRELEVANT", False)["action"]["motion"] == "MOVE"  # a note saying "stop" changes nothing by itself
    assert "estop" not in R.note_effect.__code__.co_varnames  # the note function has no stop path


def test_invalid_input_is_not_a_class_and_fails_safe():
    for bad in ({**OK, "hp": None}, {**OK, "battery_pct": float("nan")}, {**OK, "hp": True}, {**OK, "distance_cm": -1},
                {k: v for k, v in OK.items() if k != "hp"}):
        out = R.compose(bad)
        assert out["valid"] is False and out["primary"] is None and out["action"]["motion"] == "HALT"


def test_the_model_sees_exactly_the_numbers_the_label_used():
    for rec in (OK, {"distance_cm": 29.5, "velocity_ms": 2.55, "hp": 49.9, "battery_pct": 19.9, "temperature_c": 60.1}):
        text = R.render_telemetry(rec, note="Worker ahead.")
        assert R.parse_rendered(text) == rec
        assert R.label(R.parse_rendered(text))["primary"] == R.label(rec)["primary"]
    # 49.9 HP must not become 49 (or 39.6 become 39) between labelling and prompting
    assert "HP: 49.9" in R.render_telemetry({**OK, "hp": 49.9})


def test_render_refuses_values_that_could_not_be_read_back_exactly():
    try:
        R.render_telemetry({**OK, "hp": 49.123})
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_legacy_view_and_class_list_are_consistent():
    assert set(R.CLASSES) == set(R.LEGACY3) and R.LEGACY3["OVERSPEED"] is None
    assert set(R.PRIORITY) | {"NORMAL_NAV"} == set(R.CLASSES)
    assert R.compose(OK, "NEGATED")["legacy3"] is None  # noted records are outside the compatibility view


def test_relabelled_legacy_file_is_derived_and_the_original_is_untouched():
    meta = json.loads((SPEC / "derived" / "legacy200_relabel.meta.json").read_text())
    src = SPEC.parent.parent / meta["source"]
    assert hashlib.sha256(src.read_bytes()).hexdigest() == meta["source_sha256"]
    rows = list(csv.DictReader((SPEC / "derived" / "legacy200_relabel.csv").open()))
    got = {}
    for r in rows:
        got[(r["legacy_label"], r["new_primary"])] = got.get((r["legacy_label"], r["new_primary"]), 0) + 1
    assert got == {("NORMAL_NAV", "NORMAL_NAV"): 111, ("SENSOR_ERROR", "OVERHEAT"): 51,
                   ("CRITICAL_OBSTACLE", "CRITICAL_OBSTACLE"): 27, ("CRITICAL_OBSTACLE", "NORMAL_NAV"): 11}
    assert "baseline_v1" not in str(SPEC / "derived")
