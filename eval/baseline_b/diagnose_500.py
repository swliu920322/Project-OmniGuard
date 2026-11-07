"""Diagnosis of the HTTP 500s that baseline B's two canaries got. At most 6 calls, one change at a time. NOT part of any baseline score.

    python eval/baseline_b/diagnose_500.py --diff                      # offline: the A-vs-B request/config difference table
    python eval/baseline_b/diagnose_500.py --plan                      # offline: the six requests, the one change in each, the worst-case bound
    python eval/baseline_b/diagnose_500.py --mode dry-run [--fake-plan '{"4": 500}']
    python eval/baseline_b/diagnose_500.py --mode real ...             # only with the owner's explicit authorisation

The six requests go through the same client, endpoint, model name and settings (SDK retries off, 60 s timeout). Each differs from the
previous one in exactly one thing, starting from a request that succeeded in the baseline-A run and ending at the exact request that
failed twice in baseline B:
  1. replay a request of the baseline-A canary (known to have succeeded)           -> if it fails, STOP: a service problem, not our request
  2. only max_tokens 1024 -> 2048
  3. only remove max_completion_tokens
  4. only the system prompt becomes B's
  5. only the user input becomes B's canary input  (= the failed baseline-B request, byte for byte)
  6. replay step 1 again: did the service state change meanwhile?
If a step in 2..5 fails, the later changes are skipped (they would add nothing) and the run goes straight to step 6. A change that coincides
with a failure is a correlation, never proof of the cause. The model, the reasoning mode and the B prompt are never changed.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import platform
import signal
import socket
import sys
import time
from decimal import Decimal
from importlib import metadata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
for sub in ("eval/spec", "eval/baseline_v1/measure", "eval/baseline_b"):
    sys.path.insert(0, os.path.join(ROOT, sub))
import measure_lib as L  # noqa: E402
import prompt_b as P  # noqa: E402
import run_dev_eval as RUN  # noqa: E402  (git(), block_network(), raise_interrupt(), to_dict())

A_RUN = "eval/baseline_v1/measured/20261107T045607Z_real_bb1f4b4e"        # the baseline-A canary: both calls succeeded
B_RUNS = ["eval/baseline_b/runs/20261107T071745Z_real_ef50e6ae", "eval/baseline_b/runs/20261107T072708Z_real_55c6fa87"]  # both failed with 500
SOURCES = [
    ("Chat Completions API (parameters, model values, max_tokens)", "https://api-docs.deepseek.com/api/create-chat-completion/"),
    ("Thinking Mode (default on; temperature has no effect in thinking mode)", "https://api-docs.deepseek.com/guides/thinking_mode/"),
    ("Error Codes (500 = server-side issue, retry later)", "https://api-docs.deepseek.com/quick_start/error_codes/"),
    ("Status page", "https://status.deepseek.com/"),
]


def _first_request(run_rel: str) -> dict:
    run = os.path.join(ROOT, run_rel)
    problems = L.verify_run_dir(run)
    if problems:
        raise SystemExit(f"reference run does not verify, refusing to use it: {run_rel}: {problems}")
    with open(os.path.join(run, "calls.jsonl"), encoding="utf-8") as f:
        return json.loads(f.readline())["request"]


def build_steps() -> list[dict]:
    """The six requests. Each differs from the previous one in exactly one thing (checked by a test)."""
    a, b = _first_request(A_RUN), _first_request(B_RUNS[0])
    s1 = copy.deepcopy(a)
    s2 = {**s1, "max_tokens": b["max_tokens"]}
    s3 = {k: v for k, v in s2.items() if k != "max_completion_tokens"}
    s4 = copy.deepcopy(s3)
    s4["messages"][0]["content"] = b["messages"][0]["content"]
    s5 = copy.deepcopy(s4)
    s5["messages"][1]["content"] = b["messages"][1]["content"]
    assert s5 == b, "step 5 must be the failed baseline-B request, byte for byte"
    assert b["messages"][0]["content"] == P.SYSTEM_PROMPT
    s6 = copy.deepcopy(a)
    change = ["none: replay of a request that succeeded in the baseline-A canary", "max_tokens 1024 -> 2048", "remove max_completion_tokens (20)",
              "system prompt: the baseline-A one-liner -> B-1.0", "user input: the baseline-A telemetry line -> the baseline-B canary input (DEV-001, with a Chinese note)",
              "none: replay of step 1, to see whether the service state changed meanwhile"]
    return [{"step": i, "change": change[i - 1], "request": r} for i, r in enumerate([s1, s2, s3, s4, s5, s6], 1)]


def differences(prev: dict, cur: dict) -> list[str]:
    """What differs between two request bodies, at the level the plan talks about."""
    out = []
    for k in sorted(set(prev) | set(cur)):
        if k == "messages":
            for i, (m0, m1) in enumerate(zip(prev[k], cur[k])):
                if m0 != m1:
                    out.append(f"messages[{i}] ({m1['role']}) content")
            if len(prev[k]) != len(cur[k]):
                out.append("messages count")
        elif prev.get(k, "<absent>") != cur.get(k, "<absent>"):
            out.append(k)
    return out


def input_bound(req: dict) -> int:
    return sum(len(m["content"].encode("utf-8")) for m in req["messages"]) + L.CHAT_OVERHEAD_TOKENS


def next_step(results: dict[int, bool], last: int) -> int | None:
    """Adaptive order: stop if step 1 fails; after a failure in 2..5 jump to 6; step 6 is last."""
    if last == 0:
        return 1
    if last == 1 and not results[1]:
        return None
    if last == 6:
        return None
    if last in (2, 3, 4, 5) and not results[last]:
        return 6
    return last + 1


def difference_table() -> str:
    a, b = _first_request(A_RUN), _first_request(B_RUNS[0])
    ca, cb = (json.load(open(os.path.join(ROOT, r, "config.json"))) for r in (A_RUN, B_RUNS[0]))
    rows = [
        ("Run", "baseline-A canary (200 OK, 2 calls)", "baseline-B canaries (HTTP 500, 4 calls in 2 runs)"),
        ("endpoint host", ca["model"]["endpoint_host"], cb["model"]["endpoint_host"]),
        ("model string sent", a["model"], b["model"]),
        ("client class", "openai.OpenAI(base_url, api_key) via llm_provider (restored original code)", "openai.OpenAI(base_url, api_key) built directly"),
        ("SDK retries / timeout", f"{ca['request_settings']['sdk_max_retries']} / {ca['request_settings']['sdk_timeout_s']} s", f"{cb['request_settings']['sdk_max_retries']} / {cb['request_settings']['sdk_timeout_s']} s"),
        ("openai SDK version", ca["environment"]["openai_sdk"], f"NOT recorded in the B runs. Installed now: {metadata.version('openai')} (the same virtualenv was used by command, so the same version is likely, but that is an inference, not a record)"),
        ("python / platform", f"{ca['environment']['python']} / {ca['environment']['platform']}", f"{cb['environment']['python']} / {cb['environment']['platform']}"),
        ("request keys", ", ".join(sorted(a)), ", ".join(sorted(b))),
        ("temperature", a["temperature"], b["temperature"]),
        ("max_completion_tokens", a.get("max_completion_tokens", "<absent>"), b.get("max_completion_tokens", "<absent>")),
        ("max_tokens", a["max_tokens"], b["max_tokens"]),
        ("messages", len(a["messages"]), len(b["messages"])),
        ("system prompt bytes", len(a["messages"][0]["content"].encode()), len(b["messages"][0]["content"].encode())),
        ("user input bytes / non-ASCII", f"{len(a['messages'][1]['content'].encode())} / {not a['messages'][1]['content'].isascii()}", f"{len(b['messages'][1]['content'].encode())} / {not b['messages'][1]['content'].isascii()}"),
        ("reasoning / thinking switch sent", "none (provider default)", "none (provider default)"),
    ]
    out = ["| Item | " + rows[0][1] + " | " + rows[0][2] + " |", "|---|---|---|"]
    out += [f"| {r[0]} | {r[1]} | {r[2]} |" for r in rows[1:]]
    return "\n".join(out)


def send(inner, kwargs: dict) -> dict:
    cap = {"request": kwargs, "started_at": L.utc_now()}
    t0 = time.perf_counter()
    try:
        completions = inner.chat.completions
        raw_api = getattr(completions, "with_raw_response", None)
        if raw_api is not None:
            raw = raw_api.create(**kwargs)
            resp = raw.parse()
            cap["http_status"] = getattr(raw, "status_code", None)
            cap["headers"] = {k.lower(): v for k, v in dict(raw.headers).items() if k.lower() in L.RESPONSE_HEADERS_KEPT}
        else:
            resp = completions.create(**kwargs)
        cap["response"] = RUN.to_dict(resp)
    except Exception as exc:  # noqa: BLE001 - recorded, never swallowed
        cap["error"] = {"type": type(exc).__name__, "module": type(exc).__module__, "status_code": getattr(exc, "status_code", None), "message": str(exc)[:500]}
    cap["ended_at"], cap["latency_ms"] = L.utc_now(), round((time.perf_counter() - t0) * 1000, 1)
    return cap


class FakeInternalServerError(Exception):
    status_code = 500


class FakeDiagClient:
    """Dry run only: answers like the real thing, with a scripted HTTP status per call number."""

    def __init__(self, plan: dict[int, int]):
        self.plan, self.n, self.max_retries = plan, 0, 2
        self.chat = type("Chat", (), {"completions": type("Comp", (), {"create": staticmethod(self._create)})()})()

    def with_options(self, **opts):
        self.max_retries = opts.get("max_retries", self.max_retries)
        return self

    def _create(self, **kw):
        self.n += 1
        v = self.plan.get(self.n, 200)
        if v == "interrupt":
            raise KeyboardInterrupt("scripted Ctrl+C")
        if v == "sigterm":
            os.kill(os.getpid(), signal.SIGTERM)  # the runner turns this into KeyboardInterrupt
        if v != 200:
            raise FakeInternalServerError(f"fake {v} (scripted)")
        usage = {"prompt_tokens": 100, "completion_tokens": 60, "total_tokens": 160}
        d = {"id": f"fake-{self.n}", "model": "fake-model", "usage": usage,
             "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": "NORMAL_NAV"}}]}
        return type("R", (), {"model_dump": lambda self_: d, "usage": usage})()


def classify(cap: dict) -> dict:
    err = cap.get("error")
    return {"ok": not err, "http_status": cap.get("http_status") or (err or {}).get("status_code"),
            "finish_reason": (((cap.get("response") or {}).get("choices") or [{}])[0]).get("finish_reason"),
            "usage": (cap.get("response") or {}).get("usage"), "latency_ms": cap.get("latency_ms")}


def plan(args) -> int:
    steps = build_steps()
    pricing = L.Pricing(L.parse_usd(args.price_input_per_mtok or "0.3333334"), L.parse_usd(args.price_output_per_mtok or "1.3333334"), "plan")
    rows, tok, usd = [], 0, Decimal(0)
    for s in steps:
        ib, ob = input_bound(s["request"]), s["request"]["max_tokens"]
        tok += ib + ob
        usd += ib * pricing.input_per_token + ob * pricing.output_per_token
        rows.append({"step": s["step"], "change": s["change"], "input_bound": ib, "output_bound": ob})
    print(json.dumps({"steps": rows, "worst_case_tokens_all_six": tok, "worst_case_usd_all_six": f"{usd:.4f}",
                      "proposed_caps": {"max_calls": 6, "max_tokens": 35000, "usd": "0.03"}, "fits": tok <= 35000 and usd <= Decimal("0.03")}, indent=1))
    return 0


def run(args) -> int:
    real = args.mode == "real"
    if real:
        missing = [n for n in ("usd_cap", "price_input_per_mtok", "price_output_per_mtok", "price_source", "authorized_by", "model_identity", "max_calls", "max_tokens") if not getattr(args, n)]
        if missing:
            print("a real diagnosis needs: " + ", ".join("--" + m.replace("_", "-") for m in missing), file=sys.stderr)
            return 2
        if os.environ.get("BASELINE_B_DIAG_AUTHORIZED") != "yes":
            print("a real diagnosis also needs BASELINE_B_DIAG_AUTHORIZED=yes in the environment", file=sys.stderr)
            return 2
        if RUN.git("status", "--porcelain", "--untracked-files=no"):
            print("a real diagnosis needs a clean working tree (tracked files)", file=sys.stderr)
            return 2
    else:
        RUN.block_network()
    try:
        usd_cap = L.parse_usd(args.usd_cap or "1")
        pricing = L.Pricing(L.parse_usd(args.price_input_per_mtok or "1"), L.parse_usd(args.price_output_per_mtok or "1"), args.price_source or "rehearsal values: not a real price")
    except ValueError as exc:
        print(f"invalid money setting: {exc}", file=sys.stderr)
        return 2
    signal.signal(signal.SIGTERM, RUN.raise_interrupt)
    steps = build_steps()
    max_calls, max_tokens = args.max_calls or 6, args.max_tokens or 35000
    if real:
        from openai import OpenAI

        model_env, base_url = os.environ["OPENAI_MODEL_NAME"], os.environ["OPENAI_BASE_URL"]
        inner = OpenAI(base_url=base_url, api_key=os.environ["OPENAI_API_KEY"]).with_options(max_retries=0, timeout=L.SDK_TIMEOUT_S)
        if steps[0]["request"]["model"] != model_env:
            raise SystemExit(f"the configured model {model_env!r} differs from the reference request's {steps[0]['request']['model']!r}; refusing to change the model")
    else:
        inner, base_url = FakeDiagClient({int(k): (int(v) if str(v).isdigit() else v) for k, v in json.loads(args.fake_plan).items()}).with_options(max_retries=0, timeout=L.SDK_TIMEOUT_S), ""
    if getattr(inner, "max_retries", None) != 0:
        raise SystemExit("could not confirm that SDK retries are disabled")

    out_root = args.out_root or os.path.join(HERE, "diagnostics" if real else "diagnostics/dryrun")
    os.makedirs(out_root, exist_ok=True)
    run_dir = L.make_run_dir(out_root, args.mode)
    config = {
        "run_id": os.path.basename(run_dir), "mode": args.mode, "kind": "diagnosis of the baseline-B HTTP 500s", "is_baseline_result": False,
        "started_at": L.utc_now(), "repo_head": RUN.git("rev-parse", "HEAD"),
        "references": {"baseline_A_success": A_RUN, "baseline_B_failures": B_RUNS},
        "steps": [{"step": s["step"], "change": s["change"], "request_sha256": L.sha256_text(json.dumps(s["request"], sort_keys=True, ensure_ascii=False)),
                   "request": s["request"]} for s in steps],
        "difference_table": difference_table(),
        "rules": "one change at a time; step 1 failing stops the run; a failure in 2..5 skips to step 6; no model, reasoning-mode or prompt change; retries off",
        "temperature_note": "temperature=0 is sent, but the provider documents that thinking mode (on by default) ignores it: the request parameter is fixed, the temperature is not demonstrably controlled",
        "sources_retrieved_2026_11_07": SOURCES,
        "environment": {"python": sys.version.split()[0], "platform": platform.platform(), "openai_sdk": metadata.version("openai"),
                        "endpoint_host": base_url.split("//")[-1].split("/")[0] or None, "sdk_max_retries": inner.max_retries, "sdk_timeout_s": L.SDK_TIMEOUT_S},
        "budget": {"max_calls": max_calls, "max_tokens": max_tokens, "max_usd": str(usd_cap), "pricing": pricing.as_dict(), "output_token_bound": "the request's own max_tokens"},
        "authorization": {"authorized_by": args.authorized_by, "usd_cap_as_given": args.usd_cap} if real else None,
        "model_identity_stated_by_owner": args.model_identity or "REHEARSAL: fake model",
    }
    L.write_json(os.path.join(run_dir, "config.json"), config)
    guard = L.BudgetGuard(max_calls, max_tokens, usd_cap, pricing)
    records, results, status, stop_reason, last, interruption, inflight = [], {}, "completed", "plan finished", 0, None, None
    f = open(os.path.join(run_dir, "calls.jsonl"), "w", encoding="utf-8")
    try:
        while True:
            nxt = next_step(results, last)
            if nxt is None:
                break
            s = steps[nxt - 1]
            try:
                resv = guard.reserve(input_bound(s["request"]), s["request"]["max_tokens"])
            except L.BudgetExceeded as exc:
                status, stop_reason = "stopped_early", f"stopped before step {nxt}: {exc.reason}"
                break
            inflight = (nxt, s, resv, L.utc_now())  # from here until the record is written, an interruption leaves a started request
            cap = send(inner, copy.deepcopy(s["request"]))
            rec = {"step": nxt, "change": s["change"], "request": s["request"], "started_at": cap["started_at"], "ended_at": cap["ended_at"],
                   "http_status": cap.get("http_status"), "headers": cap.get("headers"), "response_full": cap.get("response"), "error": cap.get("error"),
                   "result": classify(cap)}
            records.append(rec)
            f.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")
            f.flush()
            inflight = None
            results[nxt], last = rec["result"]["ok"], nxt
            try:
                guard.settle(resv, (cap.get("response") or {}).get("usage"))
            except L.BoundViolation as exc:
                status, stop_reason = "stopped_bound_violation", f"bound violated at step {nxt}: {exc.reason}"
                break
    except BaseException as exc:  # Ctrl+C, SIGTERM or a bug: seal what exists
        interruption = {"type": type(exc).__name__, "message": str(exc)[:500]}
        status = "interrupted" if isinstance(exc, KeyboardInterrupt) else "crashed"
        stop_reason = f"{status}: {interruption['type']}: {interruption['message']}"
        if inflight is not None:  # a request was started and never returned: keep it, with its reservation (usage unknown is never free)
            st, s_, resv_, t_start = inflight
            rec = {"step": st, "change": s_["change"], "request": s_["request"], "started_at": t_start, "ended_at": L.utc_now(),
                   "status": "in_flight_at_interruption", "http_status": None, "headers": None, "response_full": None,
                   "error": {"type": type(exc).__name__, "message": str(exc)[:500]},
                   "reserved": {"input_bound": resv_.input_bound, "output_bound": resv_.output_bound, "usd": str(resv_.usd)},
                   "result": {"ok": False, "http_status": None, "finish_reason": None, "usage": None, "latency_ms": None}}
            records.append(rec)
            f.write(json.dumps(rec, ensure_ascii=False, sort_keys=True) + "\n")
    finally:
        f.close()
    summary = {
        "run_id": config["run_id"], "mode": args.mode, "status": status, "stop_reason": stop_reason, "interruption": interruption,
        "is_baseline_result": False, "calls_made": len(records), "in_flight_step": next((r["step"] for r in records if r.get("status") == "in_flight_at_interruption"), None),
        "budget": guard.snapshot(),
        "per_step": {str(r["step"]): {"change": r["change"], **r["result"], **({"status": r["status"]} if r.get("status") else {})} for r in records},
        "steps_skipped": [s["step"] for s in steps if s["step"] not in {r["step"] for r in records}],
        "reading": "A step that fails right after steps that passed is a CORRELATION with its change, not a proven cause. If step 1 fails, or step 6 fails after earlier passes, the service state is implicated, not the request.",
        "ended_at": L.utc_now(),
    }
    L.write_json(os.path.join(run_dir, "summary.json"), summary)
    lines = [f"# Diagnosis of the baseline-B HTTP 500s — {config['run_id']}", "", f"Mode `{args.mode}`, status **{status}**, calls {len(records)} of at most {max_calls}. Not a baseline result.", "",
             "| Step | Change | HTTP | Outcome | finish_reason |", "|---|---|---|---|---|"]
    lines += [f"| {r['step']} | {r['change']} | {r['result']['http_status']} | {'ok' if r['result']['ok'] else 'FAILED'} | {r['result']['finish_reason']} |" for r in records]
    lines += ["", f"Skipped: {summary['steps_skipped']}.", "", summary["reading"], "", f"Stop reason: {stop_reason}", ""]
    open(os.path.join(run_dir, "report.md"), "w", encoding="utf-8").write("\n".join(lines))
    L.write_sha256sums(run_dir)
    problems = L.verify_run_dir(run_dir)
    print(f"run directory: {run_dir}\ncalls made: {len(records)}; status: {status}; {stop_reason}\nhash verification:", "OK" if not problems else problems)
    if problems:
        return 1
    return {"interrupted": 130, "crashed": 1, "stopped_bound_violation": 3}.get(status, 0)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mode", choices=["dry-run", "real"], default="dry-run")
    ap.add_argument("--diff", action="store_true")
    ap.add_argument("--plan", action="store_true")
    ap.add_argument("--fake-plan", default="{}", help='dry-run only: {"call_number": http_status}')
    ap.add_argument("--max-calls", type=int)
    ap.add_argument("--max-tokens", type=int)
    ap.add_argument("--usd-cap")
    ap.add_argument("--price-input-per-mtok")
    ap.add_argument("--price-output-per-mtok")
    ap.add_argument("--price-source")
    ap.add_argument("--authorized-by")
    ap.add_argument("--model-identity")
    ap.add_argument("--out-root")
    args = ap.parse_args(argv)
    if args.diff:
        print(difference_table())
        return 0
    if args.plan:
        return plan(args)
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
