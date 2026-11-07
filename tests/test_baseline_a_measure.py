"""Offline tests for the baseline-A measurement harness (eval/baseline_v1/measure).

Nothing here calls a model or opens a network connection. The runner imports the ORIGINAL code
(tag eval-baseline-v1) under module names that clash with the current code, so every test that
runs it does so in a subprocess.
"""
import importlib.util
import json
import os
import subprocess
import sys
from decimal import Decimal

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEASURE = os.path.join(ROOT, "eval", "baseline_v1", "measure")
ORIGINAL = os.path.join(ROOT, "eval", "baseline_v1", "original", "src", "cloud-orchestrator", "embodied_brain")
RUNNER = os.path.join(MEASURE, "run_baseline_a.py")


def _load(name):
    sys.path.insert(0, MEASURE)
    spec = importlib.util.spec_from_file_location(name, os.path.join(MEASURE, f"{name}.py"))
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module  # dataclasses look the module up by name
    spec.loader.exec_module(module)
    return module


L = _load("measure_lib")
FAKE = _load("fake_client")
RUN = _load("run_baseline_a")

ROW = {
    "scenario_id": "0", "type": "critical", "expected_label": "CRITICAL_OBSTACLE", "obstacle": "6",
    "velocity": "1.98", "battery": "39.6", "hp": "58", "temperature": "39.7", "x": "67.7", "gate_decision": "SKIP",
}


def run_cli(tmp_path, *extra, env_extra=None):
    env = {"PATH": os.environ.get("PATH", ""), "HOME": str(tmp_path), "PYTHONDONTWRITEBYTECODE": "1"}
    env.update(env_extra or {})
    out = tmp_path / "out"
    proc = subprocess.run(
        [sys.executable, RUNNER, "--source", "archive", "--out-root", str(out), *extra],
        capture_output=True, text=True, env=env, timeout=180,
    )
    runs = sorted(out.glob("*")) if out.exists() else []
    return proc, runs


def read_run(run_dir):
    records = [json.loads(line) for line in open(run_dir / "calls.jsonl", encoding="utf-8")]
    summary = json.load(open(run_dir / "summary.json", encoding="utf-8"))
    config = json.load(open(run_dir / "config.json", encoding="utf-8"))
    return records, summary, config


# ---------------------------------------------------------------- inputs follow the original call sites
def test_input_templates_match_the_archived_source():
    bench = open(os.path.join(ORIGINAL, "benchmark.py"), encoding="utf-8").read()
    brain = open(os.path.join(ORIGINAL, "brain.py"), encoding="utf-8").read()
    for fragment in ('f"Telemetry: Distance: {obstacle}cm, "', 'f"Velocity: {velocity}m/s, HP: {hp}, "', 'f"Battery: {battery}%, Temp: {temperature}C."'):
        assert fragment in bench
    assert (
        'router_input = f"Telemetry: Distance: {obstacle}cm, X: {current_x}, Velocity: {velocity}m/s, '
        'HP: {hp}, Battery: {battery}%, Temp: {temperature}C, Device: {device_id}."'
    ) in brain
    # the business path casts to int, the benchmark path does not
    for cast in ('hp = int(req_body.get("hp", 100))', 'battery = int(req_body.get("battery", 100))', 'temperature = int(req_body.get("temperature", 40))'):
        assert cast in brain


def test_build_input_formats():
    assert L.build_input("B", ROW) == "Telemetry: Distance: 6cm, Velocity: 1.98m/s, HP: 58, Battery: 39.6%, Temp: 39.7C."
    assert L.build_input("P", ROW) == (
        "Telemetry: Distance: 6cm, X: 67.7, Velocity: 1.98m/s, HP: 58, Battery: 39%, Temp: 39C, Device: Simulated-Device."
    )
    with pytest.raises(ValueError):
        L.build_input("X", ROW)


# ---------------------------------------------------------------- interleaving
def test_plan_order_interleaves_and_alternates_who_goes_first():
    plan = L.plan_order(4)
    assert [p[0] for p in plan] == list(range(8))
    assert [(p[1], p[2]) for p in plan] == [(0, "B"), (0, "P"), (1, "P"), (1, "B"), (2, "B"), (2, "P"), (3, "P"), (3, "B")]
    # never a run of the same condition longer than two calls
    conds = [p[2] for p in plan]
    assert all(not (conds[i] == conds[i + 1] == conds[i + 2]) for i in range(len(conds) - 2))


