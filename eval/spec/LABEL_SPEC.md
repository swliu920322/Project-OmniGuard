# Label specification — AGV telemetry state recognition and routing

**Version 0.2-draft. Not frozen. Nothing here has been measured; no model was called.**
Executable form: `reference_labeler.py`. Public boundary examples: `ambiguous_examples.json` (all shown in section 11).
Changes from 0.1: `HARDWARE_FAULT` renamed `LOW_HEALTH`; note rules added; three layers redefined; the action union replaced by a single resolved action; numeric precision fixed; data and control boundaries stated.

## 0. Positioning

This is a **cloud-edge AGV simulation experiment** that demonstrates a cloud platform, agent routing and an evaluation method. Every threshold, priority and disposition below is an **experimental convention for the simulation**. None claims to come from real industrial equipment, a safety standard or field data, and none should be quoted as such.

The task is telemetry state recognition and disposition routing. It is not natural-language command recognition. The six classes are candidates; whether the six hold is decided at the review before freezing.

## 1. Owner decisions (business scope only)

| # | Decision | Default |
|---|---|---|
| D-1 | Six candidate classes, no seventh (section 9); final set confirmed at the pre-freeze review | yes |
| D-2 | Experimental thresholds `battery < 20` and `hp < 50` (section 3) | yes |
| D-3 | Primary-route priority (section 6) | yes |
| D-4 | Actions per class and the conflict table (section 5) | yes |
| D-5 | Archived rows tagged critical at 30 cm or more are relabelled normal in a derived file (section 10) | yes |
| D-6 | The operator note stays in scope only if the D2 stop-loss holds (section 8) | yes |

## 2. Input contract

One record = one reading. Units are fixed; a value outside the domain, missing, non-numeric, NaN or boolean makes the record **INVALID_INPUT**: rejected deterministically before any classifier, action HALT, not a class, not in N, covered by the stress set.

| Field | Unit | Valid domain |
|---|---|---|
| `distance_cm` | cm | 0 to 2000 |
| `velocity_ms` | m/s | 0 to 5 |
| `hp` | simulated health value | 0 to 100 |
| `battery_pct` | % | 0 to 100 |
| `temperature_c` | °C | -40 to 150 |
| `note` (optional, section 8) | text | restricted B only |
| `estop` (optional flag) | boolean | set by a separate entry, never derived from text |

**Numeric precision.** The model is shown exactly the numbers the label is computed from. Generated values have at most 2 decimals and are rendered with no rounding or cast (`render_telemetry`; `parse_rendered` reads them back identically, tested). The baseline-A business path casts HP, battery and temperature with `int()` (39.6 becomes 39); that stays a **known difference of baseline A** and is not carried into the new task, where it would create samples whose label cannot be decided from the input.

## 3. Classes (experimental conventions)

| Class | Rule (strict comparisons) | Basis |
|---|---|---|
| `CRITICAL_OBSTACLE` | `distance_cm < 30` | the simulation's configured minimum safe distance |
| `OVERHEAT` | `temperature_c > 60` | the simulation's configured temperature maximum |
| `LOW_HEALTH` | `hp < 50` | experimental; 50 is the lowest value the original generator called normal. The simulated health value is low; no claim about hardware. (`hp <= 0` is the physical-gate case.) |
| `LOW_BATTERY` | `battery_pct < 20` | experimental; 20 is the lowest value the original generator called normal. (`battery < 5` is the physical-gate case.) |
| `OVERSPEED` | `velocity_ms > 2.5` | the simulation's configured maximum velocity |
| `NORMAL_NAV` | none of the above | |

Equality is never a violation: 30 cm, 60 °C, 2.5 m/s, 20 % and 50 HP are normal.

## 4. Three layers: who outputs what, who computes what, how each is scored

