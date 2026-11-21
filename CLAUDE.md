# CLAUDE.md

## What this repository is

A research and engineering demonstrator, not a robot-control product: a simulated AGV dashboard (Next.js), a cloud agent pipeline (Azure Functions / FastAPI), Azure Bicep templates, and a state-routing evaluation under `eval/`. Everything about vehicles is simulated. `README.md` and `docs/evidence/README.md` define which numbers may be quoted and how.

## Commands

Run from the repository root. The backend virtualenv is `src/cloud-orchestrator/.venv` (gitignored); create it with `python3 -m venv src/cloud-orchestrator/.venv && src/cloud-orchestrator/.venv/bin/pip install -r src/cloud-orchestrator/requirements.txt pytest`.

```sh
src/cloud-orchestrator/.venv/bin/python -m pytest tests -q                     # full suite, no network, no key
src/cloud-orchestrator/.venv/bin/python -m pytest tests/test_router_v2.py::test_name -q   # one test
src/cloud-orchestrator/.venv/bin/python -m pytest tests/test_docs_consistency.py -q       # run after editing any public doc
```

`pyproject.toml` sets `-x`, so pytest stops at the first failure. `make test` runs the same tests from `src/cloud-orchestrator`.

- Backend: `make start-backend` (Azure Functions Core Tools `func`, port 7071; needs `src/cloud-orchestrator/local.settings.json`, copied from `local.settings.example.json`).
- Frontend: `make start-frontend` (Next.js, port 3000; `npm run dev|build` inside `src/client-edge`). `/dashboard/theorem` and `/dashboard/compare` are browser-only; `/dashboard/live` calls the backend and may incur model charges.
- `make provision|destroy|deploy-aca|patch-env|trigger-ci` change real Azure or GitHub state. Do not run them without the user asking.
- Free offline checks of published evidence are listed in `eval/REPRODUCE.md` (Level 1), for example `(cd eval/formal/results && shasum -a 256 -c SHA256SUMS)`.

## Architecture (needs several files to see)

**Request path.** `POST /api/simulate_agent` lives in `src/cloud-orchestrator/embodied_brain/brain.py`. Tenants come from `scenario_registry.json`; only `Tenant-Alpha-Extended` (`router_mode: extended`) uses the six-class path in `embodied_brain/extended.py` (`simulate_extended`). The original three-class tenants and the IoT Hub / Event Hub path (`iot_telemetry_processor` in `brain.py`) are separate and unchanged.

**Extended path order:** emergency stop (answered in `brain.py` before the rate limit) → rate limit (5 s window, 1 request) → `precheck`/`check_input` → best-effort Cosmos write and read → `router_v2.pipeline.decide` (model call, strict JSON parse, `rules.execute`) → if HALT, Safety and Compiler are skipped → Safety → Compiler (both `embodied_brain/bounded_agent.py`) → `validate_actions`.

**`src/cloud-orchestrator/router_v2/`** is the core:
- `rules.py`: the six classes, thresholds (`THRESHOLDS`: 30 cm, 60 C, HP 50, battery 20, speed 2.5 are simulation conventions, not braking distances), `check_input`, and `execute`, which merges telemetry risks computed by code with the model's risks. The model can add risks but cannot remove one the code found.
- `prompt.py`: prompt B-1.0 and `parse_reply`, a hand-written strict parser (one JSON object, exactly the keys `primary` and `note_status`, no duplicate keys, enum values). No `response_format` or Pydantic; a bad reply becomes a halt.
- `pipeline.py`: `decide`, the model adapter (`openai_model_call`, `no_retry_client`: retries off, 60 s timeout, errors become TIMEOUT / RATE_LIMIT / API_ERROR faults), and `validate_actions`.
- Order matters: `decide` calls the model first and `execute` applies the physical gate (`gate()`, HP<=0 or battery<5) afterwards. The docstring of `gate()` says "before the router is asked", which describes the legacy path (`eval/LIMITATIONS.md` item 21). Safety and Compiler use `bounded_agent.py` (one request, retries off, 60 s placeholder timeout, faults become a stop); the older `ask_agent` (SDK defaults, 5 s cache) remains for legacy tenants.

