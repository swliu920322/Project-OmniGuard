# Formal evaluation plan (acceptance-v1): entry, order of work, budget

Status: **prepared offline; nothing has been run against the frozen data and no model was called for this plan.** X and Y are unmeasured. The tuning session has not read any private file and must not.

## 1. What is tested

Baseline **B-1.0**, exactly as in the dev run (prompt hash `9247896719b66e13…`), on the frozen independent test set (300 records) and the independent stress set (55 cases), together with the rule controls **R1 and R2** on the same records (no model call, same scorer). There is **no "optimised version"**: the dev run gave no error to learn from (every reply that came back was correct; the five misses were provider errors), so inventing one would be tuning against nothing. Consequence for the resume line: **Y stays blank**; the honest form is "accuracy X on an independent test set", plus the engineering around it. Reconsider only if the formal run shows a reproducible, understood weakness, and then it is a new round with a new, untouched test set (this one becomes an exposed set).

## 2. Entry and guarantees (`eval/formal/run_formal.py`, built on the accepted evaluator; `run_dev_eval.py` is untouched, pinned by a test)

- **External data by path and expected SHA-256**, or by `--acceptance-dir` with the hashes of `FROZEN_MANIFEST.json`. The hash is checked before anything is parsed for scoring; the frozen file's class and note-status counts must also match the manifest. The public dev set runs the same way and is then flagged "not the frozen file" and never counts as the measurement. Format: `ACCEPTANCE_FORMAT.md`.
- **Frozen version.** `CODE_FREEZE.json` holds the hashes of every file that decides a result (prompt, scorer, runner, specification, rule controls, backend decision code). The freeze is also bound to the data commitment: it records the hash of `FROZEN_MANIFEST.json` and of the B-1.0 prompt and a real run refuses if either changed. A real run refuses if any file differs, if the tree is dirty, or if `--frozen-tag` does not point at the current commit. Recorded in every run: commit, tag, spec version, prompt version and hash, model parameters (temperature 0 sent, 2,048 output cap, SDK retries off, 60 s timeout; the provider ignores temperature in its default reasoning mode), the scoring policy, the owner's stated model identity (unverified), the budget.
- **Gold is recomputed** from telemetry and annotated note status by the frozen specification; the file's gold is never trusted.
- **Scoring policy, fixed in advance:** one request per record, no retry, no local result cache (the client is called directly), an error, an unusable or truncated reply and an interrupted request stay in the denominator and count as wrong. A success-only accuracy may be shown **next to** the main figure and never instead of it.
- **Two independent runs** (`run --suite main --twice`): two private run directories, fresh client and budget guard each. **Each run is reported on its own; the better one is never picked.** Before the gate is applied the two directories must verify against their seals, both be completed main-suite runs (not canaries) covering every record exactly once, and agree on mode, data, prompt, spec version, code hashes, model configuration and declared identity, request parameters (temperature, output cap, retries, timeout), scoring policy and the single returned alias with no drift flag; otherwise they are **not comparable** and nothing is compared. Then the gate: prediction agreement >= 98 % and accuracy difference <= 2 points, errors and invalid outputs compared like any other outcome. Not met means **NOT PASSED** (exit code 4), said as it is. If the first run does not complete, the second is not started.
- **Stress suite** (`run --suite stress`; the id may be `id` or `case_id`, and if both are present they must be equal; a request interrupted in flight is written down with its request body and reservation, counted as an interrupted failure and sealed like every other record): input-contract rejections and injected timeouts / rate limits are checked offline and send **no** API request; the valid cases go through the backend decision path (`router_v2.decide`) with one request each. Reported apart, never mixed into the accuracy: input rejections, injected-fault halts, missed halts, needless halts, model errors (unusable replies, wrong labels), interface errors (real API errors).
- **Record-level results stay private** (`--private-out` must be outside the repository): the public side gets aggregates only (no ids, no inputs, no replies, no per-record error lists) plus the hashes of the private files. This is what lets the repository show the numbers without handing the tuning session sample-level feedback.

## 3. Order of work

