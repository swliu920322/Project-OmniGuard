# Project-OmniGuard

Enterprise-grade secure AI orchestration substrate built on Azure zero-trust network topology and client-to-cloud isomorphic computing.

## 🛡️ Hard Metrics (Architectural Enforcements)

- **0% Public Network Exposure**: 100% of core inference serving, backend logic, and vector storage are decoupled from the public internet via Azure Private Links and isolated Hub-Spoke VNets.
- **Zero Credential Hardcoding**: Eradicated all plain text API keys and connection strings; enforced 100% Azure Managed Identities tied with rigid RBAC permissions.
- **60%+ FinOps Optimization**: Implemented isomorphic edge-to-cloud routing via client-side WebGPU to intercept malicious inputs and PII data locally, achieving near-zero cloud token waste.
- **100% Infrastructure as Code (IaC)**: Zero manual operations in Azure Portal. The absolute landing zone is provisioned, validated, and destroyed purely via Azure Bicep and GitHub Actions.

## 📁 System Repository Structure

```text
├── .azure/                  # Infrastructure as Code (IaC) Base
│   ├── main.bicep           # Hub-Spoke network topology & resource provisioning
│   └── network-rules.json   # NSG/ASG micro-segmentation matrix
├── .github/workflows/       # CI/CD Automation
│   └── deploy-infra.yml     # Credentialless deployment via GitHub OIDC federation
├── src/
│   ├── client-edge/         # Next.js frontend with WebGPU PII guardrails
│   └── cloud-orchestrator/  # Serverless asynchronous auditing & token circuit breakers
├── docker-compose.serving.yml# Local high-performance private GPU/CPU inference cluster
├── docs/adrs/               # Architecture Decision Records (ADRs)
│   ├── ADR-001-Network-Isolation.md
│   └── ADR-002-Isomorphic-FinOps.md
└── README.md                # System Topology & Governance Manifest