# ---------------------------------------------------------------- budget is checked before sending
def pricing(inp="1", out="1"):
    return L.Pricing(Decimal(inp), Decimal(out), "test")


def guard(max_calls=100, max_tokens=10_000, max_usd="100", **kw):
    return L.BudgetGuard(max_calls, max_tokens, Decimal(max_usd), kw.get("pricing", pricing()))


@pytest.mark.parametrize("good", ["1", "0.5", "  2.50 ", "0.0001"])
def test_parse_usd_accepts_positive_amounts(good):
    assert L.parse_usd(good) > 0


@pytest.mark.parametrize("bad", ["", "abc", "0", "-1", "nan", "inf", "-inf", "1e999999", "1000.01", "1e400", None])
def test_parse_usd_rejects_everything_else(bad):
    with pytest.raises(ValueError):
        L.parse_usd(bad)


def test_input_bound_is_the_byte_count_plus_the_template_allowance():
    assert L.input_token_upper_bound("a" * 100, "b" * 50) == 150 + L.CHAT_OVERHEAD_TOKENS
    # a multi-byte character can never be counted as fewer tokens than it has bytes... in the worst case
    assert L.input_token_upper_bound("你好", "") == 6 + L.CHAT_OVERHEAD_TOKENS
    assert L.input_token_upper_bound("", "") == L.CHAT_OVERHEAD_TOKENS


def test_call_cap_stops_before_sending():
    g = guard(max_calls=2)
    for _ in range(2):
        g.settle(g.reserve(10, 5), {"prompt_tokens": 8, "completion_tokens": 2})
    with pytest.raises(L.BudgetExceeded, match="call cap"):
        g.reserve(10, 5)
    assert g.calls_started == 2  # the refused call was not counted as started


def test_token_cap_counts_the_worst_case_of_the_next_call():
    g = guard(max_tokens=100)
    g.settle(g.reserve(40, 10), {"prompt_tokens": 30, "completion_tokens": 5})  # settled down to 35
    assert g.tokens_committed == 35
    g.reserve(40, 10)  # 35 + 50 = 85 <= 100, now reserved and not yet settled
    with pytest.raises(L.BudgetExceeded, match="token cap"):
        g.reserve(40, 10)  # 85 + 50 > 100


def test_usd_cap_refuses_a_call_that_could_not_be_afforded_and_sends_nothing():
    g = guard(max_usd="0.0001", pricing=pricing("1000", "1000"))  # US$1000 per million tokens: 530 tokens = US$0.53
    with pytest.raises(L.BudgetExceeded, match="usd cap"):
        g.reserve(500, 20)
    assert g.calls_started == 0 and g.usd_committed == 0


def test_usd_cap_accumulates_across_calls():
    g = guard(max_usd="0.01", pricing=pricing("10", "10"))  # US$10 per million: 100 tokens = US$0.001
    sent = 0
    with pytest.raises(L.BudgetExceeded, match="usd cap"):
        while True:
            resv = g.reserve(80, 20)  # worst case US$0.001
            g.settle(resv, {"prompt_tokens": 80, "completion_tokens": 20})  # uses all of it
            sent += 1
    assert sent == 10 and g.usd_committed <= Decimal("0.01")


def test_actual_usage_above_the_reservation_is_booked_and_stops_the_run():
    """The reviewer's reproduction: cap 100, reserve 90, the API reports 120."""
    g = guard(max_tokens=100)
    resv = g.reserve(70, 20)  # 90 tokens
    with pytest.raises(L.BoundViolation):
        g.settle(resv, {"prompt_tokens": 100, "completion_tokens": 20})  # 120
    assert g.tokens_committed == 120  # the overrun is on the books as it really was


def test_completion_above_its_bound_is_a_violation_too():
    g = guard()
    resv = g.reserve(50, 20)
    with pytest.raises(L.BoundViolation):
        g.settle(resv, {"prompt_tokens": 10, "completion_tokens": 21})


@pytest.mark.parametrize("usage", [None, {}, {"total_tokens": 30}, {"prompt_tokens": 10}])
def test_unknown_usage_keeps_the_full_reservation(usage):
    g = guard()
    resv = g.reserve(50, 20)
    before = (g.tokens_committed, g.usd_committed)
    g.settle(resv, usage)
    assert (g.tokens_committed, g.usd_committed) == before == (70, resv.usd)


