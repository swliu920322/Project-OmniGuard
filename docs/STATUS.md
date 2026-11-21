---
id: "DOC-STATUS"
title: "Project Status"
summary: "What is done, partly done, not done and deliberately out of scope, with dated milestones."
version: "1.0.0"
updated_at: "2026-11-16"
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
  - "src/cloud-orchestrator/router_v2/pipeline.py"
test_refs:
  - "tests/test_docs_consistency.py"
---
# Project status

Last reviewed: 2026-11-16. This page says what exists, what does not, and where the numbers live. It holds no metrics of its own: quote results only from the linked files. When the repository changes, update the date above in the same commit.

## What exists

| Part | State | Notes |
|---|---|---|
| AGV dashboard (Next.js) | Done, demonstrator | A browser animation of a simulated vehicle and delayed decisions. Not firmware. `/dashboard/live` needs a backend and may incur model charges. |
| Cloud decision pipeline (Router, Safety, Compiler) | Done | Only the tenant `Tenant-Alpha-Extended` uses the six-class path. Safety and Compiler are not part of the formal evaluation; one real availability run on 84 records exists (see [safety_compiler](../eval/safety_compiler/README.md)). See [Architecture](../ARCHITECTURE.md). |
| Edge simulator | Minimal by design | Sends 1 Hz telemetry and prints commands. There is no on-vehicle braking logic. |
| Azure Bicep templates | Frozen snapshot, reference | Generated with the separate Bicep Studio project. This page does not claim that any environment is currently deployed. |
| Model provider switching | Configuration level | Azure OpenAI, OpenAI, DeepSeek or any compatible endpoint, selected by environment. All roles share one model. The formal runs used DeepSeek only. |
| Evaluation round 1 | Complete | Frozen synthetic test set, two runs, stress cases. The per-record originals are lost; only aggregates and hashes remain ([limitations](../eval/LIMITATIONS.md), item 22). See the [report](../eval/report.md). |
| Evaluation round 2 | Complete | Note understanding: keyword rules R1, R2, the rewritten rule set R3, and the model, on one frozen set run once. Records, replies and scoring scripts are public. See [results](../eval/experiments/note_vs_rules_v2/RESULTS.md). |
| Interview and learning material | Maintained in place | [Handbook](../eval/interview/INTERVIEW_DEEP_DRILL_zh.md). |

## Not done

- Reproduction by a person who has not seen the project, and the owner's oral check of the evidence. Neither can be marked by the author or by an AI assistant.
- Backup of the round-2 custody material to an independent medium. The owner deferred it.
- Any physical-vehicle test, real HTTP end-to-end evaluation, or braking validation.
- Comparison across other models or other architectures. Both rounds used one fixed model.
- A safety evaluation of Safety and Compiler. The 2026-11-21 run measured availability and latency only; Safety blocked none of 84 records, so it shows nothing about what Safety would catch.
- Expert annotation. Labels come from AI annotation and AI review.

## Deliberately not claimed

- Safety certification, or accuracy in production use.
- That the synthetic sets stand for real warehouse notes. They are written by the author, in families of three language variants, so they are far fewer independent situations than records.
- A before and after improvement. The two rounds use different sets and different systems; round 2 compares a model with rules on the same records.
- That round 2 is an untouched test. Its records are public and now serve as a regression set.

## Milestones

Dates are commit dates in the Git history.

| Date | Milestone |
|---|---|
| 2026-06-11 to 06-16 | Azure foundation: network, Bicep modules, function app, Azure OpenAI, repeatable bring-up and tear-down scripts |
| 2026-06-16 to 06-20 | Streaming chat, Next.js front end, first digital-human demo |
| 2026-06-29 to 07-01 | Embodied-brain module, IoT Hub telemetry path, fleet dashboard, move to Azure Container Apps |
| 2026-07-02 to 07-18 | Infrastructure configurator (later split into its own project), switchable model provider, bilingual UI |
| 2026-10-14 | Documentation consolidated, stale material archived |
| 2026-11-06 | Repository narrowed to the AGV project |
| 2026-11-07 | Evaluation round 1: six-class specification, frozen data, formal runs, published results |
| 2026-11-09 to 11-11 | Rule set R3 developed and frozen |
| 2026-11-15 to 11-16 | Evaluation round 2: blind labelling, audits, frozen set, one authorised run, cross-check, evidence published |

For the full ordering of round 2, including commit times, read the dated log in `eval/experiments/note_vs_rules_v2/HANDOFF_TO_GPT.md`.

## Where to read next

- What may be quoted, and how: [Evidence index](evidence/README.md).
- What the evaluation cannot show: [Limitations](../eval/LIMITATIONS.md).
- What you can check without a key: [Reproduction guide](../eval/REPRODUCE.md).
