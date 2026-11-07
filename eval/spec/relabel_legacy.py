"""Derive a relabelled view of the archived 200 rows. The archived original is only READ, never changed.

Output goes to eval/spec/derived/ (legacy200_relabel.csv + legacy200_relabel.meta.json with the source SHA-256).
The derived file is history for comparison, not a test set.
"""
import csv
import hashlib
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import reference_labeler as R  # noqa: E402

SRC = HERE.parent / "baseline_v1/original/src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-07-16-thesis-200/results.csv"
OUT = HERE / "derived"


def main() -> None:
    raw = SRC.read_bytes()
    OUT.mkdir(exist_ok=True)
    rows = []
    for x in csv.DictReader(raw.decode().splitlines()):
        rec = {"distance_cm": float(x["obstacle"]), "velocity_ms": float(x["velocity"]), "hp": float(x["hp"]),
               "battery_pct": float(x["battery"]), "temperature_c": float(x["temperature"])}
        lab = R.label(rec)
        rows.append({"scenario_id": x["scenario_id"], "legacy_label": x["expected_label"], "new_primary": lab["primary"],
                     "risk_set": "|".join(lab["risk_set"]), "gate": lab["gate"], "legacy3_view": lab["legacy3"]})
    with open(OUT / "legacy200_relabel.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    (OUT / "legacy200_relabel.meta.json").write_text(json.dumps({
        "source": str(SRC.relative_to(HERE.parent.parent)), "source_sha256": hashlib.sha256(raw).hexdigest(),
        "spec_version": R.SPEC_VERSION, "rows": len(rows), "note": "derived view; the source is never modified"}, indent=1) + "\n")


if __name__ == "__main__":
    main()