# ---------------------------------------------------------------- scoring keeps failures in the denominator
def test_summary_counts_failures_and_invalid_replies_as_wrong():
    rows = [
        {**ROW, "expected_label": "NORMAL_NAV", "obstacle": "300", "gate_decision": "PASS"},
        {**ROW, "expected_label": "CRITICAL_OBSTACLE", "obstacle": "40", "gate_decision": "SKIP"},
        {**ROW, "expected_label": "SENSOR_ERROR", "obstacle": "100", "gate_decision": "HALT"},
    ]

    def rec(i, label, error=None, model="m"):
        return {"row_index": i, "condition": "B", "parsed_label": label, "reply": label, "error": error,
                "response_model": model, "usage": {"total_tokens": 10}}

    records = [
        rec(0, "NORMAL_NAV"),  # right
        rec(1, "THE ANSWER IS CRITICAL_OBSTACLE"),  # invalid label
        rec(2, None, error={"type": "RateLimitError"}),  # failed call on a row the gate would stop
    ]
    s = L.summarize(records, rows)["conditions"]["B"]
    assert s["all_rows_started"] == {"n": 3, "correct": 1, "failed_calls": 1, "invalid_replies": 1, "accuracy": 0.3333}
    assert s["rows_reaching_router"]["n"] == 2 and s["rows_reaching_router"]["correct"] == 1
    assert s["confusion_legacy_gold_x_outcome"]["SENSOR_ERROR"] == {"ERROR": 1}
    assert L.summarize(records, rows)["legacy_label_rows_critical_at_or_above_30cm"] == 1


def _truncated_record(row_index=0, finish="length", reply="NORMAL_NAV", truncated=True, error=None):
    return {"row_index": row_index, "condition": "B", "reply": reply, "parsed_label": L.parse_label(reply),
            "finish_reason": finish, "truncated": truncated, "error": error, "response_model": "m",
            "usage": {"prompt_tokens": 10, "completion_tokens": 1024, "total_tokens": 1034}}


def test_a_truncated_reply_with_a_valid_label_scores_invalid():
    """The reviewer's counter-example: the text is the right label, but the reply was cut off."""
    rows = [{**ROW, "expected_label": "NORMAL_NAV", "obstacle": "300", "gate_decision": "PASS"}]
    record = _truncated_record()
    s = L.summarize([record], rows)["conditions"]["B"]
    part = s["all_rows_started"]
    assert (part["correct"], part["invalid_replies"], part["accuracy"]) == (0, 1, 0.0)
    assert s["confusion_legacy_gold_x_outcome"] == {"NORMAL_NAV": {"INVALID": 1}}
    assert s["truncated_replies"] == 1 and s["finish_reasons"] == {"length": 1}
    assert s["rows_reaching_router"]["correct"] == 0
    # the raw evidence is untouched by scoring
    assert record["reply"] == "NORMAL_NAV" and record["parsed_label"] == "NORMAL_NAV" and record["usage"]["completion_tokens"] == 1024


@pytest.mark.parametrize("finish", ["length", "content_filter", "tool_calls"])
def test_only_a_normal_finish_can_score_correct(finish):
    rows = [{**ROW, "expected_label": "NORMAL_NAV", "obstacle": "300", "gate_decision": "PASS"}]
    normal = L.summarize([_truncated_record(finish="stop", truncated=False)], rows)["conditions"]["B"]["all_rows_started"]
    cut = L.summarize([_truncated_record(finish=finish, truncated=False)], rows)["conditions"]["B"]["all_rows_started"]
    assert normal["correct"] == 1 and normal["invalid_replies"] == 0
    assert cut["correct"] == 0 and cut["invalid_replies"] == 1


def test_a_failed_call_is_still_an_error_not_invalid():
    rows = [{**ROW, "expected_label": "NORMAL_NAV", "obstacle": "300", "gate_decision": "PASS"}]
    record = _truncated_record(reply=None, finish=None, truncated=False, error={"type": "RateLimitError"})
    s = L.summarize([record], rows)["conditions"]["B"]
    assert s["all_rows_started"]["failed_calls"] == 1 and s["all_rows_started"]["invalid_replies"] == 0
    assert s["confusion_legacy_gold_x_outcome"] == {"NORMAL_NAV": {"ERROR": 1}}


