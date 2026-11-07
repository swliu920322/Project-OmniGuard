"""The 500 diagnosis: one change per step, the failed request reproduced exactly, the adaptive order, the budget, and nothing switched."""
import json
import pathlib
import sys
import tempfile

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
for sub in ("eval/spec", "eval/baseline_v1/measure", "eval/baseline_b"):
    sys.path.insert(0, str(ROOT / sub))
import diagnose_500 as D  # noqa: E402
import prompt_b as P  # noqa: E402

STEPS = D.build_steps()


def test_each_step_changes_exactly_one_thing_relative_to_the_previous_one():
    expected = [[], ["max_tokens"], ["max_completion_tokens"], ["messages[0] (system) content"], ["messages[1] (user) content"]]
    for prev, cur, want in zip(STEPS, STEPS[1:5], expected[1:]):
        assert D.differences(prev["request"], cur["request"]) == want, cur["step"]
    assert D.differences(STEPS[0]["request"], STEPS[5]["request"]) == []               # step 6 replays step 1 exactly


def test_step_one_is_the_request_that_succeeded_and_step_five_the_one_that_failed_twice():
    a = D._first_request(D.A_RUN)
    assert STEPS[0]["request"] == a and a["max_completion_tokens"] == 20 and a["max_tokens"] == 1024
    for run in D.B_RUNS:
        assert STEPS[4]["request"] == D._first_request(run)                            # both failed canaries sent this very body
    assert STEPS[4]["request"]["messages"][0]["content"] == P.SYSTEM_PROMPT


def test_model_reasoning_mode_prompt_and_client_settings_are_never_changed():
    assert len({json.dumps(s["request"]["model"]) for s in STEPS}) == 1 and STEPS[0]["request"]["temperature"] == 0
    for s in STEPS:
        assert set(s["request"]) <= {"model", "messages", "temperature", "max_tokens", "max_completion_tokens"}   # no thinking / extra_body
    src = (ROOT / "eval/baseline_b/diagnose_500.py").read_text()
    code = src.split('"""', 2)[2]
    for banned in ("extra_body", '"thinking"', "reasoning_effort", "response_format"):
        assert banned not in code
    assert "max_retries=0" in code


def test_the_adaptive_order():
    r = {}
    assert D.next_step(r, 0) == 1
    assert D.next_step({1: False}, 1) is None                                           # step 1 fails: stop, the service is implicated
    assert D.next_step({1: True}, 1) == 2
    for k in (2, 3, 4, 5):
        assert D.next_step({k: False}, k) == 6                                          # a failure skips the rest and goes to the replay
    assert D.next_step({5: True}, 5) == 6 and D.next_step({6: True}, 6) is None and D.next_step({6: False}, 6) is None


