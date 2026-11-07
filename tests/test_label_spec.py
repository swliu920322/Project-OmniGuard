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
        if e["expected_disagreement"] is not None:
            assert r["note"]["source_disagreement"] == e["expected_disagreement"], e["id"]
        if e["clauses"]:
            assert R.combine_clause_statuses(e["clauses"]) == e["note_status"], e["id"]


def test_examples_are_in_the_document_and_marked_dev_public():
    ids = [e["id"] for e in EXAMPLES]
    assert len(ids) == len(set(ids))
    for e in EXAMPLES:
        assert f"| {e['id']} |" in DOC and e["split"] == "dev_public"


def test_every_note_status_and_language_has_a_public_example():
    assert {e["note_status"] for e in EXAMPLES if e["note_status"]} == set(R.NOTE_STATUSES)
    assert {e["language"] for e in EXAMPLES if e["note"]} == {"en", "zh", "mixed"}
    assert sum(1 for e in EXAMPLES if e["clauses"] and len(e["clauses"]) > 1) >= 4


def test_clause_combination_is_current_state_first_then_stricter():
    c = R.combine_clause_statuses
    assert c(["HISTORICAL", "NEGATED"]) == "NEGATED"          # a past person does not outrank 'now gone'
    assert c(["NEGATED", "AFFIRMED_CURRENT"]) == "AFFIRMED_CURRENT"
    assert c(["UNCERTAIN", "NEGATED"]) == "UNCERTAIN"
    assert c(["HYPOTHETICAL", "HISTORICAL"]) == "HISTORICAL"
    assert c(["IRRELEVANT"]) == "IRRELEVANT" and c([]) == "IRRELEVANT"
    for bad in (["MAYBE"],):
        try:
            c(bad)
        except ValueError:
            continue
        raise AssertionError("unknown status accepted")


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
            if status not in R.NOTE_RISK_STATUSES:
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


# --- from a model reply to the executed action -----------------------------------------------------------------------

def _record(risks):
    rec = {**OK}
    for r in risks:
        rec.update(TRIGGER[r])
    return rec


def test_execute_never_removes_a_risk_whatever_the_model_says():
    for risks in itertools.chain.from_iterable(itertools.combinations(TRIGGER, n) for n in range(6)):
        rec = _record(risks)
        for primary in R.CLASSES:
            for status in [None, *R.NOTE_STATUSES]:
                out = R.execute(rec, {"primary": primary, "note_status": status}, note="x" if status else None)
                assert set(R.risk_set(rec)) <= set(out["risk_set"]), (risks, primary, status)


def test_execute_adds_the_models_stricter_reading_and_flags_the_override():
    out = R.execute(OK, {"primary": "OVERHEAT", "note_status": None})           # false alarm from the model: stricter, accepted
    assert out["action"]["motion"] == "HALT" and out["risk_set"] == ["OVERHEAT"]
    low = R.execute(_record(["CRITICAL_OBSTACLE"]), {"primary": "NORMAL_NAV", "note_status": None})  # model too lax: code floor holds
    assert low["action"]["motion"] == "HALT" and low["floor_override"] is True
    same = R.execute(OK, {"primary": "NORMAL_NAV", "note_status": None})
    assert same["floor_override"] is False and same["action"]["motion"] == "MOVE"


def test_execute_uses_the_predicted_note_status_by_the_same_rule_as_the_gold():
    for status in R.NOTE_STATUSES:
        out = R.execute(OK, {"primary": "NORMAL_NAV", "note_status": status}, note="Worker ahead.")
        assert (out["action"]["motion"] == "HALT") == (status in R.NOTE_RISK_STATUSES), status


def test_execute_halts_on_unparseable_or_out_of_contract_replies():
    for bad in (None, {"primary": "MAYBE", "note_status": None}, {"primary": "NORMAL_NAV", "note_status": "SORT_OF"},
                {"primary": "NORMAL_NAV", "note_status": "NEGATED"}):  # a status for a record that has no note
        out = R.execute(OK, bad)
        assert out["valid"] is False and out["action"]["motion"] == "HALT" and out["action"]["halt_reasons"][0] == "PARSE_FAILURE"
    assert R.execute({**OK, "hp": None}, {"primary": "NORMAL_NAV", "note_status": None})["action"]["halt_reasons"][0] == "INVALID_INPUT"


