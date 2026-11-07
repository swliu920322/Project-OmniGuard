"""Counts, coverage and checks for the dev set. Pure functions of the records; no model, no network."""
from __future__ import annotations

import importlib.util
import itertools
import json
import pathlib
from collections import Counter

import family as F
import reference_labeler as R
import rule_control as C

SPEC = pathlib.Path(__file__).resolve().parents[1] / "spec"
EQUAL = {"distance_cm": 30, "temperature_c": 60, "velocity_ms": 2.5, "battery_pct": 20, "hp": 50}
DECIMAL_BOUNDARIES = {"distance_cm": [29.99, 30.01], "temperature_c": [59.99, 60.01], "velocity_ms": [2.49, 2.51],
                      "battery_pct": [19.99, 20.01], "hp": [49.99, 50.01]}
FIELD_RISK = {"distance_cm": "CRITICAL_OBSTACLE", "temperature_c": "OVERHEAT", "velocity_ms": "OVERSPEED",
              "battery_pct": "LOW_BATTERY", "hp": "LOW_HEALTH"}


def build(records: list[dict], fams: dict) -> dict:
    n = len(records)
    by_class = Counter(r["gold"]["primary"] for r in records)
    noted = [r for r in records if r["note"]]
    by_status = Counter(r["note_status"] for r in noted)
    by_lang = Counter(r["language"] for r in noted)
    by_status_lang = {s: dict(Counter(r["language"] for r in noted if r["note_status"] == s)) for s in R.NOTE_STATUSES}
    multi = Counter(r["note_status"] for r in noted if r["multi_clause"])
    sizes = Counter(len(f["records"]) for f in fams["families"].values())
    dev_pool = set(F.pool_by_split()["dev"])
    thresholds = {}
    for field, edge in EQUAL.items():
        vals = [r["telemetry"][field] for r in records]
        fired = [FIELD_RISK[field] in r["gold"]["telemetry_risks"] for r in records]
        thresholds[field] = {"threshold": edge, "safe_side": sum(1 for v, f in zip(vals, fired) if not f and v != edge),
                             "exactly_at": sum(1 for v in vals if v == edge), "violating": sum(fired),
                             "decimal_boundaries_present": [d for d in DECIMAL_BOUNDARIES[field] if d in vals]}
    pairs = Counter()
    for r in records:
        for a, b in itertools.combinations(r["gold"]["risk_set"], 2):
            pairs[" + ".join(sorted((a, b)))] += 1
    all_pairs = [" + ".join(sorted(p)) for p in itertools.combinations(R.PRIORITY, 2)]
    multi_risk = Counter(len(r["gold"]["risk_set"]) for r in records)
    per_class_patterns = {c: dict(sorted(Counter("+".join(r["gold"]["risk_set"]) or "none" for r in records
                                                  if r["gold"]["primary"] == c).items())) for c in R.CLASSES}
    texts = [{"family_id": r["family_id"], "text": r["rendered_input"]} for r in records]
    public = json.loads((SPEC / "ambiguous_examples.json").read_text())
    public_texts = [{"text": R.render_telemetry(e["input"], e["note"])} for e in public if R.validate(e["input"]) is None]
    within = F.check_records(texts, "dev")
    cross = F.cross_duplicates(public_texts, texts)
    clause_ok = all(R.combine_clause_statuses([c["status"] for c in r["clauses"]]) == r["note_status"] for r in noted)
    relabel_ok = all(R.compose(r["telemetry"], r["note_status"])["primary"] == r["gold"]["primary"] for r in records)
    roundtrip_ok = all(R.parse_rendered(r["rendered_input"].split(" Operator note:")[0]) == r["telemetry"] for r in records)
    r1 = sum(C.note_status_r1(r["note"]) == r["note_status"] for r in noted)
    r2 = sum(C.note_status_r2(r["note"]) == r["note_status"] for r in noted)
    gate = Counter(r["gold"]["gate"] for r in records)
    checks = {
        "180 records": n == 180,
        "30 per class": all(by_class[c] == 30 for c in R.CLASSES),
        "notes >= 60": len(noted) >= 60,
        "every status >= 10": all(by_status[s] >= 10 for s in R.NOTE_STATUSES),
        "every status has en, zh and mixed >= 4": all(by_status_lang[s].get(l, 0) >= 4 for s in R.NOTE_STATUSES for l in ("en", "zh", "mixed")),
        "every family id is assigned to dev": all(f in dev_pool for f in fams["families"]) and all(r["family_id"] in dev_pool for r in records),
        "no duplicate text inside the set, no family in another split": within == [],
        "no rendered text equals a public example": cross == [],
        "all 10 risk pairs >= 2 (gold risk sets)": all(pairs[p] >= 2 for p in all_pairs),
        ">= 6 records with three or more risks": sum(v for k, v in multi_risk.items() if k >= 3) >= 6,
        "every threshold: safe side, exactly at, violating": all(t["safe_side"] > 0 and t["exactly_at"] > 0 and t["violating"] > 0 for t in thresholds.values()),
        "every decimal boundary present": all(len(t["decimal_boundaries_present"]) == 2 for t in thresholds.values()),
        "physical-gate records present (hp <= 0 and battery < 5)": any(r["telemetry"]["hp"] <= 0 for r in records) and any(r["telemetry"]["battery_pct"] < 5 for r in records),
        "clause statuses combine to the note status": clause_ok,
        "gold primary recomputed from telemetry and status": relabel_ok,
        "rendered text parses back to the exact numbers": roundtrip_ok,
        "notes within the 500-character contract": all(len(r["note"]) <= R.MAX_NOTE_CHARS for r in noted),
    }
    return {
        "records": n, "seed": fams["seed"], "spec_version": fams["spec_version"], "salt": fams["salt"],
        "per_class": dict(by_class), "notes": len(noted), "per_status": dict(by_status), "per_language": dict(by_lang),
        "per_status_language": by_status_lang, "multi_clause_per_status": dict(multi),
        "families": {"count": len(fams["families"]), "size_distribution": {str(k): v for k, v in sorted(sizes.items())},
                     "kinds": dict(Counter(f["kind"] for f in fams["families"].values()))},
        "thresholds": thresholds, "risk_pairs": {p: pairs[p] for p in all_pairs}, "risks_per_record": {str(k): v for k, v in sorted(multi_risk.items())},
        "patterns_per_class": per_class_patterns, "gate": dict(gate),
        "source_disagreement": sum(r["gold"]["source_disagreement"] for r in records),
        "duplicates_within": within, "duplicates_with_public_examples": cross,
        "rule_controls_note_status_agreement_informational": {"R1": f"{r1}/{len(noted)}", "R2": f"{r2}/{len(noted)}"},
        "checks": checks, "all_checks_pass": all(checks.values()),
    }


