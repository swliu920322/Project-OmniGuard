# Annotation and review protocol for the gold note statuses

Applies to spec `0.4-candidate`. Only the **note status** needs annotating by hand: telemetry labels are computed by `reference_labeler.py`, and the final route is composed by code from the two. This protocol makes no claim of human expert labelling.

## What is called what

- Labels are produced by **AI sessions**. They are described as **"AI annotation and AI review"**, never as human expert gold labels.
- The **owner** only rules on disputed items.
- If a reviewer sees the initial label before judging, that step is a **review**, not blind independent annotation, and is never described as double-blind.

## Record for every note

For each note keep: the text and its language; the status of **each clause** about the topic; the **combined status** (by the rule in LABEL_SPEC section 8); and the **basis**, a one-line reason per clause. The combined status must equal `combine_clause_statuses` of the clause statuses (checked with `combine_clause_statuses`, as already done for the public examples).

## Who does what

| Step | Who | Sees |
|---|---|---|
| 1. Write the notes | dev notes: the tuning session; test notes: the acceptance session | its own set only |
| 2. Annotate (initial labels) | the author session | the note, the telemetry, the spec |
| 3. Review of **all** note labels | an independent second session | the note, telemetry, spec and the initial label; **never** model predictions or R1/R2 outputs |
| 4. Blind double annotation on a sample | the second session labels a random sample (>= 30 % of the test notes, at least 12 per status where available) **without** seeing the initial label | note, telemetry, spec |
| 5. Disputes | disagreements between 2/3 or 4 and the initial label | the owner rules; an item nobody can settle is **removed from the frozen test set** |

## What is reported

- For the blind sample (step 4): the number of notes, **agreement before adjudication** (raw, plus Cohen's kappa), and the list of disagreements.
- For step 3: how many initial labels the reviewer changed (this is a review change rate, not an agreement figure).
- How many items went to the owner, how they were settled, and how many were dropped as unresolvable.
- The reviewer sessions never receive model outputs or R1/R2 answers, so the gold cannot be shaped by the systems it scores.

## Limits stated up front

Both annotators are AI sessions and can share the same misreadings; high agreement shows consistency with the written rules, not correctness against an outside truth. The spec is an experimental convention for a simulation, so "correct" means "follows the specification".