def test_emergency_stop_flag_wins_over_any_model_reply():
    assert R.execute(OK, {"primary": "NORMAL_NAV", "note_status": None}, estop=True)["action"]["motion"] == "HALT"
    assert R.execute(OK, None, estop=True)["action"]["halt_reasons"] == ["PARSE_FAILURE", "ESTOP"]


# --- rule controls ---------------------------------------------------------------------------------------------------

_c = importlib.util.spec_from_file_location("rule_control", SPEC / "rule_control.py")
import sys  # noqa: E402
sys.path.insert(0, str(SPEC))
C = importlib.util.module_from_spec(_c)
_c.loader.exec_module(C)


def test_rule_controls_read_only_the_rendered_text_and_are_deterministic():
    for e in EXAMPLES:
        text = R.render_telemetry(e["input"], e["note"])
        assert C.predict(text, "R1") == C.predict(text, "R1") and C.predict(text, "R2") == C.predict(text, "R2")


def test_r1_telemetry_part_equals_the_reference_on_telemetry_only_records():
    for e in EXAMPLES:
        if e["note"] is None and e["expected_primary"] is not None:
            assert C.predict(R.render_telemetry(e["input"]), "R1")["primary"] == e["expected_primary"], e["id"]


def test_r1_on_the_public_notes_and_its_known_failure_is_visible():
    wrong = {e["id"] for e in EXAMPLES if e["note"] and C.note_status_r1(e["note"]) != e["note_status"]}
    assert wrong == {"N16"}  # 'now gone' has no topic word: R1 cannot carry the subject over. Reported, not tuned away.


def test_r2_only_ever_adds_risk_relative_to_r1():
    for e in EXAMPLES:
        if e["note"]:
            r1, r2 = C.note_status_r1(e["note"]), C.note_status_r2(e["note"])
            assert not (r1 in R.NOTE_RISK_STATUSES and r2 not in R.NOTE_RISK_STATUSES), e["id"]


# --- review round 3: missing note status, floor_override, faults, note contract ---------------------------------------

def test_a_noted_record_needs_a_note_status_missing_or_null_halts():
    for reply in ({"primary": "NORMAL_NAV"}, {"primary": "NORMAL_NAV", "note_status": None}):
        out = R.execute(OK, reply, note="前方有人")
        assert out["valid"] is False and out["action"]["motion"] == "HALT" and out["action"]["halt_reasons"] == ["PARSE_FAILURE"]
        assert out["floor_override"] is None  # a failure, not an override
    ok = R.execute(OK, {"primary": "NORMAL_NAV", "note_status": "NEGATED"}, note="前方没有人")
    assert ok["valid"] and ok["action"]["motion"] == "MOVE"
    assert R.execute(OK, {"primary": "NORMAL_NAV", "note_status": None}, note="   ")["valid"]  # blank note = no note


def test_floor_override_counts_every_risk_or_constraint_the_code_added():
    both = R.execute(_record(["CRITICAL_OBSTACLE", "OVERHEAT"]), {"primary": "CRITICAL_OBSTACLE", "note_status": None})
    assert both["added_risks"] == ["OVERHEAT"] and both["floor_override"] is True and both["primary_changed"] is False
    assert both["action"]["holds"] == ["COOL"]                      # the cool-down the model did not mention
    speed = R.execute(_record(["OVERSPEED"]), {"primary": "NORMAL_NAV", "note_status": None})
    assert speed["added_risks"] == ["OVERSPEED"] and speed["floor_override"] is True and speed["action"]["motion"] == "MOVE_LIMITED"
    full = R.execute(_record(["CRITICAL_OBSTACLE", "OVERHEAT"]), {"primary": "OVERHEAT", "note_status": None})
    assert full["added_risks"] == ["CRITICAL_OBSTACLE"]            # the model named the lower-priority one only
    clean = R.execute(OK, {"primary": "NORMAL_NAV", "note_status": None})
    assert clean["floor_override"] is False and clean["added_risks"] == [] and clean["forced_by"] == []


