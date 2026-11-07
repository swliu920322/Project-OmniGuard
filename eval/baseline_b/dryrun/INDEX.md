# Offline rehearsals of the baseline-B runner

Fake client, sockets blocked, **no model and no money**. Metrics are withheld on purpose: a rehearsal proves the pipeline, never a model.

| Directory | Calls | Status | What it exercises |
|---|---:|---|---|
| `20261107T065304Z_dry-run_01c588b1` | 4 / 180 | interrupted | scripted Ctrl+C while call 4 is in flight: sealed, in-flight call recorded with its reservation, exit 130 |
| `20261107T065304Z_dry-run_61e9228e` | 180 / 180 | completed | 11 scripted faults: 429, timeout, prose reply, code fence, missing key, bad label, truncation with an empty reply, truncation with a valid JSON (must still be invalid), missing usage, a null status for a noted record, an empty reply |
| `20261107T065304Z_dry-run_7fa3f160` | 180 / 180 | completed | no faults: the clean path end to end |
| `20261107T065304Z_dry-run_e908bcfa` | 51 / 180 | stopped_bound_violation | scripted fault plan including a usage report far above the reserved bound: the run stops at call 51, exit 3 |

Each directory verifies with `python eval/baseline_b/run_dev_eval.py --verify <dir>`.