def test_model_drift_is_flagged():
    rows = [{**ROW, "gate_decision": "PASS"}]
    records = [
        {"row_index": 0, "condition": "B", "parsed_label": "NORMAL_NAV", "error": None, "response_model": "a", "usage": None},
        {"row_index": 0, "condition": "P", "parsed_label": "NORMAL_NAV", "error": None, "response_model": "b", "usage": None},
    ]
    s = L.summarize(records, rows)
    assert s["model_drift_flag"] and s["distinct_response_models"] == ["a", "b"]


# ---------------------------------------------------------------- run directory
def test_run_dir_is_new_and_hashes_detect_tampering(tmp_path):
    a, b = L.make_run_dir(str(tmp_path), "dry-run"), L.make_run_dir(str(tmp_path), "dry-run")
    assert a != b and os.path.isdir(a) and os.path.isdir(b)
    open(os.path.join(a, "calls.jsonl"), "w").write("x\n")
    L.write_sha256sums(a)
    assert L.verify_run_dir(a) == []
    open(os.path.join(a, "calls.jsonl"), "a").write("tampered\n")
    open(os.path.join(a, "extra.txt"), "w").write("new\n")
    problems = L.verify_run_dir(a)
    assert "hash mismatch: calls.jsonl" in problems and "not listed: extra.txt" in problems


# ---------------------------------------------------------------- recording client and safety rails
def test_recording_client_keeps_the_full_response_and_the_error():
    fake = FAKE.FakeClient(faults={2: "rate_limit"}).with_options(max_retries=0)
    client = RUN.RecordingClient(fake)
    msgs = [{"role": "system", "content": "s"}, {"role": "user", "content": "Telemetry: Distance: 6cm"}]
    client._create(model="m", messages=msgs, max_completion_tokens=20, temperature=0.0)
    ok = client.capture
    assert ok["response"]["choices"][0]["message"]["content"] and ok["response"]["usage"] and ok["headers"]["x-request-id"]
    with pytest.raises(FAKE.RateLimitError):
        client._create(model="m", messages=msgs, max_completion_tokens=20, temperature=0.0)
    assert client.capture["error"]["type"] == "RateLimitError" and client.capture["error"]["status_code"] == 429
    assert fake.requests_received == 2 and client.requests_made == 2  # one attempt each, nothing retried


def test_installed_sdk_supports_the_options_the_harness_relies_on():
    """Uses the real OpenAI SDK class but sends nothing: the point is only that the API we call exists."""
    openai = pytest.importorskip("openai")
    client = openai.OpenAI(api_key="not-a-real-key", base_url="http://127.0.0.1:9/v1")
    assert client.max_retries == 2  # the SDK default is the silent retry we have to switch off
    limited = client.with_options(max_retries=0, timeout=L.SDK_TIMEOUT_S)
    assert limited.max_retries == 0 and limited.timeout == L.SDK_TIMEOUT_S
    assert hasattr(limited.chat.completions, "with_raw_response")


def test_downlink_sentinel_raises():
    with pytest.raises(RuntimeError, match="forbidden"):
        RUN.forbidden_downlink("Robo-A1", "[]")


def test_dry_run_blocks_the_network(tmp_path):
    code = (
        "import sys; sys.path.insert(0, %r); import run_baseline_a as R, socket; R.block_network()\n"
        "try:\n    socket.create_connection(('example.com', 80), timeout=1)\n    print('CONNECTED')\n"
        "except RuntimeError as e:\n    print('BLOCKED')\n"
    ) % MEASURE
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=60)
    assert out.stdout.strip() == "BLOCKED"


