"""Metrics of round 2 (note_vs_rules_v2): the note status first, for the model scheme and the rules R1, R2, R3 on the SAME records.

Pure functions of (records, calls). No model, no network. Everything that scores reuses the frozen evaluator (eval/baseline_b/evaluate.py):
an error, an invalid or truncated reply and an interrupted request stay in the denominator and count as wrong, and the executed action of
every scheme goes through reference_labeler.execute(), so a correction made by the code never earns a scheme a note point.
"""
from __future__ import annotations

import collections
import math
import pathlib
import random
import statistics
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
for sub in ("eval/spec", "eval/baseline_b"):
    sys.path.insert(0, str(ROOT / sub))
sys.path.insert(0, str(HERE))
import evaluate as E  # noqa: E402
import reference_labeler as R  # noqa: E402
import rule_control as C  # noqa: E402
import r3 as R3  # noqa: E402

BOOTSTRAP = {"resamples": 2000, "seed": 20261109, "unit": "family", "interval": "95% percentile"}
RULES = {"R1": lambda t: C.predict(t, "R1"), "R2": lambda t: C.predict(t, "R2"), "R3": R3.predict}
OTHER_OUTCOMES = ("ERROR", "INVALID", "INTERRUPTED")


def nearest_rank(values: list[float], q: float) -> float | None:
    """Nearest-rank percentile: the ceil(q*n)-th smallest value."""
    if not values:
        return None
    xs = sorted(values)
    return xs[max(1, math.ceil(q * len(xs))) - 1]


def describe(values: list[float]) -> dict:
    if not values:
        return {"n": 0, "median": None, "p95_nearest_rank": None, "max": None}
    return {"n": len(values), "median": round(statistics.median(values), 3), "p95_nearest_rank": round(nearest_rank(values, 0.95), 3), "max": round(max(values), 3)}


# ---- the rules, on the same rendered text as the model ---------------------------------------------------------------------------------
def rule_calls(records: list[dict], name: str, clock=None) -> tuple[list[dict], list[int]]:
    """(calls shaped like model calls, local nanoseconds per record). Reads only `rendered_input`, like the model."""
    import time
    clock = clock or time.perf_counter_ns
    fn, calls, ns = RULES[name], [], []
    for r in records:
        t0 = clock()
        pred = fn(r["rendered_input"])
        ns.append(clock() - t0)
        calls.append({"id": r["id"], "prediction": pred, "finish_reason": "stop", "error": None})
    return calls, ns


# ---- subsets -----------------------------------------------------------------------------------------------------------------------------
def telemetry_halts(rec: dict) -> bool:
    return R.compose(rec["telemetry"], None)["action"]["motion"] == "HALT"


def subsets(records: list[dict]) -> dict[str, list[dict]]:
    """normal / risky telemetry, the note-only risk subset (the gold action halts ONLY because of the note), and the languages present."""
    out = {"all": records,
           "telemetry_normal": [r for r in records if not R.risk_set(r["telemetry"])],
           "telemetry_with_risk": [r for r in records if R.risk_set(r["telemetry"])],
           "note_only_risk": [r for r in records if r["gold"]["action"]["motion"] == "HALT" and not telemetry_halts(r)]}
    for lang in sorted({r.get("language") for r in records if r.get("language")}):
        out[f"language_{lang}"] = [r for r in records if r.get("language") == lang]
    for st in R.NOTE_STATUSES:
        out[f"status_{st}"] = [r for r in records if r["note_status"] == st]
    return out


# ---- one scheme ----------------------------------------------------------------------------------------------------------------------------
def _note_f1(records: list[dict], by_id: dict) -> dict:
    gold = [r["note_status"] for r in records]
    got = [E.note_outcome(by_id[r["id"]], r) if r["id"] in by_id else "NOT_STARTED" for r in records]
    per, conf = {}, collections.defaultdict(collections.Counter)
    for g, o in zip(gold, got):
        conf[g][o] += 1
    for s in R.NOTE_STATUSES:
        tp = sum(g == s and o == s for g, o in zip(gold, got))
        fp = sum(g != s and o == s for g, o in zip(gold, got))
        fn = sum(g == s and o != s for g, o in zip(gold, got))
        p = tp / (tp + fp) if tp + fp else None
        rc = tp / (tp + fn) if tp + fn else None
        f1 = 2 * p * rc / (p + rc) if p and rc else 0.0
        per[s] = {"support": tp + fn, "precision": None if p is None else round(p, 4), "recall": None if rc is None else round(rc, 4), "f1": round(f1, 4)}
    return {"per_status": per, "macro_f1": round(sum(v["f1"] for v in per.values()) / len(per), 4) if records else None,
            "confusion_gold_x_outcome": {g: dict(sorted(v.items())) for g, v in sorted(conf.items())}}


