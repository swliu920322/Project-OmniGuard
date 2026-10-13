# AGV benchmark results

This directory is the single source of truth for the AGV agent benchmarks.
Every run lives in its own directory. Do not copy aggregate numbers between
runs, and do not write new results directly into `benchmark_results/`.

## Available runs

| Run | Purpose | Status | Files |
|---|---|---|---|
| `2026-07-16-thesis-200` | Historical thesis benchmark | Complete, legacy v2 methodology | `summary.json`, `results.csv` |
| `2026-08-18-diagnostic-60` | Later latency/error-analysis artifact | 60 rows; incomplete against its configured target of 200; not the thesis run | `results.json`, `results.csv`, `report.txt` |

## Which numbers may be quoted?

### Historical thesis run: 2026-07-16, 200 scenarios

- Router accuracy: **162/172 (94.19%)**.
- Early exits before the Compiler: **79/200 (39.5%)**.
- Full-pipeline latency, measured on 121 PASS scenarios: **5.680 s median,
  6.174 s mean, 16.391 s maximum**.
- Estimated downstream latency avoided per early exit: **4.613 s**. This is a
  counterfactual estimate based on mean downstream-stage latency, not a directly
  observed duration for skipped calls.

Use these only as historical v2 results. That scenario generator used weighted
random sampling, so the actual class counts were 111 normal, 38 critical, and
51 sensor-error scenarios—not an exact 100/50/50 split. It also labeled the
entire 5-50 cm range as critical while the runtime Safety policy blocked below
30 cm. Router error counts from this run therefore must not be presented as
end-to-end unsafe-action counts.

### Diagnostic rerun: 2026-08-18, 60 scenarios

- Router accuracy: **47/52 (90.38%)**; eight scenarios stopped at the physical
  gate and never invoked the Router.
- Early exits before the Compiler: **25/60 (41.67%)**.
- Full-pipeline latency, measured on 35 PASS scenarios: **7.667 s median,
  16.721 s mean, 73.892 s maximum**.
- The five Router disagreements labeled `CRITICAL_OBSTACLE -> NORMAL_NAV` were
  at 31, 39, 41, 42, and 46 cm. All were above the 30 cm blocking threshold,
  and the Compiler returned a stop action in all five cases. They are
  label-policy disagreements, not five demonstrated unsafe end-to-end passes.
- All eight critical scenarios below 30 cm were blocked.
- The model was not captured correctly, so this run is not suitable as the
  project's primary reproducible benchmark.

## Current protocol (v3-policy-aligned)

New runs use the shared definitions in `benchmark_scenarios.py`:

- exact stratified counts: 100 normal, 50 critical, 50 sensor error for a
  200-scenario run;
- `CRITICAL_OBSTACLE` means 5-29 cm, matching the 30 cm Safety policy;
- every sensor-error scenario violates the temperature policy;
- resolved provider/model, planned/completed counts, definition version, and
  run status are recorded;
- accuracy confidence intervals are stored as percentages;
- Router misses and unsafe final actions are reported separately;
- every run writes to `benchmark_results/runs/<run-id>/` and cannot silently
  overwrite a historical run.

The v3 protocol has not yet been run against a live model. Until it is, there is
no single "current production benchmark". The two archived runs above are
evidence for their named experiments only.

## Running the three comparisons

Use one run ID so the full pipeline and both ablations land together:

```bash
cd src/cloud-orchestrator
export BENCHMARK_RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-v3"
python3 embodied_brain/benchmark.py
python3 embodied_brain/benchmark_no_safety.py
python3 embodied_brain/benchmark_baseline.py
```

Do not update documentation from console output by hand. Review the generated
JSON/CSV files first, then update this README as the canonical summary.
