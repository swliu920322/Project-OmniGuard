"""R1 / R2 rule controls on the dev set and the dev-side stress cases. Offline: no model, no network, and nothing from the test side.

    python eval/dev/rule_control/make_report.py [--check]

The controls read the SAME rendered text a model reads (eval/spec/rule_control.py, word lists fixed there) and are scored with the same
evaluator as baseline B (eval/baseline_b/evaluate.py): `primary` against the gold route, `note_status` apart from it, the executed action
through reference_labeler.execute(). Informational: both controls and the dev notes came from the same author, and the word lists were
extended once on the public examples, so the numbers describe the controls on dev material and are not a result or a competitor score.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
for sub in ("eval/spec", "eval/baseline_b"):
    sys.path.insert(0, str(ROOT / sub))
import evaluate as E  # noqa: E402
import reference_labeler as R  # noqa: E402
import rule_control as C  # noqa: E402


def _stress_records() -> list[dict]:
    """Stress cases that reach a classifier (types 3-8 and the valid blank-note cases of type 9), shaped like dev records."""
    out = []
    for line in (ROOT / "eval/dev/stress/stress_dev.jsonl").read_text().splitlines():
        c = json.loads(line)
        if not c["sent_to_model"] or c["group"] != "A":
            continue
        tele = {k: (float("nan") if v == "NaN" else v) for k, v in c["telemetry"].items()}
        note = (c["note"] or "").strip() or None
        gold = R.compose(tele, c["note_status"] if note else None)
        out.append({"id": c["id"], "type": c["type"], "telemetry": tele, "note": note, "note_status": c["note_status"] if note else None,
                    "rendered_input": R.render_telemetry(tele, note),
                    "gold": {"primary": gold["primary"], "risk_set": gold["risk_set"], "telemetry_risks": gold["telemetry_risks"], "gate": gold["gate"], "action": gold["action"]}})
    return out


def _calls(records: list[dict], variant: str) -> list[dict]:
    return [{"id": r["id"], "prediction": C.predict(r["rendered_input"], variant), "finish_reason": "stop", "error": None} for r in records]


def _brief(m: dict) -> dict:
    p = m["primary"]["all_started"]
    return {"n": p["n"], "primary_correct": p["correct"], "primary_accuracy": p["accuracy"], "note_n": m["note_status"]["n"], "note_correct": m["note_status"]["correct"],
            "note_accuracy": m["note_status"]["accuracy"], "missed_halt": m["safety"]["missed_halt"], "needless_halt": m["safety"]["needless_halt"],
            "note_mistakes": m["note_status"]["mistakes"], "missed_halt_ids": m["safety"]["missed_halt_ids"]}


def build() -> dict:
    dev = [json.loads(line) for line in (ROOT / "eval/dev/dev_set.jsonl").read_text().splitlines()]
    stress = _stress_records()
    rep = {"spec_version": R.SPEC_VERSION, "rule_control_sha256": hashlib.sha256((ROOT / "eval/spec/rule_control.py").read_bytes()).hexdigest(),
           "dev_set_sha256": hashlib.sha256((ROOT / "eval/dev/dev_set.jsonl").read_bytes()).hexdigest(),
           "stress_sha256": hashlib.sha256((ROOT / "eval/dev/stress/stress_dev.jsonl").read_bytes()).hexdigest(), "controls": {}}
    for variant in ("R1", "R2"):
        d = E.evaluate(dev, _calls(dev, variant))
        s = E.evaluate(stress, _calls(stress, variant))
        by_type = {}
        for ty in sorted({r["type"] for r in stress}):
            sub = [r for r in stress if r["type"] == ty]
            by_type[str(ty)] = _brief(E.evaluate(sub, _calls(sub, variant)))
        telemetry_only = d["primary"]["telemetry_only"]
        rep["controls"][variant] = {
            "dev_all": _brief(d), "dev_telemetry_only_primary": {"n": telemetry_only["n"], "correct": telemetry_only["correct"]},
            "dev_noted_primary": {"n": d["primary"]["noted"]["n"], "correct": d["primary"]["noted"]["correct"]},
            "dev_note_status_per_status_recall": d["note_status"]["per_status_recall"], "stress_scored_types": _brief(s), "stress_by_type": by_type}
    rep["stress_cases_not_classified"] = "types 1, 2 and the invalid type-9 cases are rejected by the input check in code before any classifier; types 10-11 are injected faults"
    return rep


def markdown(rep: dict) -> str:
    L = ["# R1 / R2 rule controls on the dev material", "",
         f"Spec `{rep['spec_version']}`; `rule_control.py` sha256 `{rep['rule_control_sha256'][:16]}…`; dev set `{rep['dev_set_sha256'][:16]}…`; stress cases `{rep['stress_sha256'][:16]}…`. Offline, no model.", "",
         "**Read this first.** Informational only. The dev notes and both controls come from the same author, the word lists were extended once on the public examples, "
         "and nothing here was tuned on any test material. These numbers describe what a keyword rule does on dev material. They are not a result and not a competitor score. "
         "On telemetry-only records the controls reproduce the gold by construction (a sanity ceiling); the comparison that means something is the noted records.", ""]
    for v, c in rep["controls"].items():
        d = c["dev_all"]
        L += [f"## {v}", "", f"- Dev set (180): primary {d['primary_correct']}/{d['n']} = {d['primary_accuracy']}; telemetry-only {c['dev_telemetry_only_primary']['correct']}/{c['dev_telemetry_only_primary']['n']}; "
              f"noted {c['dev_noted_primary']['correct']}/{c['dev_noted_primary']['n']}; note status {d['note_correct']}/{d['note_n']} = {d['note_accuracy']}; missed_halt {d['missed_halt']}, needless_halt {d['needless_halt']}",
              f"- Note-status mistakes on dev: {d['note_mistakes']}; missed halts: {d['missed_halt_ids']}", ""]
        s = c["stress_scored_types"]
        L += [f"- Stress cases that reach a classifier ({s['n']}): primary {s['primary_correct']}/{s['n']} = {s['primary_accuracy']}; note status {s['note_correct']}/{s['note_n']} = {s['note_accuracy']}; "
              f"missed_halt {s['missed_halt']}, needless_halt {s['needless_halt']}", "", "| Stress type | n | primary correct | note status correct | missed_halt | needless_halt |", "|---|---:|---:|---|---:|---:|"]
        L += [f"| {t} | {b['n']} | {b['primary_correct']} | {b['note_correct']}/{b['note_n']} | {b['missed_halt']} | {b['needless_halt']} |" for t, b in c["stress_by_type"].items()]
        L += [""]
    L += [rep["stress_cases_not_classified"] + ".", ""]
    return "\n".join(L)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    rep = build()
    files = {"report.json": json.dumps(rep, ensure_ascii=False, indent=1, sort_keys=True) + "\n", "REPORT.md": markdown(rep)}
    if args.check:
        same = all((HERE / n).read_text() == t for n, t in files.items())
        print("regenerated files identical" if same else "DIFFERENT")
        raise SystemExit(0 if same else 1)
    for n, t in files.items():
        (HERE / n).write_text(t)
    print("wrote", ", ".join(files))


if __name__ == "__main__":
    main()
