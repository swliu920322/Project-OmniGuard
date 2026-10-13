---
id: "DOC-BP-INDEX"
title: "Azure Architecture Blueprint Catalog"
summary: "Catalog of retained advisory Azure architecture references, separated from current deployment facts."
version: "2.0.0"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - iac-bicep
perspectives:
  - cloud-architecture
layers:
  - iac-infra
doc_type: blueprint
status: accepted
code_refs:
  - ".azure/main.bicep"
test_refs:
  - "tests/shadow-e2e-test.py"
---
# Azure Architecture Blueprint Catalog

These blueprints are advisory references. They do not collectively describe one deployed environment. Validate every recommendation against the current Bicep modules, parameters, Azure subscription, and tests.

## Foundation

| Blueprint | Focus |
|---|---|
| [01 Identity Foundation](01-identity-foundation.md) | Identity and secret-handling patterns |
| [02 API Management Gateway](02-api-management-gateway.md) | Gateway and policy options |
| [03 Security Posture](03-security-posture.md) | Security controls and review checklist |
| [04 Observability Platform](04-observability-platform.md) | Logging, metrics, and tracing |
| [05 Compute and Container Optimization](05-compute-container-optimization.md) | Compute trade-offs |
| [06 Data Platform](06-data-platform-deep-dive.md) | Data-service patterns |
| [07 Event-Driven Integration](07-event-driven-integration.md) | Messaging and event flow |

## Operational architecture

| Blueprint | Focus |
|---|---|
| [09 Cost and FinOps](09-cost-finops.md) | Cost controls and estimates |
| [10 HA/DR](10-ha-dr-business-continuity.md) | Availability and recovery options |
| [11 Compliance and Governance](11-compliance-governance.md) | Governance controls |
| [12 AI/ML Platform](12-ai-ml-platform.md) | AI service topology |
| [13 Private Networking and DNS](13-enterprise-networking-private-dns.md) | Network isolation patterns |
| [14 IoT DPS Provisioning](14-iot-dps-zero-touch-provisioning.md) | Device provisioning |
| [15 Architecture Methodology](15-cloud-architect-methodology.md) | Review methodology |

## Repository-specific operations

| Blueprint | Focus |
|---|---|
| [24 E2E Troubleshooting](24-e2e-troubleshooting-playbook.md) | Troubleshooting procedure |

Completed plans, backlogs, migration notes, cloud review snapshots, and old environment output are preserved under docs/archive/. They are intentionally absent from this current catalog.