# ---------------------------------------------------------------- end to end, offline
def test_dry_run_end_to_end(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "30")
    assert proc.returncode == 0, proc.stderr
    assert len(runs) == 1
    records, summary, config = read_run(runs[0])
    assert len(records) == 60 and summary["planned_calls"] == 60
    # the client saw exactly as many requests as were recorded: nothing was retried or skipped
    assert summary["requests_that_reached_the_client"] == 60
    assert all(r["attempt"] == 1 for r in records)
    # the scripted faults are recorded, not dropped
    failed = [r for r in records if r["error"]]
    assert {r["error"]["type"] for r in failed} == {"RateLimitError", "APITimeoutError"}
    assert any(r["parsed_label"] and r["parsed_label"] not in L.ALLOWED_LABELS for r in records)  # malformed reply kept
    assert summary["conditions"]["B"]["all_rows_started"]["failed_calls"] + summary["conditions"]["P"]["all_rows_started"]["failed_calls"] == len(failed)
    # settings and provenance
    assert config["request_settings"]["sdk_max_retries"] == 0 and config["request_settings"]["ask_agent_cache_ttl_s"] == 0
    assert config["mode"] == "dry-run" and config["is_measurement"] is False and summary["is_measurement"] is False
    # a rehearsal publishes no accuracy at all
    assert "accuracy_withheld" in summary
    assert all(part["accuracy"] is None for c in summary["conditions"].values() for part in (c["all_rows_started"], c["rows_reaching_router"]))
    assert "withheld" in (runs[0] / "report.md").read_text(encoding="utf-8")
    assert config["tag"] == "eval-baseline-v1" and config["baseline_commit"].startswith("a58b125")
    assert "api_key" not in json.dumps(config).lower().replace("api_key_present", "")
    # full responses and interleaving
    assert all(r["response_full"] for r in records if not r["error"])
    assert [r["condition"] for r in records[:4]] == ["B", "P", "P", "B"]
    # 60 requests are fewer than the 330 after which the fake switches model: no drift here
    # (the full rehearsal, 400 requests, does cross it and must raise the flag)
    assert summary["model_drift_flag"] is False and summary["distinct_response_models"] == ["fake-model-1"]
    assert L.verify_run_dir(str(runs[0])) == []


def test_dry_run_stops_before_the_call_cap(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "10", "--max-calls", "5")
    assert proc.returncode == 0, proc.stderr
    records, summary, _ = read_run(runs[0])
    assert len(records) == 5 and summary["requests_that_reached_the_client"] == 5
    assert summary["status"] == "stopped_early" and "call cap" in summary["stop_reason"]


def test_dry_run_stops_before_the_token_cap(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "10", "--max-tokens", "3000")  # settled usage accumulates until a worst case (about 1500) no longer fits
    assert proc.returncode == 0, proc.stderr
    records, summary, _ = read_run(runs[0])
    assert 0 < len(records) < 20 and "token cap" in summary["stop_reason"]
    assert summary["requests_that_reached_the_client"] == len(records)


def test_a_cap_smaller_than_one_call_sends_nothing(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "4", "--max-tokens", "100")
    records, summary, _ = read_run(runs[0])
    assert records == [] and summary["requests_that_reached_the_client"] == 0 and "token cap" in summary["stop_reason"]


def test_full_rehearsal_crosses_the_model_switch_and_raises_the_drift_flag(tmp_path):
    proc, runs = run_cli(tmp_path)
    assert proc.returncode == 0, proc.stderr
    records, summary, _ = read_run(runs[0])
    assert len(records) == 400 and summary["status"] == "completed"
    assert summary["model_drift_flag"] is True and summary["distinct_response_models"] == ["fake-model-1", "fake-model-1-b"]
    assert summary["requests_that_reached_the_client"] == 400
    assert summary["budget"]["calls_started"] == 400 <= summary["budget"]["max_calls"]
    assert summary["budget"]["tokens_committed"] <= summary["budget"]["max_tokens"]


def test_two_runs_never_share_a_directory(tmp_path):
    _, first = run_cli(tmp_path, "--limit", "4")
    _, second = run_cli(tmp_path, "--limit", "4")
    assert len(second) == 2 and first[0] in second


REAL_FLAGS = ["--mode", "real", "--authorized-by", "x", "--model-identity", "test-model", "--usd-cap", "1", "--max-calls", "4", "--max-tokens", "1000",
              "--price-input-per-mtok", "0.3", "--price-output-per-mtok", "1.2", "--price-source", "test"]


def without(flags, name):
    i = flags.index(name)
    return flags[:i] + flags[i + 2:]


