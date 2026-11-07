# Scope of the baseline-A measurement

Read this before quoting any number from a run. It is copied into every run directory and its hash is recorded in `config.json`.

## What is measured

- **The router stage only**: one model call per (row, condition). The Safety and Compiler agents, the physical gate, Cosmos, IoT Hub and the HTTP endpoint are not exercised.
- **The original code**, restored from the tag `eval-baseline-v1` (commit `a58b125`). The restored `embodied_brain/utils.py::ask_agent` makes the call. Nothing in the tagged files is edited; the harness only (a) sets the `ask_agent` cache TTL to 0 so every row is really sent, (b) swaps in a recording client, and (c) replaces `send_c2d_message` with a function that raises.
- **Two conditions, same 200 telemetry rows, interleaved row by row** (B and P alternate; the one that goes first alternates by row):
  - **B, benchmark path.** The descriptive `ROUTER_PROMPT` from `benchmark.py` and the input format of `benchmark.py`: CSV values as they are, no X, no device. This uses the prompt and input format stored in the tagged `benchmark.py`. Nothing proves that the historical runs used exactly these, so it is **not** a reproduction of them.
  - **P, business router.** The tenant-Alpha prompt from `scenario_registry.json` and the input format of the HTTP path in `brain.py`: velocity as a float, HP / battery / temperature cast with `int()` (so 39.6 becomes 39), X included, device `Simulated-Device`.
- **Spending is capped before every request**: a call that could break the call, token or dollar cap is not sent. The prompt-token bound is the UTF-8 byte count of the text plus a fixed 64-token allowance (a token covers at least one byte); the completion bound is 1024 (the `max_tokens` guard). If the API ever reports more than the reserved bound, the run stops at once and is flagged `stopped_bound_violation`. Calls with unknown usage keep their full reservation.
- Settings: temperature 0 (the `ask_agent` default both original call sites use), `max_completion_tokens=20` as the original code sends it, **plus `max_tokens=1024` as a spending guard (the only change to the original request, see below)**, **SDK retries disabled** (`max_retries=0`), a 60 s timeout, no retry of any kind in the harness. A failed call stays in the record and in the denominator.
- **Inputs:** the 200 telemetry rows of the archived `thesis-200/results.csv`, hashed. **Gold labels:** that file's `expected_label`, as it is (legacy labels).

## What is not measured, and what you may not say

- This is **not a measurement of the production pipeline.** B is the historical benchmark path. P is the business router's prompt and input format called directly through `ask_agent`, not through the HTTP endpoint (so no rate limiter, no physical gate, no fallback to another tenant config).
- It is **not comparable to the historical 94.19% (162/172) or 90.38%**: different prompt handling, different date, and the model behind the name may have changed (see below).
- 28 of the 200 rows would be stopped by the physical gate (HP <= 0 or battery < 5) before the router in production. They are included here because this is a classifier measurement; the report also gives the 172 rows that reach the router.
- The legacy labels disagree with the 30 cm safety rule for rows tagged critical at or above 30 cm. Those rows are **scored as labelled, not relabelled**; their number is reported next to the accuracy.
- Tenant-Beta's labels (`HUMAN_DETECTED`, `STATIC_OBSTACLE`, `EMERGENCY`) are not measured: the input has no basis for them and there is no gold.
- The accuracy figure is descriptive. It is not an acceptance metric and not the "X" of the resume line: X comes from the extended task on the frozen test set.

## The served model is a reasoning model

A real canary (`measured/20261107T043259Z_real_401c9ff8`) showed that the model behind the configured name thinks before it answers: 58 of 67 completion tokens were `reasoning_tokens`, and the original `max_completion_tokens=20` did not limit them. Consequences, all recorded in every run:

- Cost and latency include the hidden reasoning. The report gives reasoning tokens separately.
- The harness adds `max_tokens=1024` to every request so the output (reasoning plus text) is capped and the budget bound is real. Each call record carries `request_deviation`. If the reasoning ever exceeds the cap, the reply is cut off (`finish_reason: length`), counted as an invalid reply, and the number of such replies is reported; nothing is dropped.
- This request is therefore **not byte-identical to what the original code sends**; the difference is one added spending guard.

## Model identity

The configured name (`deepseek-v4-flash`) is a retired alias, and the API answers with another alias (`deepseek-flash`): **`response.model` cannot prove which version served a call.** The version of a run is the one the owner states when starting it (`--model-identity`, for example `DeepSeek-V4.1-Flash-1017`) and is recorded as such. A provider-side change during a run would not be visible, so runs must be short, their start and end times are recorded, and a before/after comparison is valid only between runs of the same stated version made close together in time. If `response.model` changes inside a run, `model_drift_flag` is set and the run must not be used for a comparison.

## Files in a run directory

`config.json` (everything needed to reproduce the run, no secrets), `calls.jsonl` (one line per call with the full response, headers, usage, error and latency), `summary.json`, `report.md`, `pip_freeze.txt`, `SCOPE.md`, `SHA256SUMS`. A run directory is created fresh and never overwritten.
