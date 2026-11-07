# Diagnosis of the baseline-B HTTP 500s — 20261107T074921Z_real_440e6441

Mode `real`, status **completed**, calls 6 of at most 6. Not a baseline result.

| Step | Change | HTTP | Outcome | finish_reason |
|---|---|---|---|---|
| 1 | none: replay of a request that succeeded in the baseline-A canary | 200 | ok | stop |
| 2 | max_tokens 1024 -> 2048 | 200 | ok | stop |
| 3 | remove max_completion_tokens (20) | 200 | ok | stop |
| 4 | system prompt: the baseline-A one-liner -> B-1.0 | 200 | ok | stop |
| 5 | user input: the baseline-A telemetry line -> the baseline-B canary input (DEV-001, with a Chinese note) | 200 | ok | stop |
| 6 | none: replay of step 1, to see whether the service state changed meanwhile | 200 | ok | stop |

Skipped: [].

A step that fails right after steps that passed is a CORRELATION with its change, not a proven cause. If step 1 fails, or step 6 fails after earlier passes, the service state is implicated, not the request.

Stop reason: plan finished
