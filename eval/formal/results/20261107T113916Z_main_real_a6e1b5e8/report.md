# Formal evaluation, suite `main`: 20261107T113916Z_main_real_a6e1b5e8

Status **completed** (completed all planned calls); mode real; counts as a measurement: False (frozen acceptance file: False).
Prompt B-1.0 `9247896719b66e13…`; spec 1.0; repo head `fec6acf39762`; tag `eval-formal-v1`.
Record-level results are private and not published; their hashes are in the JSON. Aggregates only. Not used for tuning in this round.

**Main figure: accuracy 2/2 = 1.0 (95 % Wilson [0.3424, 1.0]); macro-F1 0.3333; errors 0, invalid 0, interrupted 0.**
Next to it, not instead of it: among calls that returned a usable reply 2/2 = 1.0 ([0.3424, 1.0]).

| Class | Support | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| `NORMAL_NAV` | 0 | None | None | 0.0 |
| `CRITICAL_OBSTACLE` | 0 | None | None | 0.0 |
| `LOW_BATTERY` | 1 | 1.0 | 1.0 | 1.0 |
| `OVERHEAT` | 0 | None | None | 0.0 |
| `LOW_HEALTH` | 1 | 1.0 | 1.0 | 1.0 |
| `OVERSPEED` | 0 | None | None | 0.0 |

| System | Primary accuracy | Macro-F1 | Note status | missed_halt | needless_halt |
|---|---:|---:|---:|---:|---:|
| Baseline B | 2/2 = 1.0 | 0.3333 | 2/2 | 0 | 0 |
| R1 | 2/2 = 1.0 | 0.3333 | 2/2 | 0 | 0 |
| R2 | 1/2 = 0.5 | 0.1667 | 1/2 | 0 | 1 |

Note status of baseline B (noted records, separate): per status recall {'AFFIRMED_CURRENT': {'support': 0, 'recall': None}, 'NEGATED': {'support': 0, 'recall': None}, 'HISTORICAL': {'support': 0, 'recall': None}, 'HYPOTHETICAL': {'support': 1, 'recall': 1.0}, 'UNCERTAIN': {'support': 0, 'recall': None}, 'IRRELEVANT': {'support': 1, 'recall': 1.0}}
Safety of baseline B: {'n': 2, 'missed_halt': 0, 'needless_halt': 0, 'floor_override': 0, 'floor_override_rate': 0.0, 'parse_failure_halts': 0, 'fault_halts': 0, 'executed_motion': {'HALT': 1, 'MOVE': 1}}
