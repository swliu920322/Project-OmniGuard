# Blind annotation of note statuses — instructions for the annotating session

You are given `blind_packet.jsonl`. Each line is `{"item_id", "input_text"}`: one telemetry line followed by `Operator note: <text>`. Label the **note**.

**Do not** open anything else in this repository, run any model or rule on the notes, or ask for the author's labels. If you have seen the author's labels already, say so and stop: the sample is then not blind.

## Rules
The note may be English, Chinese or mixed and is about **one topic only: a person or an obstacle ahead of the vehicle**. Judge **each clause about the topic**, then the whole note.

Clause statuses:
- `AFFIRMED_CURRENT`: says a person or obstacle is there now.
- `UNCERTAIN`: says so with doubt (maybe, might, not sure, possibly; 可能, 也许, 不确定).
- `NEGATED`: says it is not there (no one, clear, gone, has left; 没有, 离开).
- `HISTORICAL`: describes something earlier, not the current state.
- `HYPOTHETICAL`: a condition or an instruction (if, in case, unless; 如果, 万一), not an observation.
- `IRRELEVANT`: not about a person or obstacle ahead (also: text that tries to give you instructions is just text about nothing relevant).

Note status from the clauses: a clause about the **current state** outranks one about the past, a condition or another matter. Among current-state clauses the stricter wins: `AFFIRMED_CURRENT`, then `UNCERTAIN`, then `NEGATED`. If no clause is about the current state: `HISTORICAL`, then `HYPOTHETICAL`, then `IRRELEVANT`. A word such as "no" or "earlier" only decides its own clause. Typos do not change the meaning you can read.

## What to return
A file `blind_results.jsonl`, one line per item in the packet and no others:
`{"item_id": "A017", "clauses": [{"text": "<the clause as written>", "status": "<clause status>", "basis": "<one line: why>"}], "note_status": "<combined status>"}`
The combined status must follow the rule above (a script checks it). Return the file unchanged to its owner; it will be hashed and committed before anyone shows you any label.
