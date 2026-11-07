# Diagnosis of the baseline-B HTTP 500s — plan (nothing here has been run against the model)

Status: offline preparation only. **No model was called for this plan.** Baseline B has not been measured. Real calls need the owner's new authorisation (section 6).

## 1. What is known

- Two baseline-B canaries (`runs/20261107T071745Z_real_ef50e6ae`, `runs/20261107T072708Z_real_55c6fa87`), 2 calls each: all four returned HTTP 500 `Internal Server Error` with no reply and no usage. The second sent the same body as the first.
- Booked (worst-case reservations; the real cost is unknown because no usage came back): 20,888 tokens, US$0.015154. Calls so far: 4.
- The baseline-A canary (`measured/20261107T045607Z_real_bb1f4b4e`) and its 400-call run succeeded earlier the same day (about 04:56 UTC). A past success does not show that the service is healthy now.

## 2. Request and configuration differences (generated from the recorded runs: `diagnose_500.py --diff`)

| Item | baseline-A canary (200 OK, 2 calls) | baseline-B canaries (HTTP 500, 4 calls in 2 runs) |
|---|---|---|
| endpoint host | api.deepseek.com | api.deepseek.com |
| model string sent | deepseek-v4-flash | deepseek-v4-flash |
| client class | openai.OpenAI(base_url, api_key) via llm_provider (restored original code) | openai.OpenAI(base_url, api_key) built directly |
| SDK retries / timeout | 0 / 60.0 s | 0 / 60.0 s |
| openai SDK version | 2.41.1 | not recorded in the B config; installed now: 2.41.1 |
| python / platform | 3.11.9 / macOS-15.7.3-arm64-arm-64bit | 3.11.9 / macOS-15.7.3-arm64-arm-64bit |
| request keys | max_completion_tokens, max_tokens, messages, model, temperature | max_tokens, messages, model, temperature |
| temperature | 0.0 | 0.0 |
| max_completion_tokens | 20 | <absent> |
| max_tokens | 1024 | 2048 |
| messages | 2 | 2 |
| system prompt bytes | 361 | 2976 |
| user input bytes / non-ASCII | 81 / False | 145 / True |
| reasoning / thinking switch sent | none (provider default) | none (provider default) |

The client, endpoint, model string, retries, timeout, SDK and Python are the same; only the B config did not record the SDK version. The differences are in the **request body**: `max_completion_tokens` (20 vs absent), `max_tokens` (1024 vs 2048), the system prompt size (361 vs 2,976 bytes) and a user input with a Chinese note. That is what the six steps separate.

## 3. Read-only checks made on 2026-11-07 (no model call)

