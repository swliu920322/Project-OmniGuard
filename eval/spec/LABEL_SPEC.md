# Label specification — AGV telemetry state recognition and routing

**Version 0.1-draft. Not frozen. For owner review (business scope and key dispositions) and technical acceptance.**
Executable form: `reference_labeler.py` (same rules as code). Checked examples: `ambiguous_examples.json`. Nothing here has been measured.

## What is "intent" here

The task is **telemetry state recognition and disposition routing**: from one structured reading of an AGV, decide which handling path applies. It is not natural-language command recognition. The classifier (the Router agent) picks a class; the class selects the disposition.

## Owner decisions needed (the only items that need your judgement)

| # | Decision | My default | Why it matters |
|---|---|---|---|
| D-1 | Six classes (below), no seventh | yes | A seventh class needs an independent rule and a different disposition. None qualifies now (see section 8). |
| D-2 | Policy thresholds `battery < 20` and `hp < 50` | yes | Not physical facts: they are the lowest values the original generator called normal, so old "normal" rows stay normal. Changing them changes the dataset. |
| D-3 | Primary-route priority: obstacle > overheat > hardware fault > low battery > overspeed | yes | Decides the label when several risks occur together (section 5). |
| D-4 | Dispositions per class (section 4) | yes | They are the business meaning of each class. |
| D-5 | Old "critical at >= 30 cm" rows are relabelled normal, the old gold is not reused | yes | 11 of 200 old rows disagree with the 30 cm rule. |
| D-6 | The optional operator note (restricted B) is in scope only if the D2 stop-loss holds (section 7) | yes | Otherwise the product ships telemetry-only and the limitation is stated. |

## 1. Input contract

One record = one reading. Units are fixed; anything outside the domain is **INVALID_INPUT**, rejected deterministically before any classifier (disposition STOP, not a class, not counted in N, tested in the stress set).

| Field | Unit | Valid domain | Source field in the current code |
|---|---|---|---|
| `distance_cm` | cm | 0 to 2000 | `obstacle` |
| `velocity_ms` | m/s | 0 to 5 | `velocity` |
| `hp` | points | 0 to 100 | `hp` |
| `battery_pct` | % | 0 to 100 | `battery` |
| `temperature_c` | °C | -40 to 150 | `temperature` |
| `x`, `device_id` | | | passed through, carry no label information |
| `note` (optional, section 7) | text | | restricted B only |

Missing, non-numeric, NaN or boolean values are invalid. The current router sees HP, battery and temperature after `int()` casts (39.6 becomes 39); the label is defined on the **uncast** values, and the integer cast is a known difference reported, not hidden.

## 2. Classes

| Class | Rule (strict comparisons) | Origin |
|---|---|---|
| `CRITICAL_OBSTACLE` | `distance_cm < 30` | runtime safety rule, minimum safe distance |
| `OVERHEAT` | `temperature_c > 60` | runtime safety rule, temperature maximum |
| `HARDWARE_FAULT` | `hp < 50` | policy threshold D-2 (hp <= 0 is the deadlock the physical gate already catches) |
| `LOW_BATTERY` | `battery_pct < 20` | policy threshold D-2 (below 5 the physical gate stops the vehicle) |
| `OVERSPEED` | `velocity_ms > 2.5` | runtime safety rule, maximum velocity |
| `NORMAL_NAV` | none of the above | |

Equality is never a violation: 30 cm, 60 °C, 2.5 m/s, 20 % and 50 HP are all normal (examples E01, E03, E05, E07).

## 3. Three label layers

| Layer | Definition | Used for |
|---|---|---|
| `risk_set` | every rule above that fires, in priority order | what must be handled; the disposition always covers all of them |
| `primary` | the first element of `risk_set`, or `NORMAL_NAV` | **the class the classifier is scored on**; N counts these final classes |
| `legacy3` | compatibility view (section 6) | checking that the old three-class ability did not regress |

The model is asked for **one label** (`primary`). It is never scored on `risk_set` alone, but the safety check (section 9) looks at the disposition of all risks.

## 4. Dispositions

| Class | Disposition | Meaning |
|---|---|---|
| `NORMAL_NAV` | CONTINUE | no action |
| `CRITICAL_OBSTACLE` | STOP | immediate stop, then safety review |
| `OVERHEAT` | STOP_AND_COOL | stop, wait for the temperature to fall |
| `HARDWARE_FAULT` | STOP_AND_LOCK | stop, lock for maintenance |
| `LOW_BATTERY` | RETURN_TO_CHARGE | go to the charger; below 5 % the physical gate stops the vehicle first |
| `OVERSPEED` | LIMIT_SPEED | cap the speed |
| any `INVALID_INPUT` | STOP | unreadable telemetry is treated as unsafe |

The final disposition of a record is the union over its `risk_set`. Choosing a primary never drops another danger (E10, E11).

## 5. Priority, with the reason

`CRITICAL_OBSTACLE` > `OVERHEAT` > `HARDWARE_FAULT` > `LOW_BATTERY` > `OVERSPEED`.
Ordered by how soon the harm lands and whether the vehicle can still act: a close obstacle is a collision in seconds; overheating is a fire or damage in minutes; a hardware fault removes control; low battery is an operational loss; overspeed is corrected by a cap without stopping. This ordering is a business judgement (D-3), not a technical fact.

## 6. Old-to-new table

