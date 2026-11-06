# Project OmniGuard Architecture

Status: current architecture overview
Last reviewed: 2026-10-14

This document describes the system that exists in the repository and the boundary between implementation, simulation, infrastructure design, and research evidence. Historical plans and presentation language belong in docs/archive/, not here.

## 1. Purpose and scope

OmniGuard explores one engineering question:

> Which decisions may safely depend on a cloud LLM when an AI system influences a moving machine?

The repository provides:

- a browser simulation of AGV movement and delayed decisions;
- a Python three-agent decision pipeline;
- seeded benchmark scenarios and preserved run results;
- Azure reference infrastructure expressed in Bicep;
- supporting dashboards and operational tooling.

The AGV is simulated. The project does not claim safety certification, physical-robot validation, or a universal mathematical proof that every cloud control loop fails.

## 2. Product boundaries

### OmniGuard core

- Dashboard routes under /dashboard
- Embodied-brain code under src/cloud-orchestrator/embodied_brain
- Azure topology under .azure
- Infrastructure and benchmark tests under tests

## 3. Logical architecture

    Browser
      |
      +-- Dashboard simulation (local physics and configured latency)
      |
      +-- Next.js API proxy
              |
              v
       FastAPI / Azure Functions ASGI
              |
              +-- embodied_brain router
              |
              +-- configured LLM provider
              +-- optional Cosmos DB / Storage / IoT services

The frontend and backend can run locally. Azure resources are optional for browser-only simulations and required for environment-specific live flows.

## 4. AGV decision pipeline

The embodied-brain pipeline has four decision layers.

### 4.1 Deterministic physical pre-check

Hard conditions such as depleted health or critically low battery are handled before an LLM call. This path is deterministic and should remain independent of model availability.

### 4.2 Router Agent

The router classifies telemetry into the configured intent vocabulary, including critical obstacle, normal navigation, and sensor error. A sensor-error decision can stop the pipeline early.

### 4.3 Safety Agent

The safety stage evaluates the routed scenario against prompt-based policy. A block result produces a safety override and skips the compiler.

### 4.4 Action Compiler

If no earlier stage stops the pipeline, the compiler produces structured actions. Benchmark reporting must separately show whether the final action was safe; a router classification alone is not a release gate.

## 5. Dashboard modes

| Route | Behavior | Evidence class |
|---|---|---|
| /dashboard | Three-track fleet visualization | Simulated |
| /dashboard/theorem | Interactive latency and clearance model | Simulated |
| /dashboard/compare | Cloud/edge comparison | Simulated |
| /dashboard/live | Backend request path when configured | Runtime-dependent |

Values selected in a dashboard slider are configured simulation inputs. They must not be described as measured cloud, brake, network, or WebGPU performance unless a named run produced them.

## 6. Latency model

The dashboard uses latency to illustrate the distance travelled before a decision arrives:

    decision distance = speed × decision latency

A token-oriented cloud estimate may further decompose latency into network, prompt-processing, and generation terms. This is a model, not a timing guarantee. The actual Python benchmark records observed stage and end-to-end latency from its configured provider.

The architectural conclusion is deliberately narrow:

> A remote, variable-latency inference path should not be the sole mechanism responsible for a deadline-bound physical safety action.

This conclusion motivates a deterministic local safety layer; it does not imply that all navigation or planning must happen at the edge.

## 7. Azure reference topology

The Bicep modules describe a reference deployment containing:

- Azure Container Apps compute;
- virtual-network and subnet isolation;
- managed identity and Key Vault integration;
- private endpoints for selected data and AI services;
- IoT Hub and data services where enabled;
- frontend-to-backend routing through the application boundary.

The main files are:

- .azure/main.bicep — subscription-level entry;
- .azure/nested-infra.bicep — shared network and managed services;
- .azure/compute-module.bicep — application compute;
- .azure/templates/ — scenario-specific fragments.

IaC proves that a topology is defined. Only deployment output and environment tests can prove that a particular Azure environment was successfully provisioned and remains healthy.

## 8. Trust boundaries

### Browser boundary

The browser owns visualization and simulation state. Browser-generated physics values must be treated as untrusted input by backend services.

### Application boundary

The Next.js proxy provides a stable browser-facing path. It is not, by itself, authentication or authorization.

### Cloud service boundary

LLM, data, storage, and IoT calls depend on runtime credentials and service configuration. Managed identity is preferred in deployed Azure environments; local development uses explicitly supplied settings.

### Actuation boundary

Generated actions are proposals until validated by deterministic policy and the device controller. An LLM response must never be treated as an inherently safe actuator command.

## 9. Data and evidence flow

Benchmark scenarios are created by benchmark_scenarios.py. A run writes into its own directory under benchmark_results/runs instead of overwriting another run.

Each run should preserve:

- run identifier and timestamp;
- scenario protocol and seed;
- requested and actually executed scenario count;
- provider and model identifiers;
- temperature and other inference settings;
- raw per-scenario results;
- generated summary and report;
- known interruptions or parsing failures.

The evidence index defines the allowed terminology. Historical summaries are preserved rather than silently recalculated with new definitions.

## 10. Current measured results

The canonical numbers are maintained in the benchmark results guide:

- 2026-07-16 historical run: 200 scenarios, 94.19% router accuracy on 172 parseable outputs, 39.5% early exit, 6.174-second mean end-to-end latency.
- 2026-08-18 diagnostic run: 60 scenarios, 90.38% router accuracy on 52 parseable outputs, 9/14 recall under the legacy 5–50 cm critical label, all eight sub-30 cm cases caught and blocked, 41.67% early exit, 7.67-second median and 16.72-second mean latency.

The historical and diagnostic numbers describe different runs and denominators. Neither should be substituted for the other.

## 11. Reliability rules

- Safety metrics include recall and error direction, not only aggregate accuracy.
- Latency reports include median, high-percentile or maximum values, not only a mean.
- Parse failures and unknown model identifiers remain visible.
- Early exit is reported as a cost/latency mechanism, not automatically as a safety success.
- Final unsafe actions are counted separately from router errors.
- Live-environment claims identify the tested environment and date.

## 12. Repository decision records

ADRs under docs/adrs record why specific architecture choices were made. An accepted ADR is historical evidence of a decision, but code remains the authority for current implementation. If code intentionally supersedes an ADR, update its status and create a replacement decision where needed.

## 13. Known gaps

- No physical AGV validation.
- The diagnostic run did not preserve a reliable model identifier.
- The historical summary lacks enough detail to reconstruct every modern metric.
- Several reference blueprints describe target-state enterprise patterns rather than deployed resources.
- The live dashboard requires runtime configuration and should not be assumed operational from source alone.
- WebGPU demo timings are hardware- and browser-dependent and are not a certified response-time bound.

## 14. Related documents

- Documentation navigation: docs/README.md
- Operations: docs/operations.md
- Evidence policy: docs/evidence/README.md
- Benchmark archive: src/cloud-orchestrator/embodied_brain/benchmark_results/README.md
- Architecture decisions: docs/adrs/INDEX.md
- Dashboard behavior: docs/dashboard/00-overview.md
