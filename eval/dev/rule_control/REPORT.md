# R1 / R2 rule controls on the dev material

Spec `1.0`; `rule_control.py` sha256 `22e0456bdc41f0b6…`; dev set `bad376fce65d0b71…`; stress cases `459e5dcbe8e3728b…`. Offline, no model.

**Read this first.** Informational only. The dev notes and both controls come from the same author, the word lists were extended once on the public examples, and nothing here was tuned on any test material. These numbers describe what a keyword rule does on dev material. They are not a result and not a competitor score. On telemetry-only records the controls reproduce the gold by construction (a sanity ceiling); the comparison that means something is the noted records.

## R1

- Dev set (180): primary 178/180 = 0.9889; telemetry-only 108/108; noted 70/72; note status 69/72 = 0.9583; missed_halt 0, needless_halt 2
- Note-status mistakes on dev: [{'gold': 'HISTORICAL', 'got': 'AFFIRMED_CURRENT', 'count': 2}, {'gold': 'NEGATED', 'got': 'IRRELEVANT', 'count': 1}]; missed halts: []

- Stress cases that reach a classifier (38): primary 37/38 = 0.9737; note status 19/24 = 0.7917; missed_halt 1, needless_halt 0

| Stress type | n | primary correct | note status correct | missed_halt | needless_halt |
|---|---:|---:|---|---:|---:|
| 3 | 6 | 6 | 0/0 | 0 | 0 |
| 4 | 6 | 6 | 0/0 | 0 | 0 |
| 5 | 6 | 6 | 6/6 | 0 | 0 |
| 6 | 6 | 5 | 2/6 | 1 | 0 |
| 7 | 6 | 6 | 6/6 | 0 | 0 |
| 8 | 6 | 6 | 5/6 | 0 | 0 |
| 9 | 2 | 2 | 0/0 | 0 | 0 |

## R2

- Dev set (180): primary 148/180 = 0.8222; telemetry-only 108/108; noted 40/72; note status 24/72 = 0.3333; missed_halt 0, needless_halt 19
- Note-status mistakes on dev: [{'gold': 'HISTORICAL', 'got': 'AFFIRMED_CURRENT', 'count': 12}, {'gold': 'HYPOTHETICAL', 'got': 'AFFIRMED_CURRENT', 'count': 12}, {'gold': 'NEGATED', 'got': 'AFFIRMED_CURRENT', 'count': 11}, {'gold': 'NEGATED', 'got': 'IRRELEVANT', 'count': 1}, {'gold': 'UNCERTAIN', 'got': 'AFFIRMED_CURRENT', 'count': 12}]; missed halts: []

- Stress cases that reach a classifier (38): primary 31/38 = 0.8158; note status 10/24 = 0.4167; missed_halt 1, needless_halt 6

| Stress type | n | primary correct | note status correct | missed_halt | needless_halt |
|---|---:|---:|---|---:|---:|
| 3 | 6 | 6 | 0/0 | 0 | 0 |
| 4 | 6 | 6 | 0/0 | 0 | 0 |
| 5 | 6 | 5 | 3/6 | 0 | 1 |
| 6 | 6 | 4 | 1/6 | 1 | 1 |
| 7 | 6 | 2 | 1/6 | 0 | 4 |
| 8 | 6 | 6 | 5/6 | 0 | 0 |
| 9 | 2 | 2 | 0/0 | 0 | 0 |

types 1, 2 and the invalid type-9 cases are rejected by the input check in code before any classifier; types 10-11 are injected faults.
