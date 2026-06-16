# Project-OmniGuard

Enterprise-grade zero-trust landing zone tailored for low-cost, high-performance edge-cloud orchestration. Built
specifically as a tactical sandbox to master secure network perimeters and state machines.

## Key Performance Indicators (KPIs)

- **Zero-Warning Compilation**: Verified against Bicep Linter core specifications.
- **Edge-Cloud Rendering Latency**: Shipped 100% of digital human WGSL animation pipelines to client browsers, scaling
  server-side compute cost to absolute **$0.00**.
- **Network Isolation Barrier**: 4 discrete Private Endpoint nodes completely decapitated public endpoints for Azure
  OpenAI and Storage Account.

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

## Operational Runbook (Zero-Friction Hot Deployment)

Execute idempotent deployment without deleting the resource group:

```bash
az deployment sub create \
  --name omni-permanent-base \
  --location japaneast \
  --template-file .azure/main.bicep \
  --parameters location=japaneast prefix=omni
```

