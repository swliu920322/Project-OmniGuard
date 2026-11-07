# Real runs of the baseline-A harness

Each directory is a separate run, never overwritten. A run counts as a measurement only if `summary.json` says `"is_measurement": true`.

| Directory | Arguments | Outcome |
|---|---|---|
| `20261107T043259Z_real_401c9ff8` | `--limit 1` (2 calls planned): a canary before the full run | `stopped_bound_violation` after call #0. **Not a measurement.** The API reported 67 completion tokens for a reply of 9 tokens of text: the served model is a reasoning model and spent 58 reasoning tokens that the original `max_completion_tokens=20` does not limit. The harness's output bound of 20 is therefore wrong for this model. Spend: US$0.00014 at the conservative rates. Kept as evidence; nothing was retried or changed in this run. |

Findings from the canary (see `calls.jsonl` of that run):
- `response.model` is `deepseek-flash` while the configuration says `deepseek-v4-flash`: the configured name is an alias.
- The message carries `reasoning_content`; `usage.completion_tokens_details.reasoning_tokens` is 58 of the 67.
- The text reply was a clean label (`CRITICAL_OBSTACLE`).