| Check | Result | Limits |
|---|---|---|
| Account balance, `GET /user/balance` | `is_available: true`, CNY 12.48 (topped up, no grant) | the provider's own report |
| Model list, `GET /models` | `deepseek-flash`, `deepseek-v4-pro` | the configured name `deepseek-v4-flash` is **not in the list** (the docs' changelog still uses it; baseline A succeeded with it at about 04:56 UTC and the API answered with the alias `deepseek-flash`). An observation, not a finding; the model name is not changed in this diagnosis. |
| Status page, read by a fetch agent | "We're experiencing issues"; one open incident "DeepSeek Web/API Partially Unavailable", status *Monitoring* ("a fix has been implemented"), "ongoing for 22 minutes", affecting **V4 Pro API and V4.1 Flash API** and two more components | a rendered snapshot with no absolute time and possibly cached; it cannot be tied to the canaries at about 07:17 and 07:27 UTC; the history page showed no entries. It makes a service-side cause **plausible, not established**. |
| Official documentation (search summaries; pages not archived here) | Chat Completions: `max_tokens` up to 384K, default 8K non-thinking / 64K thinking. Thinking Mode: **thinking is on by default**; temperature and the penalties have no effect in it. Error Codes: a 500 is a server-side problem, retry after a wait | retrieved 2026-11-07 |

Sources (retrieved 2026-11-07): [Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/), [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/), [Error Codes](https://api-docs.deepseek.com/quick_start/error_codes/), [Status](https://status.deepseek.com/).

**Consequence for the write-ups, independent of the 500:** the request carries `temperature=0`, but with the provider's default reasoning mode the temperature has no documented effect. From now on we say "the request parameter is fixed to 0", not "the temperature is controlled". Reproducibility rests on the two-run agreement gate, not on the temperature.

## 4. The six diagnostic calls (`diagnose_500.py`)

Same client class, endpoint, model string and settings (SDK retries off, 60 s timeout) as the failed runs. Each step differs from the previous one in **exactly one thing** (a test checks this) and step 5 is the failed baseline-B request byte for byte (a test checks this too).

| Step | Only change | Why |
|---|---|---|
| 1 | none: replay a request of the baseline-A canary | does a request that worked this morning work now? **If it fails: stop.** The service state, not our request, is implicated |
| 2 | `max_tokens` 1024 -> 2048 | |
| 3 | remove `max_completion_tokens` (20) | |
| 4 | system prompt: the A one-liner -> B-1.0 | |
| 5 | user input: A's telemetry line -> the B canary input (DEV-001, Chinese note) | now identical to the failed request |
| 6 | none: replay step 1 | did the service state change while we were testing? |

The order is adaptive: if a step in 2 to 5 fails, the later changes are skipped (they could not tell us more) and the run goes to step 6. **Reading the result:** a failure right after passes is a *correlation with that change*, not proof of the cause; if step 1 fails, or step 6 fails after earlier passes, the service is implicated. The B prompt, the model, the reasoning mode and the retry setting are never changed. Everything is a diagnostic record, **not a baseline result**, and keeps requests, responses, exceptions, timestamps and budget.

## 5. Offline verification already done

12 tests (`tests/test_diagnose_500.py`): one change per step; step 1 is the A request and step 5 the failed B request; no model, thinking or prompt change; the adaptive order; the worst case fits; stop and skip behaviour; caps; refusal without authorisation, clean tree or money settings; no sockets in dry-run. Three fake-client rehearsals in `diagnostics/dryrun/`.

## 6. Budget and the authorisation needed

| | Calls | Tokens | US$ |
|---|---:|---:|---:|
| Worst case of the six steps (`--plan`) | 6 | 18,570 | 0.0164 |
| Proposed diagnosis cap | 6 | 35,000 | 0.03 |
| Already booked | 4 | 20,888 | 0.015154 |
| After the diagnosis, at most | 10 | 55,888 | 0.045 |
| Baseline-B cumulative ceiling kept | to be re-stated | 500,000 | 0.50 |

The earlier call ceiling of 184 was for two canaries and the 180-call run. Four calls are used and the diagnosis adds up to 6, so **the new authorisation must name the call ceiling** (for example 190 in total, leaving 180 for the dev run after a passing canary only if that canary is also authorised). Command, once authorised:

```bash
export BASELINE_B_DIAG_AUTHORIZED=yes LLM_PROVIDER=deepseek OPENAI_BASE_URL=... OPENAI_API_KEY=... OPENAI_MODEL_NAME=deepseek-v4-flash
python eval/baseline_b/diagnose_500.py --mode real --authorized-by "<who>" --model-identity "DeepSeek-V4.1-Flash-1017 (owner-stated, actual version unverified)" \
  --usd-cap 0.03 --max-calls 6 --max-tokens 35000 --price-input-per-mtok 0.3333334 --price-output-per-mtok 1.3333334 --price-source "<page and date>"
```

Reaching any cap, a bound violation, a crash or an interruption stops the run. Nothing is retried or continued automatically.

## 7. What each outcome would mean (decided after the run, with the owner and the reviewer)

- Step 1 fails: wait for the service; do not touch the request.
- Steps 1 to 6 all pass: the failed request works now; the earlier 500s were transient or state-dependent. A new 2-call canary needs a fresh authorisation.
- A step in 2 to 5 fails and step 6 passes: that change correlates with the 500. Propose a request change (for example the token limit) for review before any use.
- A step in 2 to 5 fails and step 6 fails: the service changed in the meantime; wait.
