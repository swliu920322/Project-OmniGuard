"""Safety and Compiler on the round-2 records, through the real extended flow (embodied_brain.extended.simulate_extended).

The Router is replayed from the sealed round-2 replies (no new Router request); Safety and Compiler are the real code path (bounded_agent.py, one
request each, retries off), with every request counted against hard caps before it is sent. Plan: eval/archive/designs/DESIGN_SAFETY_COMPILER_EVAL.md.

    plan      offline: which records reach Safety, and the worst-case reservation against the authorised caps
    dry-run   the whole flow with a scripted fake client; writes a sealed run directory; no network, no key
    real      only with the owner's authorisation (below); `--limit 2` is the health check, a full run needs `--after-health DIR`
    report    offline: REPORT.md from a sealed run directory

The authorisation is the owner's reply "确认" (2026-11-21) to Claude's proposal of 180 requests, 250,000 tokens and US$0.10 in total, health check
included, no retries. A real run also needs OPENAI_API_KEY, OPENAI_BASE_URL and OPENAI_MODEL_NAME in the environment, SAFETY_COMPILER_AUTHORIZED=yes,
the files it depends on identical to the latest tag `eval-safety-compiler-*` (other commits and uncommitted files do not matter). Nothing is retried, and a cap or bound violation stops the run.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import platform
import statistics
import subprocess
import sys
import time
from collections import Counter
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
for sub in ("src/cloud-orchestrator", "eval/baseline_v1/measure"):
    sys.path.insert(0, str(ROOT / sub))
import measure_lib as L  # noqa: E402

TENANT = "Tenant-Alpha-Extended"
TEST_SET = ROOT / "eval/experiments/note_vs_rules_v2/evidence/data/test_set.jsonl"
ROUTER_REPLIES = ROOT / "eval/experiments/note_vs_rules_v2/evidence/runs/main/20261115T152854Z_main_real_e5fd14c2/calls.jsonl"
RUNS = HERE / "runs"
# The provider does not honour max_completion_tokens (LIMITATIONS items 7 and 25: 80 completion tokens came back for a bound of 50), so the budget reserves this
# worst case per request, the same output bound the Router runs used (router_v2.pipeline.MAX_TOKENS). A request that reports more still stops the run.
BUDGET_OUTPUT_BOUND = 2048
PRICING = L.Pricing(Decimal("0.3333334"), Decimal("1.3333334"), "the conservative DeepSeek Flash rates used in round 2 (see eval/experiments/note_vs_rules_v2/RESULTS.md)")
AUTH = {"max_calls": 180, "max_tokens": 250_000, "max_usd": Decimal("0.10"),
        "owner_words": "确认 (2026-11-21), in reply to the proposal of 180 requests, 250,000 tokens and US$0.10, health check included, no retries"}


def read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


# ---- inputs: the records that reach Safety, with the Router replayed -----------------------------------------------------------------------------
def load_inputs(test_set=TEST_SET, router_replies=ROUTER_REPLIES):
    records = read_jsonl(test_set)
    replay = {c["input"]: c for c in read_jsonl(router_replies)}
    return records, replay


def make_replay_decide(replay, original):
    """decide() with the model call replaced by the sealed round-2 reply for the same rendered input; everything else is the real code."""
    from router_v2 import pipeline as PL, rules as RR

    def decide(rec, note, call_model, estop=False):
        clean = (note or "").strip() or None
        try:
            user = RR.render_telemetry(rec, clean)
        except ValueError:
            return original(rec, note, call_model, estop)
        sealed = replay.get(user)
        if sealed is None:
            raise KeyError("no sealed Router reply for this input")
        return original(rec, note, lambda s, u: PL.ModelReply(content=sealed["reply"], finish_reason=sealed["finish_reason"]), estop)
    return decide


def body_for(rec):
    t = rec["telemetry"]
    return {"tenant_id": TENANT, "obstacle_distance_cm": t["distance_cm"], "velocity": t["velocity_ms"], "hp": t["hp"], "battery": t["battery_pct"],
            "temperature": t["temperature_c"], "operator_note": rec["note"], "target_speed": 50}


def select_records(records, replay):
    """Records whose replayed Router decision does not halt, i.e. the ones the endpoint would send on to Safety."""
    from router_v2 import pipeline as PL
    decide = make_replay_decide(replay, PL.decide)
    out = []
    for rec in records:
        r = {k: rec["telemetry"][k] for k in ("distance_cm", "velocity_ms", "hp", "battery_pct", "temperature_c")}
        res = decide(r, rec["note"], None)
        if res["executed"]["action"]["motion"] != "HALT":
            out.append(rec)
    return out


# ---- the counted client --------------------------------------------------------------------------------------------------------------------------
class Recording:
    """Stands in for the SDK client: reserves against the caps before each request, records usage, and never sends an unbounded request."""

    def __init__(self, inner, guard, log, state):
        self.inner, self.guard, self.log, self.state = inner, guard, log, state
        self.chat = type("Chat", (), {"completions": type("C", (), {"create": staticmethod(self._create)})()})()

    @property
    def max_retries(self):
        return getattr(self.inner, "max_retries", None)

    @property
    def timeout(self):
        return getattr(self.inner, "timeout", None)

    def with_options(self, **o):
        return Recording(self.inner.with_options(**o), self.guard, self.log, self.state)

    def _create(self, **kw):
        system, user = kw["messages"][0]["content"], kw["messages"][1]["content"]
        role = "Safety" if "Safety Firewall" in system else "Compiler" if "Action Compiler" in system else "other"
        bound = kw.get("max_completion_tokens") or kw.get("max_tokens")
        if not isinstance(bound, int) or bound <= 0:
            raise ValueError("a request without an output bound is never sent")
        try:
            resv = self.guard.reserve(L.input_token_upper_bound(system, user), BUDGET_OUTPUT_BOUND)
        except L.BudgetExceeded as exc:
            self.state["stop"] = f"budget: {exc.reason}"
            raise
        self.state["worst_case_tokens"] += resv.tokens
        self.state["worst_case_usd"] += resv.usd
        entry = {"seq": len(self.log) + 1, "role": role, "input_sha256": L.sha256_text(system + "\n" + user), "started_at": L.utc_now(), "output_bound": bound, "reserved_output_bound": BUDGET_OUTPUT_BOUND}
        t0 = time.time()
        try:
            resp = self.inner.chat.completions.create(**kw)
        except Exception as exc:  # noqa: BLE001
            entry.update(error=type(exc).__name__, latency_ms=int((time.time() - t0) * 1000))
            self.log.append(entry)
            self.guard.settle(resv, None)
            raise
        usage = getattr(resp, "usage", None)
        usage = usage.model_dump() if hasattr(usage, "model_dump") else usage
        choice = resp.choices[0]
        entry.update(latency_ms=int((time.time() - t0) * 1000), finish_reason=getattr(choice, "finish_reason", None), reply=choice.message.content,
                     usage=usage, response_model=getattr(resp, "model", None))
        self.log.append(entry)
        try:
            self.guard.settle(resv, usage)
        except L.BoundViolation as exc:
            entry["bound_violation"] = exc.reason
            self.state["stop"] = f"bound violation: {exc.reason}"
            raise
        return resp


class ScriptedSDK:
    """Dry-run stand-in for the provider: Safety passes, Compiler returns a slow move; reports small usage; honours with_options."""

    def __init__(self, safety="PASS", compiler='[{"action":"move","speed":30}]', completion_tokens=8):
        self.safety, self.compiler, self.completion_tokens = safety, compiler, completion_tokens
        self.max_retries, self.timeout = 2, 600.0
        self.chat = type("Chat", (), {"completions": type("C", (), {"create": staticmethod(self._create)})()})()

    def with_options(self, **o):
        self.max_retries, self.timeout = o.get("max_retries", self.max_retries), o.get("timeout", self.timeout)
        return self

    def _create(self, **kw):
        text = self.safety if "Safety Firewall" in kw["messages"][0]["content"] else self.compiler
        usage = type("U", (), {"model_dump": staticmethod(lambda: {"prompt_tokens": 300, "completion_tokens": self.completion_tokens})})()
        msg = type("M", (), {"content": text})()
        return type("R", (), {"choices": [type("Ch", (), {"message": msg, "finish_reason": "stop"})()], "usage": usage, "model": "scripted"})()


# ---- one pass over the records through the real flow ---------------------------------------------------------------------------------------------
def view_of(data):
    trace = {t.get("agent"): t for t in data.get("pipeline_trace", [])}
    fa = data.get("final_action") or [{}]
    return {"safety": (trace.get("Safety") or {}).get("status"), "safety_decision": (trace.get("Safety") or {}).get("decision"),
            "compiler": (trace.get("Action Compiler") or {}).get("status"), "violations": data.get("constraint_violations", []),
            "final": fa[0].get("action"), "halt_reasons": fa[0].get("halt_reasons"), "reason": fa[0].get("reason"),
            "agent_2_latency_ms": (data.get("cloud_metrics") or {}).get("agent_2_latency_ms"), "agent_3_latency_ms": (data.get("cloud_metrics") or {}).get("agent_3_latency_ms")}


def run_records(records, inner, guard, replay, limit=None, results=None, log=None, state=None, on_record=None):
    from embodied_brain import extended as EXT
    from embodied_brain.utils import load_scenario_config
    from router_v2 import pipeline as PL
    logging.getLogger().setLevel(logging.ERROR)  # the flow warns once per record that Cosmos is not used
    config = load_scenario_config(TENANT)
    log = [] if log is None else log
    results = [] if results is None else results
    state = {"stop": None, "worst_case_tokens": 0, "worst_case_usd": Decimal(0)} if state is None else state
    rec_client = Recording(inner, guard, log, state)
    dummy = ScriptedSDK()  # the Router client is built but never used: decide() is replayed
    replay_decide = make_replay_decide(replay, PL.decide)
    with patch("embodied_brain.extended.get_cosmos_container", side_effect=RuntimeError("no Cosmos in this run")), \
            patch("embodied_brain.extended.get_llm_client_and_model", return_value=(dummy, "unused")), \
            patch("embodied_brain.bounded_agent.get_llm_client_and_model", return_value=(rec_client, os.environ.get("OPENAI_MODEL_NAME", "scripted"))), \
            patch("router_v2.decide", replay_decide):
        for rec in records[:limit] if limit else records:
            if state["stop"]:
                break
            if guard.calls_started + 2 > guard.max_calls:
                state["stop"] = "budget: call cap would be exceeded by the next record"
                break
            before = len(log)
            resp = asyncio.run(EXT.simulate_extended(body_for(rec), TENANT, config, time.time()))
            results.append({"id": rec["id"], "family_id": rec.get("family_id"), "language": rec.get("language"), "gold_note_status": rec["note_status"],
                            "requests": len(log) - before, **view_of(json.loads(resp.body))})
            if on_record:
                on_record(results, log)
    if state["stop"] and results and (results[-1]["halt_reasons"] or [None])[0] == "API_ERROR":
        results[-1]["note"] = "ended by the run's own stop, not a provider fault: " + state["stop"]
    return results, log, state


def spent_so_far():
    """What every earlier REAL run in runs/ has used. The owner's caps are one total for all of them, not one per run."""
    spent = {"calls": 0, "tokens": 0, "usd": Decimal(0)}
    for d in sorted(RUNS.iterdir()) if RUNS.is_dir() else []:
        try:
            cfg, b = (json.loads(Path(d, n).read_text(encoding="utf-8")) for n in ("config.json", "summary.json"))
        except (OSError, ValueError):
            continue
        if cfg.get("mode") == "real":
            spent["calls"] += int(b["budget"]["calls_started"])
            spent["tokens"] += int(b["budget"]["tokens_committed"])
            spent["usd"] += Decimal(b["budget"]["usd_committed"])
    return spent


