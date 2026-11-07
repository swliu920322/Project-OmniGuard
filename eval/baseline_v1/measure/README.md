# Baseline A measurement harness

Measures the **original router** (tag `eval-baseline-v1`, commit `a58b125`) on 200 archived telemetry rows, under two conditions (B: benchmark path, P: business router), interleaved. Read `SCOPE.md` first: it says what the numbers mean and what they do not.

| File | Role |
|---|---|
| `run_baseline_a.py` | the runner (restores the original code, records every call, enforces the caps) |
| `measure_lib.py` | input formats, interleaving, budget guard, scoring, run directory and hashes (pure, unit-tested) |
| `fake_client.py` | the fake client used by the rehearsal (never opens a socket) |
| `SCOPE.md` | what is and is not measured |
| `dryrun/<run id>/` | the committed offline rehearsal. **FAKE: it measures nothing.** |

## Offline rehearsal (no network, no cost)

```bash
python eval/baseline_v1/measure/run_baseline_a.py            # restores the tag in a temporary git worktree
python eval/baseline_v1/measure/run_baseline_a.py --verify eval/baseline_v1/measure/dryrun/<run id>
python -m pytest tests/test_baseline_a_measure.py            # 24 offline tests
```

The rehearsal blocks sockets, so a stray real call fails loudly. Its fake model follows a scripted fault plan (a 429, a timeout, a malformed reply, an empty reply, a missing usage field, a model switch at request 330) so that every failure path is exercised.

## How each rule from the review is enforced

| Rule | Where |
|---|---|
| SDK retries off | the client is wrapped with `with_options(max_retries=0, timeout=60)` and the run aborts if that cannot be confirmed; recorded as `sdk_max_retries` |
| Full response kept | `calls.jsonl` stores the whole `model_dump()` of every response, the kept headers, usage, finish reason and latency |
| Budget checked **before** sending | `BudgetGuard.before()` runs ahead of each call; a call that could break a cap is never sent; failed calls keep their worst-case reservation |
| Interleaved conditions | `plan_order()`: B and P alternate per row, and who goes first alternates by row |
| Scope stated | `SCOPE.md` is copied into every run and hashed in `config.json` |
| Failures stay in the record | an error becomes a line with `error` set; it counts as wrong in the denominator; no harness retry |
| Exactly one request per call | the runner aborts if `ask_agent` ever sends zero or several requests |
| No device downlink | `send_c2d_message` is replaced by a function that raises; the run refuses to start if any IoT or Cosmos variable is set |
| Unique, verified output | each run gets a new directory (`exist_ok=False`); `SHA256SUMS` is written and checked at the end; `--verify` re-checks later |

## A real run (not authorised yet)

Do not run this without the explicit spending cap from the owner. It is shown so the reviewer can check the guards.

```bash
export BASELINE_A_AUTHORIZED=yes          # second switch; a real run refuses without it
export LLM_PROVIDER=deepseek OPENAI_BASE_URL=https://api.deepseek.com OPENAI_API_KEY=... OPENAI_MODEL_NAME=...
python eval/baseline_v1/measure/run_baseline_a.py --mode real \
  --authorized-by "<who>" --usd-cap "<amount as given>" --max-calls 400 --max-tokens 150000
```

A real run also requires a clean tracked working tree, and records `pip freeze`, the SDK version and the model string the API returns for each call.
