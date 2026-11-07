# Offline rehearsals (fake client, no network, no measurement)

All four were produced by `run_baseline_a.py` in its default `dry-run` mode, with the original code restored from the tag into a temporary git worktree. The fake client's answers measure nothing and no accuracy is published. Each directory is sealed with `SHA256SUMS`; check with `python eval/baseline_v1/measure/run_baseline_a.py --verify <directory>`.

| Directory | Command arguments | What it shows |
|---|---|---|
| `20261107T042520Z_dry-run_8cf38604` | none | the full plan: 400 calls interleaved, scripted faults (429, timeout, malformed and empty replies, missing usage), the fake model switching string at request 330 (`model_drift_flag`), all recorded, none retried |
| `20261107T042521Z_dry-run_81bf63a0` | `--limit 4 --usd-cap 0.000001` | a dollar cap below one call's worst case: **zero requests sent**, stop reason names the cap |
| `20261107T042522Z_dry-run_a161a294` | `--limit 10 --fault-plan '{"3":"usage_over"}'` | the API "reports" far more prompt tokens than the reserved bound: the overrun is booked as it was, the run stops at once with `stopped_bound_violation` (exit code 3), nothing is sent afterwards |
| `20261107T042524Z_dry-run_49131223` | `--limit 10 --fault-plan '{"5":"interrupt"}'` | Ctrl+C while request #5 is in flight: the run is sealed as `interrupted` (exit code 130), the in-flight request is the last line of `calls.jsonl` with its reservation still booked, and the summary, report and hashes are written |

The prices in these rehearsals are placeholders (`REHEARSAL PLACEHOLDER: not a real price`).
