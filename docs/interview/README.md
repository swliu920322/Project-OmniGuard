---
id: "DOC-INTERVIEW-HOME"
title: "OmniGuard Interview Documentation"
summary: "Single entry point for the current AGV interview narrative, writing handoff, evidence links, and preparation order."
version: "1.1.0"
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

1. [Core principles learning guide](core-principles-learning-guide.md) — learn event-driven systems, Azure IoT, sampling, cloud-edge safety, multi-agent evaluation, IaC, and observability from first principles.
2. [AGV project interview guide](agv-project-interview-guide.md) — project positioning, five-stage evolution, role fit, improvement priorities, five-minute narrative, and common follow-up questions.
3. [Claude project and benchmark brief](claude-project-and-benchmark-brief.md) — source-backed contract for LinkedIn writing and exact benchmark wording.
4. [Evidence and metric index](../evidence/README.md) — canonical quantitative claims and evidence classes.
5. [Architecture](../../ARCHITECTURE.md) — current components and system boundaries.
6. [Dashboard reference](../dashboard/00-overview.md) — which values are simulated, configured, or runtime-dependent.

## What belongs here

- current interview narrative;
- current project positioning;
- interview question preparation;
- public-writing handoffs that depend on the same project claims.
- project-specific learning material used to prepare those interviews.

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

## Information needed for a personalized plan

When requesting a resume, learning plan, or job-search plan, provide what you are comfortable sharing from the list below:

- current resume or a summary of education and work history;
- years of experience and main responsibilities;
- target country/city and work-authorization constraints;
- target job titles or several example job descriptions;
- strongest and weakest technical areas;
- languages and tools actually used without AI assistance;
- English interview and writing comfort;
- job-search timing and weekly study time;
- projects, certifications, publications, and measurable work outcomes;
- whether the goal is individual contributor, architect, consultant, or management.

Remove phone numbers, home addresses, government IDs, credentials, API keys, customer secrets, and other unnecessary private information before sharing.