| Step | Who | What |
|---|---|---|
| 0 | tuning session | commit the code and `CODE_FREEZE.json`; the reviewer accepts it |
| 1 | owner | create the freeze tag at that commit (`git tag -a eval-formal-v1 -m ...`); nothing in the code does it |
| 2 | custodian | `check-format --acceptance-dir D` (counts and hash match, no record printed), then `plan --acceptance-dir D` for the exact numbers |
| 3 | owner | authorises the caps of section 5 in writing (calls, tokens, US$) |
| 4 | custodian | a **health canary on the public dev file** (`run --suite main --limit 2 --data eval/dev/dev_set.jsonl --expect-sha256 <its hash>`): 2 calls, touches no private data, shows the provider is answering and the pipeline works. The frozen data is not used for a canary |
| 5 | custodian | `run --suite main --twice` (R1/R2 are scored inside it), then `run --suite stress` |
| 6 | custodian | publish the aggregates of `--public-out`; the reviewer recomputes from the private files |
| 7 | tuning session | writes limitations and the four-line cards from the published aggregates; changes nothing in this round |

If a run ends in `stopped_early`, `stopped_bound_violation`, `crashed` or `interrupted`, stop and report; do not change a parameter and continue. A repeated or modified run is a new run with a new authorisation and review, and the earlier directory is kept.

## 4. Pass criteria written before the run

| Item | Criterion |
|---|---|
| Run validity | status `completed`; every record has a call; one alias in the replies; the private directory verifies; the hashes in the public summary match the files |
| Reproducibility | agreement >= 98 % and accuracy difference <= 2 points between the two main runs |
| Effect (proposed, to be confirmed by the owner before step 3) | accuracy >= 90 %, macro-F1 >= 0.90, recall of every class >= 0.85, recall of `CRITICAL_OBSTACLE` >= 0.95. These are targets fixed in advance, not a prediction. A miss is reported as a miss |
| Stress | no unhandled crash; every input-contract case and injected fault halts with its reason; `missed_halt` reported per type |

## 5. Budget (from `run_formal.py plan`, offline)

One total, with nothing outside it. The two-call health canary on the **public dev file** is part of it.

| | Requests | Note |
|---|---:|---|
| Health canary (public dev file) | 2 | no private data |
| Main run x 2 | 600 | 300 records each |
| Stress, valid content cases | at most 35 | types 3 to 9; the exact number comes from the file; at least 20 cases send nothing |
| R1 / R2 | 0 | |
| **Total at most** | **637** | |

Cost: the theoretical upper bound (every request with the largest input the contract allows, a 500-character note at 4 UTF-8 bytes per character, which is 5,146 tokens, and all 2,048 output tokens) is about **US$2.83 and 4.58 M tokens**. That is the ceiling of the bound, not a forecast. The dev run measured US$0.000451 per answered call (US$0.000543 counting the full reservation of failed calls) and about 1,107 tokens per call booked, which projects to **about US$0.29 to 0.35 and 0.7 M tokens** for the whole programme: an estimate from one run, not a guarantee. What can actually be spent is limited by the caps, because the guard books the worst case before each call and stops before sending when a cap would be passed:

| Run | `--max-calls` | `--max-tokens` | `--usd-cap` |
|---|---:|---:|---:|
| health canary (public dev file, `--limit 2`) | 2 | 20,000 | 0.02 |
| main run, first | 300 | 600,000 | 0.25 |
| main run, second | 300 | 600,000 | 0.25 |
| stress | 40 | 100,000 | 0.05 |
| **combined ceiling** | **642** | **1,320,000** | **0.57** |

A mass of provider errors keeps a full reservation per failed call and can make a run stop early (`stopped_early`); that is reported, not repaired. Costs are estimates at the configured conservative rates, not bills. Spending already booked on the baseline-A and baseline-B work is listed in `eval/EVIDENCE_INDEX.md` and is not part of this total.

## 6. What this does not do

It does not make the data independent beyond what the manifest says (34 families, not 300 independent scenarios; AI labels, not expert truth), does not validate the HTTP endpoint against a real model (the stress suite exercises the decision function, not the endpoint), and does not measure anything until a real run exists.
