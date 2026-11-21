# Project OmniGuard Architecture

Status: current architecture overview
Last reviewed: 2026-11-14

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

The HTTP entry selects either the original tenant path or the opt-in six-class path. They share role names but differ in validation, physical-gate timing and output checks. The diagram in the [README](README.md) shows the extended path; the thesis sequence diagram describes the original one.

### 4.1 Deterministic physical pre-check

In the original path, depleted health or critically low battery can stop processing before an LLM call. In the extended path, only the structured emergency-stop entry and invalid-input handling guarantee rejection before external calls. Since 2026-11-21 its HP≤0 or battery<5% physical gate is also checked in the HTTP flow before the Router model is asked, so a gated request makes no model request; the frozen `decide()` that the evaluation measured still applies the gate inside `execute()` after the Router call. This is deterministic decision logic in the backend, not a deployed edge controller or a guarantee that the vehicle is already stopped.

### 4.2 Router Agent

The router classifies telemetry into the configured intent vocabulary, including critical obstacle, normal navigation, and sensor error. A sensor-error decision can stop the pipeline early.

### 4.2.1 Extended router (opt-in)

A tenant configured with `router_mode: extended` (`Tenant-Alpha-Extended`) replaces the router stage of the HTTP simulator endpoint with a six-route state decision (`CRITICAL_OBSTACLE`, `OVERHEAT`, `LOW_HEALTH`, `LOW_BATTERY`, `OVERSPEED`, `NORMAL_NAV`) and an optional operator note. The flow is in `src/cloud-orchestrator/embodied_brain/extended.py` and `router_v2/`: an emergency-stop flag and the input check run in code before any external call; the model returns one strict JSON object; code adds every telemetry risk the model did not name, applies the physical gate and resolves one action; Safety can only make it stricter; the Compiler's actions are validated against a fixed action contract before they leave. Unusable input or replies halt. The original tenants, their prompts and the IoT Hub path are unchanged. The rules and their evaluation are in `eval/` ([specification](eval/spec/LABEL_SPEC.md), [report](eval/report.md)); thresholds and priorities are simulation conventions, and `goal: CHARGER` is a structured goal that nothing verifies.

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

A token-oriented cloud estimate may further decompose latency into network, prompt-processing, and generation terms. This is a model, not a timing guarantee. The historical Python benchmark records stage durations; its `total_pipeline` is the sum of Router, Safety and Compiler call durations for full-flow cases only. It is not browser-to-backend round-trip time. See the [timing evidence](eval/LATENCY_EVIDENCE.md) for boundaries, denominators and simulated parameters.

The architectural conclusion is deliberately narrow:

> A remote, variable-latency inference path should not be the sole mechanism responsible for a deadline-bound physical safety action.

This conclusion motivates a deterministic local safety layer; it does not imply that all navigation or planning must happen at the edge.

## 7. Azure reference topology

Diagrams: [thesis Figure 3.1, the Bicep-derived topology and Figure 3.2](docs/architecture/README.md).


The Bicep modules describe a reference deployment containing:

- Azure Container Apps compute;
- virtual-network and subnet isolation;
- managed identity and Key Vault integration;
- three private endpoints for Key Vault, Storage and Cosmos DB in the snapshot; Azure OpenAI is not defined behind an additional private endpoint there;
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

## 10. Measured results and their scope

The [formal state-routing report](eval/report.md) records two runs on the same 300 frozen synthetic records (34 families), each 300/300; R1/R2 on that set score 281/300 and 280/300. The 55 stress cases consist of 32 real model requests, 13 input rejections and 10 injected faults checked offline. These are Router/decision-function results under an experimental specification, not physical-robot or real-model HTTP end-to-end results.

Historical timing is separate. The [benchmark archive guide](src/cloud-orchestrator/embodied_brain/benchmark_results/README.md) preserves:

- 2026-07-16: 200 scenarios; 94.19% Router accuracy on 172 parseable outputs; 39.5% early exits. For 121 full-flow cases, the sum of the three model-call durations averages 6.174 seconds.
- 2026-08-18: 60 scenarios; 90.38% Router accuracy on 52 parseable outputs; 9/14 recall under the legacy critical label, with all eight sub-30 cm cases blocked; 41.67% early exits. For 35 full-flow cases, the same timing measure has a 7.67-second median and 16.72-second mean.

These runs use different tasks and conditions and do not establish an improvement trend. None measures browser round-trip time or a physical AGV's allowable response deadline.

## 11. Reliability rules

- Safety metrics include recall and error direction, not only aggregate accuracy.
- Latency reports include median, high-percentile or maximum values, not only a mean.
- Parse failures and unknown model identifiers remain visible.
- Early exit is reported as a cost/latency mechanism, not automatically as a safety success.
- Final unsafe actions are counted separately from router errors.
- Live-environment claims identify the tested environment and date.

<a id="design-tradeoffs"></a>

## 12. Three design trade-offs to inspect

This is a reading guide to current implementation and evidence, not a claim that the owner independently made every original decision. Earlier ADRs describe choices at their own dates.

| Choice in the implementation | Reason it serves | Cost or alternative | Evidence and unresolved question |
|---|---|---|---|
| **Model prediction plus code constraints** | The model judges the route and note semantics; code recomputes numerical risks, rejects unusable replies and validates final actions. A model cannot remove a known telemetry risk. | Numeric thresholds need no LLM. Rules or another classifier may suffice for notes; code cannot independently recover a note-only risk the model misses. | [Risk synthesis](src/cloud-orchestrator/router_v2/rules.py), [strict Router contract and action checks](src/cloud-orchestrator/router_v2/pipeline.py), [HTTP counterexample tests](tests/test_extended_endpoint.py). Real-model endpoint latency and physical stopping remain untested. |
| **Fixed Router → Safety → Compiler workflow with early exits** | Roles and data handoffs are explicit; a halt skips downstream stages. Final action checks remain code-controlled. | Serial calls add waiting time and external failure points. One structured call followed by code validation is a plausible alternative. Safety and Compiler use the legacy helper and do not share every Router guarantee. | [HTTP orchestration](src/cloud-orchestrator/embodied_brain/extended.py), [timing boundaries](eval/LATENCY_EVIDENCE.md). No controlled single-call-versus-three-stage study establishes that the three-stage design is better. |
| **Specification and held-out data frozen before formal scoring** | Fixed input, label and scoring rules make later changes detectable and keep development results separate from formal results. Two runs check repeatability; R1/R2 provide same-data controls. | The examples are synthetic, correlated by family and AI-labeled; freezing does not make them representative. Keeping records private prevents a public clone alone from reproducing formal scores. | [Specification](eval/spec/LABEL_SPEC.md), [frozen manifest](eval/acceptance/FROZEN_MANIFEST.json), [report](eval/report.md), [reproduction levels](eval/REPRODUCE.md). Stronger rules and real operational data would require their own evaluation. |

For the corresponding functions and a free fake-model exercise, see the [code map](docs/guide/BACKEND_CODE_GUIDE_zh.md#offline-lab). The [owner's experience notes](study/interview/INTERVIEW_STORY_zh.md) separate confirmed motivation from contributions still needing confirmation; the [interview handbook](study/interview/INTERVIEW_DEEP_DRILL_zh.md#core-8) is preparation material, not additional experimental evidence.

### Historical decision records

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
- State-routing evaluation: eval/report.md, eval/EVIDENCE_INDEX.md, eval/LIMITATIONS.md
- Architecture decisions: docs/adrs/INDEX.md
- Dashboard behavior: docs/dashboard/00-overview.md
