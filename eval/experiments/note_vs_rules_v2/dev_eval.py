"""Offline development evaluation of the note rules R1, R2 and R3 on PUBLIC development material only.

    python eval/experiments/note_vs_rules_v2/dev_eval.py [--label v0] [--write]

Pool (every file is hashed in the output; no private or test file is read):
  dev       eval/dev/dev_set.jsonl                   noted records (gold note_status is AI annotation + AI review)
  stress    eval/dev/stress/stress_dev.jsonl         dev-side stress cases with a note that reach a classifier (types 5-8)
  boundary  eval/spec/ambiguous_examples.json        the public boundary examples that carry a note
  extra     eval/experiments/note_vs_rules_v2/dev_extra.jsonl   examples written for this round, AI-labelled and NOT reviewed
Notes with the same text appear once (the first source wins). `disputed` extra rows are listed, never scored.
Only the note status is scored here (the primary route is composed from it by the frozen rules). This is development
material: the numbers say how the rule behaves on what it was written against, not how it generalises.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
for sub in ("eval/spec", "eval/baseline_b"):
    sys.path.insert(0, str(ROOT / sub))
sys.path.insert(0, str(HERE))
import reference_labeler as R  # noqa: E402
import rule_control as C  # noqa: E402
import r3 as R3  # noqa: E402

NORMAL_TELEMETRY = {"distance_cm": 300, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}
FILES = {"dev": "eval/dev/dev_set.jsonl", "stress": "eval/dev/stress/stress_dev.jsonl", "boundary": "eval/spec/ambiguous_examples.json",
         "extra": "eval/experiments/note_vs_rules_v2/dev_extra.jsonl"}


def sha(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_pool() -> tuple[list[dict], list[dict], dict]:
    rows, disputed, dup = [], [], 0
    seen: set[str] = set()

    def push(src, rid, note, status, kind=None, family=None, is_disputed=False):
        nonlocal dup
        key = " ".join(note.split())
        if is_disputed:
            disputed.append({"source": src, "id": rid, "note": note, "gold": status})
            return
        if key in seen:
            dup += 1
            return
        seen.add(key)
        rows.append({"source": src, "id": rid, "note": note, "gold": status, "kind": kind, "family": family})

    for line in (ROOT / FILES["dev"]).read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        if r["note"]:
            push("dev", r["id"], r["note"], r["note_status"], family=r["family_id"])
    for line in (ROOT / FILES["stress"]).read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        if r["type"] in (5, 6, 7, 8) and r.get("group") == "A" and isinstance(r.get("note"), str) and r["note"].strip():
            push("stress", r["id"], r["note"], r["note_status"], family=r["family_id"])
    for r in json.loads((ROOT / FILES["boundary"]).read_text(encoding="utf-8")):
        if isinstance(r.get("note"), str) and r["note"].strip():
            push("boundary", r["id"], r["note"], r["note_status"])
    for line in (ROOT / FILES["extra"]).read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        push("extra", r["id"], r["note"], r["note_status"], kind=r["kind"], family=r["family"], is_disputed=r["disputed"])
    return rows, disputed, {"duplicate_note_texts_skipped": dup}


def text_of(note: str) -> str:
    return R.render_telemetry(NORMAL_TELEMETRY, note)


def predictors() -> dict:
    return {"R1": lambda t: C.predict(t, "R1"), "R2": lambda t: C.predict(t, "R2"), "R3": R3.predict}


def halts(status: str | None) -> bool:
    return status in R.NOTE_RISK_STATUSES


def evaluate(rows: list[dict]) -> dict:
    out = {}
    for name, fn in predictors().items():
        wrong, by_src, by_kind = [], collections.defaultdict(lambda: [0, 0]), collections.defaultdict(lambda: [0, 0])
        missed = needless = 0
        for r in rows:
            got = fn(text_of(r["note"]))["note_status"]
            ok = got == r["gold"]
            by_src[r["source"]][1] += 1
            by_src[r["source"]][0] += ok
            if r["kind"]:
                by_kind[r["kind"]][1] += 1
                by_kind[r["kind"]][0] += ok
            missed += halts(r["gold"]) and not halts(got)
            needless += halts(got) and not halts(r["gold"])
            if not ok:
                wrong.append({"source": r["source"], "id": r["id"], "gold": r["gold"], "got": got, "note": r["note"]})
        n = len(rows)
        out[name] = {"n": n, "correct": n - len(wrong), "accuracy": round((n - len(wrong)) / n, 4), "missed_halt_by_note": missed, "needless_halt_by_note": needless,
                     "by_source": {k: f"{v[0]}/{v[1]}" for k, v in sorted(by_src.items())}, "by_extra_kind": {k: f"{v[0]}/{v[1]}" for k, v in sorted(by_kind.items())},
                     "mistakes": wrong}
    return out


def holdout_pool() -> tuple[list[dict], list[dict]]:
    """dev_holdout.jsonl: written before any R3 revision, run once after the rule was frozen (never used to change the rule)."""
    rows, disputed = [], []
    for line in (HERE / "dev_holdout.jsonl").read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        (disputed if r["disputed"] else rows).append({"source": "holdout", "id": r["id"], "note": r["note"], "gold": r["note_status"], "kind": None, "family": None})
    return rows, disputed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", default=R3.VERSION)
    ap.add_argument("--write", action="store_true", help="write dev_runs/<label>.json")
    ap.add_argument("--holdout", action="store_true", help="score dev_holdout.jsonl instead of the development pool")
    a = ap.parse_args()
    if a.holdout:
        rows, disputed = holdout_pool()
        meta = {"pool": "dev_holdout.jsonl", "holdout_sha256": sha(HERE / "dev_holdout.jsonl")}
    else:
        rows, disputed, meta = load_pool()
    res = evaluate(rows)
    rep = {"label": a.label, "r3_version": R3.VERSION, "r3_sha256": sha(HERE / "r3.py"), "files_sha256": {k: sha(ROOT / v) for k, v in FILES.items()},
           "pool_size": len(rows), **meta, "disputed_not_scored": disputed, "systems": res,
           "note": "development material only; the extra rows are AI-labelled and unreviewed; author had read the public dev notes before drafting v0"}
    for name, m in res.items():
        print(f"{name}: {m['correct']}/{m['n']} = {m['accuracy']}  missed_by_note={m['missed_halt_by_note']} needless_by_note={m['needless_halt_by_note']}  {m['by_source']}")
    for m in res["R3"]["mistakes"]:
        print("  R3 wrong:", m["source"], m["id"], m["gold"], "->", m["got"], "|", m["note"])
    if a.write:
        path = HERE / "dev_runs" / f"{a.label}.json"
        path.write_text(json.dumps(rep, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        print("wrote", path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