def score_scheme(records: list[dict], calls: list[dict]) -> dict:
    by_id = {c["id"]: c for c in calls if c.get("id")}
    started = [r for r in records if r["id"] in by_id]
    ev = E.evaluate(records, calls)
    out = {"records": len(records), "started": len(started), "not_started": len(records) - len(started),
           "note_status": {**ev["note_status"], **_note_f1(started, by_id)},
           "primary": {k: ev["primary"]["all_started"][k] for k in ("n", "correct", "accuracy", "ci95_wilson", "macro_f1", "errors", "invalid", "interrupted")},
           "safety": {k: v for k, v in ev["safety"].items() if k != "missed_halt_ids"}, "outcomes": ev["outcomes"], "subsets": {}}
    for name, sub in subsets(started).items():
        if name == "all":
            continue
        pairs = [(r, by_id[r["id"]]) for r in sub]
        note = E.score_note(pairs)
        saf = E.score_safety(pairs)
        out["subsets"][name] = {"n": len(sub), "note_correct": note["correct"], "note_accuracy": note["accuracy"], "primary_correct": E.score_primary(pairs)["correct"],
                                "missed_halt": saf["missed_halt"], "needless_halt": saf["needless_halt"], "parse_failure_halts": saf["parse_failure_halts"], "fault_halts": saf["fault_halts"]}
    return out


def correctness(records: list[dict], calls: list[dict]) -> dict[str, bool]:
    by_id = {c["id"]: c for c in calls if c.get("id")}
    return {r["id"]: (r["id"] in by_id and E.note_outcome(by_id[r["id"]], r) == r["note_status"]) for r in records}


# ---- paired comparison and the family bootstrap -----------------------------------------------------------------------------------------------
def paired(a: dict[str, bool], b: dict[str, bool]) -> dict:
    ids = sorted(a)
    return {"both_correct": sum(a[i] and b[i] for i in ids), "only_first_correct": sum(a[i] and not b[i] for i in ids),
            "only_second_correct": sum(b[i] and not a[i] for i in ids), "both_wrong": sum(not a[i] and not b[i] for i in ids), "n": len(ids)}


def family_bootstrap(records: list[dict], a: dict[str, bool], b: dict[str, bool]) -> dict:
    """Difference in note accuracy (a minus b) in percentage points, resampling whole families (same draw for both schemes), 2,000 times, seed 20261109."""
    fam: dict[str, list[str]] = collections.defaultdict(list)
    for r in records:
        fam[r.get("family_id") or r["id"]].append(r["id"])
    keys = sorted(fam)
    rng = random.Random(BOOTSTRAP["seed"])
    diffs = []
    for _ in range(BOOTSTRAP["resamples"]):
        ids = [i for k in (rng.choice(keys) for _ in keys) for i in fam[k]]
        diffs.append(100.0 * (sum(a[i] for i in ids) - sum(b[i] for i in ids)) / len(ids))
    diffs.sort()
    n = len(records)
    point = 100.0 * (sum(a.values()) - sum(b.values())) / n
    return {"difference_points": round(point, 2), "ci95_points": [round(diffs[int(0.025 * len(diffs))], 2), round(diffs[int(0.975 * len(diffs)) - 1], 2)],
            "families": len(keys), "records": n, **BOOTSTRAP,
            "note": "estimates sampling uncertainty over families; it does not repair the representativeness of synthetic data"}


