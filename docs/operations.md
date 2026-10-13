---
id: "DOC-OPERATIONS"
title: "Operations Guide"
summary: "Current local development, testing, documentation, and Azure operation entry points."
version: "1.0.0"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - iac-bicep
perspectives:
  - cloud-architecture
layers:
  - cross-cutting
doc_type: playbook
status: accepted
code_refs:
  - "Makefile"
  - "scripts/start-backend.sh"
  - "scripts/start-frontend.sh"
  - "scripts/provision.sh"
test_refs:
  - "tests/test_brain.py"
  - "tests/test_doc_system.py"
---
# Operations Guide

## Local development

Requirements:

- Python 3.10 or newer
- Node.js 20 or newer
- frontend dependencies installed in src/client-edge
- backend dependencies installed for src/cloud-orchestrator
- Azure Functions Core Tools when using the Functions host

Start the two processes in separate terminals:

    make start-backend
    make start-frontend

The frontend normally listens on port 3000. The Functions workflow normally listens on port 7071. Runtime configuration may override these defaults.

## Tests

Run the regular Python test suite:

    make test

Run documentation validation:

    make docs-test

Build document indexes after moving or adding current documents:

    make docs-build

The shadow-environment test provisions and destroys Azure resources. It is included in make test-all and should not be treated as a local-only test.

## Benchmark workflow

Benchmark scripts live under src/cloud-orchestrator/embodied_brain/. Each new execution must use a unique run identifier and preserve its provider/model metadata, scenario count, seed, temperature, raw results, and summary.

Do not modify historical run files to make newer reports agree with them. If a reporting bug is found, document the correction and keep the original artifact.

## Azure operations

Preview infrastructure changes:

    make whatif

Provision:

    make provision

Deploy application containers:

    make deploy-aca

Destroy resources:

    make destroy

Before any state-changing Azure command:

1. verify the active subscription and tenant;
2. inspect .azure/main.parameters.json;
3. review the What-If output;
4. confirm the target resource group and naming prefix;
5. confirm whether cleanup is recoverable.

## Troubleshooting order

1. Check local configuration and provider/model selection.
2. Check backend health and route registration.
3. Check the frontend proxy path.
4. Check Azure Container Apps revision state and logs.
5. Check managed identity, role assignments, private DNS, and network access.
6. Record durable architecture fixes in an ADR; keep transient incident output out of current reference docs.
