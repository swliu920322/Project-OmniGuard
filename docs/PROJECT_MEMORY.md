---
id: "DOC-PROJECT-MEMORY"
title: "Project Memory Map"
summary: "Short maintenance map for the current repository boundaries, commands, and sources of truth."
version: "2.0.0"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - cyber-physical-safety
  - multi-agent
perspectives:
  - cloud-architecture
  - frontend-engineering
layers:
  - cross-cutting
doc_type: specification
status: accepted
code_refs:
  - "Makefile"
  - ".azure/main.bicep"
  - "src/client-edge/src/app/page.tsx"
  - "src/cloud-orchestrator/function_app.py"
test_refs:
  - "tests/test_brain.py"
---
# Project Memory Map

This file is a compact maintainer handoff. It intentionally avoids duplicating the architecture, benchmark tables, and deployment instructions.

## Repository identity

Project OmniGuard is the primary research story. Prediction, Interpreter, OmniDocs packages, and standalone apps are Labs that share the repository but have separate goals.

## Main ownership map

| Area | Location | Authority |
|---|---|---|
| Azure infrastructure | .azure/ | Bicep modules |
| Operational commands | Makefile and scripts/ | Executable scripts |
| Frontend routes | src/client-edge/src/app/ | Next.js route tree |
| Backend composition | src/cloud-orchestrator/function_app.py | Registered FastAPI routers |
| AGV agent behavior | src/cloud-orchestrator/embodied_brain/ | Python implementation and tests |
| Benchmark facts | embodied_brain/benchmark_results/ | Named immutable runs |
| Architecture rationale | docs/adrs/ | Accepted ADRs |
| Historical narratives | docs/archive/ | Context only |

## Common commands

| Task | Command |
|---|---|
| Start backend | make start-backend |
| Start frontend | make start-frontend |
| Run project tests | make test |
| Validate documentation | make docs-test |
| Build document manifests | make docs-build |
| Preview Azure deployment | make whatif |
| Provision Azure resources | make provision |
| Deploy containers | make deploy-aca |

Provision, deploy, and destroy commands affect external Azure state. Confirm subscription, region, parameters, and credentials before execution.

## Change rules

1. Do not put a new product concept into the root README until it has a stable route, owner, and test.
2. Do not quote a benchmark number outside the evidence index without naming its run.
3. Do not overwrite benchmark output; create a new run directory.
4. Move completed or abandoned plans into docs/archive/.
5. Keep README files descriptive; record design decisions in ADRs.
6. Regenerate document manifests after moving indexed files.

## Handoff checklist

- Run git status and separate unrelated work before editing.
- Read docs/README.md for the current navigation.
- Read ARCHITECTURE.md for boundaries, not archived plans.
- Run the smallest relevant tests before broader test suites.
- Update this file only when ownership or operational entry points change.
