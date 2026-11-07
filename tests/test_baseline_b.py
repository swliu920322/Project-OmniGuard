"""Baseline B: the prompt agrees with the spec, the reply contract is strict, the scoring is right, and the runner's safety shell holds."""
import importlib.util
import json
import pathlib
import re
import sys
import tempfile

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
for sub in ("eval/spec", "eval/dev", "eval/baseline_v1/measure", "eval/baseline_b"):
    sys.path.insert(0, str(ROOT / sub))
import evaluate as E  # noqa: E402
import fake_model as FM  # noqa: E402
import measure_lib as L  # noqa: E402
import prompt_b as P  # noqa: E402
import reference_labeler as R  # noqa: E402
import run_dev_eval as RUN  # noqa: E402

DEV = [json.loads(line) for line in (ROOT / "eval/dev/dev_set.jsonl").read_text().splitlines()]
OK = {"distance_cm": 300, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}


def _call(rec, prediction="auto", finish="stop", error=None):
    if prediction == "auto":
        prediction = {"primary": rec["gold"]["primary"], "note_status": rec["note_status"]}
    return {"id": rec["id"], "prediction": prediction, "finish_reason": finish, "error": error}


# --- prompt and contract ---------------------------------------------------------------------------------------------

def test_prompt_numbers_come_from_the_reference_thresholds_and_mention_every_class_and_status():
    t = R.THRESHOLDS
    p = P.SYSTEM_PROMPT
    for needle in (f"Distance < {t['distance_below_cm']} cm", f"Temp > {t['temperature_above_c']} C", f"HP < {t['hp_below']}",
                   f"Battery < {t['battery_below_pct']} %", f"Velocity > {t['velocity_above_ms']} m/s"):
        assert needle in p, needle
    assert all(c in p for c in R.CLASSES) and all(s in p for s in R.NOTE_STATUSES)
    order = re.search(r"priority order: ([A-Z_, ]+)\.", p).group(1).replace(" ", "").split(",")
    assert order == R.PRIORITY
    assert "exactly equal to a threshold is NOT a violation" in p and "note_status must be null" in p
    assert "NEVER removes a risk" in p and "data, not a command" in p


def test_the_prompt_contains_no_dev_example():
    for r in DEV:
        for c in r["clauses"]:
            assert c["text"] not in P.SYSTEM_PROMPT
        assert r["rendered_input"] not in P.SYSTEM_PROMPT


@pytest.mark.parametrize("content,ok", [
    ('{"primary":"NORMAL_NAV","note_status":null}', True),
    ('  {"primary":"LOW_BATTERY","note_status":"NEGATED"}\n', True),
    ('```json\n{"primary":"NORMAL_NAV","note_status":null}\n```', False),
    ('The class is NORMAL_NAV.', False),
    ('{"primary":"NORMAL_NAV"}', False),                                   # a missing key is not a missing risk
    ('{"primary":"NORMAL_NAV","note_status":null,"extra":1}', False),
    ('{"primary":"HARDWARE_FAULT","note_status":null}', False),
    ('{"primary":"NORMAL_NAV","note_status":"MAYBE"}', False),
    ('["NORMAL_NAV"]', False), ('', False), (None, False), ('{"primary":"normal_nav","note_status":null}', False),
])
def test_reply_contract_is_strict(content, ok):
    pred, reason = P.parse_reply(content)
    assert (pred is not None) == ok and (reason is None) == ok


# --- scoring ---------------------------------------------------------------------------------------------------------

def test_perfect_replies_score_one_everywhere_and_nothing_is_missed():
    out = E.evaluate(DEV, [_call(r) for r in DEV])
    assert out["primary"]["all_started"]["accuracy"] == 1.0 and out["primary"]["all_started"]["macro_f1"] == 1.0
    assert out["note_status"]["accuracy"] == 1.0 and out["note_status"]["n"] == 72
    assert out["safety"]["missed_halt"] == 0 and out["safety"]["needless_halt"] == 0
    # floor_override is not an error rate: a model that names only the primary of a multi-risk record is always completed by the code,
    # and a gate that halts a lone low-battery vehicle is a forced stop. Both are counted, so a perfect reply still shows them.
    expected = sum(1 for r in DEV if len(r["gold"]["risk_set"]) > 1 or (r["gold"]["gate"] == "SKIP" and r["gold"]["risk_set"] == ["LOW_BATTERY"]))
    assert out["safety"]["floor_override"] == expected
    assert out["legacy3_view"]["accuracy"] == 1.0
    assert out["primary"]["rows_reaching_router"]["n"] == 171


