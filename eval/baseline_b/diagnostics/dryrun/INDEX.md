# Offline rehearsals of the 500 diagnosis

Fake client, sockets blocked, **no model, no money**. They prove the stop and skip logic only.

| Directory | Scripted behaviour | Calls | Steps run |
|---|---|---:|---|
| `20261107T073544Z_dry-run_3454305f` | nothing fails | 6 | 1, 2, 3, 4, 5, 6 |
| `20261107T073544Z_dry-run_e663953e` | call 1 (step 1) returns 500 | 1 | 1 (stop: the service, not our request) |
| `20261107T073544Z_dry-run_19cbd173` | call 4 (step 4) returns 500 | 5 | 1, 2, 3, 4, then 6 (step 5 skipped) |

Each verifies with `python eval/baseline_b/run_dev_eval.py --verify <dir>`.
