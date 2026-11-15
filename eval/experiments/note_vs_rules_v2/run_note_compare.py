"""Entry of round 2 (note_vs_rules_v2): the model scheme (B-1.0, unchanged) against the rules R1, R2, R3 on the same records.

    python eval/experiments/note_vs_rules_v2/run_note_compare.py plan  [--data F --expect-sha256 H] [--price-input-per-mtok X --price-output-per-mtok Y --price-source S]
    python eval/experiments/note_vs_rules_v2/run_note_compare.py check-data --data F [--expect-sha256 H]       # counts only; prints no record
    python eval/experiments/note_vs_rules_v2/run_note_compare.py freeze                                           # V2_FREEZE.json: hashes of every file that decides a result
    python eval/experiments/note_vs_rules_v2/run_note_compare.py run --mode dry-run|real --data F --expect-sha256 H --private-out D --public-out D ...
    python eval/experiments/note_vs_rules_v2/run_note_compare.py run --health --mode real ...                       # 2 calls on the PUBLIC dev file; never the test
    python eval/experiments/note_vs_rules_v2/run_note_compare.py check-health --run-dir D
    python eval/experiments/note_vs_rules_v2/run_note_compare.py analyze --run-dir D --data F --expect-sha256 H

The safety shell is `eval/formal/run_formal.py::run_once`, called unchanged (reserve before send, unknown usage keeps the reservation, one request per
record, SDK retries off, no cache, in-flight interruption record, bound-violation stop, sealing). This file adds: its own freeze and preconditions, the loader and
quota checks for the new data, the three rules scored on the same rendered text, the health check, and the note-first report. See IMPLEMENTATION_NOTES.md.
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import signal
import sys
from decimal import Decimal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
for sub in ("eval/spec", "eval/dev", "eval/baseline_v1/measure", "eval/baseline_b", "eval/formal", "src/cloud-orchestrator", "eval/experiments/note_vs_rules_v2"):
    sys.path.insert(0, os.path.join(ROOT, sub))
import evaluate as E  # noqa: E402
import measure_lib as L  # noqa: E402
import note_analysis as NA  # noqa: E402
import prompt_b as P  # noqa: E402
import r3 as R3  # noqa: E402
import reference_labeler as R  # noqa: E402
import run_dev_eval as RUN  # noqa: E402
import run_formal as RF  # noqa: E402

FREEZE = os.path.join(HERE, "V2_FREEZE.json")
V2_FILES = ["eval/experiments/note_vs_rules_v2/r3.py", "eval/experiments/note_vs_rules_v2/note_analysis.py", "eval/experiments/note_vs_rules_v2/run_note_compare.py"]
DEV_SET = os.path.join(ROOT, "eval/dev/dev_set.jsonl")
LANGUAGES = ("zh", "en", "mixed")
ALLOWED_KEYS = {"id", "family_id", "telemetry", "note", "note_status", "language", "gold"}
QUOTA = {"n": 180, "per_status": 30, "per_status_language": 10, "per_status_normal_telemetry": 15, "per_status_risk_telemetry": 15, "per_status_language_telemetry": 5, "min_families": 60, "max_per_family": 3,
         "max_note_chars": R.MAX_NOTE_CHARS}
CAPS = {"health": {"max_calls": 2, "max_tokens": 20_000}, "main": {"max_calls": 180}}
PUBLIC_NOTE_FILES = ("eval/dev/dev_set.jsonl", "eval/dev/stress/stress_dev.jsonl", "eval/spec/ambiguous_examples.json",
                     "eval/experiments/note_vs_rules_v2/dev_extra.jsonl", "eval/experiments/note_vs_rules_v2/dev_holdout.jsonl")


def sha(path: str) -> str:
    return L.sha256_file(path)


def code_hashes() -> dict:
    return {**RF.code_hashes(), **{f: sha(os.path.join(ROOT, f)) for f in V2_FILES}}


def check_freeze() -> dict:
    if not os.path.isfile(FREEZE):
        raise SystemExit("V2_FREEZE.json is missing: run `freeze` and review it first")
    fr = json.load(open(FREEZE, encoding="utf-8"))
    if fr.get("baseline_B_prompt_sha256") != L.sha256_text(P.SYSTEM_PROMPT):
        raise SystemExit("the baseline-B prompt differs from the one recorded in the freeze")
    now = code_hashes()
    changed = sorted(f for f in now if fr["files"].get(f) != now[f])
    if changed:
        raise SystemExit("files changed since the freeze (a new freeze and review are needed): " + ", ".join(changed))
    return now


def norm_text(s: str) -> str:
    import unicodedata
    return " ".join(unicodedata.normalize("NFKC", s).lower().split())


# ---- data: hash first, then validation; messages never echo a record ----------------------------------------------------------------------------
def public_reference() -> dict:
    notes, inputs, families = set(), set(), set()
    for rel in PUBLIC_NOTE_FILES:
        path = os.path.join(ROOT, rel)
        text = open(path, encoding="utf-8").read()
        rows = json.loads(text) if rel.endswith(".json") else [json.loads(x) for x in text.splitlines() if x.strip()]
        for r in rows:
            if isinstance(r.get("note"), str) and r["note"].strip():
                notes.add(norm_text(r["note"]))
            if isinstance(r.get("rendered_input"), str):
                inputs.add(norm_text(r["rendered_input"]))
            if r.get("family_id"):
                families.add(r["family_id"])
    return {"notes": notes, "inputs": inputs, "families": families}


def language_of(note: str) -> str:
    cjk = bool(re.search(r"[一-鿿]", note))
    latin = bool(re.search(r"[A-Za-z]{2,}", note))
    return "mixed" if cjk and latin else "zh" if cjk else "en"


def check_v2(records: list[dict], quota: dict, reference: dict | None = None) -> tuple[dict, list[str]]:
    """Counts and problems only. Problems are codes (never a record, an id or a note)."""
    problems: list[str] = []
    q = quota
    st = collections.Counter(r["note_status"] for r in records)
    by_sl = collections.Counter((r["note_status"], r.get("language")) for r in records)
    by_kind = collections.Counter((r["note_status"], "risk" if R.risk_set(r["telemetry"]) else "normal") for r in records)
    by_slk = collections.Counter((r["note_status"], r.get("language"), "risk" if R.risk_set(r["telemetry"]) else "normal") for r in records)
    fam = collections.Counter(r.get("family_id") for r in records)
    ref = reference if reference is not None else public_reference()
    overlap_notes = sum(norm_text(r["note"]) in ref["notes"] for r in records)
    overlap_inputs = sum(norm_text(r["rendered_input"]) in ref["inputs"] for r in records)
    overlap_fam = sum(1 for f in fam if f in ref["families"])
    dup_inputs = len(records) - len({r["rendered_input"] for r in records})
    # note-only stop risk: the gold action stops although the telemetry alone would not. Reported whole and split by the kind of telemetry it sits on.
    note_only_recs = [r for r in records if r["gold"]["action"]["motion"] == "HALT" and R.compose(r["telemetry"], None)["action"]["motion"] != "HALT"]
    note_only = len(note_only_recs)
    note_only_normal = sum(1 for r in note_only_recs if not R.risk_set(r["telemetry"]))
    stats = {"records": len(records), "note_status_counts": dict(sorted(st.items())), "language_counts": dict(sorted(collections.Counter(r.get("language") for r in records).items())),
             "status_x_language": {f"{s}|{l}": v for (s, l), v in sorted(by_sl.items(), key=str)}, "status_x_telemetry": {f"{s}|{k}": v for (s, k), v in sorted(by_kind.items())},
             "status_x_language_x_telemetry": {f"{s}|{l}|{k}": v for (s, l, k), v in sorted(by_slk.items(), key=str)},
             "note_only_risk_records": note_only, "note_only_risk_on_normal_telemetry": note_only_normal, "note_only_risk_on_non_stopping_risk_telemetry": note_only - note_only_normal, "families": len(fam), "largest_family": max(fam.values()) if fam else 0, "longest_note_chars": max((len(r["note"]) for r in records), default=0),
             "exact_note_overlap_with_public_material": overlap_notes, "exact_input_overlap_with_public_material": overlap_inputs, "family_ids_shared_with_public_material": overlap_fam,
             "duplicate_rendered_inputs": dup_inputs, "gate_not_pass": sum(1 for r in records if r["gold"]["gate"] != "PASS")}
    if "n" in q and len(records) != q["n"]:
        problems.append("record_count")
    if "per_status" in q and any(st.get(s, 0) != q["per_status"] for s in R.NOTE_STATUSES):
        problems.append("per_status_count")
    if "per_status_language" in q and any(by_sl.get((s, l), 0) != q["per_status_language"] for s in R.NOTE_STATUSES for l in LANGUAGES):
        problems.append("per_status_language_count")
    if "per_status_normal_telemetry" in q and any(by_kind.get((s, "normal"), 0) != q["per_status_normal_telemetry"] for s in R.NOTE_STATUSES):
        problems.append("per_status_normal_telemetry_count")
    if "per_status_risk_telemetry" in q and any(by_kind.get((s, "risk"), 0) != q["per_status_risk_telemetry"] for s in R.NOTE_STATUSES):
        problems.append("per_status_risk_telemetry_count")
    if "per_status_language_telemetry" in q and any(by_slk.get((s, l, k), 0) != q["per_status_language_telemetry"] for s in R.NOTE_STATUSES for l in LANGUAGES for k in ("normal", "risk")):
        problems.append("per_status_language_telemetry_count")
    if "min_families" in q and len(fam) < q["min_families"]:
        problems.append("too_few_families")
    if "max_per_family" in q and fam and max(fam.values()) > q["max_per_family"]:
        problems.append("family_too_large")
    if any(not r.get("family_id") for r in records):
        problems.append("family_id_missing")
    if any(r.get("language") not in LANGUAGES or language_of(r["note"]) != r["language"] for r in records):
        problems.append("language_missing_or_inconsistent")
    if stats["gate_not_pass"]:
        problems.append("physical_gate_not_pass")
    if overlap_notes or overlap_inputs:
        problems.append("exact_overlap_with_public_material")
    if overlap_fam:
        problems.append("family_shared_with_public_material")
    if dup_inputs:
        problems.append("duplicate_rendered_input")
    return stats, problems


def load_v2(path: str, expect: str, quota: dict | None, *, reference: dict | None = None) -> tuple[list[dict], dict, list[str]]:
    manifest = RF.load_manifest()
    if L.sha256_file(os.path.join(ROOT, "eval/spec/SHA256SUMS")) != manifest["sha256"]["spec_SHA256SUMS"]:
        raise SystemExit("the specification files differ from the frozen manifest")
    if manifest.get("baseline_B_prompt_sha256") != L.sha256_text(P.SYSTEM_PROMPT):
        raise SystemExit("the baseline-B prompt differs from the frozen manifest")
    if not os.path.isfile(path):
        raise SystemExit("the data file was not found")
    if sha(path) != expect:
        raise SystemExit("the data file does not match the expected SHA-256 (nothing was read for scoring)")
    records, bad = [], []
    try:
        for i, raw in enumerate(RF.read_jsonl(path), 1):
            if set(raw) - ALLOWED_KEYS:
                bad.append(f"line {i}: unknown or forbidden key")
                continue
            if raw.get("note") is None:
                raise ValueError(f"line {i}: every record of this round needs a note")
            rec = RF.normalize_test(raw, i)
            rec["language"] = raw.get("language")
            records.append(rec)
    except (ValueError, json.JSONDecodeError) as exc:
        raise SystemExit(f"the data file: {exc}")
    if bad:
        raise SystemExit("the data file: " + "; ".join(bad[:5]))
    if len({r["id"] for r in records}) != len(records):
        raise SystemExit("the data file has duplicate ids")
    stats, problems = check_v2(records, quota or {}, reference)
    return records, stats, problems


# ---- the health check -------------------------------------------------------------------------------------------------------------------------
def check_health(run_dir: str) -> dict:
    crit: dict[str, bool] = {}
    problems = L.verify_run_dir(run_dir)
    crit["directory_sealed_and_verifies"] = not problems
    if problems:
        return {"passed": False, "criteria": crit, "problems": problems[:3]}
    cfg = json.load(open(os.path.join(run_dir, "config.json"), encoding="utf-8"))
    summ = json.load(open(os.path.join(run_dir, "summary.json"), encoding="utf-8"))
    calls = RF.read_jsonl(os.path.join(run_dir, "calls.jsonl"))
    dev_records = {r["id"]: r for r in map(lambda t: RF.normalize_test(t[1], t[0]), enumerate(RF.read_jsonl(DEV_SET), 1))}
    crit["completed_two_calls_on_the_public_dev_file"] = (summ["status"] == "completed" and summ["is_canary"] and len(calls) == 2 and summ["suite"] == "main"
                                                          and cfg["dataset_sha256"]["main"] == sha(DEV_SET) and all(c["id"] in dev_records for c in calls))
    crit["no_api_error"] = all(not c.get("error") for c in calls)
    crit["finish_reason_stop"] = all(c.get("finish_reason") == "stop" for c in calls)
    crit["strict_output_and_note_compatible"] = bool(calls) and all(c["id"] in dev_records and E.usable(c, dev_records[c["id"]]) for c in calls)
    crit["output_within_the_limit"] = bool(calls) and all(isinstance((c.get("usage") or {}).get("completion_tokens"), int) and c["usage"]["completion_tokens"] <= RUN.MAX_TOKENS for c in calls)
    crit["one_returned_alias_no_drift"] = len(summ["distinct_response_models"]) == 1 and not summ["model_drift_flag"]
    rs = cfg["request_settings"]
    crit["request_parameters_match_the_frozen_configuration"] = (rs["temperature"] == L.TEMPERATURE and rs["max_tokens"] == RUN.MAX_TOKENS and rs["sdk_max_retries"] == 0
                                                                 and rs["sdk_timeout_s"] == L.SDK_TIMEOUT_S and cfg["baseline"]["prompt_sha256"] == L.sha256_text(P.SYSTEM_PROMPT))
    return {"passed": all(crit.values()), "criteria": crit, "model_configuration": cfg["model"], "returned_aliases": summ["distinct_response_models"]}


# ---- the plan --------------------------------------------------------------------------------------------------------------------------------
def plan(args) -> int:
    prompt_bytes, out_bound = len(P.SYSTEM_PROMPT.encode()), RUN.MAX_TOKENS
    telemetry_bytes = len(R.render_telemetry({"distance_cm": 2000.0, "velocity_ms": 5.0, "hp": 100.0, "battery_pct": 100.0, "temperature_c": -40.0}, None).encode())
    contract_in = prompt_bytes + telemetry_bytes + len(" Operator note: ") + R.MAX_NOTE_CHARS * 4 + L.CHAT_OVERHEAD_TOKENS
    verified = bool(args.price_input_per_mtok and args.price_output_per_mtok and args.price_source)
    pin, pout = args.price_input_per_mtok or "0.3333334", args.price_output_per_mtok or "1.3333334"
    pricing = L.Pricing(L.parse_usd(pin), L.parse_usd(pout), args.price_source or "round-1 configured rates, NOT verified for this round")
    per_call = lambda i: i * pricing.input_per_token + out_bound * pricing.output_per_token
    n_health, n_main = CAPS["health"]["max_calls"], QUOTA["n"]
    dev = json.load(open(RF.DEV_RUN_SUMMARY, encoding="utf-8"))
    tok_call = dev["budget"]["tokens_committed"] / dev["planned_calls"]
    usd_call = Decimal(dev["usd_from_reported_usage"]) / (dev["planned_calls"] - dev["calls_without_usable_usage"])
    health_bounds = [L.input_token_upper_bound(P.SYSTEM_PROMPT, r["rendered_input"]) for r in RF.read_jsonl(DEV_SET)[:n_health]]
    exact = None
    if args.data:
        if not args.expect_sha256:
            raise SystemExit("--data needs --expect-sha256")
        recs, stats, problems = load_v2(args.data, args.expect_sha256, QUOTA)
        bm = [L.input_token_upper_bound(P.SYSTEM_PROMPT, r["rendered_input"]) for r in recs]
        exact = {"main_requests": len(recs), "main_input_bound_min_max": [min(bm), max(bm)], "worst_case_tokens": sum(bm) + out_bound * len(bm) + sum(health_bounds) + out_bound * n_health,
                 "worst_case_usd": f"{sum(per_call(x) for x in bm + health_bounds):.4f}", "data_problems": problems}
    out = {"note": "offline; no record is printed and nothing is authorised by this output",
           "requests": {"health_on_the_public_dev_file": n_health, "main_records": n_main, "total_model_requests": n_health + n_main, "rule_requests": 0,
                        "note": "R1, R2 and R3 send no request. If a diagnostic request is needed beyond these, its purpose and number must be stated before any authorisation"},
           "per_call_bounds": {"prompt_bytes": prompt_bytes, "input_bound_contract_maximum": contract_in, "output_bound": out_bound,
                               "worst_usd_per_call_contract_maximum": f"{per_call(contract_in):.5f}"},
           "price": {"input_usd_per_mtok": pin, "output_usd_per_mtok": pout, "source": pricing.source, "price_verified": verified,
                     "warning": "" if verified else "these are the round-1 configured rates; the provider's price must be checked before a real run and given with --price-source"},
           "theoretical_upper_bound": {"tokens": (n_health + n_main) * (contract_in + out_bound), "usd": f"{(n_health + n_main) * per_call(contract_in):.2f}",
                                       "meaning": "every request at the largest input the contract allows and the full output limit; a ceiling of the bound, not a forecast"},
           "expected_from_the_round_1_dev_run": {"tokens_per_call_booked": round(tok_call), "usd_per_call_from_reported_usage": f"{usd_call:.6f}",
                                                 "tokens_for_the_182_requests": round((n_health + n_main) * tok_call), "usd_for_the_182_requests": f"{(n_health + n_main) * usd_call:.2f}",
                                                 "caveat": "one earlier run on other notes; the new notes may be longer or shorter, so this is a rough orientation and not a bound"},
           "not_yet_exactly_computable": [] if exact else ["per-record input bounds and the exact worst-case tokens and dollars (need the custodian's data file; only its hash and counts will be shown to the developer)",
                                                           "the price (not verified)", "the budget caps (the owner decides; no cap and no authorisation exist for this round)"],
           "exact_from_the_given_file": exact}
    print(json.dumps(out, indent=1))
    return 0


# ---- run -------------------------------------------------------------------------------------------------------------------------------------
def real_guards(args) -> int | None:
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
    if not args.health:
        if not args.health_run or not check_health(args.health_run)["passed"]:
            print("the main test needs --health-run pointing at a health run that passes `check-health`", file=sys.stderr)
            return 2
        if args.limit:
            print("--limit is for the health run only", file=sys.stderr)
            return 2
    return None


def shim(args, real: bool, records: list[dict], sha_main: str) -> argparse.Namespace:
    ns = argparse.Namespace(**vars(args))
    ns.suite, ns.twice, ns._main_sha, ns._stress_sha = "main", False, sha_main, None
    ns.public_out = os.path.join(args.public_out or os.path.join(HERE, "dryrun_public"), "run_once")
    return ns


def run(args) -> int:
    real = args.mode == "real"
    if RUN.resolve_budget(args, real) is None:
        return 2
    if real:
        bad = real_guards(args)
        if bad is not None:
            return bad
    else:
        RUN.block_network()
    signal.signal(signal.SIGTERM, RUN.raise_interrupt)
    hashes = check_freeze() if (real or not args.skip_freeze_check) else code_hashes()
    if args.health:
        if args.data != DEV_SET and os.path.realpath(args.data or "") != os.path.realpath(DEV_SET):
            print("the health check runs on the public dev file only (eval/dev/dev_set.jsonl)", file=sys.stderr)
            return 2
        records = [RF.normalize_test(r, i) for i, r in enumerate(RF.read_jsonl(DEV_SET), 1)]
        if sha(DEV_SET) != args.expect_sha256:
            raise SystemExit("the dev file does not match the expected SHA-256")
        records = records[: args.limit or CAPS["health"]["max_calls"]]
        args.limit = args.limit or CAPS["health"]["max_calls"]
        code, run_dir, summary = RF.run_once(shim(args, real, records, sha(DEV_SET)), real, RF.load_manifest(), records, False, hashes)
        print(json.dumps(check_health(run_dir), indent=1))
        return code
    quota = None if (args.skip_quota_check and not real) else QUOTA
    if not args.data or not args.expect_sha256:
        print("--data and --expect-sha256 are required", file=sys.stderr)
        return 2
    records, stats, problems = load_v2(args.data, args.expect_sha256, quota)
    if problems and (real or not args.skip_quota_check):
        print("the data does not satisfy the plan's quota or the isolation checks: " + ", ".join(problems), file=sys.stderr)
        return 2
    if args.limit:
        records = records[: args.limit]
    rule_runs = {name: NA.rule_calls(records, name) for name in ("R1", "R2", "R3")}        # offline, before any model request
    code, run_dir, summary = RF.run_once(shim(args, real, records, args.expect_sha256), real, RF.load_manifest(), records, False, hashes)
    return finish(args, real, records, stats, rule_runs, code, run_dir, summary, hashes)


def finish(args, real, records, stats, rule_runs, code, run_dir, summary, hashes) -> int:
    calls = RF.read_jsonl(os.path.join(run_dir, "calls.jsonl"))
    public, private = NA.analyze(records, calls, summary, rule_runs)
    binding = {"run_dir": os.path.basename(run_dir), "mode": args.mode, "data_sha256": args.expect_sha256, "data_stats": stats, "freeze_sha256": sha(FREEZE) if os.path.isfile(FREEZE) else None,
               "code_hashes": hashes, "prompt_sha256": L.sha256_text(P.SYSTEM_PROMPT), "r3_version": R3.VERSION, "run_calls_sha256": sha(os.path.join(run_dir, "calls.jsonl")),
               "run_summary_sha256": sha(os.path.join(run_dir, "summary.json")), "run_seal_verifies": not L.verify_run_dir(run_dir)}
    adir = run_dir.rstrip("/") + "_analysis"
    os.makedirs(adir, exist_ok=False)
    L.write_json(os.path.join(adir, "analysis_private.json"), {**private, "binding": binding})
    L.write_json(os.path.join(adir, "analysis_public.json"), {"binding": {k: v for k, v in binding.items() if k != "run_dir"}, **public})
    L.write_sha256sums(adir)
    out = os.path.join(args.public_out or os.path.join(HERE, "dryrun_public"), os.path.basename(run_dir))
    os.makedirs(out, exist_ok=False)
    pub = {"binding": {k: v for k, v in binding.items() if k != "run_dir"}, "is_dry_run_with_a_fake_model": not real, **public}
    if not real:
        pub["model_figures_withheld"] = "dry run with a fake client: the model scheme's figures are a rehearsal and are not published as results"
        for k in ("model_success_only", "model_cost_and_latency"):
            pub.pop(k, None)
        pub["schemes"] = {k: v for k, v in pub["schemes"].items() if k != "model"}
        pub["comparisons"] = {}
    L.write_json(os.path.join(out, "note_compare.json"), pub)
    open(os.path.join(out, "REPORT.md"), "w", encoding="utf-8").write(report_md(pub))
    print("private analysis:", adir, "\npublic aggregates:", out, "\ncomplete:", public["complete"])
    return code


def report_md(p: dict) -> str:
    L_ = ["# Note understanding: model scheme vs rules (round 2)", "",
          f"Status **{p['status']}** ({p['stop_reason']}); records {p['records']}, model requests started {p['model_started']}, not started {p['not_started']}; **complete: {p['complete']}**.",
          "" if p["complete"] else "**This run is not complete. Its figures are not a full result and must not be quoted as one.**", p["headline"] + ".", ""]
    if p.get("model_figures_withheld"):
        L_ += [p["model_figures_withheld"], ""]
    L_ += ["| Scheme | Note status correct | Accuracy | Note macro-F1 | Primary route correct | Missed halt | Needless halt | Note-only-risk missed halt |", "|---|---:|---:|---:|---:|---:|---:|---:|"]
    for name, s in p["schemes"].items():
        n, sub = s["note_status"], s["subsets"].get("note_only_risk", {})
        L_.append(f"| {name} | {n['correct']}/{n['n']} | {n['accuracy']} | {n['macro_f1']} | {s['primary']['correct']}/{s['primary']['n']} | {s['safety']['missed_halt']} | {s['safety']['needless_halt']} | {sub.get('missed_halt', 'n/a')} of {sub.get('n', 'n/a')} |")
    for k, c in p["comparisons"].items():
        d, pr = c["note_accuracy_difference"], c["paired"]
        L_ += ["", f"**{k}**: both correct {pr['both_correct']}, only first {pr['only_first_correct']}, only second {pr['only_second_correct']}, both wrong {pr['both_wrong']}; "
                   f"difference {d['difference_points']} points, family bootstrap 95% {d['ci95_points']} ({d['families']} families, {d['resamples']} resamples, seed {d['seed']})."]
    if "model_cost_and_latency" in p:
        m = p["model_cost_and_latency"]
        L_ += ["", f"Model latency (one API request): all {m['latency_ms_all_requests']}, successful {m['latency_ms_successful_requests']}. {m['latency_note']}",
               f"Cost: ${m['usd_from_reported_usage']} from reported usage over {m['requests_with_reported_usage']} requests (mean ${m['usd_mean_per_request_with_usage']}); "
               f"reserved for {m['requests_without_reported_usage']} requests without usage: ${m['usd_reserved_for_requests_without_usage']}. {m['cost_note']}"]
    L_ += ["", "Local rule time: " + "; ".join(f"{k} median {v['median']} us, P95 {v['p95_nearest_rank']} us" for k, v in p["local_rule_time"].items()) + ". Not the same kind of time as a model request."]
    return "\n".join(L_) + "\n"


def analyze_cmd(args) -> int:
    records, stats, _ = load_v2(args.data, args.expect_sha256, None)
    problems = L.verify_run_dir(args.run_dir)
    if problems:
        raise SystemExit("the run directory does not verify: " + problems[0])
    summary = json.load(open(os.path.join(args.run_dir, "summary.json"), encoding="utf-8"))
    cfg = json.load(open(os.path.join(args.run_dir, "config.json"), encoding="utf-8"))
    if cfg["dataset_sha256"]["main"] != args.expect_sha256:
        raise SystemExit("the run was made on a different data file")
    calls = RF.read_jsonl(os.path.join(args.run_dir, "calls.jsonl"))
    public, _ = NA.analyze(records, calls, summary, {n: NA.rule_calls(records, n) for n in ("R1", "R2", "R3")})
    print(json.dumps(public["schemes"]["model"]["note_status"]["accuracy"]), "complete:", public["complete"])
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("freeze")
    ch = sub.add_parser("check-health")
    ch.add_argument("--run-dir", required=True)
    for name in ("plan", "check-data", "run", "analyze"):
        p = sub.add_parser(name)
        p.add_argument("--data")
        p.add_argument("--expect-sha256")
        p.add_argument("--price-input-per-mtok")
        p.add_argument("--price-output-per-mtok")
        p.add_argument("--price-source")
        if name == "analyze":
            p.add_argument("--run-dir", required=True)
        if name == "run":
            p.add_argument("--mode", choices=["dry-run", "real"], default="dry-run")
            p.add_argument("--health", action="store_true", help="2 calls on the public dev file; never the test file")
            p.add_argument("--health-run", help="a passing health run directory (required for a real main run)")
            p.add_argument("--private-out")
            p.add_argument("--public-out")
            p.add_argument("--frozen-tag")
            p.add_argument("--limit", type=int)
            p.add_argument("--max-calls", type=int)
            p.add_argument("--max-tokens", type=int)
            p.add_argument("--usd-cap")
            p.add_argument("--authorized-by")
            p.add_argument("--model-identity")
            p.add_argument("--fault-plan", default="none")
            p.add_argument("--skip-freeze-check", action="store_true", help="dry-run and tests only")
            p.add_argument("--skip-quota-check", action="store_true", help="dry-run and tests only")
    args = ap.parse_args(argv)
    if args.cmd == "freeze":
        L.write_json(FREEZE, {"purpose": "hashes of every file that decides a result of round 2; a change needs a new freeze and a new review", "status": "scheme commitment before any test exists",
                              "files": code_hashes(), "baseline_B_prompt_sha256": L.sha256_text(P.SYSTEM_PROMPT), "r3_version": R3.VERSION})
        print("wrote", FREEZE)
        return 0
    if args.cmd == "check-health":
        res = check_health(args.run_dir)
        print(json.dumps(res, indent=1))
        return 0 if res["passed"] else 1
    if args.cmd == "check-data":
        if not args.data:
            raise SystemExit("--data is required")
        expect = args.expect_sha256 or sha(args.data)
        records, stats, problems = load_v2(args.data, expect, QUOTA)
        print(json.dumps({"sha256": expect, "hash_was_given": bool(args.expect_sha256), "stats": stats, "problems": problems, "format": "OK" if not problems else "PROBLEMS"}, indent=1))
        return 0 if not problems else 1
    return {"plan": plan, "run": run, "analyze": analyze_cmd}[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
