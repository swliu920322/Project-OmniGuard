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
│       ├── requirements.txt   # Python 依赖清单
│       ├── host.json          # 网关配置
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

## 📚 Documentation Index (系统文档地图)

我们遵循行业标准的 **Diátaxis 架构模型**，将项目中的设计、操作和教程文档系统化归档至 `docs/` 目录：

### 1. 🚀 Tutorials (上手引导)
* **[快速上手部署指南](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/tutorials/quickstart.md)**：介绍如何进行本地启动、微服务配置与 Azure 云部署。
* **[用户向导手册](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/tutorials/user-guide.md)**：面向使用者的功能使用向导。

### 2. 🛠️ Operations (运行与操作指南)
* **[命令行调用参考手册](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/operations/command-reference.md)**：包含日常抓取分析、`FORCE_REFRESH` 强刷历史数据等命令字典。
* **[上线与测试检查清单](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/operations/release-checklist.md)**：保障系统变动时的零故障上线清单。

### 3. 📐 Reference (协议、设计蓝图与架构集成)
* **[AGY 协议设计文档](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/reference/agy-protocol.md)**：底层设备通信及 Agent 协议核心定义。
* **[系统集成设计规范](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/reference/system-integration-design.md)**：高层云边一体化协同设计图纸。
* **设计蓝图集 (Blueprints)**：
  - [前端监控面板设计](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/reference/blueprints/frontend-dashboard.md)
  - [多 Agent 编排机制](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/reference/blueprints/multi-agent-orchestration.md)
  - [设备机队看板设计](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/reference/blueprints/fleet-dashboard.md)
  - [云上环境验证设计](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/reference/blueprints/proof-of-cloud.md)

### 4. 🧠 Explanation & Decision (设计决策、ADR 与审计)
* **架构决策记录 (ADRs)**：存放在 `docs/adrs/` 目录下的多份系统演进历史决策记录（ADR-002 至 ADR-007）。
* **架构审计与重构规范 (Audits)**：
  - [5W2H 架构重构设计规范](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/audits/5w2h-redesign-spec.md)：系统架构 5W2H 与 Lambda 去重设计标准。
  - [架构重构修改计划](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/audits/redesign-plan.md)：应对 DeepSeek 报告的重构指南。
  - [X 爬虫书签一键同步设计](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/audits/bookmarklet-sync-design.md)：本地安全代理防封号重构。
  - [DeepSeek 架构审计报告](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/audits/deepseek-audit-report.md)：原始架构缺陷审计分析。
  - [旧版架构重构评估](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/audits/architecture-redesign.md) / [重构总结概要](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/docs/audits/redesign-summary.txt)

---


