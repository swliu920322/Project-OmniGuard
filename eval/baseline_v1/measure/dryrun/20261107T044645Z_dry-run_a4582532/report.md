# Baseline A measurement report

> **DRY RUN WITH A FAKE CLIENT. Nothing here measures any model.** It only shows that the harness works.

- Run: `20261107T044645Z_dry-run_a4582532`, mode `dry-run`, status **completed**
- Source: `worktree` at tag `eval-baseline-v1` (commit `a58b125`)
- Calls started: 400 of 400 allowed; tokens booked: 78513 of 150000; US$ booked: 0.050793 of 1.00 (rehearsal rates)
- Spend implied by the usage the API reported: US$ 0.046784; calls with no usable usage: 3
- Replies cut off by max_tokens (finish_reason length): 2; reasoning tokens reported: 24784
- Stop reason: completed all planned calls
- Model version stated by the owner: REHEARSAL: fake model
- Alias reported by the API (`response.model`): ['fake-model-1', 'fake-model-1-b']  **(more than one: the model changed during the run)**

Scope: see `SCOPE.md` in this directory. Router stage only, two conditions, legacy gold labels, not the production pipeline.

| Condition | Rows | Correct | Accuracy | Failed calls | Invalid replies |
|---|---|---|---|---|---|
| B / all_rows_started | 200 | 197 | withheld (fake) | 0 | 2 |
| B / rows_reaching_router | 172 | 169 | withheld (fake) | 0 | 2 |
| P / all_rows_started | 200 | 195 | withheld (fake) | 2 | 2 |
| P / rows_reaching_router | 172 | 169 | withheld (fake) | 0 | 2 |

Legacy gold rows labelled critical but at or above 30 cm: 11 (the label policy disagrees with the 30 cm rule; these rows are scored as labelled, not relabelled).
