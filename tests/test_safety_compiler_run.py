"""run_safety_compiler.py: the real extended flow with a scripted client. No network, no key; the real mode is only checked to refuse."""
import argparse
import importlib.util
import json
import pathlib
from decimal import Decimal

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("run_safety_compiler", ROOT / "eval/safety_compiler/run_safety_compiler.py")
SC = importlib.util.module_from_spec(spec)
spec.loader.exec_module(SC)


@pytest.fixture(scope="module")
def inputs():
    records, replay = SC.load_inputs()
    return records, replay, SC.select_records(records, replay)


def run(inputs, inner, limit=2, max_calls=180):
    records, replay, chosen = inputs
    guard = SC.L.BudgetGuard(max_calls, 250_000, Decimal("0.10"), SC.PRICING)
    return SC.run_records(chosen, inner, guard, replay, limit) + (guard,)


def test_84_records_reach_safety_and_the_worst_case_fits_the_confirmed_caps(inputs):
    records, replay, chosen = inputs
    assert len(chosen) == 84
    results, log, state, guard = run(inputs, SC.ScriptedSDK(), limit=None)
    assert len(log) == 168 and state["stop"] is None
    assert state["worst_case_tokens"] < SC.AUTH["max_tokens"] and state["worst_case_usd"] < SC.AUTH["max_usd"] and len(log) <= SC.AUTH["max_calls"]


def test_a_clean_pass_makes_one_safety_and_one_compiler_request_per_record(inputs):
    results, log, state, guard = run(inputs, SC.ScriptedSDK())
    assert [e["role"] for e in log] == ["Safety", "Compiler", "Safety", "Compiler"]
    assert all(r["safety"] == "PASS" and r["compiler"] == "COMPILED" and r["final"] == "move" for r in results)
    assert all(e["output_bound"] in (50, 100) for e in log)


def test_an_empty_safety_reply_is_a_bad_reply_stop_and_the_compiler_is_not_asked(inputs):
    results, log, state, guard = run(inputs, SC.ScriptedSDK(safety=""))
    assert all(r["final"] == "stop" and r["halt_reasons"] == ["BAD_REPLY"] and r["requests"] == 1 and r["safety"] == "FAULT" and r["compiler"] == "SHORT_CIRCUIT" for r in results)


def test_a_safety_block_and_a_bad_compiler_output_are_stops(inputs):
    block = run(inputs, SC.ScriptedSDK(safety="BLOCK: test"))[0]
    assert all(r["final"] == "stop" and r["safety"] == "BLOCKED" and r["compiler"] == "SHORT_CIRCUIT" and r["requests"] == 1 for r in block)
    bad = run(inputs, SC.ScriptedSDK(compiler="not json"))[0]
    assert all(r["final"] == "stop" and r["compiler"] == "REJECTED_BY_CODE" and r["violations"] for r in bad)


def test_a_call_cap_stops_the_run_before_an_unaffordable_record(inputs):
    results, log, state, guard = run(inputs, SC.ScriptedSDK(), limit=None, max_calls=3)
    assert state["stop"].startswith("budget") and len(results) == 1 and guard.calls_started == 2


def test_usage_above_the_reserved_bound_stops_the_run_at_once(inputs):
    results, log, state, guard = run(inputs, SC.ScriptedSDK(completion_tokens=999), limit=None)
    assert state["stop"].startswith("bound violation") and len(results) == 1


def test_a_request_without_an_output_bound_is_never_sent():
    guard = SC.L.BudgetGuard(10, 1000, Decimal("1"), SC.PRICING)
    rec = SC.Recording(SC.ScriptedSDK(), guard, [], {"stop": None, "worst_case_tokens": 0, "worst_case_usd": Decimal(0)})
    with pytest.raises(ValueError):
        rec._create(messages=[{"content": "Safety Firewall"}, {"content": "u"}])
    assert guard.calls_started == 0


def test_dry_run_writes_a_sealed_directory_and_a_report(tmp_path, monkeypatch):
    monkeypatch.setattr(SC, "RUNS", tmp_path)
    assert SC.main(["dry-run", "--limit", "3"]) == 0
    d = next(tmp_path.iterdir())
    assert SC.L.verify_run_dir(str(d)) == []
    summ = json.loads((d / "summary.json").read_text())
    assert summ["requests"] == 6 and summ["status"] == "completed" and summ["health_check"]["passed"] is True
    assert SC.main(["report", "--run-dir", str(d)]) == 0
    assert SC.L.verify_run_dir(str(d)) == [] and "安全性测量" in (d / "REPORT.md").read_text(encoding="utf-8")


def test_the_real_mode_refuses_without_the_environment_and_sends_nothing(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(SC, "RUNS", tmp_path)
    for v in ("OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL_NAME", "SAFETY_COMPILER_AUTHORIZED"):
        monkeypatch.delenv(v, raising=False)
    assert SC.main(["real", "--limit", "2"]) == 2
    err = capsys.readouterr().err
    assert "OPENAI_API_KEY is not set" in err and "SAFETY_COMPILER_AUTHORIZED=yes is required" in err
    assert list(tmp_path.iterdir()) == []


def test_the_real_preflight_refuses_caps_above_the_confirmation_and_a_full_run_without_a_health_run(monkeypatch):
    for v in SC.L.FORBIDDEN_ENV:
        monkeypatch.delenv(v, raising=False)
    args = argparse.Namespace(max_calls=181, max_tokens=250_000, max_usd="0.10", limit=None, after_health=None)
    problems = SC.preflight_real(args)
    assert any("above what the owner confirmed" in p for p in problems) and any("--after-health" in p for p in problems)
    monkeypatch.setenv("COSMOS_KEY", "x")
    assert any("COSMOS_KEY" in p for p in SC.preflight_real(args))


def test_the_preflight_wants_the_files_to_match_the_tag_and_a_health_run_of_the_same_code(monkeypatch, tmp_path):
    monkeypatch.setattr(SC, "latest_tag", lambda: None)
    args = argparse.Namespace(max_calls=180, max_tokens=250_000, max_usd="0.10", limit=None, after_health=str(tmp_path))
    problems = SC.preflight_real(args)
    assert any("no tag eval-safety-compiler" in p for p in problems) and any("health run" in p for p in problems)


def test_latest_picks_the_newest_directory_and_for_health_only_a_passed_sealed_real_run(tmp_path, monkeypatch):
    monkeypatch.setattr(SC, "RUNS", tmp_path)

    def make(name, mode, passed):
        d = tmp_path / name
        d.mkdir()
        (d / "config.json").write_text(json.dumps({"mode": mode}))
        (d / "summary.json").write_text(json.dumps({"health_check": {"passed": passed} if passed is not None else None}))
        SC.L.write_sha256sums(str(d))
        return str(d)
    old = make("20260101T000000Z_real_aaaaaaaa", "real", True)
    make("20260102T000000Z_dry-run_bbbbbbbb", "dry-run", True)
    failed = make("20260103T000000Z_real_cccccccc", "real", False)
    assert SC.resolve_run_dir("latest") == failed
    assert SC.resolve_run_dir("latest", real_health_only=True) == old
    assert SC.resolve_run_dir("some/path") == "some/path"
    (tmp_path / "20260101T000000Z_real_aaaaaaaa" / "summary.json").write_text("{}")  # no longer matches its hash list
    with pytest.raises(SystemExit):
        SC.resolve_run_dir("latest", real_health_only=True)