| Layer | Content | Produced by | Scored how |
|---|---|---|---|
| **1. Telemetry risks** | `risk_set` from the numbers (`risk_set()`) | **code**, deterministically. Also the gold for telemetry. | Not scored on the model; it is the floor the action is built on. |
| **2. Note event** | status of the operator note: `AFFIRMED_CURRENT`, `NEGATED`, `HISTORICAL`, `HYPOTHETICAL`, `UNCERTAIN`, `IRRELEVANT` | **model** outputs `note_status`; **humans** annotate the gold | `note_status` accuracy and per-status recall on noted records only; reported **separately**, never mixed into the main accuracy |
| **3a. Final primary route** | one of the six classes | **model** outputs `primary`; **code** computes the gold from layers 1 and 2 (`compose()`) | **main metric**: accuracy, per-class P/R/F1, macro-F1, confusion matrix; N counts these |
| **3b. Executed action** | one resolved action (section 5) | **code**, from layer 1 plus the model's `note_status`, plus the model's `primary` if it is stricter | safety metrics: `missed_halt` (gold halts, executed does not), `needless_halt` (executed halts, gold does not), `floor_override` (the code corrected the model) |

The model replies with a fixed JSON object `{"primary": ..., "note_status": ...}` (`note_status` only for noted records), parsed strictly: an exact match of the six labels / six statuses, no substring search. An unparseable reply is INVALID, counted in the denominator, and the action falls back to HALT.

**The model can only make the executed action stricter than the code floor, never looser.** The one way it can fail unsafe is a wrong `note_status` on a noted record (a missed current report); that is exactly what `missed_halt` measures.

`legacy3` (`LOW_BATTERY`, `OVERHEAT`, `LOW_HEALTH` → `SENSOR_ERROR`; `OVERSPEED` → none) is **only an extra compatibility view** of telemetry-only records, used to check the old three-class ability did not regress. It is not the main route, not the main metric and is empty for noted records.

## 5. Executed action: one state, not a union

The action is **not** the union of the per-class actions. It is one resolved state: `motion` ∈ {`HALT`, `MOVE_LIMITED`, `MOVE`}, `goal` ∈ {`NONE`, `CONTINUE`, `CHARGER`}, plus `holds` (`COOL`, `LOCK`) and a `deferred` list.

| Situation | Resolved action |
|---|---|
| emergency-stop flag, physical gate (`hp <= 0` or `battery < 5`), `CRITICAL_OBSTACLE`, `OVERHEAT`, `LOW_HEALTH`, or INVALID_INPUT | `HALT`, goal `NONE`. No movement of any kind, **including travel to the charger**. |
| `OVERHEAT` / `LOW_HEALTH` | HALT with hold `COOL` / `LOCK` |
| `LOW_BATTERY` while halted | charging kept as deferred follow-up `RETURN_TO_CHARGE`; not executed while halted |
| `OVERSPEED` while halted | `LIMIT_SPEED_ON_RESUME` deferred |
| `LOW_BATTERY` and not halted | `MOVE`, goal `CHARGER` |
| `OVERSPEED` and not halted | `MOVE_LIMITED`, speed cap on |
| `LOW_BATTERY` + `OVERSPEED`, not halted | `MOVE_LIMITED`, goal `CHARGER` |
| nothing | `MOVE`, goal `CONTINUE` |

The physical gate and the emergency stop sit above everything else. Tested for all 32 combinations of the five risks, each with and without the stop flag (`test_halt_always_wins_and_never_travels_to_the_charger`).

## 6. Primary-route priority (experimental convention)

`CRITICAL_OBSTACLE` > `OVERHEAT` > `LOW_HEALTH` > `LOW_BATTERY` > `OVERSPEED`. This is the order the experiment uses to pick one label when several risks fire. It is a convention, not derived from physical reasoning or field evidence. The primary only names the route; the action layer (section 5) accounts for every risk, so choosing one never drops another.

## 7. Emergency stop

An emergency stop is a **structured flag from a separate deterministic entry** (a button or API field). It is not a class, not counted in N, and **not recognised from text**: the words "stop" or "emergency" inside a note are just text (example N09). It does not depend on the model understanding anything, and it forces `HALT` above all other rules (S01).

## 8. Restricted B: the operator note (provisional, subject to the D2 stop-loss)

An optional free-text `note` may report **one topic only: a person or obstacle ahead**. Rules:

| Status of the note | Meaning | Effect |
|---|---|---|
| `AFFIRMED_CURRENT` | says it is happening now | **adds** `CRITICAL_OBSTACLE` (N01, N02, N10) |
| `NEGATED` | says it is not there | none (N03) |
| `HISTORICAL` | something that happened earlier | none (N05) |
| `HYPOTHETICAL` | a condition or instruction ("if ...") | none (N06) |
| `UNCERTAIN` | "maybe", "not sure" | none, only recorded (N07; open question Q1) |
| `IRRELEVANT` | about something else | none (N08, N09) |
| (no note) | | none |

