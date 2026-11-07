"""Run baseline B on the dev set (180 records) and score it. Real calls need an explicit, recorded authorisation.

    python eval/baseline_b/run_dev_eval.py --mode dry-run           # fake client, sockets blocked, no money
    python eval/baseline_b/run_dev_eval.py --plan --price-input-per-mtok X --price-output-per-mtok Y   # volume and worst-case bound
    python eval/baseline_b/run_dev_eval.py --verify <run dir>

Same safety shell as the baseline-A harness v2 (reserve before send, settle to actual, unknown usage keeps the reservation,
a bound violation stops the run, interruptions are sealed, one request per record, SDK retries off). Dev-set results are for
development; the prompt is NOT changed because of them (a changed prompt is a new version with its own run).
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import signal
import socket
import subprocess
import sys
import time
from decimal import Decimal
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
for sub in ("eval/spec", "eval/dev", "eval/baseline_v1/measure", "eval/baseline_b"):
    sys.path.insert(0, os.path.join(ROOT, sub))
import measure_lib as L  # noqa: E402  (frozen helpers: hashing, budget, run dirs)
import evaluate as E  # noqa: E402
import prompt_b as P  # noqa: E402
import reference_labeler as R  # noqa: E402

MAX_TOKENS = 2048          # spending guard and output bound: the served model is a reasoning model, its hidden reasoning counts
DEV_FILES = ("dev_set.jsonl", "families.json", "dev_report.json", "COVERAGE_REPORT.md", "make_dev_set.py", "dev_report.py")
REHEARSAL_PRICING = {"usd_cap": "1", "input": "1", "output": "1", "source": "rehearsal values: not a real price"}


def git(*args: str) -> str:
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True, check=True).stdout.strip()


def verify_manifest(directory: str) -> dict[str, str]:
    """Check a SHA256SUMS file against the files next to it; refuse to run on anything that does not match."""
    out = {}
    with open(os.path.join(directory, "SHA256SUMS"), encoding="utf-8") as f:
        for line in f:
            digest, name = line.rstrip("\n").split("  ", 1)
            if L.sha256_file(os.path.join(directory, name)) != digest:
                raise SystemExit(f"hash mismatch, refusing to run: {os.path.relpath(os.path.join(directory, name), ROOT)}")
            out[name] = digest
    return out


def load_dev(limit: int | None) -> list[dict]:
    with open(os.path.join(ROOT, "eval/dev/dev_set.jsonl"), encoding="utf-8") as f:
        recs = [json.loads(line) for line in f]
    return recs[:limit] if limit else recs


def to_dict(resp) -> dict:
    return resp.model_dump() if hasattr(resp, "model_dump") else json.loads(json.dumps(resp, default=lambda o: getattr(o, "__dict__", str(o))))


class RecordingClient:
    """Sends one chat request with the fixed settings and keeps everything the API returned."""

    def __init__(self, inner, model: str):
        self.inner, self.model, self.requests_made = inner, model, 0

    def call(self, user_input: str) -> dict:
        self.requests_made += 1
        kwargs = {"model": self.model, "messages": P.build_messages(user_input), "temperature": L.TEMPERATURE, "max_tokens": MAX_TOKENS}
        cap = {"request": kwargs, "started_at": L.utc_now()}
        t0 = time.perf_counter()
        try:
            completions = self.inner.chat.completions
            raw_api = getattr(completions, "with_raw_response", None)
            if raw_api is not None:
                raw = raw_api.create(**kwargs)
                resp = raw.parse()
                cap["http_status"] = getattr(raw, "status_code", None)
                cap["headers"] = {k.lower(): v for k, v in dict(raw.headers).items() if k.lower() in L.RESPONSE_HEADERS_KEPT}
            else:
                resp = completions.create(**kwargs)
            cap["response"] = to_dict(resp)
        except BaseException as exc:  # recorded, then raised again if it is Ctrl+C / SystemExit
            cap["error"] = {"type": type(exc).__name__, "module": type(exc).__module__, "status_code": getattr(exc, "status_code", None),
                            "message": str(exc)[:500]}
            if not isinstance(exc, Exception):
                cap["ended_at"], cap["latency_ms"] = L.utc_now(), round((time.perf_counter() - t0) * 1000, 1)
                self.last = cap
                raise
        cap["ended_at"], cap["latency_ms"] = L.utc_now(), round((time.perf_counter() - t0) * 1000, 1)
        self.last = cap
        return cap


def build_call_record(seq: int, rec: dict, cap: dict | None, exc: BaseException | None = None) -> dict:
    resp = (cap or {}).get("response") or {}
    choice = (resp.get("choices") or [{}])[0]
    content = (choice.get("message") or {}).get("content")
    prediction, parse_error = P.parse_reply(content) if not (cap or {}).get("error") else (None, "no reply")
    user = rec["rendered_input"]
    return {
        "seq": seq, "id": rec["id"], "family_id": rec["family_id"], "input": user, "input_sha256": L.sha256_text(user),
        "request": (cap or {}).get("request"), "started_at": (cap or {}).get("started_at"), "ended_at": (cap or {}).get("ended_at"),
        "latency_ms": (cap or {}).get("latency_ms"), "http_status": (cap or {}).get("http_status"), "headers": (cap or {}).get("headers"),
        "response_full": resp or None, "response_model": resp.get("model"), "finish_reason": choice.get("finish_reason"),
        "truncated": choice.get("finish_reason") == "length", "usage": resp.get("usage"), "reasoning_tokens": L.reasoning_tokens(resp.get("usage")),
        "reply": content, "prediction": prediction, "parse_error": parse_error,
        "error": (cap or {}).get("error") or ({"type": type(exc).__name__, "message": str(exc)[:500]} if exc else None),
    }


def resolve_budget(args, real: bool):
    if real:
        missing = [n for n in ("usd_cap", "price_input_per_mtok", "price_output_per_mtok", "price_source", "authorized_by", "model_identity", "max_calls", "max_tokens") if not getattr(args, n)]
        if missing:
            print("a real run needs: " + ", ".join("--" + m.replace("_", "-") for m in missing), file=sys.stderr)
            return None
    try:
        cap = L.parse_usd(args.usd_cap or REHEARSAL_PRICING["usd_cap"])
        pricing = L.Pricing(L.parse_usd(args.price_input_per_mtok or REHEARSAL_PRICING["input"]),
                            L.parse_usd(args.price_output_per_mtok or REHEARSAL_PRICING["output"]),
                            args.price_source or REHEARSAL_PRICING["source"])
    except ValueError as exc:
        print(f"invalid money setting: {exc}", file=sys.stderr)
        return None
    return cap, pricing


def plan(args) -> int:
    """Offline: how many calls, and the worst case the guard would book. Writes nothing, calls nothing."""
    recs = load_dev(args.limit)
    try:
        pricing = L.Pricing(L.parse_usd(args.price_input_per_mtok), L.parse_usd(args.price_output_per_mtok), args.price_source or "plan")
    except (ValueError, TypeError) as exc:
        print(f"--plan needs both prices: {exc}", file=sys.stderr)
        return 2
    bounds = [L.input_token_upper_bound(P.SYSTEM_PROMPT, r["rendered_input"]) for r in recs]
    worst_usd = sum(b * pricing.input_per_token + MAX_TOKENS * pricing.output_per_token for b in bounds)
    print(json.dumps({
        "calls": len(recs), "prompt_bytes": len(P.SYSTEM_PROMPT.encode()), "input_bound_per_call_min_max": [min(bounds), max(bounds)],
        "output_bound_per_call": MAX_TOKENS, "worst_case_tokens_if_every_call_used_its_bound": sum(bounds) + MAX_TOKENS * len(recs),
        "worst_case_usd_if_every_call_used_its_bound": f"{worst_usd:.4f}",
        "note": "the guard books the worst case per call and settles to the reported usage, so the run's real spend is far lower; the worst case is only the ceiling of the bound",
    }, indent=1))
    return 0


def block_network() -> None:
    def deny(*_a, **_k):
        raise RuntimeError("network access is blocked in dry-run mode")

    socket.socket.connect = deny  # type: ignore[assignment]
    socket.create_connection = deny  # type: ignore[assignment]


def raise_interrupt(signum, _frame):
    raise KeyboardInterrupt(f"signal {signum}")


def run(args) -> int:
    real = args.mode == "real"
    money = resolve_budget(args, real)
    if money is None:
        return 2
    usd_cap, pricing = money
    if real:
        if os.environ.get("BASELINE_B_AUTHORIZED") != "yes":
            print("a real run also needs BASELINE_B_AUTHORIZED=yes in the environment", file=sys.stderr)
            return 2
        if git("status", "--porcelain", "--untracked-files=no"):
            print("a real run needs a clean working tree (tracked files)", file=sys.stderr)
            return 2
    else:
        block_network()
    signal.signal(signal.SIGTERM, raise_interrupt)
    dev_hashes = verify_manifest(os.path.join(ROOT, "eval/dev"))
    spec_hashes = verify_manifest(os.path.join(ROOT, "eval/spec"))
    records = load_dev(args.limit)
    max_calls, max_tokens = args.max_calls or len(records), args.max_tokens or 500_000

    if real:
        from openai import OpenAI

        model_name = os.environ["OPENAI_MODEL_NAME"]
        base_url = os.environ["OPENAI_BASE_URL"]
        inner = OpenAI(base_url=base_url, api_key=os.environ["OPENAI_API_KEY"]).with_options(max_retries=0, timeout=L.SDK_TIMEOUT_S)
    else:
        from fake_model import FakeClient

        faults = {} if args.fault_plan == "none" else None if args.fault_plan == "default" else {int(k): v for k, v in json.loads(args.fault_plan).items()}
        inner, model_name, base_url = FakeClient(faults=faults).with_options(max_retries=0, timeout=L.SDK_TIMEOUT_S), "fake-model-b", ""
    if getattr(inner, "max_retries", None) != 0:
        raise SystemExit("could not confirm that SDK retries are disabled")
    client = RecordingClient(inner, model_name)

    out_root = args.out_root or os.path.join(HERE, "runs" if real else "dryrun")
    os.makedirs(out_root, exist_ok=True)
    run_dir = L.make_run_dir(out_root, args.mode)
    run_id = os.path.basename(run_dir)
    canary = bool(args.limit)
    config = {
        "run_id": run_id, "mode": args.mode, "is_canary": canary, "started_at": L.utc_now(), "repo_head": git("rev-parse", "HEAD"),
        "baseline": {"name": "B", "prompt_version": P.PROMPT_VERSION, "prompt_sha256": L.sha256_text(P.SYSTEM_PROMPT), "prompt_text": P.SYSTEM_PROMPT},
        "spec": {"version": R.SPEC_VERSION, "manifest": spec_hashes},
        "dev_set": {"manifest": dev_hashes, "records_used": len(records), "dev_set_sha256": dev_hashes["dev_set.jsonl"]},
        "code": {n: L.sha256_file(os.path.join(HERE, n)) for n in ("run_dev_eval.py", "evaluate.py", "prompt_b.py", "fake_model.py")},
        "frozen_helpers": {n: L.sha256_file(os.path.join(ROOT, "eval/baseline_v1/measure", n)) for n in ("measure_lib.py",)},
        "model": {"endpoint_host": urlparse(base_url).netloc or None, "configured_model_name": model_name,
                  "identity_stated_by_owner": args.model_identity or "REHEARSAL: fake model",
                  "identity_note": "The API reports only an alias in response.model; the version is the owner's statement at run time and stays unverified."},
        "request_settings": {"temperature": L.TEMPERATURE, "max_tokens": MAX_TOKENS, "sdk_max_retries": inner.max_retries, "sdk_timeout_s": L.SDK_TIMEOUT_S,
                             "response_format": "none (plain text; the prompt asks for one JSON object)", "order": "dev_set.jsonl order, one request per record, no retries"},
        "budget": {"max_calls": max_calls, "max_tokens": max_tokens, "max_usd": str(usd_cap), "pricing": pricing.as_dict(),
                   "input_token_bound": f"UTF-8 bytes of system + user text + {L.CHAT_OVERHEAD_TOKENS}", "output_token_bound": MAX_TOKENS},
        "authorization": {"authorized_by": args.authorized_by, "usd_cap_as_given": args.usd_cap} if real else None,
        "policy": "Dev-set results are for development. The prompt is not changed because of this run; a changed prompt is a new version and a new run.",
        "environment": {"python": sys.version.split()[0], "platform": platform.platform()},
    }
    L.write_json(os.path.join(run_dir, "config.json"), config)
    guard = L.BudgetGuard(max_calls, max_tokens, usd_cap, pricing)
    calls: list[dict] = []
    status, stop_reason, interruption, inflight = "completed", "completed all planned calls", None, None
    calls_file = open(os.path.join(run_dir, "calls.jsonl"), "w", encoding="utf-8")

    def write_call(c: dict) -> None:
        calls.append(c)
        calls_file.write(json.dumps(c, ensure_ascii=False, sort_keys=True) + "\n")
        calls_file.flush()

    try:
        for seq, rec in enumerate(records, 1):
            try:
                resv = guard.reserve(L.input_token_upper_bound(P.SYSTEM_PROMPT, rec["rendered_input"]), MAX_TOKENS)
            except L.BudgetExceeded as exc:
                status, stop_reason = "stopped_early", f"stopped before sending call #{seq}: {exc.reason}"
                break
            inflight = (seq, rec, resv)
            before = client.requests_made
            client.last = None
            cap = client.call(rec["rendered_input"])
            if client.requests_made != before + 1:
                raise SystemExit(f"call #{seq}: expected exactly one request")
            call = build_call_record(seq, rec, cap)
            write_call(call)
            inflight = None
            try:
                guard.settle(resv, call["usage"])
            except L.BoundViolation as exc:
                status, stop_reason = "stopped_bound_violation", f"bound violated by call #{seq}: {exc.reason}"
                break
    except BaseException as exc:  # Ctrl+C, SIGTERM, SystemExit or a bug: seal what exists
        interruption = {"type": type(exc).__name__, "message": str(exc)[:500]}
        status = "interrupted" if isinstance(exc, KeyboardInterrupt) else "crashed"
        stop_reason = f"{status}: {interruption['type']}: {interruption['message']}"
        if inflight is not None:
            seq, rec, resv = inflight
            c = build_call_record(seq, rec, getattr(client, "last", None), exc)
            c["status"] = "in_flight_at_interruption"
            c["reserved"] = {"input_bound": resv.input_bound, "output_bound": resv.output_bound, "usd": str(resv.usd)}
            write_call(c)
    finally:
        calls_file.close()

    done = [c for c in calls if c.get("status") != "in_flight_at_interruption"]
    usable_usage = [c for c in calls if isinstance((c.get("usage") or {}).get("prompt_tokens"), int) and isinstance((c.get("usage") or {}).get("completion_tokens"), int)]
    summary = {
        "run_id": run_id, "mode": args.mode, "status": status, "stop_reason": stop_reason, "interruption": interruption,
        "is_canary": canary, "is_measurement": real and status == "completed" and not canary,
        "model_identity_stated_by_owner": config["model"]["identity_stated_by_owner"],
        "planned_calls": len(records), "calls_recorded": len(calls), "requests_that_reached_the_client": client.requests_made,
        "truncated_replies": sum(1 for c in calls if c.get("truncated")), "reasoning_tokens_reported": sum(c.get("reasoning_tokens") or 0 for c in calls),
        "parse_errors": dict(sorted(__import__("collections").Counter(c["parse_error"] for c in done if c.get("parse_error")).items())),
        "distinct_response_models": sorted({c["response_model"] for c in calls if c.get("response_model")}),
        "budget": guard.snapshot(), "calls_without_usable_usage": len(calls) - len(usable_usage),
        "usd_from_reported_usage": f"{sum((pricing.cost(c['usage']['prompt_tokens'], c['usage']['completion_tokens']) for c in usable_usage), Decimal(0)):.6f}",
        "ended_at": L.utc_now(),
    }
    summary["model_drift_flag"] = len(summary["distinct_response_models"]) > 1
    if real:
        summary["metrics"] = E.evaluate(records, done)
    else:
        summary["metrics_withheld"] = "dry run with a fake client: no accuracy or safety figure is published for it"
    L.write_json(os.path.join(run_dir, "summary.json"), summary)
    write_report(run_dir, config, summary)
    L.write_sha256sums(run_dir)
    problems = L.verify_run_dir(run_dir)
    print(f"run directory: {run_dir}")
    print(f"calls recorded: {len(calls)} / planned {len(records)}; status: {status}; {stop_reason}")
    print("hash verification:", "OK" if not problems else problems)
    if problems:
        return 1
    return {"interrupted": 130, "crashed": 1, "stopped_bound_violation": 3}.get(status, 0)


def write_report(run_dir: str, config: dict, s: dict) -> None:
    lines = [f"# Baseline B on the dev set — {s['run_id']}", "",
             f"- Mode `{s['mode']}`, status **{s['status']}**, canary: {s['is_canary']}, counts as a measurement: {s['is_measurement']}",
             f"- Prompt `{config['baseline']['prompt_version']}` sha256 `{config['baseline']['prompt_sha256'][:16]}…`; dev set sha256 `{config['dev_set']['dev_set_sha256'][:16]}…`; spec `{config['spec']['version']}`",
             f"- Calls recorded {s['calls_recorded']} of {s['planned_calls']}; truncated replies {s['truncated_replies']}; parse errors {s['parse_errors']}",
             f"- Spend implied by reported usage: US$ {s['usd_from_reported_usage']}; booked {s['budget']['usd_committed']} of {s['budget']['max_usd']}",
             f"- Model identity: {s['model_identity_stated_by_owner']} (owner-stated, actual version unverified); aliases reported: {s['distinct_response_models']}",
             f"- Stop reason: {s['stop_reason']}", ""]
    if "metrics" not in s:
        lines += [s["metrics_withheld"], ""]
    else:
        m = s["metrics"]
        p = m["primary"]["all_started"]
        lines += ["Dev-set result, for development only: not the formal X or Y, which come from the frozen test set.", "",
                  "| Subset | n | Correct | Accuracy | 95 % interval (Wilson) | Errors | Invalid |", "|---|---:|---:|---:|---|---:|---:|"]
        for name, v in m["primary"].items():
            lines.append(f"| {name} | {v['n']} | {v['correct']} | {v['accuracy']} | {v['ci95_wilson']} | {v['errors']} | {v['invalid']} |")
        lines += ["", f"Macro-F1 (all started): {p['macro_f1']}", "", "| Class | Support | Precision | Recall | F1 |", "|---|---:|---:|---:|---:|"]
        lines += [f"| `{c}` | {v['support']} | {v['precision']} | {v['recall']} | {v['f1']} |" for c, v in p["per_class"].items()]
        n = m["note_status"]
        lines += ["", f"Note status (noted records only, separate from the main accuracy): {n['correct']}/{n['n']} = {n['accuracy']}, interval {n['ci95_wilson']}",
                  f"Safety: {m['safety']}", f"Legacy three-class view (extra): {m['legacy3_view']}"]
    open(os.path.join(run_dir, "report.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mode", choices=["dry-run", "real"], default="dry-run")
    ap.add_argument("--limit", type=int, help="use only the first N dev records (a canary)")
    ap.add_argument("--plan", action="store_true", help="print the call volume and worst-case bound, then exit")
    ap.add_argument("--verify", metavar="RUN_DIR", help="check a finished run directory against its SHA256SUMS")
    ap.add_argument("--max-calls", type=int)
    ap.add_argument("--max-tokens", type=int)
    ap.add_argument("--usd-cap")
    ap.add_argument("--price-input-per-mtok")
    ap.add_argument("--price-output-per-mtok")
    ap.add_argument("--price-source")
    ap.add_argument("--authorized-by")
    ap.add_argument("--model-identity")
    ap.add_argument("--fault-plan", default="default", help="dry-run only: default | none | JSON {request_no: fault}")
    ap.add_argument("--out-root")
    args = ap.parse_args(argv)
    if args.verify:
        problems = L.verify_run_dir(args.verify)
        print("OK" if not problems else problems)
        return 0 if not problems else 1
    if args.plan:
        return plan(args)
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
