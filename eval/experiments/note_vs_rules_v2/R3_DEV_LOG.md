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

## Revision 2 (v2): two limited "not ahead" guards, then frozen as the candidate

`r3.py` sha256 `07ef3a74…` (`dev_runs/v2.json`). This was the last revision the plan allows.

1. A clause that mentions a person or object **in a room that is not the path** (room, office, canteen, 休息室, 办公室 ...) with no word for the way ahead is not read as a report (fixes X-34).
2. A clause with a **clock time or date** ("6 pm", "18:00", 明天) and **no word of presence** (is, standing, blocking, 站, 挡 ...) and no word for the way ahead is not read as a report (fixes X-33). Both guards are narrow on purpose: a mention with "ahead", a path word, or a presence word stays a report, because a missed halt is the more costly error.

Result on the development pool: **R3 141/142 = 0.9930** (dev 72/72, boundary 15/15, stress 20/20, extra 34/35); R1 118/142, R2 51/142 on the same pool. Remaining error: X-35 "请联系机器人维护人员。" (a request that mentions maintenance personnel; the rule cannot tell that they are not ahead, and excluding 人员 would hide a real "工作人员在通道里"). It stays as a disclosed false positive.

**These dev figures are optimistic.** The author read the public notes before drafting, wrote the extra rows, and revised on their errors. Only the holdout below was kept out of every revision.

### Holdout (written before revision 1, run once after revision 2, no change afterwards)

`dev_holdout.jsonl` sha256 `da4ef91c…`, 28 scored rows (2 disputed rows listed, not scored). **R3 24/28 = 0.8571**, R1 18/28, R2 9/28 (`dev_runs/holdout_v2.json`). One missed halt by note and two needless halts for R3. R3 errors, kept as they are:

| Id | Gold | R3 | Reading |
|---|---|---|---|
| H-04 "Earlier today a worker stood right there." | HISTORICAL | AFFIRMED_CURRENT | "stood" is a past verb with no past cue word; the rule has no verb tense |
| H-09 "前面的路已经被清理干净了。" | NEGATED | IRRELEVANT | "干净" is not in the clear-path words |
| H-21 "Cargo has been stacked in the aisle since yesterday." | AFFIRMED_CURRENT | HISTORICAL | a state that began in the past and still holds; the rule reads "yesterday" as a past cue. **This is a missed halt.** |
| H-26 "仓库二楼有工人在打扫。" | IRRELEVANT | AFFIRMED_CURRENT | workers elsewhere; the rule cannot place "2nd floor" as not ahead |

## What R3 is, in size and dependencies

234 lines of Python, 36 word lists with 314 entries in all, standard library only (`re`, `unicodedata`, `pathlib`, `sys`) plus the frozen `reference_labeler` and the marker split of `rule_control`. No model, no network, no sentence table, no id lookup. Two explicit revisions after the draft.

## Known limits (not fixed, disclosed)

- no verb tense: past events without a past cue word are read as current (H-04), and a present state that began in the past is read as past (H-21);
- no place semantics: a person or object mentioned somewhere other than the way ahead is a report unless one of the two narrow guards fires (X-35, H-26);
- word lists were written by one author; the vocabulary is the author's, in two languages; Chinese has no typo tolerance;
- an unsettled sentence is given a status (the rule must return one) and carries a flag in `explain()`; it is not removed;
- disputed examples that the specification cannot settle: X-37 to X-40 and H-10, H-20 (`dev_extra.jsonl`, `dev_holdout.jsonl`, `disputed: true`).

## Not a claim

Nothing here shows that R3 is the best rule one could write, nor how it behaves on the independent test; it is a documented effort of two revisions, frozen before any test exists.
