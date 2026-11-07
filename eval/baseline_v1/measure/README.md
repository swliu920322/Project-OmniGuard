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
python -m pytest tests/test_baseline_a_measure.py            # offline tests
```

The rehearsal blocks sockets, so a stray real call fails loudly. Its fake model follows a scripted fault plan (a 429, a timeout, a malformed reply, an empty reply, a missing usage field, a model switch at request 330) so that every failure path is exercised.

## How each rule from the review is enforced

| Rule | Where |
|---|---|
| SDK retries off | the client is wrapped with `with_options(max_retries=0, timeout=60)` and the run aborts if that cannot be confirmed; recorded as `sdk_max_retries` |
| Full response kept | `calls.jsonl` stores the whole `model_dump()` of every response, the kept headers, usage, finish reason and latency |
| Calls, tokens and dollars capped **before** sending | `BudgetGuard.reserve()` books the worst case ahead of each call and refuses if any of the three caps would break. The dollar cap needs prices (`--price-input-per-mtok`, `--price-output-per-mtok`, `--price-source`), recorded in `config.json`; the input price is applied to every prompt token |
| Token bound with a stated basis | prompt tokens <= UTF-8 bytes of the text + 64 (a token covers at least one byte); completion <= 20. The API's reported usage is checked against it after every call |
| A wrong bound stops the run | if reported usage exceeds the reservation the overrun is booked as it was and the run stops with `stopped_bound_violation` (exit code 3) |
| Reasoning model | the real canary showed hidden reasoning tokens that `max_completion_tokens=20` does not limit; the runner adds `max_tokens=1024` to every request (the one deviation, recorded as `request_deviation`) and reserves 1024 output tokens |
| Model version | `--model-identity` is required for a real run and recorded; the API only reports an alias (`response.model`) |
| Unknown usage keeps the reservation | a failed call, a missing usage field or an interrupted request never frees budget |
| Interruption keeps the evidence | Ctrl+C, SIGTERM or a crash seal the run as `interrupted` / `crashed`: the in-flight request is recorded with its reservation, the summary and `SHA256SUMS` are written, the temporary worktree is removed |
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
# prices: copy them from the provider's price page and say where and when (the cache-miss input price)
export LLM_PROVIDER=deepseek OPENAI_BASE_URL=https://api.deepseek.com OPENAI_API_KEY=... OPENAI_MODEL_NAME=...
python eval/baseline_v1/measure/run_baseline_a.py --mode real \
  --authorized-by "<who>" --model-identity "<exact version, as stated by the owner>" --usd-cap "<positive amount in USD>" \
  --price-input-per-mtok "<USD per million>" --price-output-per-mtok "<USD per million>" \
  --price-source "<page and date>" --max-calls 400 --max-tokens 150000
```

A real run also requires a clean tracked working tree, and records `pip freeze`, the SDK version and the model string the API returns for each call.

## Canary, then the full run: fixed criteria

The sequence for the real measurement, with the criteria set in advance so nothing is judged after the fact:

1. **Canary**: the same command with `--limit 1` (2 real calls, a few thousandths of a dollar). It passes only if **all** of these hold: `status` is `completed`; both calls have `error` null and `finish_reason` `stop`; each reply, stripped and upper-cased, is one of the three labels; each `usage.completion_tokens` is at most 1024; `response.model` is the same alias in both; `calls.jsonl` shows `max_tokens: 1024` in both requests; the run directory verifies.
2. **Full run**: only if the canary passed, the same command without `--limit`. Interleaved, 400 calls at most.
3. If either run ends in `stopped_bound_violation`, `crashed` or `interrupted`, stop and report; do not change a parameter and continue. A change is a new run with its own directory and a new review.
4. The canary and its directory are kept and committed whatever the outcome.
