# Baseline A measurement report

- Run: `20261107T043259Z_real_401c9ff8`, mode `real`, status **stopped_bound_violation**
- Source: `worktree` at tag `eval-baseline-v1` (commit `a58b125`)
- Calls started: 1 of 400 allowed; tokens booked: 218 of 150000; US$ booked: 0.000140 of 0.50
- Spend implied by the usage the API reported: US$ 0.000140; calls with no usable usage: 0
- Stop reason: bound violated by call #0: reported usage (151 prompt + 67 completion tokens) is above the reserved bound (506 + 20)
- Models reported by the API: ['deepseek-flash']

Scope: see `SCOPE.md` in this directory. Router stage only, two conditions, legacy gold labels, not the production pipeline.

| Condition | Rows | Correct | Accuracy | Failed calls | Invalid replies |
|---|---|---|---|---|---|
| B / all_rows_started | 1 | 1 | 1.0 | 0 | 0 |
| B / rows_reaching_router | 1 | 1 | 1.0 | 0 | 0 |
| P / all_rows_started | 0 | 0 | None | 0 | 0 |
| P / rows_reaching_router | 0 | 0 | None | 0 | 0 |

Legacy gold rows labelled critical but at or above 30 cm: 0 (the label policy disagrees with the 30 cm rule; these rows are scored as labelled, not relabelled).