# ---- sealed run directory and summary ------------------------------------------------------------------------------------------------------------
def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True).stdout.strip()


def latest_tag():
    tags = git("tag", "--list", "eval-safety-compiler-*").split()
    return sorted(tags)[-1] if tags else None


def code_hashes():
    files = ["eval/safety_compiler/run_safety_compiler.py", "src/cloud-orchestrator/embodied_brain/bounded_agent.py", "src/cloud-orchestrator/embodied_brain/extended.py",
             "src/cloud-orchestrator/router_v2/pipeline.py", "src/cloud-orchestrator/router_v2/rules.py", "src/cloud-orchestrator/router_v2/prompt.py"]
    return {f: L.sha256_file(str(ROOT / f)) for f in files}


def summarize(results, log, state, guard, planned, health):
    lat = lambda k: [r[k] for r in results if isinstance(r.get(k), int) and r.get(k) > 0]
    pct = lambda xs, q: sorted(xs)[min(len(xs) - 1, max(0, int(round(q * (len(xs) - 1)))))] if xs else None
    summ = {"planned_records": planned, "records_run": len(results), "requests": len(log), "stop_reason": state["stop"] or "completed all planned records",
            "status": "stopped" if state["stop"] else "completed", "health_check": health, "budget": guard.snapshot(),
            "worst_case_reservation": {"tokens": state["worst_case_tokens"], "usd": f"{state['worst_case_usd']:.6f}"},
            "safety": dict(Counter(r["safety"] for r in results)), "compiler": dict(Counter(r["compiler"] for r in results)), "final": dict(Counter(r["final"] for r in results)),
            "halt_reasons": dict(Counter(tuple(r["halt_reasons"] or []) and r["halt_reasons"][0] for r in results if r["final"] == "stop")),
            "empty_or_bad_replies": sum(1 for r in results if (r["halt_reasons"] or [None])[0] == "BAD_REPLY"),
            "latency_ms": {"safety": {"median": pct(lat("agent_2_latency_ms"), 0.5), "p95": pct(lat("agent_2_latency_ms"), 0.95)},
                           "compiler": {"median": pct(lat("agent_3_latency_ms"), 0.5), "p95": pct(lat("agent_3_latency_ms"), 0.95)}},
            "response_models": sorted({e.get("response_model") for e in log if e.get("response_model")}),
            "cost_note": "estimated at the configured conservative rates from reported usage; not a bill"}
    return summ