def test_worst_case_budget_fits_six_calls_35000_tokens_and_three_cents(capsys):
    assert D.main(["--plan"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["worst_case_tokens_all_six"] <= 35000 and float(out["worst_case_usd_all_six"]) <= 0.03 and out["fits"] is True


def _dry(plan, extra=None):
    out = tempfile.mkdtemp()
    code = D.main(["--mode", "dry-run", "--out-root", out, "--fake-plan", json.dumps(plan), *(extra or [])])
    run = next(pathlib.Path(out).iterdir())
    return code, run, json.loads((run / "summary.json").read_text())


def test_all_six_run_when_nothing_fails_and_the_run_is_sealed_and_not_a_baseline_result():
    code, run, s = _dry({})
    assert code == 0 and s["calls_made"] == 6 and s["steps_skipped"] == [] and s["is_baseline_result"] is False
    assert D.L.verify_run_dir(str(run)) == []


def test_step_one_failing_stops_after_one_call():
    code, run, s = _dry({1: 500})
    assert s["calls_made"] == 1 and s["steps_skipped"] == [2, 3, 4, 5, 6] and s["per_step"]["1"]["ok"] is False


def test_a_failure_in_the_middle_skips_to_the_replay():
    code, run, s = _dry({4: 500})                                                       # call 4 = step 4
    assert s["calls_made"] == 5 and s["steps_skipped"] == [5] and list(s["per_step"]) == ["1", "2", "3", "4", "6"]
    assert s["per_step"]["4"]["ok"] is False and s["per_step"]["6"]["ok"] is True


def test_the_call_cap_and_the_token_cap_stop_before_sending():
    code, run, s = _dry({}, ["--max-calls", "3"])
    assert s["status"] == "stopped_early" and s["calls_made"] == 3
    code, run, s = _dry({}, ["--max-tokens", "3000"])                                    # settles to tiny real usage, then the B-sized step 4 cannot be booked
    assert s["status"] == "stopped_early" and s["calls_made"] == 3 and "token cap" in s["stop_reason"]
    assert s["steps_skipped"] == [4, 5, 6]


def test_a_real_diagnosis_refuses_without_money_settings_authorisation_or_clean_tree(monkeypatch, capsys):
    assert D.main(["--mode", "real"]) == 2
    args = ["--mode", "real", "--usd-cap", "0.03", "--price-input-per-mtok", "0.33", "--price-output-per-mtok", "1.33", "--price-source", "x",
            "--authorized-by", "me", "--model-identity", "m", "--max-calls", "6", "--max-tokens", "35000"]
    monkeypatch.delenv("BASELINE_B_DIAG_AUTHORIZED", raising=False)
    assert D.main(args) == 2
    assert "BASELINE_B_DIAG_AUTHORIZED=yes" in capsys.readouterr().err


def test_dry_run_blocks_sockets():
    import socket
    D.RUN.block_network()
    with pytest.raises(RuntimeError, match="blocked"):
        socket.create_connection(("example.com", 80))


def test_the_difference_table_is_built_from_the_recorded_runs():
    t = D.difference_table()
    for needle in ("max_completion_tokens | 20 | <absent>", "max_tokens | 1024 | 2048", "2.41.1", "api.deepseek.com"):
        assert needle in t


def test_ctrl_c_in_flight_is_recorded_with_its_reservation_and_sealed():
    code, run, s = _dry({3: "interrupt"})
    assert code == 130 and s["status"] == "interrupted" and s["in_flight_step"] == 3
    assert s["calls_made"] == 3 and s["budget"]["calls_started"] == 3 and s["steps_skipped"] == [4, 5, 6]
    last = json.loads((run / "calls.jsonl").read_text().splitlines()[-1])
    assert last["status"] == "in_flight_at_interruption" and last["step"] == 3 and last["request"] == STEPS[2]["request"]
    assert last["reserved"]["output_bound"] == STEPS[2]["request"]["max_tokens"] and last["error"]["type"] == "KeyboardInterrupt"
    assert last["response_full"] is None and last["result"]["ok"] is False
    assert s["per_step"]["3"]["status"] == "in_flight_at_interruption"
    # the in-flight reservation stays booked: usage unknown is never free (steps 1 and 2 settle to tiny real usage)
    assert s["budget"]["tokens_committed"] >= 2 * 160 + sum(last["reserved"][k] for k in ("input_bound", "output_bound"))
    assert D.L.verify_run_dir(str(run)) == []


def test_sigterm_in_flight_is_handled_like_ctrl_c():
    code, run, s = _dry({2: "sigterm"})
    assert code == 130 and s["status"] == "interrupted" and s["in_flight_step"] == 2 and s["calls_made"] == 2
    assert D.L.verify_run_dir(str(run)) == []


def test_an_interruption_between_requests_leaves_no_phantom_in_flight_record():
    code, run, s = _dry({})
    assert s["in_flight_step"] is None and all("status" not in r for r in s["per_step"].values())


def test_the_difference_table_does_not_claim_a_recorded_sdk_version_for_the_b_runs():
    t = D.difference_table()
    assert "NOT recorded in the B runs" in t and "an inference, not a record" in t
