---
id: "DOC-EVIDENCE-INDEX"
title: "Evidence and Metric Index"
summary: "Canonical definitions, provenance, and allowed wording for OmniGuard quantitative claims."
version: "1.0.1"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - cyber-physical-safety
  - multi-agent
perspectives:
  - academic-research
layers:
  - cross-cutting
doc_type: specification
status: accepted
code_refs:
  - "src/cloud-orchestrator/embodied_brain/benchmark.py"
  - "src/cloud-orchestrator/embodied_brain/benchmark_scenarios.py"
test_refs:
  - "tests/test_benchmark_archives.py"
  - "tests/test_benchmark_scenarios.py"
---
# Evidence and Metric Index

This document defines how quantitative claims may be used across README files, architecture documents, presentations, and posts.

For a complete Claude/LinkedIn writing handoff—including the simulated AGV project overview, evidence boundaries, and corrected interpretation of the five Router disagreements—use the [Claude project and benchmark brief](../interview/claude-project-and-benchmark-brief.md).

## Evidence classes

| Label | Meaning | Allowed wording |
|---|---|---|
| Measured | Produced by a preserved run with raw or summarized output | “The named run measured…” |
| Historical measured | Genuine older result with incomplete modern metadata | “The historical run reported…” |
| Simulated | Produced by browser physics or a configured scenario | “The simulation demonstrates…” |
| Configured | A default, threshold, or policy value in code | “The configured value is…” |
| Derived | Calculated from named source values | “Using these assumptions…” |
| Planned | Proposed but not executed | “The protocol plans…” |

Never describe a configured or simulated value as measured.

## Canonical benchmark runs

| Run ID | Evidence class | Scope | Canonical location |
|---|---|---|---|
| 2026-07-16-thesis-200 | Historical measured | Completed 200-scenario v2 run | ../../src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-07-16-thesis-200/ |
| 2026-08-18-diagnostic-60 | Measured diagnostic | Partial 60-scenario run | ../../src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-08-18-diagnostic-60/ |
| Current v3 protocol | Planned until executed | Fixed 100 normal, 50 critical, 50 sensor-error scenarios | benchmark_scenarios.py |

The detailed metric table and limitations live in the [benchmark results guide](../../src/cloud-orchestrator/embodied_brain/benchmark_results/README.md).

## Approved current statements

### Historical 200-scenario run

- Scenario count: 200.
- Router accuracy: 94.19% over 172 parseable router outputs.
- Early exit: 39.5%.
- Mean end-to-end latency: 6.174 seconds.
- Average latency saved: 4,613 ms under that run's original definition.

Critical recall and modern final-action safety metrics cannot be reconstructed from the preserved summary alone.

### Diagnostic 60-scenario run

- Scenario count: 60, despite the older requested-count configuration indicating 200.
- Router accuracy: 90.38% over 52 parseable router outputs.
- Recall under the legacy 5–50 cm critical label: 9/14, or 64.29%.
- Label-policy disagreements: five, at 31, 39, 41, 42, and 46 cm. All were above the 30 cm blocking threshold, and all five Compiler outputs contained a stop action.
- Policy-critical cases: all eight scenarios below 30 cm were recognized and blocked.
- Early exit: 25/60, or 41.67%.
- End-to-end latency: median 7.67 seconds, mean 16.72 seconds, maximum 73.88 seconds.
- The model identifier is unknown in the preserved output.

The archived report calls the five disagreements “false negative passes,” but that metric stops at the Router/gate interpretation and does not inspect the final Compiler action. It must not be paraphrased as five unsafe end-to-end actions.

### Dashboard timing values

Dashboard brake, network, edge, token, and cloud latency values are simulated/configured unless a named runtime result is linked. The 15 ms brake value is a simulation parameter, not a measured WebGPU inference result.

## Required reporting dimensions

Router evaluation:

- denominator and parse failures;
- overall accuracy;
- per-class recall, especially critical-obstacle recall;
- false-negative and false-positive direction.

Latency evaluation:

- sample count;
- median and mean;
- a tail statistic such as p95 or maximum;
- per-stage latency where available.

Pipeline evaluation:

- early-exit definition;
- final unsafe-action count;
- provider/model/region and run timestamp;
- interrupted or incomplete execution status.

## Change policy

- A historical artifact is immutable.
- A corrected report must identify the source run and correction method.
- A new benchmark creates a new run directory.
- README and presentation numbers must be copied from this index or the run guide.
- When evidence is missing, state “unknown” rather than infer a value.
