---
id: "DOC-TUTORIAL-QUICKSTART"
title: "Quickstart"
summary: "Minimal path to install dependencies, configure the backend, start both applications, and run tests."
version: "2.0.0"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - multi-agent
perspectives:
  - cloud-architecture
  - frontend-engineering
layers:
  - cross-cutting
doc_type: tutorial
status: accepted
code_refs:
  - "Makefile"
  - "src/cloud-orchestrator/local.settings.example.json"
test_refs:
  - "tests/test_brain.py"
---
# Quickstart

## 1. Prerequisites

- Python 3.10 or newer
- Node.js 20 or newer
- npm
- Azure Functions Core Tools when using the Functions host

Azure CLI is needed only for Azure provisioning and deployment.

## 2. Backend environment

From the repository root:

    cd src/cloud-orchestrator
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
    cp local.settings.example.json local.settings.json

Edit local.settings.json with the provider and model configuration required for your environment. The local settings file is not documentation and should not be committed.

### Choosing an LLM provider

Set `LLM_PROVIDER` in `local.settings.json` (or as an environment variable). Only the keys for the chosen provider are read.

| `LLM_PROVIDER` | Keys | Defaults |
|---|---|---|
| `deepseek` | `OPENAI_API_KEY` | `https://api.deepseek.com`, `deepseek-chat` |
| `openai` | `OPENAI_API_KEY` | `https://api.openai.com/v1`, `gpt-4o-mini` |
| `azure` | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT_NAME` (optional `AZURE_OPENAI_API_VERSION`) | deployment `gpt-4o-mini` |
| `openai-compatible` | `OPENAI_API_KEY`, `OPENAI_BASE_URL` (required) | none |

`OPENAI_BASE_URL` and `OPENAI_MODEL_NAME` override the defaults for the first three rows. To give the three-agent pipeline a different model from the rest, set `BRAIN_LLM_PROVIDER`, `BRAIN_LLM_API_KEY`, `BRAIN_LLM_ENDPOINT` and `BRAIN_MODEL_NAME` (Azure: `BRAIN_DEPLOYMENT_NAME`). If `LLM_PROVIDER` is unset, Azure is used when `AZURE_OPENAI_ENDPOINT` is set, otherwise DeepSeek. An unrecognised value raises an error instead of silently falling back.

Switching to OpenAI, for example:

    "LLM_PROVIDER": "openai",
    "OPENAI_API_KEY": "sk-...",
    "OPENAI_MODEL_NAME": "gpt-4o-mini"

Only DeepSeek has been exercised against a live API for this project; the other providers are covered by configuration tests, not live calls.

## 3. Frontend environment

    cd src/client-edge
    npm install

## 4. Start locally

From the repository root, use two terminals:

    make start-backend

and:

    make start-frontend

Open http://localhost:3000. Backend startup normally uses port 7071.

## 5. Choose a route

- /dashboard — local three-track AGV simulation
- /dashboard/theorem — latency/clearance sandbox
- /dashboard/compare — cloud/edge comparison
- /dashboard/live — backend-dependent flow

Start with /dashboard when no Azure environment is available.

## 6. Validate

With the backend virtual environment available:

    make test
    PATH="src/cloud-orchestrator/.venv/bin:$PATH" make docs-test

The second command ensures the Python documentation checks use the environment containing PyYAML and pytest.

## 7. Azure work

Do not provision resources as part of the local quickstart. When Azure work is intended, read the [operations guide](../operations.md), verify the active subscription, and preview changes with:

    make whatif

The [root README](../../README.md) explains scope and limitations; the [evidence index](../evidence/README.md) explains which numbers may be quoted.
