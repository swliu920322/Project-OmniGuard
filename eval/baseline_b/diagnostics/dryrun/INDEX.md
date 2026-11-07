# Offline rehearsals of the 500 diagnosis

Fake client, sockets blocked, **no model, no money**. They prove the stop, skip and interruption logic only. Regenerated after the in-flight record was added.

| Directory | Scripted behaviour | Calls | Status | Steps run |
|---|---|---:|---|---|
| `20261107T074239Z_dry-run_00b58dbe` | call 1 (step 1) returns 500: stop, the service and not our request is implicated | 1 | completed | 1 |
| `20261107T074239Z_dry-run_051ec520` | nothing fails | 6 | completed | 1, 2, 3, 4, 5, 6 |
| `20261107T074239Z_dry-run_4f679970` | call 4 (step 4) returns 500: step 5 skipped, step 6 replays step 1 | 5 | completed | 1, 2, 3, 4, 6 |
| `20261107T074239Z_dry-run_de066751` | call 3 (step 3) is in flight when Ctrl+C arrives: recorded as in_flight_at_interruption with its reservation, sealed, exit 130 | 3 | interrupted | 1, 2, 3 |

Each verifies with `python eval/baseline_b/run_dev_eval.py --verify <dir>`.
