# CLAUDE.md

## What this repository is

A research and engineering demonstrator, not a robot-control product: a simulated AGV dashboard (Next.js), a cloud agent pipeline (Azure Functions / FastAPI), Azure Bicep templates, and a state-routing evaluation under `eval/`. Everything about vehicles is simulated. Start at `eval/README.md` (the evidence front door); `docs/evidence/README.md` says which numbers may be quoted and how. Newcomer guides: `docs/guide/`. The owner's interview material in `study/` is not evidence.

## Commands

Run from the repository root. The backend virtualenv is `src/cloud-orchestrator/.venv` (gitignored); create it with `python3 -m venv src/cloud-orchestrator/.venv && src/cloud-orchestrator/.venv/bin/pip install -r src/cloud-orchestrator/requirements.txt pytest`.

```sh
src/cloud-orchestrator/.venv/bin/python -m pytest tests -q                     # full suite, no network, no key
src/cloud-orchestrator/.venv/bin/python -m pytest tests/test_router_v2.py::test_name -q   # one test
src/cloud-orchestrator/.venv/bin/python -m pytest tests/test_docs_consistency.py -q       # run after editing any public doc
```

`pyproject.toml` sets `-x`, so pytest stops at the first failure. `make test` runs the same tests from `src/cloud-orchestrator`.

- Backend: `make start-backend` (port 7071; needs `src/cloud-orchestrator/local.settings.json`, copied from `local.settings.example.json`). Frontend: `make start-frontend` (port 3000); `/dashboard/live` calls the backend and may incur model charges.
- `make provision|destroy|deploy-aca|patch-env|trigger-ci` change real Azure or GitHub state. Do not run them without the user asking.
- Free offline checks of published evidence are in `eval/REPRODUCE.md` (Level 1), for example `(cd eval/formal/results && shasum -a 256 -c SHA256SUMS)`.

## Read the code for the flow; these are the traps

The request flow is in `src/cloud-orchestrator/embodied_brain/extended.py` and `router_v2/README.md`. Do not restate it in docs; it goes stale.

- **Gate order.** The frozen `decide()` (what the evaluation measured) calls the model first and applies the gate (`gate()`, HP<=0 or battery<5) afterwards. The HTTP flow checks the gate before asking the model. Say which one you mean (`eval/LIMITATIONS.md` item 21).
- **What the code guarantees.** The model can add risks but cannot remove one the code found (`rules.execute`). A risk that appears only in the operator note can still be missed (item 20). Safety and Compiler can only tighten the Router's decision.
- **Claims about the vehicle.** Thresholds (30 cm, 60 C, HP 50, battery 20, speed 2.5) are simulation conventions, not braking distances. `device_mock.py` only sends 1 Hz telemetry; there is no on-vehicle braking logic anywhere, do not describe one. `goal=CHARGER` is a structured goal, not proof of arrival.
- **Safety and Compiler calls** go through `embodied_brain/bounded_agent.py` (one request, retries off, 60 s placeholder timeout). The older `ask_agent` (SDK defaults, 5 s cache) is for legacy tenants. The provider ignores `max_completion_tokens` (item 25).
- **Providers.** `llm_provider.py` switches by `LLM_PROVIDER`; all roles share one client and model. Formal runs used DeepSeek only.

## Rules: when you do X, do Y

Each rule has a trigger, an action and what checks it. "No automatic check" means only you stand between a mistake and the repository.

- **When a test, hash or check fails:** stop and report. Do not regenerate a `SHA256SUMS`, loosen a test, or edit a frozen file to make it pass. No automatic check.
- **When you are about to edit a file named in `eval/experiments/note_vs_rules_v2/V2_FREEZE.json` (including `router_v2/rules.py`, `pipeline.py`, `prompt.py`, `eval/spec/*`, `run_formal.py`, `run_note_compare.py`, `r3.py`), `eval/formal/CODE_FREEZE.json`, `eval/acceptance/`, or any file pinned by a `SHA256SUMS`:** don't. A change needs a new freeze and review; record caveats in `eval/LIMITATIONS.md` instead. Checked by: hashes in `tests/test_note_vs_rules_v2.py` and `tests/test_formal_runner.py`.
- **Before any request to a model:** the owner's explicit authorisation with caps (calls, tokens, US$); no retries; never print or commit keys (`local.settings.json` is gitignored and holds real credentials). Checked by: the runners refuse without it (`tests/test_formal_runner.py`, `tests/test_safety_compiler_run.py`); nothing else you might run is checked.
- **When you write about results:** say "AI annotation and AI review", not expert labels. Round-1 300 records are 34 families, not 300 scenarios. `floor_override` 70/300 counts code-added risks, not model errors rescued. Two runs on the same data are not independent samples. Never write a before/after improvement the evidence does not contain. Checked by: banned phrases and numbers in `tests/test_docs_consistency.py`, round-2 numbers in `tests/test_round2_numbers.py`.
- **When you write about who annotated or wrote something:** use only what `eval/ANNOTATOR_PROVENANCE.md` records. Claude, GPT and Gemini sessions all worked here; a `Co-Authored-By` trailer does not prove who wrote a commit. No automatic check.
- **When you create a document:** name the existing document that cannot hold it; process notes go in the commit message. Name files for what they are (no dates, tool names or version codenames). Checked by: every document must be linked from an index (`tests/test_docs_map.py`); the naming is not checked.
- **When you edit the interview handbook:** edit `study/interview/INTERVIEW_DEEP_DRILL_zh.md` in place; no parallel "final" versions. Checked by: its anchors in `tests/test_docs_consistency.py` (not the rule about parallel versions).
- **When you are about to read a private directory** (`~/.omniguard_custody*`, session exports): don't unless the user asks. Round-1 originals have not been found (`LIMITATIONS.md` item 22); round-2 originals are public under `evidence/`. No automatic check.
- **When you commit or push:** commit locally; push only when the user says so. Several agents update `PLAN.md` and the handoff log, so stage only your own hunks. No automatic check.
