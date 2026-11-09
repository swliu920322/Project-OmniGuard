# Implementation notes (P0): what is reused, what is new, where the plan and the code disagree

Date 2026-11-09. Scope of this commit series: P0 and P1 of [PLAN.md](PLAN.md). Offline only: no model call, no private file read, no change to `eval/spec/`, the old dev data, the old baselines, the old formal results, the frozen manifest or the old runner.

## 1. Reused as it is (imported, never copied or edited)

| Piece | File | Used for |
|---|---|---|
| Specification, gold composition, action synthesis, `execute()` | `eval/spec/reference_labeler.py` | gold route and action recomputed from telemetry + annotated note status; the executed action of every scheme goes through the same `execute()` (a code correction never earns the scheme a note point) |
| R1, R2 | `eval/spec/rule_control.py` | historical references, unchanged |
| B-1.0 prompt, message builder | `eval/baseline_b/prompt_b.py` | the fixed model scheme; the prompt is not optimised in this round |
| Scorer | `eval/baseline_b/evaluate.py` | `score_note`, `score_primary`, `score_safety`, `usable`/`outcome`/`note_outcome`/`executed`, Wilson interval |
| Budget guard, run directories, sealing, UTF-8 input bound | `eval/baseline_v1/measure/measure_lib.py` | reserve-before-send, unknown usage keeps the reservation, SHA256SUMS seal and verification |
| Recording client, call record, budget resolution, network block | `eval/baseline_b/run_dev_eval.py` | one request, SDK retries off, finish reason, usage, latency, request id, alias |
| One complete run (main loop, in-flight interruption record, bound violation stop, early stop, sealing) | `eval/formal/run_formal.py::run_once`, `make_client`, `normalize_test`, `read_jsonl` | the safety shell. **Called unchanged**; this round only adds a wrapper around it |
| Fake client for rehearsals | `eval/baseline_b/fake_model.py` | dry runs |

## 2. New in this directory

`r3.py` (the rule), `dev_eval.py`, `dev_extra.jsonl`, `dev_holdout.jsonl` (public development material written for this round), `note_analysis.py` (metrics of this round), `run_note_compare.py` (entry: `plan`, `check-data`, `freeze`, `run`, `check-health`, `analyze`), `AUTHOR_BRIEF.md`, `CUSTODIAN_GUIDE.md`, `R3_DEV_LOG.md`, `dev_runs/`, `tests/test_note_vs_rules_v2.py`.

## 3. Where the plan and the code do not fit, and the smallest adjustment

| # | Conflict | Cause | Minimal adjustment taken |
|---|---|---|---|
| 1 | `run_formal.py run` cannot run the new data | it is bound to the old manifest (M=300, class counts, `eval-formal-v1` tag, `CODE_FREEZE.json`, R1/R2 only, headline = primary route) and `load_data` checks the old data hashes | the wrapper does **not** call `run_formal.run`. It does its own preconditions (same four as `run`: switch, clean tracked tree, tag == HEAD, private directory outside the repository), its own freeze file `V2_FREEZE.json`, its own data loader (`normalize_test` + checks of this round), and then calls the **unchanged** `run_once` |
| 2 | the headline metric of `run_once` is the primary route; this round's main metric is the **note status** | `E.evaluate` puts `primary` first | nothing is changed: `run_once` still writes its own private summary and aggregate-only public summary (primary first). The round's report is produced from the sealed `calls.jsonl` by `note_analysis.py`, with the note status first. The `run_once` public summary must not be quoted as this round's result |
| 3 | `run_once` marks `is_measurement` true only for the old frozen acceptance file | it compares the data hash with the old manifest | for a new file it is `false`. The round's own summary states the status (completed, 180 started, 0 not started, data hash equals the committed hash) instead |
| 4 | the health check of PLAN §4 has no code | the old canary criteria were checked by hand | `check-health` (new) evaluates the seven listed criteria on a sealed `--limit 2` run of the **public dev file** |
| 5 | R3 is not a model, but PLAN §4 asks for its local time | `run_once` times only model requests | R3, R1 and R2 are scored in the wrapper from the same `rendered_input`; their local processing time is measured per record with `perf_counter_ns` and reported apart ("not the same kind of time as a model request") |
| 6 | the fake client answers with R1's reading | it was written for the first round | unchanged. A dry run therefore shows the pipeline, not a model; paired comparisons in tests use a patched client |
| 7 | the physical gate and the e-stop are excluded from the new main data | PLAN §3 | `check-data` rejects a record whose gate is not `PASS`; no `estop` field is accepted |
| 8 | price | the old US$0.333/1.333 per Mtok are the rates configured in round 1 | `plan` takes prices as arguments, prints `price_verified: false` unless a source and date are given, and refuses to treat the old caps as authorisation. Nothing is authorised in this round |

## 4. Boundaries kept

- No push, no deployment, no backend or frontend change, no three-agent comparison, no new visual or charging tool.
- The earlier interview material in the working tree (modified or untracked files outside this directory) is not touched and not part of these commits.
- `tests/test_docs_consistency.py` is modified in the working tree by the earlier round; it is not touched here. The new tests live in `tests/test_note_vs_rules_v2.py`.
- No key is read or printed. `/private/tmp` and `OmniGuard-private` are not accessed.
