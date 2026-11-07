# Real runs of the baseline-A harness

Each directory is a separate run, never overwritten. A run counts as a measurement only if `summary.json` says `"is_measurement": true`.

| Directory | Arguments | Outcome |
|---|---|---|
| `20261107T043259Z_real_401c9ff8` | `--limit 1`: a canary before the full run, **2 calls planned, 1 executed** | `stopped_bound_violation` after call #0 (the second call was never sent). **Not a measurement.** The API reported 67 completion tokens for a reply of 9 tokens of text: the served model is a reasoning model and spent 58 reasoning tokens that the original `max_completion_tokens=20` does not limit. The harness's output bound of 20 is therefore wrong for this model. Spend: US$0.00014 at the conservative rates. Kept as evidence; nothing was retried or changed in this run. |
| `20261107T045607Z_real_bb1f4b4e` | `--limit 1`: canary after harness f5e0763 (GPT-accepted), 2 calls | `completed`, both calls `stop`, labels `CRITICAL_OBSTACLE` (B and P), `max_tokens: 1024` in both requests, same alias `deepseek-flash`, 41 and 56 completion tokens (32 and 47 reasoning), directory verifies. **All 7 pre-set criteria passed. A canary, not a measurement**: its `summary.json` says `is_measurement: true` only because the flag is `real and completed` and ignores `--limit`; that wording is a known flaw and was not changed. Model identity: owner-stated DeepSeek-V4.1-Flash-1017, actual version unverified. Spend about US$0.0002 at the conservative rates. |

Findings from the canary (see `calls.jsonl` of that run):
- `response.model` is `deepseek-flash` while the configuration says `deepseek-v4-flash`: the configured name is an alias.
- The message carries `reasoning_content`; `usage.completion_tokens_details.reasoning_tokens` is 58 of the 67.
- The text reply was a clean label (`CRITICAL_OBSTACLE`).
