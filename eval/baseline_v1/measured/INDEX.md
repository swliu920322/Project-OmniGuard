# Real runs of the baseline-A harness

Each directory is a separate run, never overwritten. A run counts as a measurement only if `summary.json` says `"is_measurement": true`.

| Directory | Arguments | Outcome |
|---|---|---|
| `20261107T043259Z_real_401c9ff8` | `--limit 1`: a canary before the full run, **2 calls planned, 1 executed** | `stopped_bound_violation` after call #0 (the second call was never sent). **Not a measurement.** The API reported 67 completion tokens for a reply of 9 tokens of text: the served model is a reasoning model and spent 58 reasoning tokens that the original `max_completion_tokens=20` does not limit. The harness's output bound of 20 is therefore wrong for this model. Spend: US$0.00014 at the conservative rates. Kept as evidence; nothing was retried or changed in this run. |
| `20261107T045607Z_real_bb1f4b4e` | `--limit 1`: canary after harness f5e0763 (GPT-accepted), 2 calls | `completed`, both calls `stop`, labels `CRITICAL_OBSTACLE` (B and P), `max_tokens: 1024` in both requests, same alias `deepseek-flash`, 41 and 56 completion tokens (32 and 47 reasoning), directory verifies. **All 7 pre-set criteria passed. A canary, not a measurement**: its `summary.json` says `is_measurement: true` only because the flag is `real and completed` and ignores `--limit`; that wording is a known flaw and was not changed. Model identity: owner-stated DeepSeek-V4.1-Flash-1017, actual version unverified. Spend about US$0.0002 at the conservative rates. |
| `20261107T045641Z_real_db062c4f` | full run, 400 calls (200 rows x B and P), harness f5e0763, cap US$0.50 | `completed`, no failed calls, one alias `deepseek-flash`, no model drift flag, directory verifies. US$0.097 booked, 112,180 of 150,000 tokens. **B: 193/200 = 96.5% (165/172 = 95.9% on rows that reach the router). P: 156/200 = 78.0% (146/172 = 84.9%), with 12 invalid replies (9 cut off by `max_tokens`, `finish_reason length`).** Descriptive only, legacy gold labels, router stage only, not the historical 94.19% and not the resume X. Model identity: owner-stated DeepSeek-V4.1-Flash-1017, actual version unverified. |

Findings from the canary (see `calls.jsonl` of that run):
- `response.model` is `deepseek-flash` while the configuration says `deepseek-v4-flash`: the configured name is an alias.
- The message carries `reasoning_content`; `usage.completion_tokens_details.reasoning_tokens` is 58 of the 67.
- The text reply was a clean label (`CRITICAL_OBSTACLE`).
