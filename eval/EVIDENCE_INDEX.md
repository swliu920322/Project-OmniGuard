# Evidence index (framework, status of 2026-11-07)

A map from each claim to the file that proves it. **Empty cells are empty on purpose: nothing unfinished is written as a conclusion.** The path a reader should be able to follow is: README claim -> evaluation report -> data version and code commit -> per-record raw results. Independent data is frozen and formal evaluation is complete: see [report.md](report.md), `acceptance/FROZEN_MANIFEST.json` and `formal/results/VERIFICATION.json`. Stranger reproduction and oral acceptance remain pending.

Time box: D0 = 2026-11-07 11:58:03 +0800, deadline 2026-11-14 11:58:03 +0800. Each gate below is "passed", "not passed" or "waived with a reason" at the deadline; waived is not passed.

## The resume line, field by field

| Field | Value now | What fixes it |
|---|---|---|
| 覆盖【N】类意图 | 6 state-routing classes, spec 1.0 | data frozen in `acceptance/FROZEN_MANIFEST.json`; this is not a claim that model quality has passed |
| 【M】条评测集 | 300 frozen independent test records, 50 per class | 34 conservative families, not 300 independent scenarios; 55 independent stress cases are separate from M. Dev records, dev stress and public examples are also separate |
| 识别准确率从【X%】 | baseline B: 300/300 (100%) in each of two runs | measured on the frozen synthetic test set; use as a final accuracy, not as the start of an invented improvement |
| 提升至【Y%】 | not measured, and no optimised version exists | none was made: the dev run had no classification error to learn from (97.2 %, five provider errors, every returned reply correct) and the frozen set is at 300/300. Write a final accuracy, never "from X to Y" |

## Gate 1: the evaluation can be trusted

| Item | Status | Evidence |
|---|---|---|
| Original implementation archived and tagged | done | tag `eval-baseline-v1` -> `a58b125`; archive `d5ffbcb`; `eval/baseline_v1/` |
| Baseline A measured (descriptive only, not a start of "improvement") | done | harness `f5e0763`; runs `78906f0` (400 calls); canary `9cdad69`; first canary that stopped on a bound violation `588231e` |
| Label specification 1.0, input contract, data plan, annotation protocol | done | `2ac27c6`, `eval/spec/` (manifest `SHA256SUMS`) |
| Dev set, 180 records, regenerable | done | `35914f2`, `eval/dev/` |
| **Independent frozen test set** with a hash commitment | done | `acceptance/FROZEN_MANIFEST.json`; inputs and labels held outside the repository; both formal main runs completed |
| Blind annotation (sealed) and full review of the note statuses | done | Dev: 33/96 blind, 96 reviewed, `annotation/agreement_report.json`. Final test: 24/72 blind before full review, all 72 reviewed; 20 stress notes independently annotated and reviewed. AI annotation, not expert truth. See frozen manifest |
| Accuracy, per-class P/R/F1, macro-F1, confusion matrix, 95 % intervals on the test set | done | [report.md](report.md); both main runs in `formal/results/`; each 300/300, macro-F1 1.0, no provider errors |

## Gate 2: stress and limits

| Item | Status | Evidence |
|---|---|---|
| Dev-side stress cases, 66 (11 types x 6) | done, offline | `01d4ce4`, `eval/dev/stress/` |
| Behaviour of the decision path against a lax or wrong model, fake dependencies | done | `tests/test_stress_dev.py`, `tests/test_extended_endpoint.py`; backend `6aa7824` |
| R1/R2 rule controls on dev material | done, offline | `2243bee`, `eval/dev/rule_control/` |
| Stress cases with a **real model** | done, decision-function scope | 32 valid content cases sent to the model; 13 input rejections and 10 injected faults checked offline; no missed halt, needless halt or model error in this set |
| Test-side stress cases (written by the acceptance session) | done | 55 cases, 11 types x 5; frozen manifest and `formal/results/`; no real robot or live HTTP end-to-end claim |

## Gate 3: reproducibility

| Item | Status | Evidence |
|---|---|---|
| One-command evaluation, caps and sealed run directories | done for the dev set | `eval/baseline_b/README.md` |
| Two independent runs on the frozen test set: agreement >= 98 %, accuracy difference <= 2 points | passed | primary and note agreement both 100%, accuracy difference 0 points; comparison JSON in `formal/results/` |
| A stranger reproduces it from the README with real credentials in 10 minutes | **not done** (materials prepared) | [REPRODUCE.md](REPRODUCE.md); the formal numbers also need the private files, so a clone alone cannot reproduce them |

## Gate 4: it can be explained

| Item | Status | Evidence |
|---|---|---|
| Real errors with counts and raw examples | no model errors observed in this formal set | no five model-error categories can be invented; actual rule-control error directions are in `report.md`, examples stay private. Dev provider failures remain preserved separately |
| Limitations | written | [LIMITATIONS.md](LIMITATIONS.md) (19 items) |
| Four-line cards | written | [ORAL_CARDS_zh.md](ORAL_CARDS_zh.md) (12 cards) |
| Oral check, three random questions | **not done** | to be done by the owner; no session can stand in |

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

Formal programme (separate authorization, US$0.57): health canary 2 calls, two main runs of 300, stress 32 API calls plus 23 offline checks. Total 634 API calls and 630,792 reported tokens; computed at the configured conservative rates US$0.284948, not a bill. Every actual API call reported usage. `formal/results/VERIFICATION.json` lists each run, hashes and budgets. The stress runner's raw `calls_without_usable_usage=23` includes the offline checks, not unknown-usage API requests; the raw artifact is retained and the distinction is documented.

## Formal evaluation entry and results

`eval/formal/` (`FORMAL_PLAN.md`, `ACCEPTANCE_FORMAT.md`, `run_formal.py`, `CODE_FREEZE.json`), tag `eval-formal-v1` at `fec6acf`. Results, hashes and the independent recount: `eval/formal/results/` and `report.md`. Rule controls R1/R2 are scored on the same records.

## Closing the gates at the deadline (2026-11-14 11:58:03 +0800)

Each item is written as passed / not passed / waived with a reason at the deadline; a waiver is not a pass. Items the tuning side cannot close are listed with who closes them.

| Gate | State on 2026-11-07 | Who closes the rest |
|---|---|---|
| 1. The evaluation can be trusted | evidence complete: spec, frozen data, annotation, report | nobody; ready to be marked passed |
| 2. Stress and limits | evidence complete for the decision function; no HTTP-endpoint run against a real model | nobody; ready to be marked passed with that scope |
| 3. Reproducibility | two-run gate passed; the stranger's 10-minute reproduction is **not done** | the owner finds the stranger; needs the private files or an owner decision on publication |
| 4. It can be explained | limitations and cards written; the random three-question oral check is **not done** | the owner, in person |

If an item is still open at the deadline it is marked "not passed" or "waived" with the reason; it is not carried over silently.

## Code and tests

Backend extended router and its endpoint flow: `01d4ce4`, `c6f85a2`, `6aa7824` (`src/cloud-orchestrator/router_v2/`, `embodied_brain/extended.py`; endpoint tests with fake dependencies). Formal stress now exercises the backend decision function against a real model, but not the HTTP Router/Safety/Compiler flow end to end. Formal evaluator tag: `eval-formal-v1` at `fec6acf`. Its 50 focused tests passed in reviewer execution; the full suite was not rerun during the paid programme.
