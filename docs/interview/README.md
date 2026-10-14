---
id: "DOC-INTERVIEW-HOME"
title: "OmniGuard Interview Documentation"
summary: "Single entry point for the current AGV interview narrative, writing handoff, evidence links, and preparation order."
version: "1.0.0"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - cyber-physical-safety
  - multi-agent
perspectives:
  - cloud-architecture
  - academic-research
layers:
  - cross-cutting
doc_type: tutorial
status: accepted
code_refs:
  - "src/cloud-orchestrator/embodied_brain/brain.py"
  - "src/cloud-orchestrator/edge-simulator/device_mock.py"
test_refs:
  - "tests/test_brain.py"
  - "tests/test_benchmark_archives.py"
---
# Interview documentation

This directory is the only current entry point for interview preparation and public project storytelling.

## Read in this order

1. [AGV project interview guide](agv-project-interview-guide.md) — project positioning, five-stage evolution, technical topics, role fit, improvement priorities, five-minute narrative, and common follow-up questions.
2. [Claude project and benchmark brief](claude-project-and-benchmark-brief.md) — source-backed contract for LinkedIn writing and exact benchmark wording.
3. [Evidence and metric index](../evidence/README.md) — canonical quantitative claims and evidence classes.
4. [Architecture](../../ARCHITECTURE.md) — current components and system boundaries.
5. [Dashboard reference](../dashboard/00-overview.md) — which values are simulated, configured, or runtime-dependent.

## What belongs here

- current interview narrative;
- current project positioning;
- interview question preparation;
- public-writing handoffs that depend on the same project claims.

Raw benchmark artifacts and metric definitions stay under `docs/evidence/` and `src/cloud-orchestrator/embodied_brain/benchmark_results/`. Architecture decisions stay under `docs/adrs/`. This directory links to those sources instead of copying them.

## What does not belong here

- old presentation scripts;
- inflated or superseded interview claims;
- deployment logs;
- benchmark output files;
- unrelated career planning;
- future architecture proposals.

Historical interview material remains under `docs/archive/interviews/`. It may explain project history, but it is not current guidance and must not be quoted without checking current code and evidence.

## Maintenance rule

When an interview claim changes:

1. correct the governing source first—code, architecture, or evidence;
2. update the relevant file in this directory;
3. rebuild the documentation index;
4. do not create a second current interview guide elsewhere.
