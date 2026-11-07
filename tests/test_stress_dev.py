"""Dev-side stress cases: coverage, regenerability and the behaviour of the real decision path (fake models only, no network)."""
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
STRESS = ROOT / "eval/dev/stress"
for sub in ("src/cloud-orchestrator", "eval/spec", "eval/dev", "eval/dev/stress"):
    sys.path.insert(0, str(ROOT / sub))
import family as F  # noqa: E402
import make_stress_dev as S  # noqa: E402
import reference_labeler as R  # noqa: E402
import router_v2 as V  # noqa: E402

CASES = [json.loads(line) for line in (STRESS / "stress_dev.jsonl").read_text().splitlines()]


def _telemetry(c):
    return {k: (float("nan") if v == "NaN" else v) for k, v in c["telemetry"].items()}


def _reply(primary, status):
    return V.ModelReply(content=json.dumps({"primary": primary, "note_status": status}), finish_reason="stop")


def test_every_type_has_at_least_five_cases_and_the_two_groups_are_separate():
    for ty in range(1, 12):
        assert sum(1 for c in CASES if c["type"] == ty) >= 5, ty
    assert len(CASES) == 66 and {c["group"] for c in CASES if c["type"] in (10, 11)} == {"B"} and {c["group"] for c in CASES if c["type"] <= 9} == {"A"}


def test_regeneration_is_identical_and_the_files_match_the_script():
    assert (STRESS / "stress_dev.jsonl").read_text() == S.jsonl(S.build())
    assert subprocess.run([sys.executable, str(STRESS / "make_stress_dev.py"), "--check"], capture_output=True, text=True).returncode == 0


def test_families_are_dev_families_unused_by_the_dev_set_and_texts_are_unique():
    dev_used = {json.loads(line)["family_id"] for line in (ROOT / "eval/dev/dev_set.jsonl").read_text().splitlines()}
    ids = [c["family_id"] for c in CASES]
    assert len(set(ids)) == len(ids) and set(ids) <= set(F.pool_by_split()["dev"]) and not set(ids) & dev_used
    assert len({c["id"] for c in CASES}) == 66


def test_input_check_types_never_reach_the_model_and_halt():
    for c in CASES:
        if c["sent_to_model"]:
            continue
        called = []
        out = V.decide(_telemetry(c), c["note"], lambda s, u: called.append(u))
        assert called == [] and out["model_called"] is False, c["id"]
        assert out["executed"]["action"]["halt_reasons"][0] == "INVALID_INPUT" and out["executed"]["action"]["motion"] == "HALT", c["id"]
    assert {c["type"] for c in CASES if not c["sent_to_model"]} == {1, 2, 9}


def test_blank_notes_are_valid_and_count_as_no_note():
    for c in CASES:
        if c["type"] == 9 and c["sent_to_model"]:
            assert c["note"] in ("", "   ")
            out = V.decide(_telemetry(c), c["note"], lambda s, u: _reply("NORMAL_NAV", None))
            assert out["executed"]["valid"] and "Operator note" not in out["user_input"]


def test_injected_timeouts_and_rate_limits_halt_with_their_own_reason_and_are_not_accuracy_cases():
    for c in CASES:
        if c["type"] in (10, 11):
            out = V.decide(_telemetry(c), None, lambda s, u, f=c["fault"]: V.ModelReply(fault=f))
            assert out["model_called"] and out["executed"]["action"]["halt_reasons"][0] == c["fault"], c["id"]
            assert c["scored_in_accuracy"] is False and c["expected"]["motion"] == "HALT"


def test_a_correct_model_reproduces_the_expected_route_and_motion_on_every_scored_case():
    n = 0
    for c in CASES:
        if not c["scored_in_accuracy"]:
            continue
        out = V.decide(_telemetry(c), c["note"], lambda s, u, c=c: _reply(c["expected"]["primary"], c["note_status"]))["executed"]
        assert out["valid"] and out["primary"] == c["expected"]["primary"] and out["action"]["motion"] == c["expected"]["motion"], c["id"]
        n += 1
    assert n == 36


def test_a_lax_model_only_loses_the_cases_whose_only_risk_comes_from_the_note():
    lax = lambda s, u: _reply("NORMAL_NAV", None)
    missed = []
    for c in CASES:
        if not c["scored_in_accuracy"]:
            continue
        note_status = c["note_status"]
        reply = (lambda s, u, st=note_status: _reply("NORMAL_NAV", st)) if c["note"] else lax        # a lax class, but a status that fits the record
        out = V.decide(_telemetry(c), c["note"], reply)["executed"]
        if c["expected"]["motion"] == "HALT" and out["action"]["motion"] != "HALT":
            missed.append(c["id"])
        halting_telemetry = any(r in R.HALT_RISKS for r in R.risk_set(_telemetry(c)))
        if halting_telemetry:
            assert out["action"]["motion"] == "HALT", c["id"]                                       # the code floor holds whatever the model says
    # nothing is missed when the status is right: only a wrong note_status (tested next) can lose a note-only risk
    assert missed == []


def test_a_wrong_note_status_is_the_one_way_a_note_only_risk_is_lost_and_it_is_exactly_what_missed_halt_measures():
    lost = []
    for c in CASES:
        if c["scored_in_accuracy"] and c["note"] and c["expected"]["motion"] == "HALT":
            out = V.decide(_telemetry(c), c["note"], lambda s, u: _reply("NORMAL_NAV", "NEGATED"))["executed"]
            if out["action"]["motion"] != "HALT":
                assert not any(r in R.HALT_RISKS for r in R.risk_set(_telemetry(c))), c["id"]       # only note-driven risks can be lost
                lost.append(c["id"])
    assert lost and all(c.startswith(("STR-05", "STR-06", "STR-07")) for c in lost)


def test_injection_text_is_data_and_emergency_stop_is_only_the_flag():
    inj = {c["id"]: c for c in CASES if c["type"] == 8}
    c = inj["STR-08-3"]                                                                              # the note says EMERGENCY STOP NOW
    assert V.decide(_telemetry(c), c["note"], lambda s, u: _reply("NORMAL_NAV", "IRRELEVANT"))["executed"]["action"]["motion"] == "MOVE"
    assert V.decide(_telemetry(c), c["note"], lambda s, u: _reply("NORMAL_NAV", "IRRELEVANT"), estop=True)["executed"]["action"]["halt_reasons"] == ["ESTOP"]
    for cid in ("STR-08-1", "STR-08-2", "STR-08-4", "STR-08-6"):                                     # injection plus a real telemetry risk: still halted or still limited
        c = inj[cid]
        out = V.decide(_telemetry(c), c["note"], lambda s, u, c=c: _reply("NORMAL_NAV", c["note_status"]))["executed"]
        assert out["floor_override"] is True and out["risk_set"] == c["expected"]["risk_set"], cid


def test_note_clause_statuses_combine_to_the_recorded_status():
    for c in CASES:
        if c["clauses"]:
            assert R.combine_clause_statuses([x["status"] for x in c["clauses"]]) == c["note_status"], c["id"]
