# Azure Cloud Architect — Blueprint Catalog

> *Project-OmniGuard 云架构蓝图索引*
> 覆盖 Azure 云架构师日常工作中 80%+ 的核心领域，每个蓝图关联具体场景与 OmniGuard 落地路径。

---

## 领域矩阵

| # | 领域 | Azure 服务 | 架构师工作占比 | OmniGuard 现状 | 优先级 |
|---|------|-----------|--------------|----------------|--------|
| 1 | **身份与访问 (IAM)** | Entra ID, RBAC, Managed Identity, Key Vault, Conditional Access | ~15% | 无 Entra ID 集成, 无 KV | P0 |
| 2 | **网络与边界安全** | VNet, Firewall, WAF, Front Door, Private Link, DNS | ~12% | Hub-Spoke VNet, 3x PE, NSG 已就绪 | P0 |
| 3 | **API 管理与网关** | API Management, Front Door, App Gateway | ~10% | 无 APIM, 前端 catch-all 做代理 | P1 |
| 4 | **可观测性 (Observability)** | Monitor, Log Analytics, App Insights, Workbooks, Alerts | ~10% | LA Workspace + App Insights SDK 已设 | P1 |
| 5 | **安全态势 (Security Posture)** | Defender for Cloud, Sentinel, Policy, Purview | ~10% | 无 | P1 |
| 6 | **计算与容器化** | ACA, AKS, ACR, Functions | ~8% | ACA + Functions 已运行 | P0 |
| 7 | **数据平台** | Cosmos DB, SQL DB, Redis, AI Search, Data Lake | ~8% | Cosmos DB 已用, 需优化 | P1 |
| 8 | **事件驱动与集成** | Event Grid, Service Bus, Logic Apps, Durable Functions | ~7% | IoT Hub -> Event Hub 路由已设 | P2 |
| 9 | **CI/CD & DevOps** | DevOps, GitHub Actions, Deployment Slots, Bicep | ~7% | sh/ 脚本部署, 无 CI/CD pipeline | P1 |
| 10 | **成本与 FinOps** | Cost Management, Budgets, Reservations, Advisor | ~5% | 无 | P1 |
| 11 | **高可用与灾备 (HA/DR)** | Availability Zones, Geo-replication, Backup Vault | ~5% | 单区域 Singapore | P2 |
| 12 | **合规与治理** | Policy, Landing Zones, Blueprints, Purview Compliance | ~3% | 无 | P2 |
| 13 | **企业网络与私有 DNS** | VNet, Private Link, Private Endpoint, Private DNS Zone | ~15% | Hub-Spoke 无隔离, PE DNS 解析缺失 | P1 |
| 14 | **IoT 零接触预配** | Device Provisioning Service (DPS), X.509 CA Certs | ~10% | 静态连接字符串, 无 DPS 动态预配 | P1 |

---

## 蓝图总览

每个蓝图独立成文件，格式统一：

```
docs/reference/blueprints/
├── 00-azure-architect-blueprints-index.md      ← 本文 (导航索引)
├── cloud-architecture-review.md                ← 云架构审查与修复报告 (新)
├── configurator-development-plan.md            ← 启动配置器与估算台开发计划 (新)
├── 01-identity-foundation.md                    ← 身份基座
├── 02-api-management-gateway.md                 ← API 网关
├── 03-security-posture.md                       ← 安全态势
├── 04-observability-platform.md                 ← 可观测平台
├── 05-compute-container-optimization.md         ← 计算优化
├── 06-data-platform-deep-dive.md                ← 数据平台深化
├── 07-event-driven-integration.md               ← 事件驱动集成
├── 08-cicd-devops-pipeline.md                   ← CI/CD 流水线
├── 09-cost-finops.md                            ← 成本优化
├── 10-ha-dr-business-continuity.md              ← 高可用与灾备
├── 11-compliance-governance.md                  ← 合规与治理
├── 12-ai-ml-platform.md                         ← AI/ML 平台 (预留)
├── 13-enterprise-networking-private-dns.md      ← 企业网络与私有 DNS (新)
├── 14-iot-dps-zero-touch-provisioning.md        ← IoT 零接触预配 (新)
├── 15-cloud-architect-methodology.md             ← 云架构师方法论与集成场景 (核心)
├── 16-enterprise-iac-governance-plan.md          ← 企业级 IaC 产品化与治理规划 (新)
├── 17-deepseek-implementation-target.md          ← DeepSeek V4 任务规范: 路由网段校验与预检 (新)
├── 18-web-preflight-integration.md               ← Web 云端预飞行校验深度集成 (新)
├── 19-tags-and-package-downloader.md             ← 企业标签治理与 IaC 配置包打包下载 (新)
├── 20-gitops-pipeline-integration.md             ← GitOps 自动流水线动态注入 (新)
├── 21-thorough-gitops-scenarios.md               ← 三轨式企业 GitOps 流程深度注入 (新)
└── 22-key-vault-physical-integration.md          ← Key Vault 物理整合与零信任身份闭环 (新)
```