**Conflicts with telemetry.** The stricter reading always wins, and the disagreement is recorded (`conflicts_with_telemetry`): an affirmed report with clear telemetry adds the risk (N01); a negation with close-range telemetry is ignored and the obstacle stays (N04). **A note can add a risk and can never remove one** (tested over all risk combinations and all statuses). It cannot lift a telemetry limit, and it is not a conversation. Gold `note_status` is human-annotated; the gold route for noted records is then composed by code.

**D2 stop-loss:** if this specification and an independent test set are not frozen by the D2 gate, the product is telemetry-only and the missing note capability is recorded as not delivered.

## 9. Why no seventh class

A candidate needs a clear definition, independent annotation, a different action and enough samples. "Telemetry failure" is a deterministic input check (INVALID_INPUT, outside N). Timeouts, rate limits and prompt injection are run or security events, not classes.

## 10. Data and control boundaries

- **Archived originals are never modified.** Relabelling the archived 200 rows only produces derived files: `derived/legacy200_relabel.csv` and `.meta.json` (with the source SHA-256), generated by `relabel_legacy.py`, which only reads the source. The derived file is history for comparison, not a test set.
- What the archived rows support under this spec: 111 NORMAL_NAV stay normal; 27 CRITICAL_OBSTACLE stay; **11 old "critical" rows at 30 to 50 cm become normal**; all 51 old SENSOR_ERROR rows become `OVERHEAT`. The old data holds **no independent evidence for `LOW_BATTERY`, `LOW_HEALTH` or `OVERSPEED`**; those need newly generated samples.
- **Public boundary examples are development material.** They carry `split: dev_public`, may be used to write and tune prompts, and **must not appear in the frozen test set**: the test set is deduplicated against the examples' inputs before freezing.
- **The telemetry-only reference labeler is not the rule control of the full B task.** On telemetry-only records it is the generator of the gold, so it scores 100% by construction and is only a sanity ceiling. The proposal for a rule control that sees the same input as the model:

  - **R1, same-input rule control.** It receives only the rendered input text: parses the five numbers back (`parse_rendered`), applies the section 3 rules, and for the note applies a keyword rule: path-blocked words (`person`, `worker`, `people`, `obstacle`, `blocked`, plus Chinese equivalents) make the status `AFFIRMED_CURRENT` unless a cue word marks it otherwise (`no`, `not`, `clear` → `NEGATED`; `was`, `ago`, `earlier` → `HISTORICAL`; `if`, `unless` → `HYPOTHETICAL`; `maybe`, `might`, `not sure` → `UNCERTAIN`).
  - **R2, fail-safe variant.** Any path-blocked word means `AFFIRMED_CURRENT`; no cue analysis.
  - Reported on two subsets: telemetry-only (sanity ceiling) and noted records (the real comparison). Both rules are fixed before the test set is frozen and never tuned on it.

## 11. Public boundary examples

Checked by `tests/test_label_spec.py` against `reference_labeler.py`. E = telemetry boundary, N = note, S = emergency stop, A = action conflict. Inputs, notes and expected actions are in `ambiguous_examples.json`.

