# Annotation and review protocol for the gold note statuses

Applies to spec `1.0`. Only the **note status** is annotated by sessions: telemetry labels are computed by `reference_labeler.py`, and the final route is composed by code from the two. This protocol makes no claim of human expert labelling.

## What is called what

- Labels are produced by **AI sessions** and described everywhere as **"AI annotation and AI review"**, never as human or expert gold labels.
- The **owner** only rules on disputed items.
- A reviewer who sees the initial label before judging performs a **review**, not blind annotation. Only the sealed blind sample (step 4) is called blind, and it is never called double-blind for the whole set.

## Record for every note

For each note keep: the text and its language; the status of **each clause** about the topic; the **combined status** (rule in LABEL_SPEC section 8); and the **basis**, a one-line reason per clause. The combined status must equal `combine_clause_statuses` of the clause statuses (checked with that function, as already done for the public examples).

## Order of steps (the blind step comes before the reviewer sees any label)

| Step | Who | Sees |
|---|---|---|
| 1. Write the notes | dev notes: the tuning session; test notes: the acceptance session | its own set only |
| 2. Initial annotation | the author session | note, telemetry, spec |
| 3. Draw the blind sample | `annotation.stratified_sample`, fixed seed `20261107`, stratified by initial status: at least 30 % of the notes of **every** status (rounded up) and at least 4 per status (all of them if a status has fewer). The sampled ids and the seed are committed (hash) before step 4. | |
| 4. **Blind annotation, sealed** | the second session labels **only the sampled notes**, without any initial label, model prediction or R1/R2 output. Its labels are written to a file and the file's SHA-256 is committed **before step 5 starts**. | note, telemetry, spec |
| 5. Full review | the same second session is now shown the initial labels and reviews **all** notes; every change is recorded with its reason | note, telemetry, spec, initial label |
| 6. Disputes | any blind-vs-initial disagreement and any review change that the author contests goes to the owner. An item nobody can settle is **removed from the frozen test set**. | |

With the planned 72 test notes (12 per status) the sample is 4 per status, 24 in all (33 %), so the other 48 are covered only by the review. The actual proportion is recorded, and if a status has fewer than 4 notes the shortfall is reported.

## What is reported

- Blind sample (step 4): the number of notes, the sampling proportion and the per-status counts, **agreement with the initial labels before any adjudication** (raw agreement and Cohen's kappa), and the list of disagreements. If kappa cannot be computed (no items, or every label in one category) the report says so instead of showing a number.
- Review (step 5): how many initial labels the reviewer changed. This is a change rate, not an agreement figure.
- Disputes: how many went to the owner, how they were settled, how many were dropped as unresolvable.
- The reviewer never receives model outputs or R1/R2 answers, so the gold cannot be shaped by the systems it scores.

## Limits stated up front

Both annotators are AI sessions and can share the same misreadings; high agreement shows consistency with the written rules, not correctness against an outside truth. The specification is an experimental convention for a simulation, so "correct" means "follows the specification".
