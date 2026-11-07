# Baseline A measurement report

> **DRY RUN WITH A FAKE CLIENT. Nothing here measures any model.** It only shows that the harness works.

- Run: `20261107T042524Z_dry-run_49131223`, mode `dry-run`, status **interrupted**
- Source: `worktree` at tag `eval-baseline-v1` (commit `a58b125`)
- Calls started: 5 of 400 allowed; tokens booked: 1013 of 150000; US$ booked: 0.000333 of 1.00 (rehearsal rates)
- Spend implied by the usage the API reported: US$ 0.000156; calls with no usable usage: 1
- Stop reason: interrupted: KeyboardInterrupt: scripted Ctrl+C
- Models reported by the API: ['fake-model-1']
- **Interrupted**: KeyboardInterrupt: scripted Ctrl+C
- A request was in flight at the interruption; it is recorded and its budget stays booked.

Scope: see `SCOPE.md` in this directory. Router stage only, two conditions, legacy gold labels, not the production pipeline.

| Condition | Rows | Correct | Accuracy | Failed calls | Invalid replies |
|---|---|---|---|---|---|
| B / all_rows_started | 3 | 2 | withheld (fake) | 1 | 0 |
| B / rows_reaching_router | 2 | 1 | withheld (fake) | 1 | 0 |
| P / all_rows_started | 2 | 2 | withheld (fake) | 0 | 0 |
| P / rows_reaching_router | 1 | 1 | withheld (fake) | 0 | 0 |

Legacy gold rows labelled critical but at or above 30 cm: 0 (the label policy disagrees with the 30 cm rule; these rows are scored as labelled, not relabelled).
