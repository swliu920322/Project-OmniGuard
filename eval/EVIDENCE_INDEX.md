# Evidence index (kept up to date; last review 2026-11-21)

A map from each claim to the file that proves it. **Empty cells are empty on purpose: nothing unfinished is written as a conclusion.** The path a reader should be able to follow is: README claim -> evaluation report -> data version and code commit -> per-record raw results. Independent data is frozen and formal evaluation is complete: see [report.md](report.md), `acceptance/FROZEN_MANIFEST.json` and `formal/results/VERIFICATION.json`. Stranger reproduction and oral acceptance remain pending.

Round 2 (note understanding, 180 new synthetic notes) has its own section below: [Round 2: claim to evidence](#round-2-claim-to-evidence). Round 2 is a different question on different data, not a before-and-after of round 1.

Time box of round 1: D0 = 2026-11-07 11:58:03 +0800, deadline 2026-11-14 11:58:03 +0800. The deadline has passed. Each gate was to be written as "passed", "not passed" or "waived with a reason"; waived is not passed. **Nothing in the repository records that marking, and this file does not make it: that is the owner's decision.** What this file records is the state of the evidence for each gate, today, in [Where the gates stand](#where-the-gates-stand-2026-11-21).

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
| A stranger reproduces it from the README with real credentials in 10 minutes | **not done** (materials prepared; two AI-agent rehearsals of level 1 done) | [REPRODUCE.md](REPRODUCE.md); rehearsal: an AI agent with no history completed level 1 in 2 min 32 s on commit `3db72fa` and reported five documentation issues, all fixed ([round 1](reproduction_logs/2026-11-07-gemini-level1.md)); round 2 on commit `4604b67` ran the corrected guide cleanly in 1 min 48 s ([round 2](reproduction_logs/2026-11-07-gemini-level1-round2.md), a thinner report). Both are self-reported, level 1 only, not a human, and nothing of the formal numbers was reproduced). The formal numbers also need the private files, so a clone alone cannot reproduce them |

## Gate 4: it can be explained

Start with the owner's confirmed motivation and the timing/evaluation distinction: [interview narrative](../study/interview/INTERVIEW_STORY_zh.md). This is a learning and speaking guide, not a new experiment or proof that the owner independently wrote every component. Oral acceptance remains pending.

| Item | Status | Evidence |
|---|---|---|
| Real errors with counts and raw examples | no model errors observed in this formal set | no five model-error categories can be invented; actual rule-control error directions are in `report.md`, examples stay private. Dev provider failures remain preserved separately |
| Limitations | written | [LIMITATIONS.md](LIMITATIONS.md) (26 items; a one-sentence summary of the eight that matter most comes first) |
| Oral preparation materials | written; consolidated | [interview handbook](../study/interview/INTERVIEW_DEEP_DRILL_zh.md) (core eight questions, 15 reference questions; replaces the former cards and companion); [learning route](../study/interview/RECOMMEND_LEARNING_zh.md); latency and cost evidence [LATENCY_COST.md](LATENCY_COST.md), timing code and simulated-vs-measured values [LATENCY_EVIDENCE.md](LATENCY_EVIDENCE.md) (round 1: the public files hold no per-request latency and the private run package cannot be found, LIMITATIONS item 22; round 2: measured and public, see [RESULTS.md](experiments/note_vs_rules_v2/RESULTS.md)) |
| Oral check, three random questions | **not done** | to be done by the owner; no session can stand in |

## Round 2: claim to evidence

All paths are under `experiments/note_vs_rules_v2/`. The numbers live in two places only: [RESULTS.md](experiments/note_vs_rules_v2/RESULTS.md) (prose) and `results/20261115T152854Z_main_real_e5fd14c2/note_compare.json` (machine-readable); `tests/test_round2_numbers.py` checks that the other documents agree with the second.

| Claim | Value | Where it is proven |
|---|---|---|
| Fixed-prompt model, note-status accuracy | 173/180 (96.11 %) | [RESULTS.md](experiments/note_vs_rules_v2/RESULTS.md); recompute for free from the sealed replies: [evidence/README.md](experiments/note_vs_rules_v2/evidence/README.md) |
| Rule set R3 (the main comparison), same records | 77/180 (42.78 %) | same files |
| Difference and its uncertainty | 53.33 points, family-bootstrap 95 % interval [43.33, 63.33]; paired 75 both right, 98 model only, 2 R3 only, 5 both wrong | `note_compare.json`; the family interval says nothing about how representative synthetic data is |
| What the data is | 180 records, 60 families of three language variants, six note statuses of 30 each; inputs frozen before the run | `evidence/data/test_set.jsonl`, hash in `V2_FREEZE.json` and [RESULTS.md](experiments/note_vs_rules_v2/RESULTS.md) |
| How the run was controlled | 2 health requests and 180 main requests, no retries, about US$0.11 at the conservative rates (an estimate, not a bill) | [RUN_RECEIPTS.md](RUN_RECEIPTS.md), `evidence/runs/` |
| Who wrote and who labelled | author a Gemini session; blind labelling and review GPT-family sessions; AI labels, not expert truth | [ANNOTATOR_PROVENANCE.md](ANNOTATOR_PROVENANCE.md) |
| Where each system is wrong | by status, language, note-only stop risk and family | [SLICE_REPORT.md](experiments/note_vs_rules_v2/slices/SLICE_REPORT.md) |
| The scoring chain itself works | perfect, inverted, constant and shuffled answers behave as they must | [CONTROL_CHECK.md](experiments/note_vs_rules_v2/controls/CONTROL_CHECK.md) |
| The copy on GitHub is the copy that ran | fresh clone, 41 archive and 28 evidence hashes verified | `results/20261115T152854Z_main_real_e5fd14c2/REMOTE_BACKUP_VERIFICATION.json` |
| What is not claimed | not an improvement over round 1, not expert labels, not production accuracy, not that R3 is the best rules can do | [RESULTS.md](experiments/note_vs_rules_v2/RESULTS.md), [LIMITATIONS.md](LIMITATIONS.md) |

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