def start_run(mode, limit):
    """Creates the run directory and writes the configuration BEFORE the first request, with the real start time; the record files start empty."""
    run_dir = L.make_run_dir(str(RUNS), mode)
    config = {"run_id": os.path.basename(run_dir), "mode": mode, "tenant": TENANT, "started_at": L.utc_now(), "repo_head": git("rev-parse", "HEAD"), "tag": latest_tag(),
              "tag_commit": git("rev-list", "-n", "1", latest_tag()) if latest_tag() else None,
              "code_hashes": code_hashes(), "inputs": {"test_set_sha256": L.sha256_file(str(TEST_SET)), "router_replies_sha256": L.sha256_file(str(ROUTER_REPLIES))},
              "authorisation": {**AUTH, "max_usd": str(AUTH["max_usd"])}, "pricing": PRICING.as_dict(), "limit": limit,
              "request_settings": {"sdk_max_retries": 0, "sdk_timeout_s": 60.0, "temperature": 0.0, "max_completion_tokens_requested": {"Safety": 50, "Compiler": 100},
                                   "output_tokens_reserved_per_request": BUDGET_OUTPUT_BOUND, "result_cache": "none (bounded_agent has no cache)"},
              "router": "replayed from the sealed round-2 replies; no Router request", "environment": {"python": sys.version.split()[0], "platform": platform.platform()}}
    L.write_json(os.path.join(run_dir, "config.json"), config)
    for name in ("calls.jsonl", "results.jsonl"):
        open(os.path.join(run_dir, name), "w", encoding="utf-8").close()
    return run_dir


