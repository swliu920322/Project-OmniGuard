# Baseline A measurement report

- Run: `20261107T045641Z_real_db062c4f`, mode `real`, status **completed**
- Source: `worktree` at tag `eval-baseline-v1` (commit `a58b125`)
- Calls started: 400 of 400 allowed; tokens booked: 112180 of 150000; US$ booked: 0.097173 of 0.50
- Spend implied by the usage the API reported: US$ 0.097173; calls with no usable usage: 0
- Replies cut off by max_tokens (finish_reason length): 9; reasoning tokens reported: 57243
- Stop reason: completed all planned calls
- Model version stated by the owner: DeepSeek-V4.1-Flash-1017 (owner-stated, actual version unverified)
- Alias reported by the API (`response.model`): ['deepseek-flash']

Scope: see `SCOPE.md` in this directory. Router stage only, two conditions, legacy gold labels, not the production pipeline.

| Condition | Rows | Correct | Accuracy | Failed calls | Invalid replies |
|---|---|---|---|---|---|
| B / all_rows_started | 200 | 193 | 0.965 | 0 | 0 |
| B / rows_reaching_router | 172 | 165 | 0.9593 | 0 | 0 |
| P / all_rows_started | 200 | 156 | 0.78 | 0 | 12 |
| P / rows_reaching_router | 172 | 146 | 0.8488 | 0 | 7 |

Legacy gold rows labelled critical but at or above 30 cm: 11 (the label policy disagrees with the 30 cm rule; these rows are scored as labelled, not relabelled).
