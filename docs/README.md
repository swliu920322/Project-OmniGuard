---
id: "DOC-HOME"
title: "Project OmniGuard Documentation"
summary: "Navigation for current architecture, operations, evidence, decisions,."
version: "2.0.2"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - cyber-physical-safety
perspectives:
  - cloud-architecture
layers:
  - cross-cutting
doc_type: tutorial
status: accepted
code_refs:
  - "src/cloud-orchestrator/embodied_brain/brain.py"
  - "src/client-edge/src/app/dashboard/page.tsx"
test_refs:
  - "tests/test_brain.py"
  - "tests/test_benchmark_archives.py"
---
# Documentation

This page is the only navigation entry for Project OmniGuard documentation. Documents outside the **Current documentation** section must not be treated as current system truth.

## Current documentation

| Need | Source |
|---|---|
| Understand what the repository is | [Root README](../README.md) |
| Understand components and boundaries | [Architecture](../ARCHITECTURE.md) |
| Start, test, deploy, or troubleshoot | [Operations](operations.md) |
| Quote a metric or research result | [Evidence index](evidence/README.md) |
| Understand the AGV dashboard | [Dashboard reference](dashboard/00-overview.md) |
| Review an architecture decision | [ADR index](adrs/INDEX.md) |
| Review the six-route state-routing evaluation | [Evaluation report](../eval/report.md), [evidence index](../eval/EVIDENCE_INDEX.md) and [limitations](../eval/LIMITATIONS.md) |
| See the Azure reference architecture diagrams | [Architecture diagrams](architecture/README.md) |
| Learn the system | [Quickstart](tutorials/quickstart.md) and [user guide](tutorials/user-guide.md) |

## Reference material

- reference/blueprints/ contains architecture patterns and implementation notes. A blueprint may describe a target state; verify it against code before treating it as deployed.

## Source-of-truth rules

1. **Runtime behavior**: current code and passing tests.
2. **Measured results**: immutable files under a named benchmark run.
3. **Architecture decisions**: accepted ADRs, checked against current code.
4. **Plans and presentations**: intent or narrative only; never evidence.

When these sources disagree, do not average or silently reconcile them. Record the conflict in the evidence index and correct downstream documentation.

## Maintenance checklist

Before merging a documentation change, run:

    make docs-build
    make docs-test

Also confirm that:

- new numeric claims identify their evidence class;
- links are repository-relative;
- archived content is not linked as current guidance;
- generated manifests were rebuilt after adding, removing, or moving indexed documents.
