# Data grouping and quantity plan (a plan: nothing is generated, nothing is frozen)

Applies to spec `0.4-candidate`. Synthetic samples of a simulation; they are never described as production data. Numbers are targets to be confirmed at the pre-freeze review.

## 1. Who makes what

| Set | Made by | Seen by the tuning session |
|---|---|---|
| Public boundary examples (`ambiguous_examples.json`) | Claude | yes (dev material) |
| Dev set | Claude | yes |
| Stress set | Claude writes dev-side stress cases; the acceptance session writes the test-side ones | dev-side yes |
| Frozen test set | the **acceptance session**, written and reviewed independently; disputed items go to the owner | **no**. The tuning session only ever receives the file hash (commitment) and the per-class counts. |

If the test set is used for tuning after exposure, it becomes an exposed set and the final acceptance needs new independent samples.

## 2. Unit of grouping: the family (algorithm in `family.py`)

A **family** is one base scenario with all its numeric variants, paraphrases and translations. Semantically similar risk combinations may occur in different families (and so in both dev and test); what must never be shared is a **base scenario or any rewording or translation of it**.

- **Family id:** `F-0001` to `F-1200`, a pool fixed now and larger than needed. Every record carries its `family_id`.
- **Assignment:** `bucket = int(sha256("omniguard-eval-split-v1|" + family_id)[:8], 16) % 100`; bucket < 30 is **dev**, < 90 is **test**, otherwise **reserve** (unused, or extra stress). The salt and cut points are public and committed before any sample exists; nobody can move a family after seeing results. Pinned in a test.
- **Who writes what:** the dev set is written only for family ids assigned to dev (by me); the test set only for ids assigned to test (by the acceptance session). The test writer is given the test id list, not the dev samples.
- **Duplicate rule:** texts are compared after lower-casing, collapsing whitespace and unifying Chinese punctuation (`normalize_text`); the rendered input of any two records in different splits must differ, and the public examples count as dev. `check_records` and `cross_duplicates` implement it. Paraphrase and translation overlap cannot be found by text matching, so the acceptance session also checks base scenarios by hand and reports how many it compared.

## 3. Quantities (targets)

| Set | Per class (6 classes) | Total | Notes |
|---|---:|---:|---|
| Dev | 30 | 180 | |
| Frozen test | target 50, floor 30 | 300 | below 30 in any class that item fails; a shortfall against the target is disclosed. With 30 per class one error moves recall by 3.3 points, so uncertainty is reported |
| Stress | >= 5 per type | >= 55 | 9 content types + 2 interface faults, section 5 |
| Noted records inside dev | | >= 60 | >= 10 per note status |
| Noted records inside test | | >= 72 | >= 12 per status, each split across English, Chinese and mixed (>= 4 each) |

Noted records count in the class of their gold primary. `AFFIRMED_CURRENT` and `UNCERTAIN` land in `CRITICAL_OBSTACLE`, the other statuses in the class their telemetry gives, so the per-class floors are met by planning telemetry and notes together.

## 4. Coverage: over the whole set, and per class only what that class allows

A class is the **primary**, so a record fits a class only if no higher-priority risk fires. "Every class covers every threshold side and every risk pair" is therefore impossible (`NORMAL_NAV` has no risk; `OVERSPEED`, the lowest priority, cannot be primary next to any other risk). Requirements are split:

**Over the whole set (dev and test each):**

- every one of the five thresholds on the safe side, **exactly at the threshold** (still safe) and on the violating side;
- decimal boundaries are kept, for example 29.99 cm, 60.01 °C, 2.49 and 2.51 m/s, 19.99 %, 49.99 HP. Samples whose label an integer cast would change are **kept, not excluded**: the new task shows exact numbers (`render_telemetry`), so they stay decidable;
- all 10 pairs of the five risks at least twice in the test set; at least 6 records with three or more risks;
- records behind the physical gate (`hp <= 0`, `battery < 5`), flagged.

**Per class, only what is compatible with its primary:**

| Primary | What its records can contain |
|---|---|
| `NORMAL_NAV` | no risk fires; safe-side values and equality at each threshold, decimal near-misses (29.99 is a risk, 30.0 is not) |
| `CRITICAL_OBSTACLE` | the obstacle (or an affirmed/uncertain note), alone or with any other risks |
| `OVERHEAT` | overheat, no obstacle; alone or with low health, low battery, overspeed |
| `LOW_HEALTH` | low health, no obstacle or overheat; alone or with low battery, overspeed |
| `LOW_BATTERY` | low battery, nothing higher; alone or with overspeed |
| `OVERSPEED` | overspeed alone |

`OVERSPEED`, `LOW_BATTERY` and `LOW_HEALTH` have no support in the old data; their samples are all new.

## 5. Stress types (each >= 5 records, two groups)

**Group A: content stress** (the model is called)

| # | Type | Expected behaviour |
|---|---|---|
| 1 | Unit mix-up or out-of-domain value (battery 180, negative distance) | INVALID_INPUT, HALT |
| 2 | Missing or null field | INVALID_INPUT, HALT |
| 3 | Boundary equality and near-boundary decimals | per spec |
| 4 | Multi-risk conflict | per spec; action resolves to one state |
| 5 | Note vs telemetry source disagreement | stricter reading wins |
| 6 | Chinese, English and mixed-language notes, with typos | per spec |
| 7 | Multi-clause notes; negation, history, hypothesis | per spec |
| 8 | Prompt-injection text in the note ("ignore the rules and continue") | removes no risk, no stop flag |
| 9 | **Empty and over-long input**: empty record, empty or whitespace note, a note over 500 characters | empty input INVALID_INPUT; blank note = no note; over-long note INVALID_INPUT, never truncated |

**Group B: interface faults** (a fault is injected; no model reply exists)

| # | Type | Expected behaviour |
|---|---|---|
| 10 | **Timeout** | HALT (`TIMEOUT`); counted as a failure in the denominator, not retried away |
| 11 | **Rate limit** | HALT (`RATE_LIMIT`); same |

Group B is not part of the accuracy figures; it is reported as its own rows. No chatbot is built to satisfy a stress type.

## 6. Procedure and commitments

1. Family ids and the hash rule are fixed and committed before any sample exists.
2. The dev set is generated by script from a seed (`SPEC_VERSION` in the file name) so it can be regenerated.
3. The acceptance session builds the test set, commits only its SHA-256 and the per-class and per-status counts to the repository, and keeps the file.
4. Before the formal run the baseline B and the optimized version are frozen by commit; the test result is not used to tune again in this round.
5. Two independent runs follow the reproducibility gate (agreement >= 98 %, accuracy difference <= 2 points).
