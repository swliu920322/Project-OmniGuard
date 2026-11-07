# Real runs of baseline B

Each directory is a separate run, never overwritten. A run is a measurement only if `summary.json` says `"is_measurement": true`; a canary (`--limit`) never is.

| Directory | Arguments | Outcome |
|---|---|---|
| `20261107T071745Z_real_ef50e6ae` | `--limit 2` canary, caps US$0.05 / 2 calls / 20,000 tokens, harness `a15c870` | `completed` as a run, but **the canary FAILED its pre-set criteria**: both calls returned HTTP 500 `Internal Server Error` from the provider (request ids `141e4b3d-…`, `fb94b6bd-…`), no reply, no usage reported. No prompt-contract behaviour could be observed. Not a measurement. Nothing was retried or changed. Cause not established (provider-side error is likely, a problem with the request is not excluded). |
| `20261107T072708Z_real_55c6fa87` | second `--limit 2` canary, caps US$0.04 / 2 calls / 10,500 tokens (10,000 cannot hold two worst-case reservations of 5,233 and 5,211), same prompt, parameters and model configuration, harness `a15c870` | `completed` as a run, but **the canary FAILED again**: both calls returned HTTP 500 `Internal Server Error` (request ids 52ea69c5…, 318c29e9…), no reply, no usage. Not a measurement. Nothing retried or changed. Four requests of baseline B have now failed with 500. Cause not established. |

The full 180-call dev run was **not** started because no canary passed. Calls made so far: 4 (all failed with 500); reservations of all four stay booked (about 20.9k tokens, US$0.015 at the conservative rates).

Diagnosis of the two failures: see `../diagnostics/INDEX.md` (the six-step diagnosis, run later the same day, got HTTP 200 for every step including the exact failed request).
