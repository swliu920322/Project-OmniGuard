# Baseline A measurement report

- Run: `20261107T045607Z_real_bb1f4b4e`, mode `real`, status **completed**
- Source: `worktree` at tag `eval-baseline-v1` (commit `a58b125`)
- Calls started: 2 of 400 allowed; tokens booked: 359 of 150000; US$ booked: 0.000217 of 0.50
- Spend implied by the usage the API reported: US$ 0.000217; calls with no usable usage: 0
- Replies cut off by max_tokens (finish_reason length): 0; reasoning tokens reported: 79
- Stop reason: completed all planned calls
- Model version stated by the owner: DeepSeek-V4.1-Flash-1017 (owner-stated, actual version unverified)
- Alias reported by the API (`response.model`): ['deepseek-flash']

Scope: see `SCOPE.md` in this directory. Router stage only, two conditions, legacy gold labels, not the production pipeline.

| Condition | Rows | Correct | Accuracy | Failed calls | Invalid replies |
|---|---|---|---|---|---|
| B / all_rows_started | 1 | 1 | 1.0 | 0 | 0 |
| B / rows_reaching_router | 1 | 1 | 1.0 | 0 | 0 |
| P / all_rows_started | 1 | 1 | 1.0 | 0 | 0 |
| P / rows_reaching_router | 1 | 1 | 1.0 | 0 | 0 |

Legacy gold rows labelled critical but at or above 30 cm: 0 (the label policy disagrees with the 30 cm rule; these rows are scored as labelled, not relabelled).
