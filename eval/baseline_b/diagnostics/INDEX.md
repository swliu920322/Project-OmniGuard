# Real diagnostic runs (not baseline results)

| Directory | What | Outcome |
|---|---|---|
| `20261107T074921Z_real_440e6441` | the authorised six-step diagnosis of the baseline-B HTTP 500s (owner authorisation: diagnosis only, <= 6 calls, US$0.03, 35,000 tokens; cumulative ceiling 190 calls, US$0.50, 500,000 tokens) | `completed`, 6 calls, **all six returned HTTP 200 with `finish_reason` stop**, including step 5, which is the failed baseline-B request (DEV-001) byte for byte. Actual usage 2,770 tokens (US$0.00134 at the conservative rates). Alias `deepseek-flash`. Directory verifies. |

Per step (HTTP 200 each; prompt + completion tokens, of which reasoning; latency):

| Step | Only change | Tokens | Latency |
|---|---|---|---:|
| 1 | replay of a baseline-A request | 151 + 48 (39) | 38.9 s |
| 2 | `max_tokens` 1024 -> 2048 | 151 + 71 (62) | 18.3 s |
| 3 | remove `max_completion_tokens` | 151 + 49 (40) | 5.6 s |
| 4 | system prompt -> B-1.0 | 868 + 57 (37) | 2.7 s |
| 5 | user input -> the B canary input (the failed request) | 881 + 150 (129) | 3.2 s |
| 6 | replay of step 1 | 151 + 42 (33) | 1.6 s |

**Reading.** No change in the request is correlated with the 500s: the exact request that failed twice now succeeds, so the earlier failures were transient or tied to the service state at that time, not to `max_tokens`, `max_completion_tokens`, the B prompt or the Chinese note. Not proven further: the status page showed a V4.1 Flash incident in monitoring when it was read, and the first call here took 38.9 s while the last took 1.6 s, which fits a recovering service, but neither fact establishes the cause. Not tested: DEV-002's request body (the second body that failed). The reply of step 5 is not a result of any kind.

Accounting after this run: 10 calls (4 failed baseline-B canary calls + 6 diagnostic), booked about 23,658 tokens and US$0.0165 (reservations of the four failed calls plus actual usage of the six), against the ceiling of 190 calls, 500,000 tokens, US$0.50. **No canary or full dev run was started** (not authorised by this step).