def test_floor_override_counts_the_stop_flag_and_the_gate_when_they_change_the_action():
    stop = R.execute(OK, {"primary": "NORMAL_NAV", "note_status": None}, estop=True)
    assert stop["floor_override"] is True and stop["forced_by"] == ["ESTOP"]
    gated = R.execute(_record([]) | {"hp": 0}, {"primary": "NORMAL_NAV", "note_status": None})
    assert gated["floor_override"] is True and "GATE" in gated["action"]["halt_reasons"]
    already = R.execute(_record(["CRITICAL_OBSTACLE"]), {"primary": "CRITICAL_OBSTACLE", "note_status": None}, estop=True)
    assert already["floor_override"] is False and already["forced_by"] == []  # the model had already halted


def test_floor_override_is_never_weaker_than_the_old_primary_comparison_when_the_model_gives_no_note_status():
    for risks in itertools.chain.from_iterable(itertools.combinations(TRIGGER, n) for n in range(6)):
        for primary in R.CLASSES:
            out = R.execute(_record(risks), {"primary": primary, "note_status": None})
            if out["primary_changed"]:
                assert out["floor_override"] is True, (risks, primary)


def test_interface_faults_halt_and_are_not_replies():
    for fault in R.FAULTS:
        out = R.execute(OK, {"primary": "NORMAL_NAV", "note_status": None}, fault=fault)
        assert out["action"]["halt_reasons"] == [fault] and out["floor_override"] is None
    try:
        R.execute(OK, None, fault="BOOM")
    except ValueError:
        return
    raise AssertionError("unknown fault accepted")


def test_note_contract_empty_is_no_note_overlong_and_non_text_are_invalid():
    assert R.execute(OK, {"primary": "NORMAL_NAV", "note_status": None}, note="")["valid"]
    assert R.execute(OK, {"primary": "NORMAL_NAV", "note_status": "IRRELEVANT"}, note="x" * R.MAX_NOTE_CHARS)["valid"]
    for bad in ("x" * (R.MAX_NOTE_CHARS + 1), 123, ["a"]):
        out = R.execute(OK, {"primary": "NORMAL_NAV", "note_status": "IRRELEVANT"}, note=bad)
        assert out["valid"] is False and out["action"]["halt_reasons"] == ["INVALID_INPUT"]
    assert R.execute({}, {"primary": "NORMAL_NAV", "note_status": None})["action"]["halt_reasons"] == ["INVALID_INPUT"]  # empty input


# --- families, split and duplicates ----------------------------------------------------------------------------------

_f = importlib.util.spec_from_file_location("family", SPEC / "family.py")
F = importlib.util.module_from_spec(_f)
_f.loader.exec_module(F)


def test_split_assignment_is_pinned_and_deterministic():
    assert [F.assign_split(F.family_id(n)) for n in (1, 2, 3, 4, 5, 1200)] == ["test", "test", "test", "dev", "dev", "test"]
    assert F.pool_by_split() == F.pool_by_split()


def test_pool_proportions_are_near_the_cut_points():
    pool = F.pool_by_split()
    total = sum(len(v) for v in pool.values())
    assert total == F.POOL_SIZE and set(pool) == {"dev", "test", "reserve"}
    assert abs(len(pool["dev"]) / total - 0.30) < 0.05 and abs(len(pool["test"]) / total - 0.60) < 0.05
    assert not set(pool["dev"]) & set(pool["test"])


def test_a_family_in_the_wrong_split_or_a_duplicate_text_is_reported():
    dev_id, test_id = F.pool_by_split()["dev"][0], F.pool_by_split()["test"][0]
    recs = [{"family_id": dev_id, "text": "Telemetry: Distance: 10cm."}, {"family_id": test_id, "text": "other"},
            {"family_id": dev_id, "text": "TELEMETRY:  distance: 10CM."}]
    problems = F.check_records(recs, "dev")
    assert any("belongs to 'test'" in p for p in problems) and any("same text as record 0" in p for p in problems)
    assert F.check_records(recs[:1], "dev") == []
    assert F.check_records([{"family_id": "X-1", "text": "t"}], "dev")


def test_public_examples_are_checked_against_a_set_by_normalised_text():
    texts = [{"text": R.render_telemetry(e["input"], e["note"])} for e in EXAMPLES]
    assert F.cross_duplicates(texts[:3], [{"text": texts[1]["text"].upper()}]) == [(1, 0)]
    assert F.cross_duplicates(texts, [{"text": "something else entirely"}]) == []
