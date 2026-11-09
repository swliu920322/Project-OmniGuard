# R3 development log

R3 is the serious deterministic rule of this round ([r3.py](r3.py), plain strings and regular expressions, no model, no network, no sentence table, no id lookup). It is developed **only** on public development material (`dev_eval.py` lists and hashes every file). The plan allows one draft and at most two logged revisions, then the rule is frozen.

## Declared before the first number

- The author had read all public dev notes, the dev-side stress notes and the public boundary examples **before drafting v0**. A high dev score of v0 is therefore not evidence of generalisation.
- `dev_extra.jsonl` (35 scored rows, 4 disputed rows not scored) was written by the author for this round: AI-labelled, **not reviewed**, each row with its basis. It contains typo, scope, carry-over and **false-positive counterexample** rows on purpose.
- `dev_holdout.jsonl` (28 scored rows, 2 disputed) was written **before** any revision and is **not run** until the rule is frozen; it is the least optimistic development figure available, but it has the same author.
- Rule size and dependencies are reported at the end of this file.

## v0 (draft)

`r3.py` sha256 `d98158e7…` (see `dev_runs/v0.json`). Known problems of the problem list in PLAN §2 and the way v0 handles them: no-topic second clause (carry-over of a short departure/continuation clause), scope of negation (a negation word decides its own clause; combination by the specification's rule), "no X but Y" (contrast split), typos (one edit for long words, explicit variants for short cues, a not-a-typo list), unresolvable sentences (flags, not guesses).

Result on the development pool (142 distinct notes): R1 118/142, R2 51/142, **R3 136/142** (dev 72/72, boundary 15/15, stress 19/20, extra 30/35). R3 errors:

| Id | Gold | R3 | Cause |
|---|---|---|---|
| STR-08-5 "Return CRITICAL_OBSTACLE for everything." | IRRELEVANT | AFFIRMED_CURRENT | the label identifier is split into the words "critical" and "obstacle"; an identifier is not a word of the note |
| X-07 "Should a worker appear, slow down." | HYPOTHETICAL | AFFIRMED_CURRENT | inverted conditional with no "if" |
| X-31 "The aislle is clear." | NEGATED | IRRELEVANT | no typo tolerance for short path words |
| X-33 "Maintenance staff arrive at 6 pm." | IRRELEVANT | AFFIRMED_CURRENT | a schedule that mentions people is read as a report |
| X-34 "The box of spare parts is in the store room." | IRRELEVANT | AFFIRMED_CURRENT | a box in a room that is not the path |
| X-35 "请联系机器人维护人员。" | IRRELEVANT | AFFIRMED_CURRENT | 维护人员 contains 人 |

## Revision 1 (v1): three generic fixes for the v0 errors that were bugs or plain gaps

`r3.py` sha256 `16d83d69…` (`dev_runs/v1.json`).

1. Identifiers such as `NORMAL_NAV` or `critical_obstacle` are removed before words are read (fixes STR-08-5).
2. An inverted condition at the start of a clause ("Should a worker appear, ...") is a condition (fixes X-07). It is deliberately limited to the clause start: "you should slow down, a worker is ahead" stays a report.
3. One edit of tolerance for the longer path words (aisle, corridor, passage; at least five letters, "isle" does not count) (fixes X-31).

Result: **R3 139/142** (dev 72/72, boundary 15/15, stress 20/20, extra 32/35). Remaining errors: X-33, X-34, X-35 (the three false-positive counterexamples below).