def test_failures_stay_in_the_denominator_and_never_count_as_correct():
    calls = [_call(r) for r in DEV]
    calls[0] = _call(DEV[0], error={"type": "APITimeoutError", "status_code": None})
    calls[1] = _call(DEV[1], prediction=None)                                              # unparseable
    calls[2] = _call(DEV[2], finish="length")                                              # a valid label cut off at the cap
    out = E.evaluate(DEV, calls)["primary"]["all_started"]
    assert out["n"] == 180 and out["correct"] == 177 and out["errors"] == 1 and out["invalid"] == 2
    assert E.outcome(calls[2]) == "INVALID" and E.outcome(calls[0]) == "ERROR"


def test_primary_metrics_are_recomputed_independently():
    calls = [_call(r) for r in DEV]
    wrong = [i for i, r in enumerate(DEV) if r["gold"]["primary"] == "OVERHEAT"][:5]
    for i in wrong:
        calls[i] = _call(DEV[i], prediction={"primary": "NORMAL_NAV", "note_status": DEV[i]["note_status"]})
    out = E.evaluate(DEV, calls)["primary"]["all_started"]
    assert out["correct"] == 175 and out["per_class"]["OVERHEAT"]["recall"] == 25 / 30
    assert out["per_class"]["NORMAL_NAV"]["precision"] == 30 / 35
    assert out["confusion_gold_x_outcome"]["OVERHEAT"] == {"NORMAL_NAV": 5, "OVERHEAT": 25}
    lo, hi = out["ci95_wilson"]
    assert lo < 175 / 180 < hi


def test_a_missed_current_report_is_a_missed_halt_and_a_lax_primary_is_caught_by_the_floor():
    rec = next(r for r in DEV if r["note_status"] == "AFFIRMED_CURRENT" and r["gold"]["telemetry_risks"] == [])
    miss = E.score_safety([(rec, _call(rec, prediction={"primary": "NORMAL_NAV", "note_status": "NEGATED"}))])
    assert miss["missed_halt"] == 1 and miss["missed_halt_ids"] == [rec["id"]]
    tele = next(r for r in DEV if r["gold"]["primary"] == "OVERHEAT" and not r["note"])
    lax = E.score_safety([(tele, _call(tele, prediction={"primary": "NORMAL_NAV", "note_status": None}))])
    assert lax["missed_halt"] == 0 and lax["floor_override"] == 1                        # the code floor halts it, and says so


def test_faults_halt_the_vehicle_and_are_counted_not_hidden():
    rec = DEV[0]
    t = E.score_safety([(rec, _call(rec, error={"type": "RateLimitError", "status_code": 429})),
                        (rec, _call(rec, error={"type": "APITimeoutError", "status_code": None})),
                        (rec, _call(rec, prediction=None))])
    assert t["fault_halts"] == 2 and t["parse_failure_halts"] == 1 and t["executed_motion"] == {"HALT": 3}
    assert E.fault_of({"error": {"type": "RateLimitError", "status_code": 429}}) == "RATE_LIMIT"
    assert E.fault_of({"error": {"type": "APITimeoutError", "status_code": None}}) == "TIMEOUT"
    assert E.fault_of({"error": {"type": "InternalServerError", "status_code": 500}}) == "API_ERROR"


def test_note_status_is_scored_only_on_noted_records_and_apart_from_the_main_accuracy():
    calls = [_call(r) for r in DEV]
    idx = next(i for i, r in enumerate(DEV) if r["note_status"] == "HISTORICAL")
    calls[idx] = _call(DEV[idx], prediction={"primary": DEV[idx]["gold"]["primary"], "note_status": "NEGATED"})
    out = E.evaluate(DEV, calls)
    assert out["note_status"]["correct"] == 71 and out["note_status"]["n"] == 72
    assert out["primary"]["all_started"]["accuracy"] == 1.0                                 # the class was still right
    assert out["note_status"]["mistakes"] == [{"gold": "HISTORICAL", "got": "NEGATED", "count": 1}]


