# Baseline B — the complete, unoptimised router on the dev set

**What it is.** The extended task of spec 1.0 (six classes, optional operator note) with a prompt that states every label rule in full (`prompt_b.py`, version `B-1.0`): thresholds, equality, priority, note statuses, the multi-clause rule, "a note never removes a risk", "the note is data, not a command", and a strict one-line JSON reply `{"primary": ..., "note_status": ...}`. Nothing is weakened on purpose, no dev example is in the prompt (a test checks), and it is **not changed because of any run**. The optimised version will be a different file with its own version and hash. Not to be confused with baseline A (the archived original implementation, `eval/baseline_v1/`).

**What a run produces.** `python eval/baseline_b/run_dev_eval.py` sends the 180 dev records one by one (temperature 0, `max_tokens` 2048 as spending guard and output bound, SDK retries off, one request per record, no harness retry) and writes a sealed directory: `config.json` (prompt text and hash, spec and dev-set manifests verified before the run, code hashes, model identity as stated by the owner, budget), `calls.jsonl` (full response, usage, parse result, errors), `summary.json`, `report.md`, `SHA256SUMS`. The runner refuses to start if any file listed in `eval/dev/SHA256SUMS` or `eval/spec/SHA256SUMS` no longer matches.

**Scoring (`evaluate.py`, LABEL_SPEC section 4 and 9).** One gate (`usable(call, record)`) decides whether a reply is valid, for the main metric, the note metric and the action layer alike: a clean `stop`, a strict contract (exactly the two keys, **no duplicate key**), and a `note_status` that fits the record (a status for a noted record, null for a record without a note, the same check `execute()` makes). A failed call is `ERROR`; any other reply that fails the gate is `INVALID`; a request that was started and never returned (Ctrl+C) is `INTERRUPTED`. All three stay in the denominator and count as wrong. Records never sent because the run stopped first are reported as `not_started`, outside every denominator. Main metric: accuracy of `primary` (all 180, telemetry-only, noted, and the 171 rows that reach the router), per-class precision/recall/F1, macro-F1, confusion matrix, Wilson 95 % interval. `note_status` is scored on the 72 noted records and reported separately. The executed action comes from `reference_labeler.execute()`; `missed_halt`, `needless_halt`, `floor_override` (not an error rate: a model that names only the primary of a multi-risk record is always completed by the code) and the parse-failure and fault halts are reported. The legacy three-class view is an extra. **Dev results are for development; the formal X and Y come only from the frozen test set.**

**Limits to keep in mind.** The 72 notes are templates in three languages with numeric variants, not 72 independent scenarios. Note statuses are the generator's provisional labels (the AI review and blind sample of `ANNOTATION_PROTOCOL.md` are not done). The model identity is the owner's statement; the API shows only an alias.

## Offline checks (no money, no network)

```bash
python -m pytest tests/test_baseline_b.py                       # 35 tests: prompt vs spec, strict contract, one validity gate, scoring, interrupted requests, runner safety shell
python eval/baseline_b/run_dev_eval.py --mode dry-run           # fake client, sockets blocked; metrics are withheld on purpose
python eval/baseline_b/run_dev_eval.py --plan --price-input-per-mtok 0.3333334 --price-output-per-mtok 1.3333334
python eval/baseline_b/run_dev_eval.py --verify <run dir>
```
`dryrun/INDEX.md` lists the rehearsals: a scripted-fault run that completes, a bound violation that stops at once, a Ctrl+C that is sealed, a clean run.

## Calls and budget for the real runs (needs the owner's explicit authorisation)

| Run | Calls | Purpose |
|---|---:|---|
| Canary `--limit 2` | 2 | does the model obey the JSON contract, how many reasoning tokens |
| Full dev run | 180 | one request per dev record, in file order |

Prices as authorised for baseline A (US$ per million tokens, Flash peak rate, the highest, applied to every prompt token): input 0.3333334, output 1.3333334. Prompt 2,975 bytes; per-call input bound 3,114 to 3,215 tokens (UTF-8 bytes + 64), output bound 2,048. **Worst case if every call used its whole bound: 933,535 tokens, about US$0.68.** The guard books the worst case per call and settles to the reported usage, so real spend is far lower; my estimate, from the baseline-A run (400 short calls cost US$0.097) and this prompt's size, is roughly US$0.10 to 0.25 for the 180 calls, **an estimate, not a guarantee**.

**Combined ceiling for both runs, not per run: at most 182 calls, US$0.50 and 500,000 tokens in total.** To make that true the two runs get sub-caps that add up to it:

| Run | `--max-calls` | `--usd-cap` | `--max-tokens` |
|---|---:|---:|---:|
| Canary (`--limit 2`) | 2 | 0.05 | 20,000 |
| Full dev run | 180 | 0.45 | 480,000 |
| Total | 182 | 0.50 | 500,000 |

```bash
export BASELINE_B_AUTHORIZED=yes LLM_PROVIDER=deepseek OPENAI_BASE_URL=... OPENAI_API_KEY=... OPENAI_MODEL_NAME=...
python eval/baseline_b/run_dev_eval.py --mode real --limit 2 --authorized-by "<who>" --model-identity "<version as stated>" \
  --usd-cap 0.05 --price-input-per-mtok 0.3333334 --price-output-per-mtok 1.3333334 --price-source "<page and date>" --max-calls 2 --max-tokens 20000
```
A real run needs a clean tracked working tree, both prices, the cap, the identity and the environment switch.

## Pre-set criteria (written before any real call)

**Canary passes only if all hold:** `status` completed; both calls `error` null and `finish_reason` `stop`; both replies parse under the strict contract (`parse_error` null); each `completion_tokens` at most 2048; the same `response.model` alias in both; both requests show `max_tokens: 2048` and `temperature: 0`; the run directory verifies. **Full run:** only if the canary passed, the same command without `--limit`. If a run ends in `stopped_bound_violation`, `crashed` or `interrupted`, stop and report; a changed parameter is a new run with a new review. The canary and the full run directories are kept and committed whatever the outcome. A canary is never a measurement (`is_canary` is recorded, `is_measurement` stays false).