def markdown(rep: dict) -> str:
    L = [f"# Dev set coverage report", "",
         f"Spec `{rep['spec_version']}`, seed `{rep['seed']}`, split salt `{rep['salt']}`. Generated by `make_dev_set.py`; no model was called and no test data was touched.",
         "Synthetic samples of a simulation; labels are the spec's deterministic gold plus AI-annotated notes (AI annotation and AI review pending: see below).", "",
         "## Checks", "", "| Check | Result |", "|---|---|"]
    L += [f"| {k} | {'pass' if v else '**FAIL**'} |" for k, v in rep["checks"].items()]
    L += ["", "## Counts", "", "| Class (gold primary) | Records |", "|---|---:|"]
    L += [f"| `{c}` | {rep['per_class'].get(c, 0)} |" for c in R.CLASSES]
    L += ["", f"Notes: {rep['notes']} records. Multi-clause per status: {rep['multi_clause_per_status']}.", "",
          "| Note status | en | zh | mixed | total |", "|---|---:|---:|---:|---:|"]
    for s in R.NOTE_STATUSES:
        d = rep["per_status_language"][s]
        L.append(f"| `{s}` | {d.get('en', 0)} | {d.get('zh', 0)} | {d.get('mixed', 0)} | {rep['per_status'][s]} |")
    f = rep["families"]
    L += ["", f"## Families", "", f"{f['count']} families, all drawn from ids that `family.py` assigns to dev. Records per family: {f['size_distribution']}. Kinds: {f['kinds']} "
          "(`boundary`: equality, near-safe and violating value of one threshold; `pair`: the same scenario with an English and a Chinese note; `single`).", "",
          "## Thresholds", "", "| Field | Threshold | Safe side | Exactly at | Violating | Decimal boundaries present |", "|---|---:|---:|---:|---:|---|"]
    for k, t in rep["thresholds"].items():
        L.append(f"| `{k}` | {t['threshold']} | {t['safe_side']} | {t['exactly_at']} | {t['violating']} | {t['decimal_boundaries_present']} |")
    L += ["", "## Risk pairs and multi-risk records (gold risk sets, notes included)", "", "| Pair | Records |", "|---|---:|"]
    L += [f"| {p} | {c} |" for p, c in rep["risk_pairs"].items()]
    L += ["", f"Risks per record: {rep['risks_per_record']}. Physical gate (router skipped in production): {rep['gate']}. "
          f"Records where note and telemetry disagree (source disagreement): {rep['source_disagreement']}.", "",
          "## Patterns inside each class (only what the class allows)", ""]
    for c, d in rep["patterns_per_class"].items():
        L.append(f"- `{c}`: {d}")
    ag = rep["rule_controls_note_status_agreement_informational"]
    L += ["", "## Informational", "",
          f"Rule controls on the note statuses of this dev set (not tuned for it, no model): R1 {ag['R1']}, R2 {ag['R2']}. "
          "The same session wrote both the R1 word lists and these notes, so R1's high agreement here is not an estimate of how it will do on notes written independently. It is a description of the baselines on dev material, not a result.", "",
          "## Not done yet", "",
          "- The note statuses are the generator's own annotation. The AI review and the sealed blind sample of `ANNOTATION_PROTOCOL.md` have not been run.",
          "- No stress cases are in this set (they are separate: DATA_PLAN section 5).",
          "- The frozen test set does not exist here and was not read."]
    return "\n".join(L) + "\n"
