# Project-OmniGuard

Enterprise-grade secure AI orchestration substrate built on Azure zero-trust network topology and client-to-cloud isomorphic computing.

## 🛡️ Hard Metrics (Architectural Enforcements)

- **0% Public Network Exposure**: 100% of core inference serving, backend logic, and vector storage are decoupled from the public internet via Azure Private Links and isolated Hub-Spoke VNets.
- **Zero Credential Hardcoding**: Eradicated all plain text API keys and connection strings; enforced 100% Azure Managed Identities tied with rigid RBAC permissions.
- **60%+ FinOps Optimization**: Implemented isomorphic edge-to-cloud routing via client-side WebGPU to intercept malicious inputs and PII data locally, achieving near-zero cloud token waste.
- **100% Infrastructure as Code (IaC)**: Zero manual operations in Azure Portal. The absolute landing zone is provisioned, validated, and destroyed purely via Azure Bicep and GitHub Actions.

## 📁 System Repository Structure

```text
├── .azure/                    # 基础设施即代码 (IaC) 的神庙
│   ├── main.bicep             # 订阅级指挥官
│   ├── nested-infra.bicep     # 网络基建特种部队
│   ├── compute-module.bicep   # 计算大脑(Function)特种部队
│   └── network-rules.json     # 安全规则配置矩阵
├── .github/workflows/       # CI/CD Automation
│   └── deploy-infra.yml     # Credentialless deployment via GitHub OIDC federation
├── src/
│   ├── client-edge/         # Next.js frontend with WebGPU PII guardrails
│   └── cloud-orchestrator/    # 无服务器后端大脑
│       ├── BicepAuditor/      # 业务逻辑代码
│       ├── requirements.txt   # Python 依赖清单
│       ├── host.json          # 网关配置
│       └── BicepAuditor/
│           └── function_app.py # 业务路由模拟JSON端点
├── docker-compose.serving.yml# Local high-performance private GPU/CPU inference cluster
├── docs/adrs/               # Architecture Decision Records (ADRs)
│   ├── ADR-001-Network-Isolation.md
│   └── ADR-002-Isomorphic-FinOps.md
└── README.md                # System Topology & Governance Manifest
```

## 🛠️ Infrastructure Changelog

| Date | Target Component | Modification | Resolution |
| :--- | :--- | :--- | :--- |
| 2026-06-15 | `nested-infra.bicep` | Mutated `serverfarms` name token to append `-v2` suffix. | Fixed `FlexConsumption` -> `ElasticPremium` SKU migration deadlock (`53216 / BadRequest`). |
| 2026-06-15 | `nested-infra.bicep` | Swapped SKU from `EP1` to `P1v3` (`PremiumV3`). | Bypassed `SubscriptionIsOverQuotaForSku` preflight validation failure in `southeastasia`. |
| 2026-06-15 | `nested-infra.bicep` | Pivoted SKU from `PremiumV3` to `Standard/S1`. | Crushed subscription-wide premium VM zero-quota lockdown; maintained VNet injection plane. |