class Progress:
    """Appends each finished record and its requests to the run directory as the run goes, so an interruption or a crash keeps what was done."""

    def __init__(self, run_dir):
        self.run_dir, self.n_log, self.n_results = run_dir, 0, 0

    def __call__(self, results, log):
        for name, items, done in (("calls.jsonl", log, "n_log"), ("results.jsonl", results, "n_results")):
            new = items[getattr(self, done):]
            if new:
                with open(os.path.join(self.run_dir, name), "a", encoding="utf-8") as f:
                    f.writelines(json.dumps(x, ensure_ascii=False) + "\n" for x in new)
                setattr(self, done, len(items))


def finish_run(run_dir, results, log, state, guard, planned, health, interrupted=None):
    summ = summarize(results, log, state, guard, planned, health)
    summ["finished_at"] = L.utc_now()
    summ["requests_booked_but_not_recorded"] = guard.calls_started - len(log)  # an in-flight request at an interruption: its budget stays booked
    if interrupted is not None:
        summ["status"], summ["stop_reason"] = "interrupted", f"interrupted: {type(interrupted).__name__}; the records finished before it are kept"
    L.write_json(os.path.join(run_dir, "summary.json"), summ)
    L.write_sha256sums(run_dir)
    return run_dir


def resolve_run_dir(arg, real_health_only=False):
    """A run directory given as a path, or `latest`: the newest directory under runs/ (for --after-health: the newest sealed REAL run that passed the health check)."""
    if arg != "latest":
        return arg
    for d in sorted((p for p in RUNS.iterdir() if p.is_dir()), reverse=True) if RUNS.is_dir() else []:
        try:
            cfg, summ = (json.loads(Path(d, n).read_text(encoding="utf-8")) for n in ("config.json", "summary.json"))
        except (OSError, ValueError):
            continue
        if not real_health_only or (cfg.get("mode") == "real" and (summ.get("health_check") or {}).get("passed") and not L.verify_run_dir(str(d))):
            return str(d)
    raise SystemExit("no suitable run directory under " + str(RUNS))