## Where the gates stand (2026-11-21)

The state of the evidence for each gate of round 1. It is not a marking of passed, not passed or waived (see the note at the top). Items the tuning side cannot close are listed with who closes them.

| Gate | State of the evidence on 2026-11-21 | Who closes the rest |
|---|---|---|
| 1. The evaluation can be trusted | evidence complete: spec, frozen data, annotation, report; who annotated is now recorded ([ANNOTATOR_PROVENANCE.md](ANNOTATOR_PROVENANCE.md)); round 1 labels all come from one model family | nobody; the owner marks it |
| 2. Stress and limits | evidence complete for the decision function; Safety and Compiler have one real availability run of 84 records (not a safety evaluation, [LIMITATIONS](LIMITATIONS.md) item 26); no live HTTP request was made against a real model | nobody; the owner marks it with that scope |
| 3. Reproducibility | two-run gate passed; the stranger's 10-minute reproduction is **not done**; a level-3 rerun of round 1 cannot be done because the private files cannot be found ([LIMITATIONS](LIMITATIONS.md) item 22); round 2 can be recomputed for free | the owner finds the stranger (level 1 needs no private data) |
| 4. It can be explained | limitations written (26 items); the interview handbook and a three-minute walk-through exist; the random three-question oral check is **not done** | the owner, in person |

A gate that is still open stays open in this table; it is not carried over silently.

## Audit and control material (added 2026-11-21)

None of this changes a published number or calls a model; each file says how to regenerate it.

| What | Where | What it shows |
|---|---|---|
| Who annotated, and from which model family | [ANNOTATOR_PROVENANCE.md](ANNOTATOR_PROVENANCE.md), [LIMITATIONS.md](LIMITATIONS.md) item 23 | Round 1: author, blind annotator, reviewer, adjudicator and custodian are all GPT-family sessions; round 2: author is a Gemini session, labelling is GPT-family |
| Session metadata behind that table | [provenance/SESSION_META.md](provenance/SESSION_META.md), [provenance/README.md](provenance/README.md) | Model strings, effort settings, time ranges and which session issued which commit; raw exports are kept outside the repository |
| Round-2 results cut by status, language, family | [slices/SLICE_REPORT.md](experiments/note_vs_rules_v2/slices/SLICE_REPORT.md) | Where the model and R3 are wrong; not a new result |
| Scoring-chain controls | [controls/CONTROL_CHECK.md](experiments/note_vs_rules_v2/controls/CONTROL_CHECK.md) | Perfect, inverted, constant and shuffled answers through the project's own scorer; chance level 16.7% |
| One page per real run | [RUN_RECEIPTS.md](RUN_RECEIPTS.md) | What each run recorded; missing items are shown as not recorded |
| Safety and Compiler: one real availability run (2026-11-21) | [safety_compiler/README.md](safety_compiler/README.md), [LIMITATIONS.md](LIMITATIONS.md) item 26 | 84 records, 168 requests through the real extended flow with the Router replayed from sealed replies; all usable, none blocked, no empty reply; latency and use; not a safety evaluation |
| Code-layer action contract | [ACTION_CONTRACT_COVERAGE.md](ACTION_CONTRACT_COVERAGE.md) | Which bad Compiler outputs `validate_actions` stops, one example each; offline, no model |
| Designs (the bounded-retry one was implemented the same day, see LIMITATIONS item 24) | [DESIGN_CANARY_UNKNOWN.md](archive/designs/DESIGN_CANARY_UNKNOWN.md), [DESIGN_SAFETY_COMPILER_EVAL.md](archive/designs/DESIGN_SAFETY_COMPILER_EVAL.md), [DESIGN_BOUNDED_RETRY.md](archive/designs/DESIGN_BOUNDED_RETRY.md) | Control cases and a "don't know" place; evaluating Safety and Compiler; bounded retries for their calls |

## Code and tests

Backend extended router and its endpoint flow: `01d4ce4`, `c6f85a2`, `6aa7824` (`src/cloud-orchestrator/router_v2/`, `embodied_brain/extended.py`; endpoint tests with fake dependencies). Formal stress exercises the backend decision function against a real model; the Safety and Compiler stages ran once against a real model (item 26), with the Router replayed. Formal evaluator tag: `eval-formal-v1` at `fec6acf`; the code of the Safety/Compiler run is tag `eval-safety-compiler-v1`. The whole offline test suite runs with one command (see `CLAUDE.md`).