# ---- the model scheme: latency, usage, cost --------------------------------------------------------------------------------------------------
def model_costs(records: list[dict], calls: list[dict], summary: dict) -> dict:
    by_rec = {r["id"]: r for r in records}
    lat_all = [c["latency_ms"] for c in calls if isinstance(c.get("latency_ms"), (int, float))]
    lat_ok = [c["latency_ms"] for c in calls if isinstance(c.get("latency_ms"), (int, float)) and c["id"] in by_rec and E.usable(c, by_rec[c["id"]])]
    with_usage = [c for c in calls if isinstance((c.get("usage") or {}).get("prompt_tokens"), int) and isinstance((c.get("usage") or {}).get("completion_tokens"), int)]
    reported_usd = float(summary["usd_from_reported_usage"])
    committed = float(summary["budget"]["usd_committed"])
    return {"requests": len(calls), "requests_with_reported_usage": len(with_usage), "requests_without_reported_usage": len(calls) - len(with_usage),
            "latency_ms_all_requests": describe(lat_all), "latency_ms_successful_requests": describe(lat_ok),
            "latency_note": "wall clock of one API request around the client call (network + service + hidden reasoning); not an HTTP business end-to-end latency and not comparable with local rule time",
            "tokens_reported": {"prompt": sum(c["usage"]["prompt_tokens"] for c in with_usage), "completion": sum(c["usage"]["completion_tokens"] for c in with_usage)},
            "usd_from_reported_usage": round(reported_usd, 6),
            "usd_mean_per_request_with_usage": round(reported_usd / len(with_usage), 6) if with_usage else None,
            "usd_reserved_for_requests_without_usage": round(committed - reported_usd, 6),
            "cost_note": "estimate at the configured rates (not a bill); a request with no reported usage keeps its worst-case reservation, which is an upper bound and not a spend, and is never counted as zero"}


def local_time(ns: list[int]) -> dict:
    us = [x / 1000.0 for x in ns]
    return {**describe(us), "total_ms": round(sum(ns) / 1e6, 3), "unit_of_median_p95_max": "microseconds per record",
            "note": "local string processing on one machine; not the same kind of time as a model request"}


# ---- the whole report ---------------------------------------------------------------------------------------------------------------------------
def analyze(records: list[dict], model_calls: list[dict], summary: dict, rule_runs: dict) -> tuple[dict, dict]:
    """(public aggregate report, private detail). The public one has no id, no note, no reply."""
    schemes = {"model": model_calls, **{k: v[0] for k, v in rule_runs.items()}}
    scores = {k: score_scheme(records, c) for k, c in schemes.items()}
    ok = {k: correctness(records, c) for k, c in schemes.items()}
    comparisons, private_pairs = {}, {}
    for other in ("R3", "R1", "R2"):
        comparisons[f"model_vs_{other}"] = {"paired": paired(ok["model"], ok[other]), "note_accuracy_difference": family_bootstrap(records, ok["model"], ok[other])}
        private_pairs[f"model_vs_{other}"] = {k: sorted(i for i in ok["model"] if (ok["model"][i], ok[other][i]) == v) for k, v in
                                              {"both_correct": (True, True), "only_model_correct": (True, False), f"only_{other}_correct": (False, True), "both_wrong": (False, False)}.items()}
    complete = summary["status"] == "completed" and scores["model"]["started"] == len(records) == summary["planned"]
    public = {"headline": "note status accuracy (the main metric of this round); the primary route and the executed action are reported apart",
              "complete": complete, "status": summary["status"], "stop_reason": summary["stop_reason"], "records": len(records), "model_started": scores["model"]["started"],
              "not_started": scores["model"]["not_started"],
              "completeness_note": "complete = the run finished and every record was started; a stopped or interrupted run is NOT a full result and its figures must not be quoted as one",
              "schemes": scores, "comparisons": comparisons,
              "model_success_only": _success_only(records, model_calls), "model_cost_and_latency": model_costs(records, model_calls, summary),
              "local_rule_time": {k: local_time(v[1]) for k, v in rule_runs.items()}}
    by_rec = {r["id"]: r for r in records}
    private = {"paired_ids": private_pairs, "model_outcomes": {c["id"]: E.note_outcome(c, by_rec[c["id"]]) for c in model_calls if c.get("id") in by_rec}}
    return public, private


def _success_only(records: list[dict], calls: list[dict]) -> dict:
    by_id = {c["id"]: c for c in calls}
    ok = [(r, by_id[r["id"]]) for r in records if r["id"] in by_id and E.usable(by_id[r["id"]], r)]
    k = sum(E.note_outcome(c, r) == r["note_status"] for r, c in ok)
    return {"n": len(ok), "note_correct": k, "note_accuracy": round(k / len(ok), 4) if ok else None, "ci95_wilson": E.wilson(k, len(ok)),
            "note": "among requests that returned a usable reply; shown NEXT TO the main figure, never instead of it"}
