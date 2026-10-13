---
id: "DOC-REFERENCE-INDEX"
title: "Architecture Reference Index"
summary: "Scope and interpretation rules for advisory architecture blueprints and protocol references."
version: "1.0.0"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - iac-bicep
perspectives:
  - cloud-architecture
layers:
  - cross-cutting
doc_type: blueprint
status: accepted
code_refs:
  - ".azure/main.bicep"
test_refs:
  - "tests/shadow-e2e-test.py"
---
# Architecture Reference Index

The files under `blueprints/` are reusable architecture notes. They include a mixture of implemented patterns, historical decisions, and target-state enterprise recommendations.

They are not a deployment inventory. Before claiming that a blueprint is implemented:

1. locate the corresponding current Bicep or application code;
2. confirm the feature is enabled by current parameters;
3. run the relevant validation or environment test;
4. record material architectural changes in an ADR.

Start with the [blueprint catalog](blueprints/00-azure-architect-blueprints-index.md). Point-in-time Azure output, implementation task specifications, and agent execution prompts have been moved to the historical archive because they do not describe current cloud state.