**Providers.** `llm_provider.py` switches Azure OpenAI / OpenAI / DeepSeek / any OpenAI-compatible endpoint by `LLM_PROVIDER` env; all roles share one client and model. Formal runs used DeepSeek only.

**Edge.** `src/cloud-orchestrator/edge-simulator/device_mock.py` only sends 1 Hz telemetry over IoT Hub and prints commands. There is no on-vehicle braking logic anywhere; do not describe one.

**Frontend.** `src/client-edge/src/app/dashboard/live/` holds the simulation (`lib/physics.ts`, `config/simulation.ts`); it is a browser animation, not firmware.

**`eval/`** (the evidence part):
- `spec/` six-class label spec, reference labeler, keyword rules R1/R2; `baseline_b/` prompt B-1.0 and evaluator; `dev/` public dev set; `acceptance/FROZEN_MANIFEST.json` round-1 commitments; `formal/` runner (`run_formal.py`) and published round-1 results.
- `experiments/note_vs_rules_v2/` is round 2 (note understanding, rules R3 vs the model): `run_note_compare.py`, `r3.py`, `PLAN.md`, `RESULTS.md`, `HANDOFF_TO_GPT.md` (dated custodian log), `evidence/` (180 records, model replies, rule predictions, free recompute script), `archive/`.
- `annotation/` blind-annotation tooling and `validate_rationales.py`.
- `interview/INTERVIEW_DEEP_DRILL_zh.md` is the single interview answer source.

## Rules that are easy to break

- **Frozen files stay frozen.** Do not edit anything listed in `eval/experiments/note_vs_rules_v2/V2_FREEZE.json` (including `router_v2/rules.py`, `pipeline.py`, `prompt.py`, `eval/spec/*`, `run_formal.py`, `run_note_compare.py`, `r3.py`), `eval/formal/CODE_FREEZE.json`, `eval/acceptance/`, or any file pinned by a `SHA256SUMS`. Tests check the hashes. A change needs a new `freeze` and review. Record caveats in `eval/LIMITATIONS.md` instead.
- **No model calls without the owner's explicit authorisation** with caps (calls, tokens, US$). The real runner also needs `BASELINE_B_AUTHORIZED=yes`, a clean tree and a frozen tag at HEAD. No retries. Never print or commit keys; `local.settings.json` is gitignored and holds real credentials.
- **Evidence wording.** `tests/test_docs_consistency.py` bans phrases in the READMEs and `eval/report.md` (for example "零风险", "工业级", "from X to Y", "提升至", "人工专家标注"), requires quoted numbers to match `eval/formal/results/VERIFICATION.json`, and checks that relative links exist. Say "AI annotation and AI review", not expert labels. Round-1 300 records are 34 families, not 300 scenarios. `floor_override` 70/300 counts code-added risks, not model errors rescued. Two runs on the same data are not independent samples. Never write a before/after improvement the evidence does not contain.
- **Private data.** Round-1 originals are lost (`LIMITATIONS.md` item 22). Round-2 originals are public under `evidence/`; earlier custody material lives outside the repo (`~/.omniguard_custody*`, `.local-archives/` is gitignored). Do not read private directories unless the user asks.
- **Interview handbook.** Edit answers in place in `INTERVIEW_DEEP_DRILL_zh.md`; do not create parallel "final" versions. A test requires anchors `core-q1..8`, `q1..15` and `evidence`.
- **Git.** Commit locally; push only when the user says so. `HANDOFF_TO_GPT.md` and `PLAN.md` are updated by several agents, so stage only your own hunks.
- **When a check fails.** Stop and report. Do not regenerate a `SHA256SUMS`, loosen a test, or edit a frozen file to make it pass.
- **Who did what.** Claude, GPT and Gemini sessions all worked here. State who annotated or wrote what only as recorded in `eval/ANNOTATOR_PROVENANCE.md`; a `Co-Authored-By` trailer does not prove who wrote a commit.
