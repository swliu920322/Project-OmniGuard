# Diagnosis of the baseline-B HTTP 500s — 20261107T074239Z_dry-run_de066751

Mode `dry-run`, status **interrupted**, calls 3 of at most 6. Not a baseline result.

| Step | Change | HTTP | Outcome | finish_reason |
|---|---|---|---|---|
| 1 | none: replay of a request that succeeded in the baseline-A canary | None | ok | stop |
| 2 | max_tokens 1024 -> 2048 | None | ok | stop |
| 3 | remove max_completion_tokens (20) | None | FAILED | None |

Skipped: [4, 5, 6].

A step that fails right after steps that passed is a CORRELATION with its change, not a proven cause. If step 1 fails, or step 6 fails after earlier passes, the service state is implicated, not the request.

Stop reason: interrupted: KeyboardInterrupt: scripted Ctrl+C
