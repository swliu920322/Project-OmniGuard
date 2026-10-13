---
id: "DOC-TUTORIAL-USER-GUIDE"
title: "User Guide"
summary: "How to navigate OmniGuard, distinguish simulation from live behavior, and interpret displayed outcomes."
version: "2.0.0"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - cyber-physical-safety
perspectives:
  - frontend-engineering
layers:
  - edge-client
doc_type: tutorial
status: accepted
code_refs:
  - "src/client-edge/src/app/dashboard/page.tsx"
  - "src/client-edge/src/app/iac/page.tsx"
test_refs:
  - "tests/test_brain.py"
---
# User Guide

## Start with the project boundary

OmniGuard is the AGV/cloud-edge safety demonstrator. Prediction, Interpreter, and OmniDocs are Labs housed in the same repository. Their presence does not mean their claims or data belong to the AGV benchmark.

## Dashboard

Use /dashboard to compare simulated decision strategies. Controls change the browser's model inputs; they do not change preserved benchmark results.

Use /dashboard/theorem to explore the relationship between:

- vehicle speed;
- available clearance;
- decision latency;
- distance travelled while waiting.

Use /dashboard/compare for a focused cloud/edge comparison.

Use /dashboard/live only when a backend is configured and reachable. A value shown in live mode is evidence for that request and environment, not a universal platform latency.

See the [dashboard reference](../dashboard/00-overview.md) for interpretation guidance.

## Benchmark results

The benchmark archive is not controlled by dashboard sliders. Every run has its own directory and provenance.

Before sharing a result:

1. name the run;
2. state the actual scenario count;
3. state the denominator used for accuracy;
4. include critical recall and error direction;
5. include a tail latency statistic;
6. disclose unknown model or interrupted-run metadata.

Use the [evidence index](../evidence/README.md) as the canonical summary.

## IaC tools

The /iac routes visualize and configure repository infrastructure templates. Generated or previewed infrastructure is not deployed infrastructure until the Azure operation succeeds and validation passes.

Use the [operations guide](../operations.md) before running provisioning, deployment, or destruction commands.

## Labs

- /prediction is a KOL and supply-chain analysis experiment.
- /interpreter is a content-presentation experiment.
- packages/ contains reusable experimental document tooling.

Treat each Lab as a separate product surface. Do not add its claims to the OmniGuard architecture overview unless it becomes a required OmniGuard dependency.

## Reporting language

Prefer precise wording:

- “The simulation uses a configured 15 ms brake delay.”
- “The 2026-08-18 diagnostic run measured a 7.67-second median.”
- “The current v3 protocol plans 200 scenarios and has not yet been executed.”

Avoid wording that converts a simulation, plan, or single environment observation into a general proof.
