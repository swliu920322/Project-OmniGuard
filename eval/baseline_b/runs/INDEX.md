# Real runs of baseline B

Each directory is a separate run, never overwritten. A run is a measurement only if `summary.json` says `"is_measurement": true`; a canary (`--limit`) never is.

| Directory | Arguments | Outcome |
|---|---|---|
| `20261107T071745Z_real_ef50e6ae` | `--limit 2` canary, caps US$0.05 / 2 calls / 20,000 tokens, harness `a15c870` | `completed` as a run, but **the canary FAILED its pre-set criteria**: both calls returned HTTP 500 `Internal Server Error` from the provider (request ids `141e4b3d-…`, `fb94b6bd-…`), no reply, no usage reported. No prompt-contract behaviour could be observed. Not a measurement. Nothing was retried or changed. Cause not established (provider-side error is likely, a problem with the request is not excluded). |

The full 180-call dev run was **not** started because the canary did not pass.