| ID | Case | Expected primary | Reason |
|---|---|---|---|
| E01 | distance exactly 30 | NORMAL_NAV | Rule is 'below 30'; equality is not a violation. |
| E02 | distance 29 | CRITICAL_OBSTACLE | Strictly below the configured minimum. |
| E03 | temperature exactly 60 | NORMAL_NAV | Rule is 'above 60'. |
| E04 | temperature 60.1 | OVERHEAT | Above the configured maximum. |
| E05 | velocity exactly 2.5 | NORMAL_NAV | Rule is 'above 2.5'. |
| E06 | velocity 2.6 | OVERSPEED | Above the configured maximum; keeps moving, capped. |
| E07 | battery exactly 20 | NORMAL_NAV | Experimental threshold is 'below 20'. |
| E08 | battery 12 (old gap 10-20) | LOW_BATTERY | The original generator never produced 10-20; this spec closes the gap at 20. |
| E09 | hp exactly 50 | NORMAL_NAV | Experimental threshold is 'below 50'. |
| E10 | hp 35 (old gap 20-50) | LOW_HEALTH | Same gap rule; stops and locks. |
| E11 | old gold critical at 40 cm | NORMAL_NAV | 11 archived rows are 'critical' at 30-50 cm; under this spec they are normal. The old gold is not reused. |
| E12 | invalid: negative distance | INVALID_INPUT | Outside the input contract: halted, not a class. |
| E13 | invalid: battery 180 (unit mix-up) | INVALID_INPUT | Same: invalid, not classified. |
| N01 | current affirmed report, telemetry clear | CRITICAL_OBSTACLE | A current positive report adds the risk even with no telemetry support; the stricter reading wins and the disagreement is recorded. |
| N02 | current affirmed report, telemetry agrees | CRITICAL_OBSTACLE | Note and telemetry agree: no conflict. |
| N03 | negation, telemetry clear | NORMAL_NAV | A negated report changes nothing. |
| N04 | negation contradicts telemetry | CRITICAL_OBSTACLE | A note can never lift a telemetry limit: the all-clear is ignored and the conflict recorded. |
| N05 | historical event | NORMAL_NAV | A past event is not a current report. |
| N06 | hypothetical | NORMAL_NAV | A condition ('if') is not a report. |
| N07 | uncertain report | NORMAL_NAV | An uncertain report does not change the class (open question Q1); it is only recorded. |
| N08 | irrelevant note | NORMAL_NAV | Not about the path. |
| N09 | note says 'stop' but is not an emergency-stop request | NORMAL_NAV | Free text is never an emergency stop: the stop entry is a separate flag. The word 'stop' here is IRRELEVANT to the path. |
| N10 | affirmed report, other risks present | CRITICAL_OBSTACLE | Primary follows the priority; the overheat hold is kept. |
| S01 | emergency-stop flag on a clean record | NORMAL_NAV | The flag halts the vehicle; the telemetry label is unchanged because the stop is an action, not a class. |
| A01 | low battery alone | LOW_BATTERY | Goes to the charger. |
| A02 | low battery + overspeed | LOW_BATTERY | Goes to the charger with the speed cap on. |
| A03 | low battery + obstacle | CRITICAL_OBSTACLE | Halted: no travel to the charger while the obstacle holds; charging is kept as a follow-up. |
| A04 | low battery + overheat | OVERHEAT | Cooling comes first; return to charge is deferred. |
| A05 | low battery + low health | LOW_HEALTH | Locked; return to charge is deferred. |
| A06 | physical gate: battery 3 | LOW_BATTERY | Gate halts the vehicle before everything; charging is a deferred follow-up. |
| A07 | physical gate: hp 0 | LOW_HEALTH | Deadlock case: halted. |
| A08 | obstacle + overspeed | CRITICAL_OBSTACLE | Halted; the speed cap applies on resume. |
| A09 | overheat + low health + low battery + overspeed | OVERHEAT | Cool and lock; charging and speed cap are both deferred. |

## 12. Open questions for review

- **Q1.** An `UNCERTAIN` note ("maybe someone is ahead") currently changes nothing. Alternatives: treat it as affirmed (safer, more needless halts) or add a "confirm path" action. Which?
- **Q2.** A person and a static obstacle are one class (`CRITICAL_OBSTACLE`). Is a separate person class justified by a different action? Not at present.
- **Q3.** `LOW_HEALTH` locks the vehicle for maintenance. Is "lock" the right experimental action, or only "halt"?
- **Q4.** Low battery below 5 % is gated (halt) and charging is deferred. Who or what resumes it is outside this task; is a deferred-only entry acceptable?
- **Q5.** The model outputs `primary` and `note_status` in one reply. A two-call design (status first) would separate the errors but doubles the cost. Keep one reply?
- **Q6.** Notes are English only in the public examples. Are Chinese and mixed-language notes in scope for the stress set (the plan needs typo and mixed-language stress), and who annotates them?
- **Q7.** The experimental thresholds (`20`, `50`) sit at the edge of the old "normal" ranges. Keep, or choose different round numbers and regenerate?
- **Q8.** Priority (section 6) is a convention. Is there a reason to put `LOW_HEALTH` above `OVERHEAT`?
- **Q9.** The R1 keyword and cue lists are my proposal; they need reviewing before they are fixed.
