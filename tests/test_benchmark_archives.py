import csv
import json
import statistics
from pathlib import Path


RUNS = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "cloud-orchestrator"
    / "embodied_brain"
    / "benchmark_results"
    / "runs"
)


def test_historical_thesis_archive_matches_quoted_metrics():
    run_dir = RUNS / "2026-07-16-thesis-200"
    rows = list(csv.DictReader((run_dir / "results.csv").open()))
    summary = json.loads((run_dir / "summary.json").read_text())
    router_rows = [row for row in rows if row["router_label"]]
    pass_rows = [row for row in rows if row["gate_decision"] == "PASS"]
    pipeline_latency = [
        float(row["router_latency"])
        + float(row["safety_latency"])
        + float(row["compiler_latency"])
        for row in pass_rows
    ]

    assert len(rows) == summary["total_scenarios"] == 200
    assert len(router_rows) == 172
    assert sum(row["router_label"] == row["expected_label"] for row in router_rows) == 162
    assert sum(row["gate_decision"] != "PASS" for row in rows) == 79
    assert len(pass_rows) == 121
    assert round(statistics.median(pipeline_latency), 1) == 5680.1
    assert round(statistics.mean(pipeline_latency), 1) == 6173.6
    assert round(max(pipeline_latency), 1) == 16390.6


def test_diagnostic_archive_is_a_distinct_60_row_run():
    run_dir = RUNS / "2026-08-18-diagnostic-60"
    rows = list(csv.DictReader((run_dir / "results.csv").open()))
    payload = json.loads((run_dir / "results.json").read_text())

    assert len(rows) == len(payload["results"]) == 60
    assert payload["metrics"]["total_scenarios"] == 60
    assert payload["metrics"]["metadata"]["num_scenarios"] == 200
    assert payload["metrics"]["router_accuracy"]["correct"] == 47
    assert payload["metrics"]["router_accuracy"]["total"] == 52
