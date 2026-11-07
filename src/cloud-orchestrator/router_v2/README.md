# router_v2 — the extended router in the backend (opt-in)

The same decision the evaluation measures, packaged for the backend: telemetry (+ optional operator note, + emergency-stop flag) -> one executed action.

- `rules.py`: **byte-identical copy** of `eval/spec/reference_labeler.py` (spec 1.0). A test compares the two files' hashes.
- `prompt.py`: the B-1.0 prompt and the strict reply parser, equivalent to `eval/baseline_b/prompt_b.py` (a test compares the prompt text and the parser on a corpus).
- `pipeline.py`: `decide(rec, note, call_model, estop)` — input check in code before any model call, exact numbers (no rounding, at most 2 decimals), one model call, strict parse, `rules.execute()`. `openai_model_call()` adapts an OpenAI-compatible client (one request, no retry, errors become faults).

**Switching it on.** A tenant in `scenario_registry.json` with `"router_mode": "extended"` (`Tenant-Alpha-Extended`) uses it for the Router stage of `/api/simulate_agent`; Safety and Compiler are unchanged. A request may carry `operator_note` (text) and `emergency_stop` (boolean; the only stop entry, text is never read as a stop). Tenants without `router_mode` behave exactly as before. The IoT Hub path is not switched.

**What differs from the evaluation.** In the endpoint the telemetry values come straight from the request (no `int()` cast), but the physical gate before the router still uses the endpoint's existing integer values. A live value with more than 2 decimals is rejected as out of contract, because the model could not see the exact number the code compares.

`tests/test_router_v2.py` proves that, for every dev record and several reply variants (right, lax, prose, missing key, wrong status), this path and the evaluation path return identical executed actions.
