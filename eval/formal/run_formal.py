"""Formal evaluation entry for external (private, frozen) data. Built on the accepted baseline-B evaluator; `run_dev_eval.py` is untouched.

    python eval/formal/run_formal.py freeze                              # write CODE_FREEZE.json: hashes of every file that decides a result
    python eval/formal/run_formal.py plan  [--acceptance-dir D]          # offline: requests, token and cost upper bounds (+ the expected cost from the dev run)
    python eval/formal/run_formal.py check-format --acceptance-dir D     # counts and hash checks only; prints no record
    python eval/formal/run_formal.py run --suite main|stress|rules ...   # one run (--twice: two independent runs, then the reproducibility gate)
    python eval/formal/run_formal.py compare --run-a A --run-b B ...     # the gate on two private run directories

Data comes from a path with an expected SHA-256 (`--data` + `--expect-sha256`, `--stress-data` + `--stress-expect-sha256`), or from `--acceptance-dir`, whose file hashes are taken
from eval/acceptance/FROZEN_MANIFEST.json. The hash is checked BEFORE anything is read for scoring. When the file is the frozen acceptance file, its class and note-status counts
must also match the manifest; any other file (for example the public dev set) is run without that check and never counts as the formal measurement.

Guarantees: every file that decides a result must match CODE_FREEZE.json; gold is RECOMPUTED from telemetry and annotated note status by the frozen specification, never trusted
from the file; the prompt is baseline B (B-1.0) and its hash must equal the manifest's; one request per record, SDK retries off, no local result cache (the client is called
directly, `ask_agent`'s cache is not used), failures and invalid replies stay in the denominator; record-level results stay in the PRIVATE directory (outside the repository),
only aggregates (no ids, no inputs, no replies) are published. The rule controls R1/R2 are scored on the same records with no model call, next to baseline B.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import platform
import signal
import sys
from collections import Counter
from decimal import Decimal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
for sub in ("eval/spec", "eval/dev", "eval/baseline_v1/measure", "eval/baseline_b", "src/cloud-orchestrator"):
    sys.path.insert(0, os.path.join(ROOT, sub))
import evaluate as E  # noqa: E402
import measure_lib as L  # noqa: E402
import prompt_b as P  # noqa: E402
import reference_labeler as R  # noqa: E402
import rule_control as C  # noqa: E402
import run_dev_eval as RUN  # noqa: E402  (RecordingClient, build_call_record, resolve_budget, git, block_network, raise_interrupt)

MANIFEST = os.path.join(ROOT, "eval/acceptance/FROZEN_MANIFEST.json")
FREEZE = os.path.join(HERE, "CODE_FREEZE.json")
DEV_RUN_SUMMARY = os.path.join(ROOT, "eval/baseline_b/runs/20261107T075357Z_real_c5e026a8/summary.json")  # public: the measured per-call average
FROZEN_FILES = ["eval/baseline_b/prompt_b.py", "eval/baseline_b/evaluate.py", "eval/baseline_b/run_dev_eval.py", "eval/baseline_v1/measure/measure_lib.py",
                "eval/formal/run_formal.py", "eval/spec/reference_labeler.py", "eval/spec/SHA256SUMS", "eval/spec/rule_control.py",
                "src/cloud-orchestrator/router_v2/rules.py", "src/cloud-orchestrator/router_v2/prompt.py", "src/cloud-orchestrator/router_v2/pipeline.py"]
TELE = ("distance_cm", "velocity_ms", "hp", "battery_pct", "temperature_c")
GATE = {"agreement_min": 0.98, "accuracy_diff_max_points": 2.0}
SCORING_POLICY = ("an error, an unusable or truncated reply and an interrupted request stay in the denominator and count as wrong; nothing is retried or dropped; "
                  "primary route is the main metric, note_status is reported apart, a success-only accuracy may be shown next to the main figure and never instead of it")
STRESS_MODEL_TYPES = (3, 4, 5, 6, 7, 8, 9)  # types whose cases may need a model request (type 9 only when its input is valid)
CAPS = {"health_canary": {"max_calls": 2, "max_tokens": 20_000, "usd": "0.02"}, "main_run": {"max_calls": 300, "max_tokens": 600_000, "usd": "0.25"},
        "stress_run": {"max_calls": 40, "max_tokens": 100_000, "usd": "0.05"}}                          # the health canary runs on the PUBLIC dev file and is part of the total


def sha(path: str) -> str:
    return L.sha256_file(path)


def code_hashes() -> dict:
    return {f: sha(os.path.join(ROOT, f)) for f in FROZEN_FILES}


def load_manifest(path: str | None = None) -> dict:
    with open(path or MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def read_jsonl(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(x) for x in f if x.strip()]


# --- the external files: hash first, then validation and normalisation (messages never echo a record) ---------------------------------

def ident(raw: dict, line: int) -> str:
    """The record id: `id` or `case_id` (the private stress file uses `case_id`); both present must be equal. Internally always `id`."""
    a, b = raw.get("id"), raw.get("case_id")
    if a is not None and b is not None and a != b:
        raise ValueError(f"line {line}: `id` and `case_id` are both present and differ")
    v = a if a is not None else b
    if not isinstance(v, str) or not v:
        raise ValueError(f"line {line}: a record needs a string `id` (or `case_id`)")
    return v


def normalize_test(raw: dict, line: int) -> dict:
    if not isinstance(raw, dict) or not isinstance(raw.get("telemetry"), dict) or set(raw["telemetry"]) != set(TELE):
        raise ValueError(f"line {line}: a record needs id, telemetry with exactly {list(TELE)}, note and note_status")
    rid = ident(raw, line)
    note, status = raw.get("note"), raw.get("note_status")
    if (note is None) != (status is None) or (note is not None and (not isinstance(note, str) or not note.strip())):
        raise ValueError(f"line {line}: note and note_status must both be present (note non-blank text) or both null")
    if R.check_input(raw["telemetry"], note) is not None:
        raise ValueError(f"line {line}: a test record must satisfy the input contract")
    gold = R.compose(raw["telemetry"], status)
    if not gold["valid"]:
        raise ValueError(f"line {line}: invalid record")
    if isinstance(raw.get("gold"), dict) and raw["gold"].get("primary") != gold["primary"]:
        raise ValueError(f"line {line}: the file's gold primary differs from the one recomputed from telemetry and note_status")
    clean = note.strip() if note else None
    return {"id": rid, "family_id": raw.get("family_id"), "telemetry": raw["telemetry"], "note": clean, "note_status": status,
            "rendered_input": R.render_telemetry(raw["telemetry"], clean),
            "gold": {"primary": gold["primary"], "risk_set": gold["risk_set"], "telemetry_risks": gold["telemetry_risks"], "gate": gold["gate"], "action": gold["action"]}}


def normalize_stress(raw: dict, line: int) -> dict:
    ty = raw.get("type") if isinstance(raw, dict) else None
    if not isinstance(raw, dict) or not isinstance(ty, int) or isinstance(ty, bool) or not 1 <= ty <= 11 or "telemetry" not in raw:
        raise ValueError(f"line {line}: a stress case needs id (or case_id), type 1..11 and telemetry")
    rid = ident(raw, line)
    fault = raw.get("fault") or {10: "TIMEOUT", 11: "RATE_LIMIT"}.get(ty)
    if fault is not None and fault not in R.FAULTS:
        raise ValueError(f"line {line}: unknown fault")
    estop = raw.get("estop", False)
    if not isinstance(estop, bool):
        raise ValueError(f"line {line}: estop must be a boolean")
    return {"id": rid, "type": ty, "telemetry": raw["telemetry"], "note": raw.get("note"), "note_status": raw.get("note_status"), "estop": estop, "fault": fault}


def resolve(args, manifest: dict, kind: str) -> tuple[str, str, bool]:
    """(path, expected sha256, is_the_frozen_file) for 'main' or 'stress'. An explicit --data needs its --expect-sha256."""
    name = "test_set.jsonl" if kind == "main" else "stress_cases.jsonl"
    path = args.data if kind == "main" else args.stress_data
    expect = args.expect_sha256 if kind == "main" else args.stress_expect_sha256
    if path:
        if not expect:
            raise SystemExit(f"--{'data' if kind == 'main' else 'stress-data'} needs its expected SHA-256 (--{'expect-sha256' if kind == 'main' else 'stress-expect-sha256'})")
    elif args.acceptance_dir:
        path, expect = os.path.join(args.acceptance_dir, name), manifest["sha256"][name]
    else:
        raise SystemExit(f"no {kind} data given: use --acceptance-dir or --{'data' if kind == 'main' else 'stress-data'} with its expected SHA-256")
    return path, expect, expect == manifest["sha256"][name]


def load_data(args, manifest: dict, need: tuple = ("main", "stress")) -> tuple[list, list, dict]:
    """Hash-check, then validate and normalise. Returns (test records, stress cases, which of them are the frozen acceptance files)."""
    if L.sha256_file(os.path.join(ROOT, "eval/spec/SHA256SUMS")) != manifest["sha256"]["spec_SHA256SUMS"]:
        raise SystemExit("the specification files differ from the frozen manifest")
    if manifest.get("baseline_B_prompt_sha256") != L.sha256_text(P.SYSTEM_PROMPT):
        raise SystemExit("the baseline-B prompt differs from the frozen manifest")
    out, frozen = {"main": [], "stress": []}, {}
    for kind, norm in (("main", normalize_test), ("stress", normalize_stress)):
        if kind not in need:
            continue
        path, expect, is_frozen = resolve(args, manifest, kind)
        if not os.path.isfile(path):
            raise SystemExit(f"the {kind} data file was not found")
        if sha(path) != expect:
            raise SystemExit(f"the {kind} data file does not match the expected SHA-256 (nothing was read for scoring)")
        try:
            rows = [norm(r, i) for i, r in enumerate(read_jsonl(path), 1)]
        except (ValueError, json.JSONDecodeError) as exc:
            raise SystemExit(f"the {kind} data file: {exc}")
        if len({r["id"] for r in rows}) != len(rows):
            raise SystemExit(f"the {kind} data file has duplicate ids")
        out[kind], frozen[kind] = rows, is_frozen
    test, stress = out["main"], out["stress"]
    if test and frozen["main"]:
        cc = Counter(r["gold"]["primary"] for r in test)
        if len(test) != manifest["M"] or dict(cc) != manifest["class_counts"] or sum(1 for r in test if r["note"]) != manifest["noted_records"] \
                or dict(Counter(r["note_status"] for r in test if r["note"])) != manifest["note_status_counts"]:
            raise SystemExit("counts per class or per note status differ from the frozen manifest")
    if stress and frozen["stress"]:
        if len(stress) != manifest["stress_records"] or {str(k): v for k, v in Counter(r["type"] for r in stress).items()} != manifest["stress_type_counts"]:
            raise SystemExit("stress case counts differ from the frozen manifest")
    return test, stress, frozen


def check_code_freeze() -> dict:
    if not os.path.isfile(FREEZE):
        raise SystemExit("CODE_FREEZE.json is missing: run `freeze` and review it first")
    freeze = json.load(open(FREEZE, encoding="utf-8"))
    frozen = freeze["files"]
    if freeze.get("frozen_manifest_sha256") != sha(MANIFEST):
        raise SystemExit("the frozen data manifest changed since the code freeze (a new freeze and review are needed)")
    if freeze.get("baseline_B_prompt_sha256") != L.sha256_text(P.SYSTEM_PROMPT):
        raise SystemExit("the baseline-B prompt differs from the one recorded in the code freeze")
    now = code_hashes()
    changed = sorted(f for f in FROZEN_FILES if frozen.get(f) != now[f])
    if changed:
        raise SystemExit("files changed since the freeze (a new freeze and review are needed): " + ", ".join(changed))
    return now


# --- aggregates ----------------------------------------------------------------------------------------------------------------------

def success_only(records: list[dict], calls: list[dict]) -> dict:
    by_id = {c["id"]: c for c in calls}
    ok = [(r, by_id[r["id"]]) for r in records if r["id"] in by_id and E.usable(by_id[r["id"]], r)]
    k = sum(E.outcome(c, r) == r["gold"]["primary"] for r, c in ok)
    return {"n": len(ok), "correct": k, "accuracy": round(k / len(ok), 4) if ok else None, "ci95_wilson": E.wilson(k, len(ok)),
            "note": "accuracy among calls that returned a usable reply; reported NEXT TO the main figure, never instead of it"}


def public_view(metrics: dict) -> dict:
    m = copy.deepcopy(metrics)
    m["safety"].pop("missed_halt_ids", None)
    return m


def rule_controls(records: list[dict]) -> dict:
    """R1 / R2 on the same records and the same scorer; no model call, no budget."""
    out = {}
    for variant in ("R1", "R2"):
        calls = [{"id": r["id"], "prediction": C.predict(r["rendered_input"], variant), "finish_reason": "stop", "error": None} for r in records]
        out[variant] = E.evaluate(records, calls)
    return out


# --- one run -------------------------------------------------------------------------------------------------------------------------

def make_client(args, real: bool):
    if real:
        from openai import OpenAI
        model_name, base_url = os.environ["OPENAI_MODEL_NAME"], os.environ["OPENAI_BASE_URL"]
        inner = OpenAI(base_url=base_url, api_key=os.environ["OPENAI_API_KEY"]).with_options(max_retries=0, timeout=L.SDK_TIMEOUT_S)
    else:
        from fake_model import FakeClient
        faults = {} if args.fault_plan == "none" else None if args.fault_plan == "default" else {int(k): v for k, v in json.loads(args.fault_plan).items()}
        inner, model_name, base_url = FakeClient(faults=faults).with_options(max_retries=0, timeout=L.SDK_TIMEOUT_S), "fake-model-b", ""
    if getattr(inner, "max_retries", None) != 0:
        raise SystemExit("could not confirm that SDK retries are disabled")
    return inner, model_name, base_url


def run_once(args, real, manifest, records, frozen_data, hashes) -> tuple[int, str, dict]:
    """One independent run: fresh client, fresh budget guard, its own private directory. Returns (exit code, private dir, summary)."""
    suite = args.suite
    usd_cap, pricing = RUN.resolve_budget(args, real)
    inner, model_name, base_url = make_client(args, real)
    client = RUN.RecordingClient(inner, model_name)
    private_root = args.private_out or os.path.join(HERE, "dryrun_private")
    os.makedirs(private_root, exist_ok=True)
    run_dir = L.make_run_dir(private_root, f"{suite}_{args.mode}")
    max_calls, max_tokens = args.max_calls or len(records), args.max_tokens or 600_000
    config = {"run_id": os.path.basename(run_dir), "suite": suite, "mode": args.mode, "is_canary": bool(args.limit), "started_at": L.utc_now(), "repo_head": RUN.git("rev-parse", "HEAD"),
              "frozen_tag": args.frozen_tag, "spec_version": R.SPEC_VERSION, "manifest_version": manifest["version"], "data_is_frozen_acceptance_file": frozen_data,
              "dataset_sha256": {"main": getattr(args, "_main_sha", None), "stress": getattr(args, "_stress_sha", None)},
              "code_freeze_sha256": sha(FREEZE) if os.path.isfile(FREEZE) else None, "code_hashes": hashes,
              "baseline": {"name": "B", "prompt_version": P.PROMPT_VERSION, "prompt_sha256": L.sha256_text(P.SYSTEM_PROMPT)},
              "model": {"configured_model_name": model_name, "identity_stated_by_owner": args.model_identity or "REHEARSAL: fake model", "unverified": True,
                        "note": "the API reports only an alias; temperature=0 is sent but the provider's default reasoning mode ignores it"},
              "request_settings": {"temperature": L.TEMPERATURE, "max_tokens": RUN.MAX_TOKENS, "sdk_max_retries": inner.max_retries, "sdk_timeout_s": L.SDK_TIMEOUT_S,
                                   "local_result_cache": "none: the client is called directly for every record; ask_agent's cache is not used"},
              "scoring_policy": SCORING_POLICY, "budget": {"max_calls": max_calls, "max_tokens": max_tokens, "max_usd": str(usd_cap), "pricing": pricing.as_dict()},
              "authorization": {"authorized_by": args.authorized_by, "usd_cap_as_given": args.usd_cap} if real else None,
              "environment": {"python": sys.version.split()[0], "platform": platform.platform()},
              "policy": "one request per record, no retry, failures count as wrong, no tuning on this run; record-level results stay private"}
    L.write_json(os.path.join(run_dir, "config.json"), config)
    guard = L.BudgetGuard(max_calls, max_tokens, usd_cap, pricing)
    calls: list[dict] = []
    status, stop_reason, interruption, inflight = "completed", "completed all planned calls", None, None
    state: dict = {"inflight": None}                      # the stress path keeps its current case, request and reservation here
    f = open(os.path.join(run_dir, "calls.jsonl"), "w", encoding="utf-8")

    def write(c):
        calls.append(c)
        f.write(json.dumps(c, ensure_ascii=False, sort_keys=True) + "\n")
        f.flush()

    try:
        if suite == "main":
            for seq, rec in enumerate(records, 1):
                try:
                    resv = guard.reserve(L.input_token_upper_bound(P.SYSTEM_PROMPT, rec["rendered_input"]), RUN.MAX_TOKENS)
                except L.BudgetExceeded as exc:
                    status, stop_reason = "stopped_early", f"stopped before sending call #{seq}: {exc.reason}"
                    break
                inflight = (seq, rec, resv)
                client.last = None
                cap = client.call(rec["rendered_input"])
                call = RUN.build_call_record(seq, rec, cap)
                write(call)
                inflight = None
                try:
                    guard.settle(resv, call["usage"])
                except L.BoundViolation as exc:
                    status, stop_reason = "stopped_bound_violation", f"bound violated by call #{seq}: {exc.reason}"
                    break
        else:
            status, stop_reason = run_stress(records, client, guard, write, state)
    except BaseException as exc:  # noqa: BLE001 - seal what exists
        interruption = {"type": type(exc).__name__, "message": str(exc)[:500]}
        status = "interrupted" if isinstance(exc, KeyboardInterrupt) else "crashed"
        stop_reason = f"{status}: {interruption['type']}: {interruption['message']}"
        if inflight is not None:
            seq, rec, resv = inflight
            c = RUN.build_call_record(seq, rec, getattr(client, "last", None), exc)
            c.update({"status": "in_flight_at_interruption", "reserved": {"input_bound": resv.input_bound, "output_bound": resv.output_bound, "usd": str(resv.usd)}})
            write(c)
        if state["inflight"] is not None:                 # stress: a request was started and never returned
            seq, case, resv = state["inflight"]
            write({"seq": seq, "id": case["id"], "type": case["type"], "status": "in_flight_at_interruption", "model_called": True, "injected_fault": None,
                   "executed": R.execute(case["telemetry"], None, case["note"], case["estop"], fault="API_ERROR"), "prediction": None, "parse_error": "interrupted",
                   "invalid_reason": None, "request": (getattr(client, "last", None) or {}).get("request"), "response_full": None,
                   "error": {"type": type(exc).__name__, "message": str(exc)[:500]}, "usage": None, "reply": None, "response_model": None,
                   "reserved": {"input_bound": resv.input_bound, "output_bound": resv.output_bound, "usd": str(resv.usd)}})
    finally:
        f.close()
    usable = [c for c in calls if isinstance((c.get("usage") or {}).get("prompt_tokens"), int) and isinstance((c.get("usage") or {}).get("completion_tokens"), int)]
    summary = {"run_id": config["run_id"], "suite": suite, "mode": args.mode, "status": status, "stop_reason": stop_reason, "interruption": interruption, "is_canary": bool(args.limit),
               "is_measurement": real and status == "completed" and not args.limit and frozen_data, "planned": len(records), "calls_recorded": len(calls),
               "requests_that_reached_the_client": client.requests_made, "budget": guard.snapshot(), "calls_without_usable_usage": len(calls) - len(usable),
               "distinct_response_models": sorted({c["response_model"] for c in calls if c.get("response_model")}),
               "usd_from_reported_usage": f"{sum((pricing.cost(c['usage']['prompt_tokens'], c['usage']['completion_tokens']) for c in usable), Decimal(0)):.6f}", "ended_at": L.utc_now()}
    summary["model_drift_flag"] = len(summary["distinct_response_models"]) > 1
    if suite == "main":
        summary["metrics"] = E.evaluate(records, calls)
        summary["success_only_primary"] = success_only(records, calls)
        summary["rule_controls"] = rule_controls(records)
    else:
        summary["stress"] = stress_metrics(records, calls)
    L.write_json(os.path.join(run_dir, "summary.json"), summary)
    L.write_sha256sums(run_dir)
    problems = L.verify_run_dir(run_dir)
    write_public(args, config, summary, run_dir, real)
    print(f"private run directory: {run_dir}\nstatus: {status}; {stop_reason}\nhash verification:", "OK" if not problems else problems)
    code = 1 if problems else {"interrupted": 130, "crashed": 1, "stopped_bound_violation": 3}.get(status, 0)
    return code, run_dir, summary


def run(args) -> int:
    real = args.mode == "real"
    manifest = load_manifest(args.manifest if (args.manifest and not real) else MANIFEST)
    if RUN.resolve_budget(args, real) is None:
        return 2
    if real:
        if os.environ.get("BASELINE_B_AUTHORIZED") != "yes":
            print("a real run also needs BASELINE_B_AUTHORIZED=yes in the environment", file=sys.stderr)
            return 2
        if RUN.git("status", "--porcelain", "--untracked-files=no"):
            print("a real run needs a clean working tree (tracked files)", file=sys.stderr)
            return 2
        if not args.frozen_tag or RUN.git("rev-parse", f"{args.frozen_tag}^{{commit}}") != RUN.git("rev-parse", "HEAD"):
            print("a real run needs --frozen-tag pointing at the current commit", file=sys.stderr)
            return 2
        if not args.private_out or os.path.realpath(args.private_out).startswith(os.path.realpath(ROOT)):
            print("the private output directory must be outside the repository", file=sys.stderr)
            return 2
    else:
        RUN.block_network()
    signal.signal(signal.SIGTERM, RUN.raise_interrupt)
    hashes = check_code_freeze() if (real or not args.skip_freeze_check) else code_hashes()
    need = ("stress",) if args.suite == "stress" else ("main",)
    test, stress, frozen = load_data(args, manifest, need=need)
    args._main_sha = resolve(args, manifest, "main")[1] if test else None
    args._stress_sha = resolve(args, manifest, "stress")[1] if stress else None
    records = test if args.suite in ("main", "rules") else stress
    if args.limit:
        records = records[: args.limit]
    frozen_data = bool(frozen.get("main" if args.suite != "stress" else "stress"))
    if args.suite == "rules":
        return run_rules(args, records, frozen_data, hashes, manifest)
    if args.twice:
        if args.suite != "main":
            print("--twice is for the main suite", file=sys.stderr)
            return 2
        dirs = []
        for k in (1, 2):
            print(f"--- independent run {k} of 2 ---")
            code, run_dir, summary = run_once(args, real, manifest, records, frozen_data, hashes)
            dirs.append(run_dir)
            if code != 0 or summary["status"] != "completed":
                print(f"run {k} did not complete ({summary['status']}): the second run is not started; report it as it is", file=sys.stderr)
                return code or 1
        res = compare_runs(dirs[0], dirs[1], records)
        print(json.dumps(res, indent=1))
        out = args.public_out or os.path.join(HERE, "results" if real else "dryrun_public")
        os.makedirs(out, exist_ok=True)
        L.write_json(os.path.join(out, f"reproducibility_{os.path.basename(dirs[0])}__{os.path.basename(dirs[1])}.json"), res)
        return 0 if res["passes"] else 4
    return run_once(args, real, manifest, records, frozen_data, hashes)[0]


def run_rules(args, records, frozen_data, hashes, manifest) -> int:
    """R1 / R2 alone: no model, no network, no budget."""
    rc = rule_controls(records)
    out = os.path.join(args.public_out or os.path.join(HERE, "results"), "rules_" + L.utc_now().replace(":", "").replace(".", ""))
    os.makedirs(out, exist_ok=False)
    pub = {"suite": "rules", "records": len(records), "data_is_frozen_acceptance_file": frozen_data, "dataset_sha256": args._main_sha, "code_freeze_sha256": sha(FREEZE) if os.path.isfile(FREEZE) else None,
           "controls": {k: public_view(v) for k, v in rc.items()}, "note": "no model call; informational comparison for baseline B, same records, same scorer"}
    L.write_json(os.path.join(out, "public_summary.json"), pub)
    print("public aggregates:", out)
    return 0


def run_stress(cases, client, guard, write, state):
    """Stress cases go through the backend decision path (router_v2.decide). Input-check cases never reach a model; injected faults produce no API request."""
    from router_v2 import ModelReply, decide

    for seq, c in enumerate(cases, 1):
        bound = {"resv": None}

        def call_model(system, user, c=c, bound=bound):
            if c["fault"]:
                return ModelReply(fault=c["fault"])                      # injected: no request leaves the machine
            bound["resv"] = guard.reserve(L.input_token_upper_bound(system, user), RUN.MAX_TOKENS)
            state["inflight"] = (seq, c, bound["resv"])      # from here until the record is written, an interruption leaves a started request
            client.last = None
            cap = client.call(user)
            bound["cap"] = cap
            resp = cap.get("response") or {}
            ch = (resp.get("choices") or [{}])[0]
            if cap.get("error"):
                return ModelReply(fault=E.fault_of({"error": cap["error"]}))
            return ModelReply(content=(ch.get("message") or {}).get("content"), finish_reason=ch.get("finish_reason"), usage=resp.get("usage"))

        try:
            res = decide(c["telemetry"], c["note"], call_model, estop=c["estop"])
        except L.BudgetExceeded as exc:
            return "stopped_early", f"stopped before sending call #{seq}: {exc.reason}"
        cap_ = bound.get("cap") or {}
        usage = (cap_.get("response") or {}).get("usage")
        write({"seq": seq, "id": c["id"], "type": c["type"], "model_called": bool(cap_), "injected_fault": c["fault"], "executed": res["executed"], "prediction": res.get("prediction"),
               "parse_error": res.get("parse_error"), "invalid_reason": res.get("invalid_reason"), "request": cap_.get("request"), "response_full": cap_.get("response"),
               "error": cap_.get("error"), "usage": usage, "response_model": (cap_.get("response") or {}).get("model"),
               "reply": (((cap_.get("response") or {}).get("choices") or [{}])[0].get("message") or {}).get("content")})
        state["inflight"] = None
        if bound["resv"] is not None:
            try:
                guard.settle(bound["resv"], usage)
            except L.BoundViolation as exc:
                return "stopped_bound_violation", f"bound violated by call #{seq}: {exc.reason}"
    return "completed", "completed all planned calls"


def stress_metrics(cases: list[dict], calls: list[dict]) -> dict:
    """Per type and in total, reported apart: input rejections, injected-fault halts, missed halts, needless halts, model errors, interface errors."""
    by_id = {c["id"]: c for c in calls}
    keys = ("cases", "started", "model_requests", "input_rejected_as_expected", "injected_fault_halts_as_expected", "missed_halt", "needless_halt",
            "model_unusable_replies", "model_wrong_primary", "interface_errors", "interrupted", "scored")
    per_type: dict[str, dict] = {}
    for case in cases:
        t = per_type.setdefault(str(case["type"]), dict.fromkeys(keys, 0))
        t["cases"] += 1
        call = by_id.get(case["id"])
        if call is None:
            continue
        t["started"] += 1
        if call.get("status") == "in_flight_at_interruption":      # started, no result: a failure, never dropped
            t["model_requests"] += 1
            t["interrupted"] += 1
            continue
        ex, requested = call["executed"], bool(call["request"])
        t["model_requests"] += requested
        invalid = R.check_input(case["telemetry"], case["note"]) is not None
        halt0 = ex["action"]["halt_reasons"][0] if ex["action"]["halt_reasons"] else None
        if invalid:
            t["input_rejected_as_expected"] += ex["action"]["motion"] == "HALT" and halt0 == "INVALID_INPUT" and not requested
            continue
        if case["fault"]:
            t["injected_fault_halts_as_expected"] += ex["action"]["motion"] == "HALT" and halt0 == case["fault"] and not requested
            continue
        gold = R.compose(case["telemetry"], case["note_status"] if (case["note"] or "").strip() else None, case["estop"])
        t["scored"] += 1
        gold_halt, got_halt = gold["action"]["motion"] == "HALT", ex["action"]["motion"] == "HALT"
        t["missed_halt"] += gold_halt and not got_halt
        t["needless_halt"] += got_halt and not gold_halt
        if call["error"]:
            t["interface_errors"] += 1
        elif not ex["valid"]:
            t["model_unusable_replies"] += 1
        elif call["prediction"] and call["prediction"]["primary"] != gold["primary"]:
            t["model_wrong_primary"] += 1
    total = {k: sum(v[k] for v in per_type.values()) for k in keys}
    return {"by_type": dict(sorted(per_type.items(), key=lambda kv: int(kv[0]))), "total": total,
            "note": "input rejections (types 1, 2 and invalid type 9) and injected faults (types 10, 11) are checked offline and send no API request; "
                    "model errors are unusable replies and wrong primary labels; interface errors are real API errors; all are reported apart from the classification accuracy"}


def write_public(args, config, summary, run_dir, real):
    out = os.path.join(args.public_out or os.path.join(HERE, "results" if real else "dryrun_public"), summary["run_id"])
    os.makedirs(out, exist_ok=False)
    pub = {"run_id": summary["run_id"], "suite": summary["suite"], "mode": summary["mode"], "status": summary["status"], "stop_reason": summary["stop_reason"], "is_canary": summary["is_canary"],
           "is_measurement": summary["is_measurement"], "data_is_frozen_acceptance_file": config["data_is_frozen_acceptance_file"], "planned": summary["planned"],
           "calls_recorded": summary["calls_recorded"], "requests_that_reached_the_client": summary["requests_that_reached_the_client"], "model_drift_flag": summary["model_drift_flag"],
           "model_identity_stated_by_owner": config["model"]["identity_stated_by_owner"], "spec_version": config["spec_version"], "prompt_sha256": config["baseline"]["prompt_sha256"],
           "repo_head": config["repo_head"], "frozen_tag": config["frozen_tag"], "dataset_sha256": config["dataset_sha256"], "code_freeze_sha256": config["code_freeze_sha256"],
           "scoring_policy": config["scoring_policy"], "private_calls_sha256": sha(os.path.join(run_dir, "calls.jsonl")), "private_summary_sha256": sha(os.path.join(run_dir, "summary.json")),
           "budget": summary["budget"], "usd_from_reported_usage": summary["usd_from_reported_usage"], "calls_without_usable_usage": summary["calls_without_usable_usage"],
           "cost_note": "computed at the configured conservative rates; not a bill; calls without reported usage keep their full reservation in `budget`"}
    if summary["suite"] == "main":
        pub["metrics"] = public_view(summary["metrics"])
        pub["success_only_primary"] = summary["success_only_primary"]
        pub["rule_controls"] = {k: public_view(v) for k, v in summary["rule_controls"].items()}
    else:
        pub["stress"] = summary["stress"]
    if not real:
        for k in ("metrics", "success_only_primary", "rule_controls", "stress"):
            pub.pop(k, None)
        pub["metrics_withheld"] = "dry run with a fake client: no figure is published"
    L.write_json(os.path.join(out, "public_summary.json"), pub)
    lines = [f"# Formal evaluation, suite `{pub['suite']}`: {pub['run_id']}", "",
             f"Status **{pub['status']}** ({pub['stop_reason']}); mode {pub['mode']}; counts as a measurement: {pub['is_measurement']} (frozen acceptance file: {pub['data_is_frozen_acceptance_file']}).",
             f"Prompt B-1.0 `{pub['prompt_sha256'][:16]}…`; spec {pub['spec_version']}; repo head `{pub['repo_head'][:12]}`; tag `{pub['frozen_tag']}`.",
             "Record-level results are private and not published; their hashes are in the JSON. Aggregates only. Not used for tuning in this round.", ""]
    if "metrics" in pub:
        p = pub["metrics"]["primary"]["all_started"]
        s = pub["success_only_primary"]
        lines += [f"**Main figure: accuracy {p['correct']}/{p['n']} = {p['accuracy']} (95 % Wilson {p['ci95_wilson']}); macro-F1 {p['macro_f1']}; errors {p['errors']}, invalid {p['invalid']}, interrupted {p['interrupted']}.**",
                  f"Next to it, not instead of it: among calls that returned a usable reply {s['correct']}/{s['n']} = {s['accuracy']} ({s['ci95_wilson']}).", "",
                  "| Class | Support | Precision | Recall | F1 |", "|---|---:|---:|---:|---:|"]
        lines += [f"| `{c}` | {v['support']} | {v['precision']} | {v['recall']} | {v['f1']} |" for c, v in p["per_class"].items()]
        lines += ["", "| System | Primary accuracy | Macro-F1 | Note status | missed_halt | needless_halt |", "|---|---:|---:|---:|---:|---:|"]
        for name, m in (("Baseline B", pub["metrics"]), *pub["rule_controls"].items()):
            a = m["primary"]["all_started"]
            lines.append(f"| {name} | {a['correct']}/{a['n']} = {a['accuracy']} | {a['macro_f1']} | {m['note_status']['correct']}/{m['note_status']['n']} | {m['safety']['missed_halt']} | {m['safety']['needless_halt']} |")
        n = pub["metrics"]["note_status"]
        lines += ["", f"Note status of baseline B (noted records, separate): per status recall {n['per_status_recall']}", f"Safety of baseline B: {pub['metrics']['safety']}"]
    if "stress" in pub:
        lines += ["| Type | " + " | ".join(next(iter(pub["stress"]["by_type"].values())).keys()) + " |", "|---|" + "---:|" * len(next(iter(pub["stress"]["by_type"].values())))]
        lines += [f"| {t} | " + " | ".join(str(v) for v in row.values()) + " |" for t, row in pub["stress"]["by_type"].items()]
        lines += ["", f"Total: {pub['stress']['total']}", pub["stress"]["note"]]
    open(os.path.join(out, "report.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("public aggregates:", out)


# --- the reproducibility gate ---------------------------------------------------------------------------------------------------------

def _dig(d, path):
    for k in path:
        d = d[k]
    return d


def compare_runs(dir_a: str, dir_b: str, records: list[dict]) -> dict:
    def load(d):
        return {c["id"]: c for c in read_jsonl(os.path.join(d, "calls.jsonl"))}, json.load(open(os.path.join(d, "config.json"), encoding="utf-8"))

    problems = []
    for tag, d in (("A", dir_a), ("B", dir_b)):
        v = L.verify_run_dir(d)
        if v:
            problems.append(f"run {tag}: the directory does not verify ({v[0]})")
    if problems:
        raise SystemExit("the two runs are not comparable: " + "; ".join(problems))
    a, ca = load(dir_a)
    b, cb = load(dir_b)
    sa, sb = (json.load(open(os.path.join(d, "summary.json"), encoding="utf-8")) for d in (dir_a, dir_b))
    recs = {r["id"]: r for r in records}
    checks = {
        "both runs must be completed main-suite runs": all(x["status"] == "completed" and x["suite"] == "main" and not x["is_canary"] for x in (sa, sb)),
        "both runs must cover every record exactly once": set(a) == set(b) == set(recs) and len(a) == sa["calls_recorded"] == sb["calls_recorded"] == len(recs),
        "same mode (a dry run cannot be compared with a real one)": ca["mode"] == cb["mode"],
        "same data": ca["dataset_sha256"] == cb["dataset_sha256"] and ca["data_is_frozen_acceptance_file"] == cb["data_is_frozen_acceptance_file"],
        "same prompt, spec version and code": ca["baseline"] == cb["baseline"] and ca["spec_version"] == cb["spec_version"] and ca["code_hashes"] == cb["code_hashes"],
        "same model configuration and declared identity": ca["model"] == cb["model"],
        "same request parameters, retries and timeout": ca["request_settings"] == cb["request_settings"],
        "same scoring policy": ca["scoring_policy"] == cb["scoring_policy"],
        "one and the same returned alias in both runs, no drift": sa["distinct_response_models"] == sb["distinct_response_models"] and len(sa["distinct_response_models"]) <= 1
                                                                 and not sa["model_drift_flag"] and not sb["model_drift_flag"],
    }
    bad = [k for k, ok in checks.items() if not ok]
    if bad:
        raise SystemExit("the two runs are not comparable: " + "; ".join(bad))
    n = len(recs)
    out_a = {i: E.outcome(c, recs[i]) for i, c in a.items()}
    out_b = {i: E.outcome(c, recs[i]) for i, c in b.items()}
    agree = sum(out_a[i] == out_b[i] for i in recs) / n
    noted = [i for i in recs if recs[i]["note"]]
    note_agree = sum(E.note_outcome(a[i], recs[i]) == E.note_outcome(b[i], recs[i]) for i in noted) / len(noted) if noted else None
    acc = lambda o: sum(o[i] == recs[i]["gold"]["primary"] for i in recs) / n
    diff = abs(acc(out_a) - acc(out_b)) * 100
    return {"records": n, "prediction_agreement": round(agree, 4), "note_status_agreement": round(note_agree, 4) if note_agree is not None else None,
            "accuracy_a": round(acc(out_a), 4), "accuracy_b": round(acc(out_b), 4), "accuracy_difference_points": round(diff, 2),
            "errors_a": sum(v == "ERROR" for v in out_a.values()), "errors_b": sum(v == "ERROR" for v in out_b.values()),
            "invalid_a": sum(v == "INVALID" for v in out_a.values()), "invalid_b": sum(v == "INVALID" for v in out_b.values()),
            "gate": dict(GATE), "passes": agree >= GATE["agreement_min"] and diff <= GATE["accuracy_diff_max_points"], "verdict": "PASSED" if (agree >= GATE["agreement_min"] and diff <= GATE["accuracy_diff_max_points"]) else "NOT PASSED",
            "note": "errors and invalid outputs are compared as outcomes like any other and are never removed; no record-level detail is printed"}


def compare(args) -> int:
    manifest = load_manifest(args.manifest if args.manifest else MANIFEST)
    test, _, _ = load_data(args, manifest, need=("main",))
    res = compare_runs(args.run_a, args.run_b, test)
    print(json.dumps(res, indent=1))
    if args.public_out:
        os.makedirs(args.public_out, exist_ok=True)
        L.write_json(os.path.join(args.public_out, f"reproducibility_{os.path.basename(args.run_a)}__{os.path.basename(args.run_b)}.json"), res)
    return 0 if res["passes"] else 4


# --- offline budget -----------------------------------------------------------------------------------------------------------------------

def plan(args) -> int:
    """Requests, tokens and cost upper bounds for the whole formal programme. Works from the manifest alone; with data it uses the exact inputs (numbers only)."""
    manifest = load_manifest(args.manifest if args.manifest else MANIFEST)
    pricing = L.Pricing(L.parse_usd(args.price_input_per_mtok or "0.3333334"), L.parse_usd(args.price_output_per_mtok or "1.3333334"), "plan")
    prompt_bytes, out_bound = len(P.SYSTEM_PROMPT.encode()), RUN.MAX_TOKENS
    telemetry_bytes = len(R.render_telemetry({"distance_cm": 2000.0, "velocity_ms": 5.0, "hp": 100.0, "battery_pct": 100.0, "temperature_c": -40.0}, None).encode())
    contract_user = telemetry_bytes + len(" Operator note: ") + R.MAX_NOTE_CHARS * 4          # 500 characters at up to 4 UTF-8 bytes each
    contract_in = prompt_bytes + contract_user + L.CHAT_OVERHEAD_TOKENS
    dev_in = 3215                                                                           # the largest bound seen on the dev set
    per_call = lambda i: i * pricing.input_per_token + out_bound * pricing.output_per_token
    n_main = manifest["M"]
    n_stress = sum(v for k, v in manifest["stress_type_counts"].items() if int(k) in STRESS_MODEL_TYPES)
    exact = None
    if args.acceptance_dir or args.data:
        need = ("main",) + (("stress",) if (args.acceptance_dir or args.stress_data) else ())
        test, stress, _ = load_data(args, manifest, need=need)
        bm = [L.input_token_upper_bound(P.SYSTEM_PROMPT, r["rendered_input"]) for r in test]
        sent = [c for c in stress if R.check_input(c["telemetry"], c["note"]) is None and not c["fault"]]
        bs = [L.input_token_upper_bound(P.SYSTEM_PROMPT, R.render_telemetry(c["telemetry"], (c["note"] or "").strip() or None)) for c in sent]
        exact = {"main_input_bound_min_max": [min(bm), max(bm)], "stress_model_requests": len(sent), "stress_no_request_cases": len(stress) - len(sent),
                 "worst_case_tokens": 2 * (sum(bm) + out_bound * len(bm)) + sum(bs) + out_bound * len(sent),
                 "worst_case_usd": f"{2 * sum(per_call(x) for x in bm) + sum(per_call(x) for x in bs):.4f}"}
    n_canary = CAPS["health_canary"]["max_calls"]
    requests = n_canary + 2 * n_main + n_stress
    worst_tokens = requests * (contract_in + out_bound)
    worst_usd = requests * per_call(contract_in)
    dev = json.load(open(DEV_RUN_SUMMARY, encoding="utf-8"))
    tok_per_call = dev["budget"]["tokens_committed"] / dev["planned_calls"]
    usd_reported_per_call = Decimal(dev["usd_from_reported_usage"]) / (dev["planned_calls"] - dev["calls_without_usable_usage"])
    usd_booked_per_call = Decimal(dev["budget"]["usd_committed"]) / dev["planned_calls"]
    out = {
        "note": "offline; nothing from private data is printed. R1/R2 and the input-rejection / injected-fault stress cases send no API request",
        "programme": {"health_canary_requests_on_the_public_dev_file": n_canary, "main_runs": 2, "records_per_main_run": n_main, "stress_cases": manifest["stress_records"], "stress_model_requests_upper_bound": n_stress,
                      "stress_no_request_cases_at_least": manifest["stress_records"] - n_stress, "total_model_requests_upper_bound": requests, "r1_r2_requests": 0},
        "per_call_bounds": {"prompt_bytes": prompt_bytes, "input_bound_contract_maximum": contract_in, "input_bound_dev_maximum": dev_in, "output_bound": out_bound,
                            "worst_usd_per_call_contract_maximum": f"{per_call(contract_in):.5f}", "worst_usd_per_call_dev_maximum": f"{per_call(dev_in):.5f}"},
        "theoretical_upper_bound": {"tokens": worst_tokens, "usd": f"{worst_usd:.2f}",
                                    "meaning": "every request at the largest input the contract allows (a 500-character note at 4 UTF-8 bytes per character, the maximum for any character) AND the full 2,048 output tokens; far above anything seen, shown only as the ceiling of the bound"},
        "expected_from_the_dev_run": {"basis": "baseline B dev run, 180 calls: 175 with usage, 5 provider errors",
                                      "tokens_per_call_booked": round(tok_per_call), "usd_per_call_from_reported_usage": f"{usd_reported_per_call:.6f}", "usd_per_call_booked_incl_failed": f"{usd_booked_per_call:.6f}",
                                      "usd_for_the_programme": f"{requests * usd_reported_per_call:.2f} to {requests * usd_booked_per_call:.2f}", "tokens_for_the_programme": round(requests * tok_per_call),
                                      "caveat": "an estimate from one run, not a guarantee; the test notes may be longer or shorter"},
        "proposed_caps": {**CAPS, "combined": {"max_calls": n_canary + 2 * CAPS["main_run"]["max_calls"] + CAPS["stress_run"]["max_calls"],
                                              "max_tokens": CAPS["health_canary"]["max_tokens"] + 2 * CAPS["main_run"]["max_tokens"] + CAPS["stress_run"]["max_tokens"],
                                              "usd": f"{Decimal(CAPS['health_canary']['usd']) + 2 * Decimal(CAPS['main_run']['usd']) + Decimal(CAPS['stress_run']['usd'])}",
                                              "note": "includes the 2-call health canary on the public dev file; nothing sits outside this total"},
                          "how_they_work": "the guard books the worst case before each call and settles to the reported usage; a run that would pass its cap stops BEFORE sending (stopped_early) and is reported, so the caps are what can be spent, not the theoretical bound"},
        "exact_from_the_given_files": exact}
    print(json.dumps(out, indent=1))
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("freeze")
    for name in ("check-format", "plan", "run", "compare"):
        p = sub.add_parser(name)
        p.add_argument("--acceptance-dir")
        p.add_argument("--data", help="main data file; needs --expect-sha256")
        p.add_argument("--expect-sha256")
        p.add_argument("--stress-data", help="stress data file; needs --stress-expect-sha256")
        p.add_argument("--stress-expect-sha256")
        p.add_argument("--manifest", help="dry-run and tests only")
        p.add_argument("--price-input-per-mtok")
        p.add_argument("--price-output-per-mtok")
        p.add_argument("--price-source")
        p.add_argument("--public-out")
        if name == "run":
            p.add_argument("--suite", choices=["main", "stress", "rules"], required=True)
            p.add_argument("--mode", choices=["dry-run", "real"], default="dry-run")
            p.add_argument("--twice", action="store_true", help="two independent runs back to back, then the reproducibility gate")
            p.add_argument("--private-out")
            p.add_argument("--frozen-tag")
            p.add_argument("--limit", type=int)
            p.add_argument("--max-calls", type=int)
            p.add_argument("--max-tokens", type=int)
            p.add_argument("--usd-cap")
            p.add_argument("--authorized-by")
            p.add_argument("--model-identity")
            p.add_argument("--fault-plan", default="none")
            p.add_argument("--skip-freeze-check", action="store_true", help="dry-run and tests only")
        if name == "compare":
            p.add_argument("--run-a", required=True)
            p.add_argument("--run-b", required=True)
    args = ap.parse_args(argv)
    if args.cmd == "freeze":
        L.write_json(FREEZE, {"purpose": "hashes of every file that decides a formal result; a change needs a new freeze and a new review", "files": code_hashes(),
                              "baseline_B_prompt_sha256": L.sha256_text(P.SYSTEM_PROMPT), "frozen_manifest_sha256": sha(MANIFEST)})
        print("wrote", FREEZE)
        return 0
    if args.cmd == "check-format":
        manifest = load_manifest(args.manifest if args.manifest else MANIFEST)
        test, stress, frozen = load_data(args, manifest)
        print(json.dumps({"test_records": len(test), "class_counts": dict(Counter(r["gold"]["primary"] for r in test)), "noted": sum(1 for r in test if r["note"]),
                          "stress_cases": len(stress), "stress_types": dict(sorted(Counter(r["type"] for r in stress).items())), "format": "OK",
                          "hashes": "match the expected SHA-256", "is_the_frozen_acceptance_data": frozen}))
        return 0
    return {"plan": plan, "run": run, "compare": compare}[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