def health_verdict(results, log):
    """Pass criteria, fixed before any request: every request got a usable reply with reported usage, and no record ended in a fault stop."""
    ok = bool(log) and all(e.get("reply") and isinstance(e.get("usage"), dict) and "error" not in e for e in log) \
        and not any((r["halt_reasons"] or [None])[0] in ("TIMEOUT", "RATE_LIMIT", "API_ERROR", "BAD_REPLY") for r in results)
    return {"passed": ok, "criteria": "every request returned non-empty text and reported usage; no record stopped on TIMEOUT / RATE_LIMIT / API_ERROR / BAD_REPLY"}


# ---- report ---------------------------------------------------------------------------------------------------------------------------------------
def render_report(run_dir):
    cfg = json.loads(Path(run_dir, "config.json").read_text(encoding="utf-8"))
    summ = json.loads(Path(run_dir, "summary.json").read_text(encoding="utf-8"))
    results = read_jsonl(Path(run_dir, "results.jsonl"))
    n = summ["records_run"]
    viol = Counter(v.split(":")[0][:70] for r in results for v in r["violations"])
    L_ = [f"# Safety 和 Compiler：{cfg['mode']} 运行报告\n", f"运行 `{cfg['run_id']}`，标签 `{cfg['tag'] or '无'}`，状态 **{summ['status']}**（{summ['stop_reason']}）。",
          "Router 是按已封存的第二轮回复重放的，没有新的 Router 请求；Safety 和 Compiler 走真实的扩展流程（`bounded_agent.py`）。费用是估算，不是账单。",
          "\n## 1. 主张\n", "测的是 Safety 和 Compiler 两个模型角色的**可用性和稳定性**：会不会无故拦截、回复是否可用、输出能否通过代码层合约、耗时多少。**不是**安全性测量：Router 判停的请求根本不进入它们，它们只能让结果更严。",
          "\n## 2. 证据\n", f"- 进入 Safety 的记录：{n}（计划 {summ['planned_records']}），请求 {summ['requests']} 次，预算 {summ['budget']['calls_started']}/{summ['budget']['max_calls']} 次、"
          f"约 {summ['budget']['tokens_committed']} token、约 US${summ['budget']['usd_committed']}（上限 US${summ['budget']['max_usd']}）。",
          f"- Safety：{summ['safety']}", f"- Compiler：{summ['compiler']}", f"- 最终动作：{summ['final']}；停车原因：{summ['halt_reasons']}",
          f"- 空或不可用回复（BAD_REPLY）：{summ['empty_or_bad_replies']}（这是新路径与旧路径行为不同的地方，见 LIMITATIONS 第 24 条）",
          f"- 耗时（毫秒，端点指标）：Safety {summ['latency_ms']['safety']}，Compiler {summ['latency_ms']['compiler']}", f"- 返回的模型别名：{summ['response_models']}",
          f"- Compiler 被代码拒绝的违规类别：{dict(viol) or '无'}", "\n## 3. 推理\n",
          "每条记录各问一次 Safety 和一次 Compiler，关闭重试，失败留在分母里；回复为空算 BAD_REPLY，不算通过。把耗时和停车比例与第二轮的 Router 数字并排看，才知道这两个角色增加了多少等待、多少额外停车。",
          "\n## 4. 局限\n", "- 数据是合成的，同一情境三种语言写法，条数不是独立样本。", "- 只有一个模型、一次运行；模型别名不等于验证过的版本。",
          "- 超时 60 秒是占位值；这里量到的耗时是后续定值的依据，不是结论。", "- 本次不评价 Safety 是否「该拦」：没有金标说明哪些记录应当被拦。"]
    return "\n".join(L_) + "\n"