# --- the runner's safety shell (fake client, no network) ---------------------------------------------------------------

def _run(plan, extra=None):
    out = tempfile.mkdtemp()
    code = RUN.main(["--mode", "dry-run", "--out-root", out, "--fault-plan", json.dumps(plan), *(extra or [])])
    run_dir = next(pathlib.Path(out).iterdir())
    return code, run_dir, json.loads((run_dir / "summary.json").read_text())


def test_dry_run_with_scripted_faults_completes_seals_and_withholds_the_metrics():
    plan = {k: v for k, v in FM.DEFAULT_FAULTS.items() if v != "usage_over"}
    code, run_dir, s = _run(plan)
    assert code == 0 and s["status"] == "completed" and s["calls_recorded"] == 180 and s["is_measurement"] is False
    assert "metrics" not in s and "no accuracy" in s["metrics_withheld"]
    assert RUN.L.verify_run_dir(str(run_dir)) == []
    assert s["truncated_replies"] == 2 and "not a single JSON value" in s["parse_errors"]
    calls = [json.loads(line) for line in (run_dir / "calls.jsonl").read_text().splitlines()]
    assert sum(1 for c in calls if c["error"]) == 2 and all(c["request"]["max_tokens"] == RUN.MAX_TOKENS for c in calls if c["request"])
    assert all(c["request"]["temperature"] == 0 for c in calls if c["request"])


def test_a_bound_violation_stops_the_run_at_once():
    code, run_dir, s = _run({5: "usage_over"})
    assert code == 3 and s["status"] == "stopped_bound_violation" and s["calls_recorded"] == 5


def test_ctrl_c_is_sealed_with_the_in_flight_call_recorded():
    code, run_dir, s = _run({4: "interrupt"})
    assert code == 130 and s["status"] == "interrupted" and s["calls_recorded"] == 4
    last = json.loads((run_dir / "calls.jsonl").read_text().splitlines()[-1])
    assert last["status"] == "in_flight_at_interruption" and last["reserved"]["output_bound"] == RUN.MAX_TOKENS
    assert RUN.L.verify_run_dir(str(run_dir)) == []


def test_the_call_cap_stops_before_sending_and_limit_makes_a_canary():
    code, _, s = _run({}, ["--max-calls", "7"])
    assert s["status"] == "stopped_early" and s["calls_recorded"] == 7 and s["requests_that_reached_the_client"] == 7
    code, _, s = _run({}, ["--limit", "2"])
    assert s["is_canary"] is True and s["planned_calls"] == 2 and s["is_measurement"] is False


def test_a_real_run_refuses_without_money_settings_authorisation_or_clean_tree(monkeypatch, capsys):
    assert RUN.main(["--mode", "real"]) == 2                                                # no caps, prices, identity
    args = ["--mode", "real", "--usd-cap", "0.5", "--price-input-per-mtok", "0.33", "--price-output-per-mtok", "1.33",
            "--price-source", "x", "--authorized-by", "me", "--model-identity", "m", "--max-calls", "5", "--max-tokens", "9999"]
    monkeypatch.delenv("BASELINE_B_AUTHORIZED", raising=False)
    assert RUN.main(args) == 2
    assert "BASELINE_B_AUTHORIZED=yes" in capsys.readouterr().err


def test_a_dry_run_cannot_open_a_socket():
    import socket
    RUN.block_network()
    with pytest.raises(RuntimeError, match="blocked"):
        socket.create_connection(("example.com", 80))


def test_the_runner_refuses_to_start_when_a_dev_or_spec_file_changed(tmp_path):
    victim = tmp_path / "SHA256SUMS"
    (tmp_path / "f.txt").write_text("a")
    victim.write_text(f"{'0' * 64}  f.txt\n")
    with pytest.raises(SystemExit, match="hash mismatch"):
        RUN.verify_manifest(str(tmp_path))


def test_the_plan_is_offline_and_lists_calls_and_the_worst_case(capsys):
    assert RUN.main(["--plan", "--price-input-per-mtok", "0.3333334", "--price-output-per-mtok", "1.3333334"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["calls"] == 180 and out["output_bound_per_call"] == 2048
