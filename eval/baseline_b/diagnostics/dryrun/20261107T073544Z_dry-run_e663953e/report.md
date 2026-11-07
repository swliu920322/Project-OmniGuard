# Diagnosis of the baseline-B HTTP 500s — 20261107T073544Z_dry-run_e663953e

Mode `dry-run`, status **completed**, calls 1 of at most 6. Not a baseline result.

| Step | Change | HTTP | Outcome | finish_reason |
|---|---|---|---|---|
| 1 | none: replay of a request that succeeded in the baseline-A canary | 500 | FAILED | None |

Skipped: [2, 3, 4, 5, 6].

A step that fails right after steps that passed is a CORRELATION with its change, not a proven cause. If step 1 fails, or step 6 fails after earlier passes, the service state is implicated, not the request.

Stop reason: plan finished
