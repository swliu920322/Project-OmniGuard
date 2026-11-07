# Offline rehearsals (fake client, no network, no measurement)

All four come from `run_baseline_a.py` in its default `dry-run` mode, with the original code restored from the tag into a temporary git worktree. The fake client behaves like the reasoning model seen in the real canary (it ignores `max_completion_tokens`, honours `max_tokens`, spends reasoning tokens first) and follows scripted faults; its answers measure nothing and no accuracy is published. Each directory is sealed with `SHA256SUMS`; check with `python eval/baseline_v1/measure/run_baseline_a.py --verify <directory>`.

| Directory | Arguments | What it shows |
|---|---|---|
| `20261107T044645Z_dry-run_a4582532` | none | the full plan: 400 interleaved calls; reasoning tokens recorded; `max_tokens=1024` on every request with `request_deviation`; scripted faults (429, timeout, malformed and empty replies, missing usage); **two replies cut off at the guard, one empty and one that still names a valid label (call #54): both score INVALID**; the fake model switching alias at request 330 (`model_drift_flag`); nothing retried |
| `20261107T044646Z_dry-run_6f6be4bb` | `--limit 4 --usd-cap 0.000001` | a dollar cap below one call's worst case: **zero requests sent** |
| `20261107T044648Z_dry-run_b385200a` | `--limit 10 --fault-plan '{"3":"long_reply"}'` | a provider that ignores every cap reports 5000 completion tokens against the reserved 1024: the overrun is booked as it was and the run stops at once with `stopped_bound_violation` (exit code 3) |
| `20261107T044649Z_dry-run_261d42a1` | `--limit 10 --fault-plan '{"5":"interrupt"}'` | Ctrl+C while request #5 is in flight: sealed as `interrupted` (exit code 130), the in-flight request is the last line of `calls.jsonl` with its reservation still booked |

Scoring rule shown by these runs: only `finish_reason: stop` can score correct; cut-off replies, other finish reasons and a missing finish reason score INVALID, and failed calls score ERROR.

The prices in these rehearsals are placeholders (`REHEARSAL PLACEHOLDER: not a real price`).
