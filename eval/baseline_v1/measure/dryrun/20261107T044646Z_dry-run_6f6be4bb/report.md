# Baseline A measurement report

> **DRY RUN WITH A FAKE CLIENT. Nothing here measures any model.** It only shows that the harness works.

- Run: `20261107T044646Z_dry-run_6f6be4bb`, mode `dry-run`, status **stopped_early**
- Source: `worktree` at tag `eval-baseline-v1` (commit `a58b125`)
- Calls started: 0 of 400 allowed; tokens booked: 0 of 150000; US$ booked: 0.000000 of 0.000001 (rehearsal rates)
- Spend implied by the usage the API reported: US$ 0.000000; calls with no usable usage: 0
- Replies cut off by max_tokens (finish_reason length): 0; reasoning tokens reported: 0
- Stop reason: stopped before sending call #0: usd cap 0.000001 would be exceeded (0.000000 committed + 0.001381 worst case for the next call)
- Model version stated by the owner: REHEARSAL: fake model
- Alias reported by the API (`response.model`): none

Scope: see `SCOPE.md` in this directory. Router stage only, two conditions, legacy gold labels, not the production pipeline.

| Condition | Rows | Correct | Accuracy | Failed calls | Invalid replies |
|---|---|---|---|---|---|
| B / all_rows_started | 0 | 0 | withheld (fake) | 0 | 0 |
| B / rows_reaching_router | 0 | 0 | withheld (fake) | 0 | 0 |
| P / all_rows_started | 0 | 0 | withheld (fake) | 0 | 0 |
| P / rows_reaching_router | 0 | 0 | withheld (fake) | 0 | 0 |

Legacy gold rows labelled critical but at or above 30 cm: 0 (the label policy disagrees with the 30 cm rule; these rows are scored as labelled, not relabelled).