---

## 场景速查表

| 场景 | 相关蓝图 | 复杂度 | 预估工时 |
|------|---------|--------|---------|
| 为 ACA 启用 Managed Identity + Key Vault 集成 | 01 | 低 | 1天 |
| 替换连接字符串为 Secret Volume / Key Vault Reference | 01 | 中 | 1天 |
| 前置 Azure Front Door + WAF 做全球加速/防攻击 | 02 | 中 | 2天 |
| 部署 API Management 统一后端 API 治理 | 02 | 高 | 3天 |
| 接入 Defender for Cloud 统一安全评分 | 03 | 低 | 0.5天 |
| 部署 Sentinel SIEM 做安全事件关联分析 | 03 | 高 | 5天 |
| 构建 Azure Monitor 工作簿仪表盘 (实时 IoT/Fleet) | 04 | 中 | 2天 |
| 配置 Prometheus + Grafana 容器监控 (ACA 集成) | 04 | 中 | 1天 |
| 配置智能告警 (Dynamic Thresholds, Action Groups) | 04 | 中 | 1天 |
| ACR 启用 Geo-replication 或 Premium SKU | 05 | 低 | 0.5天 |
| ACA Dapr 集成 (状态管理、发布订阅、绑定) | 05 | 高 | 3天 |
| 部署 Azure Redis Cache 做会话/缓存层 | 06 | 中 | 1天 |
| Cosmos DB 从 Session 一致性升级 + 多区域写入 | 06 | 中 | 2天 |
| 引入 Azure AI Search 做 IoT/知识库全文检索 | 06 | 高 | 3天 |
| Event Grid + Service Bus 解耦 IoT 事件处理 | 07 | 中 | 2天 |
| Durable Functions 编排 IoT 设备固件更新工作流 | 07 | 高 | 3天 |
| Logic Apps 做低代码事件响应/通知 | 07 | 低 | 1天 |
| GitHub Actions CI/CD: Bicep lint + 自动部署 | 08 | 中 | 2天 |
| ACA Blue/Green 部署 + 流量分割 | 08 | 高 | 2天 |
| 设置 Budget + 告警 + Cost Export 到 Power BI | 09 | 低 | 1天 |
| 启用 Availability Zones 多 AZ 部署 | 10 | 中 | 1天 |
| 配置 Cosmos DB 自动备份 + 异地恢复 | 10 | 中 | 1天 |
| Azure Policy 强制合规 (标签/区域/SKU 审计) | 11 | 中 | 2天 |
| 部署 Landing Zone 架构 (管理组/订阅治理) | 11 | 高 | 5天 |
| 部署 Hub-Spoke 拓扑并配置 Private DNS 自动注册 | 13 | 高 | 3天 |
| 配置 IoT Hub Device Provisioning Service X.509 注册 | 14 | 高 | 4天 |
| [集成场景 A] 零特权极简沙箱部署与网络防火墙补偿 | 15 | 中 | 2天 |
| [集成场景 B] 零信任“身网双锁”内网拓扑与 DNS 自愈 | 15 | 高 | 4天 |
| [集成场景 C] 异步背压自愈与双通道控制链路解耦 | 15 | 极高 | 5天 |

---

## 使用方式

1. 浏览索引，找到感兴趣的领域
2. 打开对应蓝图文件，查看：
   - 当前 OmniGuard 现状分析
   - 目标架构设计 (含 Bicep/CLI/AzAPI 示例)
   - 实施步骤 (逐步可执行)
   - 验收标准 (如何验证成功)
3. 从 P0 开始，逐步推进

> **建议实施顺序**: 01 → 04 → 05/08 → 02 → 03 → 06 → 09 → 07 → 10 → 11
> 核心思路: 先打好身份安全基座 → 建立可观测性 → 完善 CI/CD → 再拓展高阶领域

---
*Generated: 2026-07-02 | Architect: AI Cloud Architect | Project: OmniGuard v1.0.0*
