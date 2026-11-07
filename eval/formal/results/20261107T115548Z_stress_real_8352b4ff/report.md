# Formal evaluation, suite `stress`: 20261107T115548Z_stress_real_8352b4ff

Status **completed** (completed all planned calls); mode real; counts as a measurement: True (frozen acceptance file: True).
Prompt B-1.0 `9247896719b66e13…`; spec 1.0; repo head `fec6acf39762`; tag `eval-formal-v1`.
Record-level results are private and not published; their hashes are in the JSON. Aggregates only. Not used for tuning in this round.

| Type | cases | started | model_requests | input_rejected_as_expected | injected_fault_halts_as_expected | missed_halt | needless_halt | model_unusable_replies | model_wrong_primary | interface_errors | interrupted | scored |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 5 | 5 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 5 | 5 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| 4 | 5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| 5 | 5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| 6 | 5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| 7 | 5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| 8 | 5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 |
| 9 | 5 | 5 | 2 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| 10 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 11 | 5 | 5 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Total: {'cases': 55, 'started': 55, 'model_requests': 32, 'input_rejected_as_expected': 13, 'injected_fault_halts_as_expected': 10, 'missed_halt': 0, 'needless_halt': 0, 'model_unusable_replies': 0, 'model_wrong_primary': 0, 'interface_errors': 0, 'interrupted': 0, 'scored': 32}
input rejections (types 1, 2 and invalid type 9) and injected faults (types 10, 11) are checked offline and send no API request; model errors are unusable replies and wrong primary labels; interface errors are real API errors; all are reported apart from the classification accuracy