@pytest.mark.parametrize(
    "extra,env_extra",
    [
        (["--mode", "real"], {}),  # no authorisation at all
        (REAL_FLAGS, {}),  # everything given, but no environment switch
        (without(REAL_FLAGS, "--usd-cap"), {"BASELINE_A_AUTHORIZED": "yes"}),  # no dollar cap
        (without(REAL_FLAGS, "--price-source"), {"BASELINE_A_AUTHORIZED": "yes"}),
        (without(REAL_FLAGS, "--model-identity"), {"BASELINE_A_AUTHORIZED": "yes"}),  # the version must be stated
        (without(REAL_FLAGS, "--price-output-per-mtok"), {"BASELINE_A_AUTHORIZED": "yes"}),
        (["--mode", "real", *without(REAL_FLAGS[2:], "--usd-cap"), "--usd-cap", "-1"], {"BASELINE_A_AUTHORIZED": "yes"}),
        (["--mode", "real", *without(REAL_FLAGS[2:], "--usd-cap"), "--usd-cap", "abc"], {"BASELINE_A_AUTHORIZED": "yes"}),
        (["--mode", "dry-run", "--usd-cap", "0"], {}),
        (["--mode", "dry-run", "--price-input-per-mtok", "nan"], {}),
        (["--mode", "dry-run"], {"IotHubServiceConnectionString": "HostName=x"}),  # could reach a device
        (["--mode", "dry-run"], {"COSMOS_KEY": "k"}),
    ],
)
def test_refusals_happen_before_any_output_or_network(tmp_path, extra, env_extra):
    proc, runs = run_cli(tmp_path, *extra, env_extra=env_extra)
    assert proc.returncode == 2 and runs == []


# ---------------------------------------------------------------- money, end to end
def test_a_dollar_cap_below_one_call_sends_nothing(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "4", "--usd-cap", "0.000001")
    records, summary, config = read_run(runs[0])
    assert proc.returncode == 0 and records == []
    assert summary["requests_that_reached_the_client"] == 0 and "usd cap" in summary["stop_reason"]
    assert config["budget"]["max_usd"] == "0.000001" and config["budget"]["pricing"]["source"].startswith("REHEARSAL")


def test_the_dollar_cap_stops_a_run_part_way(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "40", "--usd-cap", "0.2", "--price-input-per-mtok", "100", "--price-output-per-mtok", "100")
    records, summary, _ = read_run(runs[0])
    assert proc.returncode == 0 and 0 < len(records) < 80 and "usd cap" in summary["stop_reason"]
    assert Decimal(summary["budget"]["usd_committed"]) <= Decimal("0.2")
    assert summary["requests_that_reached_the_client"] == len(records)


# ---------------------------------------------------------------- a wrong bound stops the run
@pytest.mark.parametrize("fault", ["usage_over", "long_reply"])
def test_a_usage_bound_violation_stops_at_once_and_is_flagged(tmp_path, fault):
    proc, runs = run_cli(tmp_path, "--limit", "20", "--fault-plan", json.dumps({"3": fault}))
    records, summary, _ = read_run(runs[0])
    assert proc.returncode == 3
    assert summary["status"] == "stopped_bound_violation" and "bound violated" in summary["stop_reason"]
    assert len(records) == 3 and summary["requests_that_reached_the_client"] == 3  # nothing was sent after it
    assert summary["is_measurement"] is False
    assert L.verify_run_dir(str(runs[0])) == []


def test_missing_usage_is_recorded_and_keeps_its_budget(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "6", "--fault-plan", json.dumps({"2": "no_usage", "4": "timeout"}))
    records, summary, _ = read_run(runs[0])
    assert proc.returncode == 0 and len(records) == 12
    assert summary["calls_without_usable_usage"] == 2
    assert Decimal(summary["budget"]["usd_committed"]) > Decimal(summary["usd_from_reported_usage"])  # the two unknowns stay booked


# ---------------------------------------------------------------- the reasoning-model finding
def test_every_request_carries_the_spending_guard_and_says_so(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "6")
    records, summary, config = read_run(runs[0])
    ok = [r for r in records if r["request"]]
    assert ok and all(r["request"]["max_tokens"] == L.SAFETY_MAX_TOKENS == 1024 for r in ok)
    assert all(r["request"]["max_completion_tokens"] == 20 for r in ok)  # the original parameter is still sent
    assert all(r["request_deviation"] == {"added": {"max_tokens": 1024}} for r in ok)
    assert config["request_settings"]["max_tokens_spending_guard"] == 1024 and config["budget"]["output_token_bound"] == 1024


