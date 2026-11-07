# Baseline A measurement report

> **DRY RUN WITH A FAKE CLIENT. Nothing here measures any model.** It only shows that the harness works.

- Run: `20261107T044648Z_dry-run_b385200a`, mode `dry-run`, status **stopped_bound_violation**
- Source: `worktree` at tag `eval-baseline-v1` (commit `a58b125`)
- Calls started: 3 of 400 allowed; tokens booked: 5448 of 150000; US$ booked: 0.006251 of 1.00 (rehearsal rates)
- Spend implied by the usage the API reported: US$ 0.006251; calls with no usable usage: 0
- Replies cut off by max_tokens (finish_reason length): 0; reasoning tokens reported: 180
- Stop reason: bound violated by call #2: reported usage (81 prompt + 5000 completion tokens) is above the reserved bound (285 + 1024)
- Model version stated by the owner: REHEARSAL: fake model
- Alias reported by the API (`response.model`): ['fake-model-1']

Scope: see `SCOPE.md` in this directory. Router stage only, two conditions, legacy gold labels, not the production pipeline.

| Condition | Rows | Correct | Accuracy | Failed calls | Invalid replies |
|---|---|---|---|---|---|
| B / all_rows_started | 1 | 1 | withheld (fake) | 0 | 0 |
| B / rows_reaching_router | 1 | 1 | withheld (fake) | 0 | 0 |
| P / all_rows_started | 2 | 2 | withheld (fake) | 0 | 0 |
| P / rows_reaching_router | 1 | 1 | withheld (fake) | 0 | 0 |

Legacy gold rows labelled critical but at or above 30 cm: 0 (the label policy disagrees with the 30 cm rule; these rows are scored as labelled, not relabelled).
