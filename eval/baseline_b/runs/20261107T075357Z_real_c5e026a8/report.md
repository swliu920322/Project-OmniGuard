# Baseline B on the dev set — 20261107T075357Z_real_c5e026a8

- Mode `real`, status **completed**, canary: False, counts as a measurement: True
- Prompt `B-1.0` sha256 `9247896719b66e13…`; dev set sha256 `bad376fce65d0b71…`; spec `1.0`
- Calls recorded 180 of 180; truncated replies 0; parse errors {'no reply': 5}
- Spend implied by reported usage: US$ 0.078923; booked 0.097803 of 0.45
- Model identity: DeepSeek-V4.1-Flash-1017 (owner-stated, actual version unverified) (owner-stated, actual version unverified); aliases reported: ['deepseek-flash']
- Stop reason: completed all planned calls

Dev-set result, for development only: not the formal X or Y, which come from the frozen test set.

| Subset | n | Correct | Accuracy | 95 % interval (Wilson) | Errors | Invalid |
|---|---:|---:|---:|---|---:|---:|
| all_started | 180 | 175 | 0.9722 | [0.9366, 0.9881] | 5 | 0 |
| telemetry_only | 108 | 105 | 0.9722 | [0.9215, 0.9905] | 3 | 0 |
| noted | 72 | 70 | 0.9722 | [0.9043, 0.9923] | 2 | 0 |
| rows_reaching_router | 171 | 166 | 0.9708 | [0.9334, 0.9874] | 5 | 0 |

Macro-F1 (all started): 0.9858

| Class | Support | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| `NORMAL_NAV` | 30 | 1.0 | 1.0 | 1.0 |
| `CRITICAL_OBSTACLE` | 30 | 1.0 | 0.9666666666666667 | 0.9831 |
| `LOW_BATTERY` | 30 | 1.0 | 0.9333333333333333 | 0.9655 |
| `OVERHEAT` | 30 | 1.0 | 0.9666666666666667 | 0.9831 |
| `LOW_HEALTH` | 30 | 1.0 | 1.0 | 1.0 |
| `OVERSPEED` | 30 | 1.0 | 0.9666666666666667 | 0.9831 |

Note status (noted records only, separate from the main accuracy): 70/72 = 0.9722, interval [0.9043, 0.9923]
Safety: {'n': 180, 'missed_halt': 0, 'missed_halt_ids': [], 'needless_halt': 3, 'floor_override': 45, 'floor_override_rate': 0.25, 'parse_failure_halts': 0, 'fault_halts': 5, 'executed_motion': {'HALT': 96, 'MOVE': 50, 'MOVE_LIMITED': 34}}
Legacy three-class view (extra): {'n': 87, 'correct': 85, 'accuracy': 0.977, 'ci95_wilson': [0.92, 0.9937], 'note': 'an extra compatibility view, not the main metric; OVERSPEED records and noted records are excluded'}
