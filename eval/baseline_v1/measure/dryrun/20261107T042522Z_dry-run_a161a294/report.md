# Baseline A measurement report

> **DRY RUN WITH A FAKE CLIENT. Nothing here measures any model.** It only shows that the harness works.

- Run: `20261107T042522Z_dry-run_a161a294`, mode `dry-run`, status **stopped_bound_violation**
- Source: `worktree` at tag `eval-baseline-v1` (commit `a58b125`)
- Calls started: 3 of 400 allowed; tokens booked: 10000246 of 150000; US$ booked: 3.000082 of 1.00 (rehearsal rates)
- Spend implied by the usage the API reported: US$ 3.000082; calls with no usable usage: 0
- Stop reason: bound violated by call #2: reported usage (10000000 prompt + 3 completion tokens) is above the reserved bound (285 + 20)
- Models reported by the API: ['fake-model-1']

Scope: see `SCOPE.md` in this directory. Router stage only, two conditions, legacy gold labels, not the production pipeline.

| Condition | Rows | Correct | Accuracy | Failed calls | Invalid replies |
|---|---|---|---|---|---|
| B / all_rows_started | 1 | 1 | withheld (fake) | 0 | 0 |
| B / rows_reaching_router | 1 | 1 | withheld (fake) | 0 | 0 |
| P / all_rows_started | 2 | 2 | withheld (fake) | 0 | 0 |
| P / rows_reaching_router | 1 | 1 | withheld (fake) | 0 | 0 |

Legacy gold rows labelled critical but at or above 30 cm: 0 (the label policy disagrees with the 30 cm rule; these rows are scored as labelled, not relabelled).
