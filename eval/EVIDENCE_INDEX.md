# Evidence index (framework, status of 2026-11-07)

A map from each claim to the file that proves it. **Empty cells are empty on purpose: nothing unfinished is written as a conclusion.** The path a reader should be able to follow is: README claim -> evaluation report -> data version and code commit -> per-record raw results. The independent test data is now frozen; formal model evaluation and its raw results are still pending. See `acceptance/FROZEN_MANIFEST.json`.

Time box: D0 = 2026-11-07 11:58:03 +0800, deadline 2026-11-14 11:58:03 +0800. Each gate below is "passed", "not passed" or "waived with a reason" at the deadline; waived is not passed.

## The resume line, field by field

| Field | Value now | What fixes it |
|---|---|---|
| 覆盖【N】类意图 | 6 state-routing classes, spec 1.0 | data frozen in `acceptance/FROZEN_MANIFEST.json`; this is not a claim that model quality has passed |
| 【M】条评测集 | 300 frozen independent test records, 50 per class | 34 conservative families, not 300 independent scenarios; 55 independent stress cases are separate from M. Dev records, dev stress and public examples are also separate |
| 识别准确率从【X%】 | not measured | baseline B on the frozen test set |
| 提升至【Y%】 | not measured | the optimised version on the same frozen test set; written only if the improvement is reliable. The dev set is already at 97.2 % for B (5 provider errors, every returned reply correct), so there may be little to improve on this kind of data |

## Gate 1: the evaluation can be trusted

| Item | Status | Evidence |
|---|---|---|
| Original implementation archived and tagged | done | tag `eval-baseline-v1` -> `a58b125`; archive `d5ffbcb`; `eval/baseline_v1/` |
| Baseline A measured (descriptive only, not a start of "improvement") | done | harness `f5e0763`; runs `78906f0` (400 calls); canary `9cdad69`; first canary that stopped on a bound violation `588231e` |
| Label specification 1.0, input contract, data plan, annotation protocol | done | `2ac27c6`, `eval/spec/` (manifest `SHA256SUMS`) |
| Dev set, 180 records, regenerable | done | `35914f2`, `eval/dev/` |
| **Independent frozen test set** with a hash commitment | done, data only | `acceptance/FROZEN_MANIFEST.json`; inputs and labels held outside the repository; no formal model run yet |
| Blind annotation (sealed) and full review of the note statuses | done | Dev: 33/96 blind, 96 reviewed, `annotation/agreement_report.json`. Final test: 24/72 blind before full review, all 72 reviewed; 20 stress notes independently annotated and reviewed. AI annotation, not expert truth. See frozen manifest |
| Accuracy, per-class P/R/F1, macro-F1, confusion matrix, 95 % intervals on the test set | **not done** | evaluator ready (`eval/baseline_b/evaluate.py`); needs the test set and an authorised run |

## Gate 2: stress and limits

| Item | Status | Evidence |
|---|---|---|
| Dev-side stress cases, 66 (11 types x 6) | done, offline | `01d4ce4`, `eval/dev/stress/` |
| Behaviour of the decision path against a lax or wrong model, fake dependencies | done | `tests/test_stress_dev.py`, `tests/test_extended_endpoint.py`; backend `6aa7824` |
| R1/R2 rule controls on dev material | done, offline | `2243bee`, `eval/dev/rule_control/` |
| Stress cases with a **real model** | **not done** | needs an authorised run |
| Test-side stress cases (written by the acceptance session) | done, data only | 55 cases, 11 types x 5; frozen manifest; real-model stress validation still pending |

## Gate 3: reproducibility

| Item | Status | Evidence |
|---|---|---|
| One-command evaluation, caps and sealed run directories | done for the dev set | `eval/baseline_b/README.md` |
| Two independent runs on the frozen test set: agreement >= 98 %, accuracy difference <= 2 points | **not done** | needs the test set |
| A stranger reproduces it from the README with real credentials in 10 minutes | **not done** | |

## Gate 4: it can be explained

| Item | Status | Evidence |
|---|---|---|
| Real errors with counts and raw examples | **not done** for the test set | on the dev set baseline B made no classification error; the 5 misses are provider errors (four HTTP 500, one 503) kept as failures |
| Limitations | draft | `eval/LIMITATIONS.md` |
| Four-line cards, oral check | **not done** | |

## Real model runs and their cost

Costs are computed at the conservative configured rates (Flash peak rate, applied to every prompt token). **They are not bills**; a call whose usage was not reported keeps its full reservation, shown in the "booked" column.

| Run | Directory | Calls | From reported usage (US$) | Booked (US$) | Counts as |
|---|---|---:|---:|---:|---|
| A canary 1 | `baseline_v1/measured/20261107T043259Z_real_401c9ff8` | 1 | 0.000140 | 0.000140 | stopped on a bound violation, not a measurement |
| A canary 2 | `.../20261107T045607Z_real_bb1f4b4e` | 2 | 0.000217 | 0.000217 | canary |
| A full run | `.../20261107T045641Z_real_db062c4f` | 400 | 0.097173 | 0.097173 | descriptive baseline-A measurement |
| B canary 1 | `baseline_b/runs/20261107T071745Z_real_ef50e6ae` | 2 | unknown | 0.007577 | failed: HTTP 500 |
| B canary 2 | `.../20261107T072708Z_real_55c6fa87` | 2 | unknown | 0.007577 | failed: HTTP 500 |
| B diagnosis | `baseline_b/diagnostics/20261107T074921Z_real_440e6441` | 6 | 0.001340 | 0.001340 | diagnostic record, not a baseline result |
| B canary 3 | `baseline_b/runs/20261107T075330Z_real_5f677a7e` | 2 | 0.001035 | 0.001035 | passed all seven criteria |
| B dev run | `baseline_b/runs/20261107T075357Z_real_c5e026a8` | 180 | 0.078923 | 0.097803 | baseline B on the dev set (development use only) |

Baseline B calls: 192 (the 2 + 2 failed canary calls, 6 diagnostic calls, 2 canary calls, 180 dev-run calls). Baseline A calls: 403.

## Code and tests

Backend extended router and its endpoint flow: `01d4ce4`, `c6f85a2`, `6aa7824` (`src/cloud-orchestrator/router_v2/`, `embodied_brain/extended.py`; tests with fake dependencies). Nothing in the backend path has been run against a real model with the new prompt except the baseline-B dev run, which used the evaluation runner, not the HTTP endpoint. The whole suite: `python -m pytest tests` (335 tests at the time of writing).
