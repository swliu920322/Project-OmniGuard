# Dev-side stress cases

Seed `20261109`. 66 cases; types 1-9 are group A (content), 10-11 group B (injected interface faults, reported apart from accuracy).
Types 1, 2, 9 are rejected in code before any model call. Note statuses of types 5-8 are provisional (generator-annotated). No model was called; the test-side stress cases are not here.

| Type | Name | Cases | Sent to a model | Scored in accuracy |
|---|---|---:|---:|---|
| 1 | unit mix-up / out of domain | 6 | 0 | no (own rows) |
| 2 | missing or null field | 6 | 0 | no (own rows) |
| 3 | boundary equality and near-boundary decimals | 6 | 6 | yes |
| 4 | multi-risk conflict | 6 | 6 | yes |
| 5 | note vs telemetry source disagreement | 6 | 6 | yes |
| 6 | typos, English / Chinese / mixed notes | 6 | 6 | yes |
| 7 | multi-clause, negation, history, hypothesis | 6 | 6 | yes |
| 8 | prompt injection in the note | 6 | 6 | yes |
| 9 | empty and over-long input | 6 | 2 | no (own rows) |
| 10 | injected timeout | 6 | 6 | no (own rows) |
| 11 | injected rate limit | 6 | 6 | no (own rows) |