| Old class | New classes | Note |
|---|---|---|
| `NORMAL_NAV` | `NORMAL_NAV` | |
| `CRITICAL_OBSTACLE` | `CRITICAL_OBSTACLE` | threshold now exactly 30 cm |
| `SENSOR_ERROR` | `LOW_BATTERY`, `OVERHEAT`, `HARDWARE_FAULT` | the old class mixed three causes |
| (none) | `OVERSPEED` | the old task had no such class |

`legacy3` view: `LOW_BATTERY`, `OVERHEAT`, `HARDWARE_FAULT` map to `SENSOR_ERROR`; `OVERSPEED` maps to nothing and is **excluded** from the compatibility check.

**What the old data can and cannot support** (from relabelling the 200 archived rows with the reference rules):

| Old gold | New primary | Rows |
|---|---|---|
| `NORMAL_NAV` | `NORMAL_NAV` | 111 |
| `CRITICAL_OBSTACLE` | `CRITICAL_OBSTACLE` | 27 |
| `CRITICAL_OBSTACLE` | `NORMAL_NAV` (distance 30 to 50 cm) | 11 |
| `SENSOR_ERROR` | `OVERHEAT` | 51 |

All 51 old sensor-error rows are overheating cases. The old data has **no independent evidence for `LOW_BATTERY` or `HARDWARE_FAULT`** and none for `OVERSPEED`. Those classes need newly generated samples; the old 200 rows are history, not a test set.

## 7. Restricted B: the optional operator note (provisional, subject to the D2 stop-loss)

Scope kept narrow so it can only make the vehicle safer:

- An optional free-text `note` may be attached to a record. It is a **report of an event or a request**, never a command that overrides telemetry.
- It **cannot lift** any telemetry-derived risk. A note saying "all clear" changes nothing.
- It may **add** a risk: a note reporting a person or an obstacle ahead makes the record `CRITICAL_OBSTACLE` even at a large distance. Gold labels for noted records follow this rule and are labelled by a human, not by `reference_labeler.py`.
- No conversation. An emergency-stop request has a **deterministic entry that does not go through the model**; it is not a class and not counted in N.
- **D2 stop-loss:** if this label specification and an independent test set are not frozen by the D2 gate, the product is telemetry-only and the missing note capability is recorded as not delivered.

## 8. Why there is no seventh class

A candidate must have a clear definition, independent annotation, a different disposition and enough samples. "Telemetry failure" (missing, stale, contradictory readings) has a disposition (STOP) but is a **deterministic input check**, not something a classifier should decide, so it is INVALID_INPUT, outside N. Timeouts, rate limits and prompt injection are run or security events, not intents.

## 9. Scoring and safety rules (preview; full protocol in the next document)

- Accuracy, per-class precision/recall/F1, macro-F1 and the confusion matrix are on `primary`. Errors, invalid replies and truncated replies stay in the denominator; no retry hides a first failure.
- **Strict parsing**: after stripping and upper-casing, the reply must equal one of the six labels. Substring matching (the current `"SENSOR_ERROR" in reply`) is not accepted.
- **Safety check**: a record whose disposition includes any stop must never end in CONTINUE or LIMIT_SPEED. An unparseable reply falls back to STOP and is counted as invalid, not correct.
- Thresholds are in `THRESHOLDS`; changing one is a new spec version and invalidates earlier labels.

## 10. Ambiguity examples

Checked by `tests/test_label_spec.py` against `reference_labeler.py`. Full inputs in `ambiguous_examples.json`.

| ID | Case | Expected primary | Reason |
|---|---|---|---|
| E01 | boundary: distance exactly 30 | NORMAL_NAV | The rule is 'below the minimum 30 cm'; 30 is not below. |
| E02 | boundary: distance 29 | CRITICAL_OBSTACLE | Strictly inside the minimum safe distance. |
| E03 | boundary: temperature exactly 60 | NORMAL_NAV | The rule is 'maximum 60 C'; 60 does not exceed it. |
| E04 | boundary: temperature 60.1 | OVERHEAT | Above the maximum. |
| E05 | boundary: velocity exactly 2.5 | NORMAL_NAV | The rule is 'max 2.5 m/s'; 2.5 is allowed. |
| E06 | boundary: velocity 2.6 | OVERSPEED | Above the maximum. |
| E07 | boundary: battery exactly 20 | NORMAL_NAV | Policy threshold is 'below 20'. |
| E08 | gap zone: battery 12 (between the old 10 and 20) | LOW_BATTERY | The original generator never produced 10-20; the spec closes the gap at 20. |
| E09 | gap zone: hp 35 (between the old 20 and 50) | HARDWARE_FAULT | Same gap rule, threshold 50. |
| E10 | conflict: obstacle and overheat | CRITICAL_OBSTACLE | Collision is the nearest consequence; OVERHEAT stays in the risk set so the cool-down is not lost. |
| E11 | conflict: low battery and overspeed | LOW_BATTERY | Energy outranks speed; LIMIT_SPEED stays in the disposition. |
| E12 | gate: battery 3 reaches no router in production | LOW_BATTERY | Still labelled LOW_BATTERY; gate=SKIP says production never asks the router. |
| E13 | gate: hp 0 | HARDWARE_FAULT | hp<=0 is the deadlock case; gate=SKIP. |
| E14 | legacy conflict: 40 cm labelled critical in the old data | NORMAL_NAV | 11 old rows are critical at >= 30 cm; under this spec they are normal. Old gold is not reused. |
| E15 | invalid: negative distance | INVALID_INPUT | Outside the input contract: rejected before any classifier, disposition STOP, not a class. |
| E16 | invalid: battery above 100 (unit mix-up, 0.8 vs 80 style) | INVALID_INPUT | Same: invalid, not classified. |