# ---- command line ---------------------------------------------------------------------------------------------------------------------------------
def preflight_real(args):
    problems = []
    for v in ("OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL_NAME"):
        if not os.environ.get(v):
            problems.append(f"{v} is not set")
    if os.environ.get("SAFETY_COMPILER_AUTHORIZED") != "yes":
        problems.append("SAFETY_COMPILER_AUTHORIZED=yes is required")
    problems += [f"{v} is set; a run must not touch real devices or storage" for v in L.FORBIDDEN_ENV if os.environ.get(v)]
    tag = latest_tag()
    if tag is None:
        problems.append("there is no tag eval-safety-compiler-*")
    elif subprocess.run(["git", "diff", "--quiet", tag, "--", *code_hashes()], cwd=ROOT).returncode != 0:  # only the files this run depends on must equal the tag
        problems.append(f"a file this run depends on differs from the tag {tag}")
    if args.max_calls > AUTH["max_calls"] or args.max_tokens > AUTH["max_tokens"] or Decimal(args.max_usd) > AUTH["max_usd"]:
        problems.append("a cap is above what the owner confirmed")
    if args.limit is None:
        if not args.after_health:
            problems.append("a full run needs --after-health DIR (a passed, sealed health run at this HEAD)")
        else:
            bad = L.verify_run_dir(args.after_health)
            h = json.loads(Path(args.after_health, "summary.json").read_text(encoding="utf-8")) if not bad else {}
            c = json.loads(Path(args.after_health, "config.json").read_text(encoding="utf-8")) if not bad else {}
            if bad or not (h.get("health_check") or {}).get("passed") or c.get("code_hashes") != code_hashes():
                problems.append("the health run is missing, not sealed, not passed, or ran other code")
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["plan", "dry-run", "real", "report"])
    ap.add_argument("--limit", type=int, default=None, help="only the first N records; with real mode this is the health check")
    ap.add_argument("--after-health", default=None, help="the health run's directory, or `latest` for the newest passed real health run")
    ap.add_argument("--run-dir", default=None, help="for report: a run directory, or `latest` (the default)")
    ap.add_argument("--max-calls", type=int, default=AUTH["max_calls"])
    ap.add_argument("--max-tokens", type=int, default=AUTH["max_tokens"])
    ap.add_argument("--max-usd", default=str(AUTH["max_usd"]))
    args = ap.parse_args(argv)
    if args.after_health:
        args.after_health = resolve_run_dir(args.after_health, real_health_only=True)
    if args.mode == "report":
        args.run_dir = resolve_run_dir(args.run_dir or "latest")
        Path(args.run_dir, "REPORT.md").write_text(render_report(args.run_dir), encoding="utf-8")
        L.write_sha256sums(args.run_dir)
        print("wrote", Path(args.run_dir, "REPORT.md"))
        return 0
    records, replay = load_inputs()
    chosen = select_records(records, replay)
    n_plan = len(chosen[:args.limit] if args.limit else chosen)
    spent = spent_so_far() if args.mode == "real" else {"calls": 0, "tokens": 0, "usd": Decimal(0)}
    guard = L.BudgetGuard(args.max_calls - spent["calls"], args.max_tokens - spent["tokens"], Decimal(args.max_usd) - spent["usd"], PRICING)
    if args.mode == "real":
        problems = preflight_real(args)
        if problems:
            print("refusing to send any request:", *problems, sep="\n  ", file=sys.stderr)
            return 2
        from openai import OpenAI
        inner = OpenAI(base_url=os.environ["OPENAI_BASE_URL"], api_key=os.environ["OPENAI_API_KEY"]).with_options(max_retries=0, timeout=L.SDK_TIMEOUT_S)
    else:
        inner = ScriptedSDK()
    results, log, state = [], [], {"stop": None, "worst_case_tokens": 0, "worst_case_usd": Decimal(0)}
    run_dir = start_run(args.mode, args.limit) if args.mode != "plan" else None
    progress = Progress(run_dir) if run_dir else None
    interrupted = None
    try:
        run_records(chosen, inner, guard, replay, args.limit, results=results, log=log, state=state, on_record=progress)
    except BaseException as exc:  # noqa: BLE001 - seal what exists, then report; nothing is retried
        interrupted = exc
        state["stop"] = state["stop"] or f"interrupted: {type(exc).__name__}"
    if args.mode == "plan":
        per_call = state["worst_case_tokens"] // max(1, len(log))
        print(json.dumps({"records_that_reach_safety": len(chosen), "requests_expected": 2 * len(chosen), "reserved_per_request_tokens_about": per_call,
                          "sum_if_every_request_used_its_full_reservation": state["worst_case_tokens"], "note": "not a forecast: the guard adds each request's real usage and stops before the next one could break a cap; the health check measured 293 tokens for one Safety request",
                          "authorised": {"calls": AUTH["max_calls"], "tokens": AUTH["max_tokens"], "usd": str(AUTH["max_usd"])}, "already_spent": {k: str(v) for k, v in spent_so_far().items()}}, indent=2))
        return 0
    progress(results, log)
    health = health_verdict(results, log) if args.limit else None
    finish_run(run_dir, results, log, state, guard, n_plan, health, interrupted)
    print("wrote", run_dir, "|", "stopped: " + state["stop"] if state["stop"] else "completed", "|", health or "")
    if interrupted is not None and not isinstance(interrupted, KeyboardInterrupt):
        raise interrupted
    return 130 if isinstance(interrupted, KeyboardInterrupt) else (1 if state["stop"] else 0)


if __name__ == "__main__":
    sys.exit(main())
