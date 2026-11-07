#!/usr/bin/env python3
"""Baseline A measurement: the original router, restored from the tag eval-baseline-v1.

Default mode is a DRY RUN with a fake client (no network, no cost). A real run needs --mode real,
explicit caps, a recorded authorisation and BASELINE_A_AUTHORIZED=yes in the environment.
Read SCOPE.md first: it says what is and is not measured.

    python eval/baseline_v1/measure/run_baseline_a.py                       # offline rehearsal
    python eval/baseline_v1/measure/run_baseline_a.py --verify <run dir>    # re-check a run's hashes
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from importlib import metadata
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import measure_lib as L  # noqa: E402

TAG = "eval-baseline-v1"
BASE_COMMIT = "a58b1258280567d3061973197151a0c917276fd8"
CSV_REL = "src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-07-16-thesis-200/results.csv"
# Original files whose bytes must match the archive before anything is imported from them.
SOURCE_CHECKS = (
    CSV_REL,
    "src/cloud-orchestrator/scenario_registry.json",
    "src/cloud-orchestrator/embodied_brain/benchmark.py",
    "src/cloud-orchestrator/embodied_brain/brain.py",
    "src/cloud-orchestrator/embodied_brain/utils.py",
    "src/cloud-orchestrator/llm_provider.py",
    "src/cloud-orchestrator/openai_config.py",
)


def git(repo: str, *args: str) -> str:
    return subprocess.run(["git", "-C", repo, *args], check=True, capture_output=True, text=True).stdout.strip()


def repo_root() -> str:
    return git(HERE, "rev-parse", "--show-toplevel")


def block_network() -> None:
    """Dry run: any attempt to open a connection fails loudly."""

    def deny(*_a, **_k):
        raise RuntimeError("network access is blocked in dry-run mode")

    socket.socket.connect = deny  # type: ignore[assignment]
    socket.create_connection = deny  # type: ignore[assignment]


def archive_hashes(repo: str) -> dict[str, str]:
    out = {}
    with open(os.path.join(repo, "eval/baseline_v1/SHA256SUMS"), encoding="utf-8") as f:
        for line in f:
            digest, path = line.rstrip("\n").split("  ", 1)
            out[path] = digest
    return out


def restore_source(kind: str, repo: str):
    """Returns (source_root, cleanup, info). source_root contains src/ as in the original repo."""
    if kind == "archive":
        return os.path.join(repo, "eval/baseline_v1/original"), (lambda: None), {"kind": "archive"}
    tmp = tempfile.mkdtemp(prefix="baseline-a-")
    wt = os.path.join(tmp, "wt")
    git(repo, "worktree", "add", "--detach", wt, TAG)
    head = git(wt, "rev-parse", "HEAD")
    if head != BASE_COMMIT:
        git(repo, "worktree", "remove", "--force", wt)
        raise SystemExit(f"worktree HEAD {head} is not the baseline commit {BASE_COMMIT}")

    def cleanup():
        subprocess.run(["git", "-C", repo, "worktree", "remove", "--force", wt], capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)

    return wt, cleanup, {"kind": "worktree", "head": head}


def verify_source(source_root: str, repo: str) -> dict[str, str]:
    expected, got = archive_hashes(repo), {}
    for rel in SOURCE_CHECKS:
        digest = L.sha256_file(os.path.join(source_root, rel))
        if digest != expected[rel]:
            raise SystemExit(f"source file differs from the archive: {rel}")
        got[rel] = digest
    return got


def read_prompts(source_root: str) -> dict[str, str]:
    bench = open(os.path.join(source_root, "src/cloud-orchestrator/embodied_brain/benchmark.py"), encoding="utf-8").read()
    match = re.search(r'^ROUTER_PROMPT = """(.*?)"""', bench, re.S | re.M)
    registry = json.load(open(os.path.join(source_root, "src/cloud-orchestrator/scenario_registry.json"), encoding="utf-8"))
    return {"B": match.group(1), "P": registry["Tenant-Alpha"]["agent_router_prompt"]}


def to_dict(resp) -> dict:
    if hasattr(resp, "model_dump"):
        return resp.model_dump()
    return json.loads(json.dumps(resp, default=lambda o: getattr(o, "__dict__", str(o))))


class RecordingClient:
    """Wraps the client the original ask_agent() uses and captures every request in full."""

    def __init__(self, inner):
        self.inner = inner
        self.capture: dict | None = None
        self.requests_made = 0
        self.chat = type("Chat", (), {"completions": type("Completions", (), {"create": self._create})()})()

    def _create(self, **kwargs):
        self.requests_made += 1
        cap = {"request": kwargs, "started_at": L.utc_now(), "attempt": 1}
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
            return resp
        except BaseException as exc:  # recorded, then re-raised to the caller
            cap["error"] = {
                "type": type(exc).__name__,
                "module": type(exc).__module__,
                "status_code": getattr(exc, "status_code", None),
                "message": str(exc)[:500],
            }
            raise
        finally:
            cap["ended_at"] = L.utc_now()
            cap["latency_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            self.capture = cap


def forbidden_downlink(*_a, **_k):
    raise RuntimeError("device downlink (C2D) is forbidden during the baseline measurement")


def pip_freeze() -> str:
    res = subprocess.run([sys.executable, "-m", "pip", "freeze"], capture_output=True, text=True)
    return res.stdout if res.returncode == 0 else f"# pip freeze failed: {res.stderr.strip()}\n"


def build_record(seq, row_index, cond, row, system, user, reply, capture, exc) -> dict:
    resp = (capture or {}).get("response") or {}
    choice = (resp.get("choices") or [{}])[0]
    usage = resp.get("usage")
    return {
        "seq": seq,
        "row_index": row_index,
        "scenario_id": row["scenario_id"],
        "condition": cond,
        "input": user,
        "input_sha256": L.sha256_text(user),
        "system_prompt_sha256": L.sha256_text(system),
        "request": (capture or {}).get("request"),
        "started_at": (capture or {}).get("started_at"),
        "ended_at": (capture or {}).get("ended_at"),
        "latency_ms": (capture or {}).get("latency_ms"),
        "attempt": 1,
        "http_status": (capture or {}).get("http_status"),
        "headers": (capture or {}).get("headers"),
        "response_full": resp or None,
        "response_model": resp.get("model"),
        "finish_reason": choice.get("finish_reason"),
        "usage": usage,
        "reply": reply,
        "parsed_label": L.parse_label(reply),
        "error": (capture or {}).get("error") or ({"type": type(exc).__name__, "message": str(exc)[:500]} if exc else None),
    }


def write_report(run_dir: str, config: dict, summary: dict) -> None:
    fake = config["mode"] == "dry-run"
    lines = ["# Baseline A measurement report", ""]
    if fake:
        lines += ["> **DRY RUN WITH A FAKE CLIENT. Nothing here measures any model.** It only shows that the harness works.", ""]
    lines += [
        f"- Run: `{config['run_id']}`, mode `{config['mode']}`, status **{summary['status']}**",
        f"- Source: `{config['source']['kind']}` at tag `{TAG}` (commit `{BASE_COMMIT[:7]}`)",
        f"- Calls started: {summary['budget']['calls_started']} of {summary['budget']['max_calls']} allowed; "
        f"tokens committed: {summary['budget']['tokens_committed']} of {summary['budget']['max_tokens']}",
        f"- Stop reason: {summary['stop_reason']}",
        f"- Models reported by the API: {summary['distinct_response_models'] or 'none'}"
        + ("  **(more than one: the model changed during the run)**" if summary["model_drift_flag"] else ""),
        "",
        "Scope: see `SCOPE.md` in this directory. Router stage only, two conditions, legacy gold labels, not the production pipeline.",
        "",
        "| Condition | Rows | Correct | Accuracy | Failed calls | Invalid replies |",
        "|---|---|---|---|---|---|",
    ]
    for cond, entry in summary["conditions"].items():
        for part in ("all_rows_started", "rows_reaching_router"):
            p = entry[part]
            shown = "withheld (fake)" if fake else p["accuracy"]
            lines.append(f"| {cond} / {part} | {p['n']} | {p['correct']} | {shown} | {p['failed_calls']} | {p['invalid_replies']} |")
    lines += [
        "",
        f"Legacy gold rows labelled critical but at or above 30 cm: {summary['legacy_label_rows_critical_at_or_above_30cm']} "
        "(the label policy disagrees with the 30 cm rule; these rows are scored as labelled, not relabelled).",
    ]
    open(os.path.join(run_dir, "report.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")


def run(args) -> int:
    repo = repo_root()
    real = args.mode == "real"

    for name in L.FORBIDDEN_ENV:
        if os.environ.get(name):
            print(f"refusing to run: environment variable {name} is set (could reach devices or storage)", file=sys.stderr)
            return 2
    if real:
        if not (args.authorized_by and args.usd_cap and args.max_calls and args.max_tokens):
            print("a real run needs --authorized-by, --usd-cap, --max-calls and --max-tokens", file=sys.stderr)
            return 2
        if os.environ.get("BASELINE_A_AUTHORIZED") != "yes":
            print("a real run also needs BASELINE_A_AUTHORIZED=yes in the environment", file=sys.stderr)
            return 2
        if git(repo, "status", "--porcelain", "--untracked-files=no"):
            print("a real run needs a clean working tree (tracked files)", file=sys.stderr)
            return 2
    else:
        block_network()
    max_calls = args.max_calls or 400
    max_tokens = args.max_tokens or 150_000

    out_root = args.out_root or os.path.join(repo, "eval/baseline_v1", "measured" if real else "measure/dryrun")
    os.makedirs(out_root, exist_ok=True)
    source_root, cleanup, source_info = restore_source(args.source, repo)
    run_dir = None
    try:
        source_hashes = verify_source(source_root, repo)
        rows = L.load_rows(os.path.join(source_root, CSV_REL), args.limit)
        prompts = read_prompts(source_root)

        sys.path.insert(0, os.path.join(source_root, "src/cloud-orchestrator"))
        import embodied_brain.utils as U  # the ORIGINAL code, imported from the restored source

        U.ASK_AGENT_CACHE_TTL = 0  # no cache hits: every row must really be sent
        U.send_c2d_message = forbidden_downlink
        brain = sys.modules.get("embodied_brain.brain")
        if brain is not None:
            brain.send_c2d_message = forbidden_downlink

        if real:
            inner = U.get_llm_client()  # original code builds the client from the environment
            limited = inner.with_options(max_retries=0, timeout=L.SDK_TIMEOUT_S)
            if getattr(limited, "max_retries", None) != 0:
                raise SystemExit("could not confirm that SDK retries are disabled")
            client = RecordingClient(limited)
        else:
            sys.path.insert(0, HERE)
            from fake_client import FakeClient

            faults = {} if args.fault_plan == "none" else None
            fake = FakeClient(faults=faults)
            limited = fake.with_options(max_retries=0, timeout=L.SDK_TIMEOUT_S)
            if limited.max_retries != 0:
                raise SystemExit("could not confirm that SDK retries are disabled")
            client = RecordingClient(limited)
            U._llm_config = U.get_llm_config("BRAIN")
        U.get_llm_client = lambda: client
        cfg = U._llm_config or U.get_llm_config("BRAIN")

        run_dir = L.make_run_dir(out_root, args.mode)
        run_id = os.path.basename(run_dir)
        scope_path = os.path.join(HERE, "SCOPE.md")
        shutil.copy(scope_path, os.path.join(run_dir, "SCOPE.md"))
        config = {
            "run_id": run_id,
            "mode": args.mode,
            "is_measurement": real,
            "started_at": L.utc_now(),
            "tag": TAG,
            "tag_object": git(repo, "rev-parse", TAG),
            "baseline_commit": BASE_COMMIT,
            "repo_head": git(repo, "rev-parse", "HEAD"),
            "source": {**source_info, "verified_against": "eval/baseline_v1/SHA256SUMS", "file_sha256": source_hashes},
            "harness": {n: L.sha256_file(os.path.join(HERE, n)) for n in ("run_baseline_a.py", "measure_lib.py", "fake_client.py", "SCOPE.md")},
            "inputs": {
                "csv": CSV_REL,
                "csv_sha256": source_hashes[CSV_REL],
                "rows_used": len(rows),
                "sample_input_B": L.build_input("B", rows[0]),
                "sample_input_P": L.build_input("P", rows[0]),
            },
            "prompts": {c: {"sha256": L.sha256_text(t), "chars": len(t), "text": t} for c, t in prompts.items()},
            "model": {
                "provider": cfg.provider.name,
                "endpoint_host": urlparse(cfg.endpoint).netloc or None,
                "configured_model_name": cfg.model_name,
                "api_key_present": bool(cfg.api_key),
                "real_model_is_the_response_model_field": True,
            },
            "request_settings": {
                "temperature": L.TEMPERATURE,
                "max_completion_tokens": L.MAX_COMPLETION_TOKENS,
                "sdk_max_retries": limited.max_retries,
                "sdk_timeout_s": L.SDK_TIMEOUT_S,
                "ask_agent_cache_ttl_s": U.ASK_AGENT_CACHE_TTL,
                "order": "B and P interleaved per row; the condition that goes first alternates by row",
            },
            "budget": {"max_calls": max_calls, "max_tokens": max_tokens, "chars_per_token_assumed": L.CHARS_PER_TOKEN},
            "authorization": {"authorized_by": args.authorized_by, "usd_cap": args.usd_cap} if real else None,
            "environment": {
                "python": sys.version.split()[0],
                "platform": platform.platform(),
                "openai_sdk": metadata.version("openai") if _has("openai") else None,
                "llm_env_names_set": sorted(k for k in os.environ if k.startswith(("LLM_", "OPENAI_", "AZURE_OPENAI_", "BRAIN_"))),
                "forbidden_env_set": [],
            },
        }
        L.write_json(os.path.join(run_dir, "config.json"), config)
        open(os.path.join(run_dir, "pip_freeze.txt"), "w", encoding="utf-8").write(pip_freeze())

        guard = L.BudgetGuard(max_calls, max_tokens)
        records, stop_reason = [], "completed all planned calls"
        plan = L.plan_order(len(rows))
        with open(os.path.join(run_dir, "calls.jsonl"), "w", encoding="utf-8") as calls_file:
            for seq, row_index, cond in plan:
                row, system = rows[row_index], prompts[cond]
                user = L.build_input(cond, row)
                worst = L.estimate_tokens(system, user)
                try:
                    guard.before(worst)  # checked BEFORE the request is sent
                except L.BudgetExceeded as exc:
                    stop_reason = f"stopped before sending call #{seq}: {exc.reason}"
                    break
                before = client.requests_made
                reply, exc_caught, client.capture = None, None, None
                try:
                    reply = U.ask_agent(system, user, max_completion_tokens=L.MAX_COMPLETION_TOKENS)
                except Exception as exc:  # noqa: BLE001 - recorded, never swallowed silently
                    exc_caught = exc
                if client.requests_made != before + 1:
                    raise SystemExit(f"call #{seq}: expected exactly one request, saw {client.requests_made - before}")
                record = build_record(seq, row_index, cond, row, system, user, reply, client.capture, exc_caught)
                total = (record["usage"] or {}).get("total_tokens")
                guard.settle(worst, total)
                records.append(record)
                calls_file.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
                calls_file.flush()

        summary = L.summarize(records, rows)
        if not real:
            # The fake model's answers are not a measurement, so no accuracy is published for it.
            for entry in summary["conditions"].values():
                for part in ("all_rows_started", "rows_reaching_router"):
                    entry[part]["accuracy"] = None
            summary["accuracy_withheld"] = "dry run with a fake client: accuracy is deliberately not reported"
        summary.update(
            {
                "run_id": run_id,
                "mode": args.mode,
                "is_measurement": real and stop_reason.startswith("completed"),
                "status": "completed" if stop_reason.startswith("completed") else "stopped_early",
                "stop_reason": stop_reason,
                "planned_calls": len(plan),
                "calls_recorded": len(records),
                "requests_that_reached_the_client": client.requests_made,
                "budget": guard.snapshot(),
                "ended_at": L.utc_now(),
            }
        )
        L.write_json(os.path.join(run_dir, "summary.json"), summary)
        write_report(run_dir, config, summary)
        L.write_sha256sums(run_dir)
        problems = L.verify_run_dir(run_dir)
        print(f"run directory: {run_dir}")
        print(f"calls recorded: {len(records)} / planned {len(plan)}; status: {summary['status']}; {stop_reason}")
        print("hash verification:", "OK" if not problems else problems)
        return 0 if not problems else 1
    finally:
        cleanup()


def _has(module: str) -> bool:
    try:
        metadata.version(module)
        return True
    except metadata.PackageNotFoundError:
        return False


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--mode", choices=("dry-run", "real"), default="dry-run")
    p.add_argument("--source", choices=("worktree", "archive"), default="worktree")
    p.add_argument("--out-root")
    p.add_argument("--limit", type=int, help="use only the first N rows (rehearsal only)")
    p.add_argument("--max-calls", type=int)
    p.add_argument("--max-tokens", type=int)
    p.add_argument("--authorized-by")
    p.add_argument("--usd-cap")
    p.add_argument("--fault-plan", choices=("default", "none"), default="default", help="dry-run only")
    p.add_argument("--verify", metavar="RUN_DIR", help="re-check the hashes of an existing run directory")
    args = p.parse_args(argv)
    if args.verify:
        problems = L.verify_run_dir(args.verify)
        print("OK" if not problems else "\n".join(problems))
        return 0 if not problems else 1
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
