# Baseline B on the dev set — 20261107T075330Z_real_5f677a7e

- Mode `real`, status **completed**, canary: True, counts as a measurement: False
- Prompt `B-1.0` sha256 `9247896719b66e13…`; dev set sha256 `bad376fce65d0b71…`; spec `1.0`
- Calls recorded 2 of 2; truncated replies 0; parse errors {}
- Spend implied by reported usage: US$ 0.001035; booked 0.001035 of 0.05
- Model identity: DeepSeek-V4.1-Flash-1017 (owner-stated, actual version unverified) (owner-stated, actual version unverified); aliases reported: ['deepseek-flash']
- Stop reason: completed all planned calls

Dev-set result, for development only: not the formal X or Y, which come from the frozen test set.

| Subset | n | Correct | Accuracy | 95 % interval (Wilson) | Errors | Invalid |
|---|---:|---:|---:|---|---:|---:|
| all_started | 2 | 2 | 1.0 | [0.3424, 1.0] | 0 | 0 |
| telemetry_only | 0 | 0 | None | None | 0 | 0 |
| noted | 2 | 2 | 1.0 | [0.3424, 1.0] | 0 | 0 |
| rows_reaching_router | 2 | 2 | 1.0 | [0.3424, 1.0] | 0 | 0 |

Macro-F1 (all started): 0.3333

| Class | Support | Precision | Recall | F1 |
|---|---:|---:|---:|---:|
| `NORMAL_NAV` | 0 | None | None | 0.0 |
| `CRITICAL_OBSTACLE` | 0 | None | None | 0.0 |
| `LOW_BATTERY` | 1 | 1.0 | 1.0 | 1.0 |
| `OVERHEAT` | 0 | None | None | 0.0 |
| `LOW_HEALTH` | 1 | 1.0 | 1.0 | 1.0 |
| `OVERSPEED` | 0 | None | None | 0.0 |

Note status (noted records only, separate from the main accuracy): 2/2 = 1.0, interval [0.3424, 1.0]
Safety: {'n': 2, 'missed_halt': 0, 'missed_halt_ids': [], 'needless_halt': 0, 'floor_override': 0, 'floor_override_rate': 0.0, 'parse_failure_halts': 0, 'fault_halts': 0, 'executed_motion': {'HALT': 1, 'MOVE': 1}}
Legacy three-class view (extra): {'n': 0, 'correct': 0, 'accuracy': None, 'ci95_wilson': None, 'note': 'an extra compatibility view, not the main metric; OVERSPEED records and noted records are excluded'}
