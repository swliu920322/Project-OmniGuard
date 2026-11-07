# Formal evaluation, suite `main`: 20261107T113942Z_main_real_094cb6c1

Status **completed** (completed all planned calls); mode real; counts as a measurement: True (frozen acceptance file: True).
Prompt B-1.0 `9247896719b66e13…`; spec 1.0; repo head `fec6acf39762`; tag `eval-formal-v1`.
Record-level results are private and not published; their hashes are in the JSON. Aggregates only. Not used for tuning in this round.

**Main figure: accuracy 300/300 = 1.0 (95 % Wilson [0.9874, 1.0]); macro-F1 1.0; errors 0, invalid 0, interrupted 0.**
Next to it, not instead of it: among calls that returned a usable reply 300/300 = 1.0 ([0.9874, 1.0]).

| Class | Support | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| `NORMAL_NAV` | 50 | 1.0 | 1.0 | 1.0 |
| `CRITICAL_OBSTACLE` | 50 | 1.0 | 1.0 | 1.0 |
| `LOW_BATTERY` | 50 | 1.0 | 1.0 | 1.0 |
| `OVERHEAT` | 50 | 1.0 | 1.0 | 1.0 |
| `LOW_HEALTH` | 50 | 1.0 | 1.0 | 1.0 |
| `OVERSPEED` | 50 | 1.0 | 1.0 | 1.0 |

| System | Primary accuracy | Macro-F1 | Note status | missed_halt | needless_halt |
|---|---:|---:|---:|---:|---:|
| Baseline B | 300/300 = 1.0 | 1.0 | 72/72 | 0 | 0 |
| R1 | 281/300 = 0.9367 | 0.9363 | 23/72 | 14 | 3 |
| R2 | 280/300 = 0.9333 | 0.9345 | 15/72 | 10 | 6 |

Note status of baseline B (noted records, separate): per status recall {'AFFIRMED_CURRENT': {'support': 12, 'recall': 1.0}, 'NEGATED': {'support': 12, 'recall': 1.0}, 'HISTORICAL': {'support': 12, 'recall': 1.0}, 'HYPOTHETICAL': {'support': 12, 'recall': 1.0}, 'UNCERTAIN': {'support': 12, 'recall': 1.0}, 'IRRELEVANT': {'support': 12, 'recall': 1.0}}
Safety of baseline B: {'n': 300, 'missed_halt': 0, 'needless_halt': 0, 'floor_override': 70, 'floor_override_rate': 0.2333, 'parse_failure_halts': 0, 'fault_halts': 0, 'executed_motion': {'HALT': 152, 'MOVE': 85, 'MOVE_LIMITED': 63}}
