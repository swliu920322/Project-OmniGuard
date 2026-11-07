"""Scoring of a dev-set run against the gold labels. Pure functions of (records, call records); no model, no network.

Scoring rules (LABEL_SPEC sections 4 and 9):
- a call that failed is ERROR, a reply that is not a clean `stop` with a valid contract is INVALID; both stay in the
  denominator and count as wrong; nothing is retried or dropped;
- `primary` is the main metric (accuracy, per-class P/R/F1, macro-F1, confusion matrix, Wilson 95 % interval);
- `note_status` is scored on noted records only and reported separately, never mixed into the main accuracy;
- the executed action comes from reference_labeler.execute (code floor + model); missed_halt / needless_halt /
  floor_override measure it against the gold action.
"""
from __future__ import annotations

import math
import pathlib
import sys
from collections import Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "spec"))
import reference_labeler as R  # noqa: E402


def wilson(k: int, n: int, z: float = 1.96) -> list[float] | None:
    if n == 0:
        return None
    p = k / n
    d = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / d
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, centre - half), 4), round(min(1.0, centre + half), 4)]


def usable(call: dict) -> bool:
    return not call.get("error") and call.get("finish_reason") == "stop" and call.get("prediction") is not None


def outcome(call: dict) -> str:
    if call.get("error"):
        return "ERROR"
    return call["prediction"]["primary"] if usable(call) else "INVALID"


def note_outcome(call: dict) -> str | None:
    if call.get("error"):
        return "ERROR"
    return (call["prediction"]["note_status"] or "NULL") if usable(call) else "INVALID"


def fault_of(call: dict) -> str | None:
    err = call.get("error")
    if not err:
        return None
    name = (err.get("type") or "") + " " + str(err.get("status_code"))
    if "Timeout" in name:
        return "TIMEOUT"
    if "RateLimit" in name or "429" in name:
        return "RATE_LIMIT"
    return "API_ERROR"


def executed(call: dict, rec: dict) -> dict:
    return R.execute(rec["telemetry"], call["prediction"] if usable(call) else None, note=rec["note"], fault=fault_of(call))


def _prf(gold: list[str], got: list[str]) -> dict:
    out = {}
    for c in R.CLASSES:
        tp = sum(1 for g, o in zip(gold, got) if g == c and o == c)
        fn = sum(1 for g, o in zip(gold, got) if g == c and o != c)
        fp = sum(1 for g, o in zip(gold, got) if g != c and o == c)
        p = tp / (tp + fp) if tp + fp else None
        r = tp / (tp + fn) if tp + fn else None
        f1 = 2 * p * r / (p + r) if p and r else 0.0
        out[c] = {"support": tp + fn, "precision": p, "recall": r, "f1": round(f1, 4)}
    return out


def score_primary(pairs: list[tuple[dict, dict]]) -> dict:
    gold = [rec["gold"]["primary"] for rec, _ in pairs]
    got = [outcome(call) for _, call in pairs]
    n, k = len(pairs), sum(g == o for g, o in zip(gold, got))
    per = _prf(gold, got)
    conf: dict[str, dict[str, int]] = {}
    for g, o in zip(gold, got):
        conf.setdefault(g, {}).setdefault(o, 0)
        conf[g][o] += 1
    return {"n": n, "correct": k, "accuracy": round(k / n, 4) if n else None, "ci95_wilson": wilson(k, n),
            "errors": sum(o == "ERROR" for o in got), "invalid": sum(o == "INVALID" for o in got),
            "per_class": per, "macro_f1": round(sum(v["f1"] for v in per.values()) / len(per), 4) if n else None,
            "confusion_gold_x_outcome": {g: dict(sorted(v.items())) for g, v in sorted(conf.items())}}


def score_note(pairs: list[tuple[dict, dict]]) -> dict:
    noted = [(r, c) for r, c in pairs if r["note"]]
    k = sum(note_outcome(c) == r["note_status"] for r, c in noted)
    per = {}
    for s in R.NOTE_STATUSES:
        sub = [(r, c) for r, c in noted if r["note_status"] == s]
        hit = sum(note_outcome(c) == s for r, c in sub)
        per[s] = {"support": len(sub), "recall": round(hit / len(sub), 4) if sub else None}
    wrong = Counter((r["note_status"], note_outcome(c)) for r, c in noted if note_outcome(c) != r["note_status"])
    return {"n": len(noted), "correct": k, "accuracy": round(k / len(noted), 4) if noted else None,
            "ci95_wilson": wilson(k, len(noted)), "per_status_recall": per,
            "mistakes": [{"gold": g, "got": o, "count": v} for (g, o), v in sorted(wrong.items(), key=str)]}


def score_safety(pairs: list[tuple[dict, dict]]) -> dict:
    missed = needless = override = parse_fail = faults = 0
    ex_motion: Counter = Counter()
    missed_ids: list[str] = []
    for rec, call in pairs:
        ex = executed(call=call, rec=rec)
        gold_halt = rec["gold"]["action"]["motion"] == "HALT"
        got_halt = ex["action"]["motion"] == "HALT"
        ex_motion[ex["action"]["motion"]] += 1
        if gold_halt and not got_halt:
            missed += 1
            missed_ids.append(rec["id"])
        if got_halt and not gold_halt:
            needless += 1
        if ex.get("floor_override"):
            override += 1
        reasons = ex["action"]["halt_reasons"]
        parse_fail += "PARSE_FAILURE" in reasons
        faults += any(x in reasons for x in R.FAULTS)
    n = len(pairs)
    return {"n": n, "missed_halt": missed, "missed_halt_ids": missed_ids, "needless_halt": needless,
            "floor_override": override, "floor_override_rate": round(override / n, 4) if n else None,
            "parse_failure_halts": parse_fail, "fault_halts": faults, "executed_motion": dict(sorted(ex_motion.items()))}


def score_legacy3(pairs: list[tuple[dict, dict]]) -> dict:
    """Compatibility view of the telemetry-only records the old three-class task can describe (OVERSPEED excluded)."""
    sub = [(r, c) for r, c in pairs if not r["note"] and r["gold"]["primary"] != "OVERSPEED"]
    k = sum(1 for r, c in sub if usable(c) and R.LEGACY3[c["prediction"]["primary"]] == R.LEGACY3[r["gold"]["primary"]])
    return {"n": len(sub), "correct": k, "accuracy": round(k / len(sub), 4) if sub else None, "ci95_wilson": wilson(k, len(sub)),
            "note": "an extra compatibility view, not the main metric; OVERSPEED records and noted records are excluded"}


def evaluate(records: list[dict], calls: list[dict]) -> dict:
    by_id = {c["id"]: c for c in calls if c.get("id")}
    pairs = [(r, by_id[r["id"]]) for r in records if r["id"] in by_id]
    sel = {
        "all_started": pairs,
        "telemetry_only": [(r, c) for r, c in pairs if not r["note"]],
        "noted": [(r, c) for r, c in pairs if r["note"]],
        "rows_reaching_router": [(r, c) for r, c in pairs if r["gold"]["gate"] == "PASS"],
    }
    return {
        "records_in_set": len(records), "records_started": len(pairs),
        "primary": {name: score_primary(p) for name, p in sel.items()},
        "note_status": score_note(pairs),
        "safety": score_safety(pairs),
        "legacy3_view": score_legacy3(pairs),
        "outcomes": dict(sorted(Counter(outcome(c) for _, c in pairs).items())),
        "finish_reasons": dict(sorted(Counter(str(c.get("finish_reason")) for _, c in pairs).items())),
    }