def test_reasoning_tokens_are_recorded_and_do_not_break_the_bound(tmp_path):
    """The fake, like the real model, ignores max_completion_tokens=20: 60+ completion tokens must be normal."""
    proc, runs = run_cli(tmp_path, "--limit", "10", "--fault-plan", "none")
    records, summary, _ = read_run(runs[0])
    assert proc.returncode == 0 and summary["status"] == "completed"
    assert all(r["usage"]["completion_tokens"] > 20 for r in records)
    assert all(r["reasoning_tokens"] and r["reasoning_tokens"] <= r["usage"]["completion_tokens"] for r in records)
    assert summary["reasoning_tokens_reported"] == sum(r["reasoning_tokens"] for r in records) > 0


def test_a_reply_cut_off_by_the_guard_is_kept_and_counted_wrong(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "10", "--fault-plan", json.dumps({"3": "truncate"}))
    records, summary, _ = read_run(runs[0])
    cut = [r for r in records if r["truncated"]]
    assert proc.returncode == 0 and len(cut) == 1 and len(records) == 20
    assert cut[0]["finish_reason"] == "length" and cut[0]["reply"] == "" and cut[0]["usage"]["completion_tokens"] == 1024
    assert summary["truncated_replies"] == 1
    cond = summary["conditions"][cut[0]["condition"]]
    assert cond["truncated_replies"] == 1 and cond["all_rows_started"]["invalid_replies"] >= 1  # in the denominator, wrong


def test_a_cut_off_reply_that_still_names_a_label_is_invalid_end_to_end(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "10", "--fault-plan", json.dumps({"3": "truncate_label"}))
    records, summary, _ = read_run(runs[0])
    cut = [r for r in records if r["truncated"]]
    assert proc.returncode == 0 and len(cut) == 1
    assert cut[0]["finish_reason"] == "length" and cut[0]["parsed_label"] in L.ALLOWED_LABELS  # a valid label, but cut off
    entry = summary["conditions"][cut[0]["condition"]]
    assert entry["truncated_replies"] == 1 and entry["all_rows_started"]["invalid_replies"] >= 1


def test_the_model_version_is_the_owners_statement_not_the_alias(tmp_path):
    proc, runs = run_cli(tmp_path, "--limit", "4", "--model-identity", "DeepSeek-V4.1-Flash-1017")
    _, summary, config = read_run(runs[0])
    assert config["model"]["identity_stated_by_owner"] == "DeepSeek-V4.1-Flash-1017"
    assert "alias" in config["model"]["identity_note"] and summary["model_identity_stated_by_owner"] == "DeepSeek-V4.1-Flash-1017"
    assert summary["distinct_response_models"] == ["fake-model-1"]  # what the API says is only an alias


# ---------------------------------------------------------------- an interruption keeps the evidence
@pytest.mark.parametrize("fault,code", [("interrupt", 130), ("sigterm", 130)])
def test_an_interruption_is_sealed_with_the_request_that_was_in_flight(tmp_path, fault, code):
    proc, runs = run_cli(tmp_path, "--limit", "20", "--fault-plan", json.dumps({"5": fault}))
    assert proc.returncode == code, proc.stderr
    records, summary, config = read_run(runs[0])
    assert summary["status"] == "interrupted" and summary["interruption"]["type"] == "KeyboardInterrupt"
    assert len(records) == 5 and records[-1]["status"] == "in_flight_at_interruption"
    assert records[-1]["error"]["type"] == "KeyboardInterrupt" and records[-1]["reserved"]["input_bound"] > 0
    assert summary["in_flight_at_interruption"] == records[-1]["seq"] == 4
    # the four finished calls were settled to real usage; the fifth keeps its whole reservation
    finished = sum(r["usage"]["total_tokens"] for r in records[:4])
    assert summary["budget"]["tokens_committed"] == finished + records[-1]["reserved"]["input_bound"] + records[-1]["reserved"]["output_bound"]
    assert summary["budget"]["calls_started"] == 5 and summary["is_measurement"] is False
    assert (runs[0] / "report.md").exists() and L.verify_run_dir(str(runs[0])) == []


def test_verify_cli_detects_tampering(tmp_path):
    _, runs = run_cli(tmp_path, "--limit", "4")
    ok = subprocess.run([sys.executable, RUNNER, "--verify", str(runs[0])], capture_output=True, text=True)
    assert ok.returncode == 0 and ok.stdout.strip() == "OK"
    open(runs[0] / "summary.json", "a").write(" ")
    bad = subprocess.run([sys.executable, RUNNER, "--verify", str(runs[0])], capture_output=True, text=True)
    assert bad.returncode == 1 and "hash mismatch: summary.json" in bad.stdout
