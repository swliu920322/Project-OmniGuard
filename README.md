# Project OmniGuard

Cloud-edge safety research platform for studying where AI agents can—and cannot—sit in a moving-machine control loop.

OmniGuard combines a simulated AGV dashboard, a three-stage cloud agent pipeline, Azure infrastructure templates, and reproducible benchmark archives. It is a research and engineering demonstrator, not a certified robot-control product.

[中文说明](README_zh.md) · [Architecture](ARCHITECTURE.md) · [Documentation](docs/README.md) · [Evidence index](docs/evidence/README.md)

## What this repository contains

| Area | Role | Status |
|---|---|---|
| AGV dashboard | Simulates cloud-only, cloud+edge, and token-heavy control loops | Core demonstrator |
| Embodied-brain pipeline | Router → safety → action compiler with early exit | Core research implementation |
| Azure IaC | Frozen Bicep snapshot and deployment scripts for the reference topology (generated with the separate Bicep Studio project) | Engineering reference |
| Benchmark archive | Immutable historical and diagnostic runs with limitations | Evidence |

The repository deliberately distinguishes implemented behavior, simulated parameters, measured results, and future proposals. See the [evidence policy](docs/evidence/README.md) before quoting a number.

## System at a glance

```text
Telemetry / seeded scenario
          |
          v
  physical pre-check
          |
          v
  Router Agent -------- sensor error ------> stop
          |
          v
  Safety Agent -------- policy block ------> safety override
          |
          v
  Action Compiler -------------------------> structured action
```

The browser dashboard is a simulation. The Python benchmark calls the configured LLM provider. Azure resources are defined as code, but a checkout of this repository does not prove that a live environment is currently deployed.

## Current benchmark evidence

Two preserved runs serve different purposes:

| Run | Scenarios | Router accuracy | Critical recall | Early exit | End-to-end latency |
|---|---:|---:|---:|---:|---|
| Historical thesis run, 2026-07-16 | 200 | 94.19% on 172 parseable router outputs | Not recoverable from the preserved summary | 39.5% | Mean 6.174 s |
| Diagnostic run, 2026-08-18 | 60 | 90.38% on 52 parseable router outputs | 9/14 under the legacy 5–50 cm label; all 8 cases below 30 cm were caught and blocked | 41.67% | Median 7.67 s; mean 16.72 s; max 73.88 s |

These runs are not directly interchangeable. The diagnostic run exposed a long latency tail and five label-policy disagreements at 31–46 cm; all five still produced a final stop action. It should not be presented as a completed 200-scenario benchmark or as five demonstrated unsafe passes. Full provenance and metric definitions are in the [benchmark results guide](src/cloud-orchestrator/embodied_brain/benchmark_results/README.md).

## Repository layout

```text
.azure/                         Azure Bicep modules and deployment parameters
scripts/                        Provisioning, deployment, validation, and local-start scripts
src/client-edge/                Next.js frontend and browser-side experiments
src/cloud-orchestrator/         FastAPI/Azure Functions backend and agent pipelines
src/cloud-orchestrator/
  embodied_brain/               AGV agent pipeline, scenarios, and benchmark evidence
tests/                          Unit, contract, benchmark, and shadow-environment tests
docs/                           Current documentation
```

## Local development

Prerequisites:

- Python 3.10+
- Node.js 20+
- Azure Functions Core Tools for the Functions host workflow
- Provider credentials configured from the supplied example settings

Start the backend and frontend in separate terminals:

```bash
make start-backend
make start-frontend
```

Useful checks:

```bash
make test
make docs-test
```

Azure operations are documented in [docs/operations.md](docs/operations.md). Review the target subscription and parameters before running provisioning or destruction commands.

## Interactive routes

| Route | Purpose | Data source |
|---|---|---|
| `/dashboard` | Three-AGV simulation | Browser simulation |
| `/dashboard/theorem` | Single-AGV latency/clearance sandbox | Browser simulation |
| `/dashboard/compare` | Cloud versus edge comparison | Browser simulation |
| `/dashboard/live` | Calls the configured backend when available | Runtime-dependent |

## Documentation contract

- [docs/README.md](docs/README.md) is the documentation entry point.
- [ARCHITECTURE.md](ARCHITECTURE.md) describes the current system and its boundaries.
- [docs/evidence/README.md](docs/evidence/README.md) defines which claims are measured, simulated, configured, or planned.
- [docs/adrs/INDEX.md](docs/adrs/INDEX.md) records architecture decisions.

## Known limitations

- AGV behavior is simulated; no physical robot was controlled by these experiments.
- LLM latency and classification results depend on provider, model, region, and run conditions.
- The historical 200-run summary does not retain every metric needed for modern safety analysis.
- The 60-run diagnostic archive does not record a trustworthy model identifier.
- WebGPU and brake-latency demonstrations are not safety certification evidence.

## License

[MIT](LICENSE)
