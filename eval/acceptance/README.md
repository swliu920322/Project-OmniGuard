# Independent acceptance data

`FROZEN_MANIFEST.json` is the active data commitment for acceptance-v1: 300 records, six classes with 50 records each, and a separate 55-case stress set. Model evaluation has not run. X and Y are unknown.

Only hashes, counts and annotation/audit summaries are public here. The tuning session must not read the private inputs, labels or annotation packets. The acceptance custodian holds them outside the repository. After tuning has ended, the custodian runs the frozen versions without returning sample-level feedback for further tuning in this round.

The earlier candidate and blind-seal commitments are retained for provenance. The first candidate was not frozen: a cross-set semantic audit led to 14 note rewrites before any model evaluation. The revision2 blind packet was hash-committed before a fresh session annotated it; those labels were sealed before all 72 initial labels were released for review. No state-label changes or owner disputes remained. The final dataset hash is in the frozen manifest, not the earlier candidate commitment.

There are 34 conservative families, not 300 independent scenarios. The specification mandates the same threshold equality, adjacent values and physical-gate anchors as dev; these are not novel semantic scenarios. Exact-input comparisons and a family/semantic audit were performed, with the remaining limitations retained in the manifest. AI agreement is not expert validation.

Changing any frozen input, label or annotation rule requires a new version and an explicit reason. Do not overwrite a historical commitment or present model/stress metrics before a real run exists. Additional provider calls still require the owner's budget authorization.
