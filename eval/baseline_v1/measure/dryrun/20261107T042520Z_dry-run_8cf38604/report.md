# Baseline A measurement report

> **DRY RUN WITH A FAKE CLIENT. Nothing here measures any model.** It only shows that the harness works.

- Run: `20261107T042520Z_dry-run_8cf38604`, mode `dry-run`, status **completed**
- Source: `worktree` at tag `eval-baseline-v1` (commit `a58b125`)
- Calls started: 400 of 400 allowed; tokens booked: 49498 of 150000; US$ booked: 0.015975 of 1.00 (rehearsal rates)
- Spend implied by the usage the API reported: US$ 0.015580; calls with no usable usage: 3
- Stop reason: completed all planned calls
- Models reported by the API: ['fake-model-1', 'fake-model-1-b']  **(more than one: the model changed during the run)**

Scope: see `SCOPE.md` in this directory. Router stage only, two conditions, legacy gold labels, not the production pipeline.

| Condition | Rows | Correct | Accuracy | Failed calls | Invalid replies |
|---|---|---|---|---|---|
| B / all_rows_started | 200 | 197 | withheld (fake) | 0 | 2 |
| B / rows_reaching_router | 172 | 169 | withheld (fake) | 0 | 2 |
| P / all_rows_started | 200 | 197 | withheld (fake) | 2 | 0 |
| P / rows_reaching_router | 172 | 171 | withheld (fake) | 0 | 0 |

Legacy gold rows labelled critical but at or above 30 cm: 11 (the label policy disagrees with the 30 cm rule; these rows are scored as labelled, not relabelled).
