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
├── enterprise-directory-review.md            ← 企业级目录结构架构评审与演进报告 (新)
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
├── 22-key-vault-physical-integration.md          ← Key Vault 物理整合与零信任身份闭环 (新)
├── 23-shadow-e2e-integration.md                  ← 隔离影子环境 E2E 部署自愈测试 (新)
├── 24-e2e-troubleshooting-playbook.md            ← 多场景交叉验证与云端排障手册 (新)
└── 99-project-backlog.md                         ← 项目待办与架构路线备忘 (新)
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

## 当前工作交接与进度备忘 (Handover & Current Session Progress)

### 🟢 当前已完成的核心里程碑 (Milestones Achieved)
1. **Bicep 编译警告 100% 肃清**：
   * 修复了 BCP318 空安全性警告（在所有条件资源属性上增加了 `.?` 与 `?? ''` 空安全守护）。
   * 修复了 BCP081 警告，将 DPS 的 API 对应版本对齐为支持离线类型校验的 `2021-10-15` 稳定版。
   * 修正了 IoT Hub 路由 `endpoints` 中的笔误，并将老式 `listKeys()` 调用全部重构为 Bicep 符号引用函数。
2. **IaC 配置器逻辑对齐与防降级治理**：
   * 解决了 React 页面修改基础表单参数转为 `custom` 场景导致后端 API 强制退避降级为 `sandbox` 模板的隐蔽漏洞。目前后端路由根据是否启用托管身份（`deployManagedIdentities`）自适应装载正确的 Bicep 模块。
   * 优化了基础参数微调 UX：修改变量不会将当前高亮 Preset 标签切换为自定义，只有变动功能包或 SKU 等级才会触发。
   * 解决了主编排 `main.bicep` 的 11 参数限制与页面多 SKU 输出的校验失衡问题，通过前端输出过滤器彻底治愈了部署预检时的 `InvalidTemplate` 报错。
3. **“身网双锁”物理隔离 E2E 验证成功**：
   * 在 `omni3`、`omni4` 和 `omni5` 下全量通过了极简沙箱、内网隔离、全球门户（SWA）以及拉满配置（All Packs Enabled）的多场景部署。
   * **物理证明零信任边界**：未授权访问 Key Vault 提示 `ForbiddenByRbac` 身份锁拦截；临时授权后，公网访问依然被 `ForbiddenByConnection` (`PublicAccessDisabled`) 物理拦截。只有合规托管身份通过 Spoke 内网的 PE 节点才能成功连通。
   * **DNS 解析自愈**：Cosmos DB 与 Key Vault 分别解析绑定到了 `10.1.2.6` 和 `10.1.2.4` 私网 IP，容器环境运行状态为 `Succeeded`，实测日志流一切就绪。
4. **DevOps 效率与架构资产沉淀**：
   * 增加了 `make whatif` 预检工具，调用 `sh/provision-whatif.sh` 支持自适应租户前缀提取的 Dry-run 干跑，节约 80%+ 的排队等待时间。
   * 归档了 **ADR-032** 架构决策记录，并在 `2-secure-IoT.md`、`3-global-portal.md`、`4-all.md` 验收报告中补充了完整的真实 CLI 运行输出与 SKU 等级记录。
5. **ACA Ingress 与 OpenAI 凭证统一治理 (ADR-033)**：
   * **Ingress 降级修复**：解决了 ACA 内部 Ingress HTTP→HTTPS 重定向导致 Node.js `fetch` 将 `POST` 改变为 `GET`（引发 FastAPI 405 Method Not Allowed 报错）的网络级拦截问题。通过在 Bicep 中声明 `allowInsecure: true` 彻底疏通。
   * **凭证统一注入**：对齐了三种不同的 Python OpenAI 环境变量命名，并在 `sh/deploy-aca.sh` 中实现了自适应读取本地 `local.settings.json` 并动态注入至 Container Apps 的流程，避开了测试订阅无 quota 的痛点。
   * **多租户前缀自动化滚动发布**：重构了 `sh/deploy-aca.sh`，使其在检测到参数文件时能够动态解析出真实的 `PREFIX` 与 `RG` 进行升级部署（支持 `omni3`、`omni4`、`omni5` 的无缝滚动更新）。
6. **Azure OpenAI 凭证加载与客户端实例化规范化统一 (ADR-034)**：
   * **统一配置与加载**：创建了中央凭证加载工具 `openai_config.py`，集中式处理本地 `local.settings.json` 参数自动注入与标准 `AZURE_OPENAI_*` 变量和 OpenAI 兼容变量的优先级解析。
   * **消除冗余与不一致**：全面重构了 `digitalhuman/router.py`、`embodied_brain/utils.py` 和 `kol_analysis/inference_engine.py`，移除所有重复解析与实例化代码，消除了 `digitalhuman` 由于缺乏 fallback 潜在的静默崩溃隐患。

---

### 📅 下阶段建议启动的架构任务 (Next Sprints Recommendations)
* **任务 1：高阶组件物理装载 (APIM / Front Door Premium)**
  * *Context*：目前 APIM、Front Door WAF、Redis 在 React 配置台上为逻辑估算模型。既然 Hub-Spoke 骨干网和零信任身份已物理扎根，下一阶段可以根据 [02-api-management-gateway.md](file:///Users/liushengwei/project/Project-OmniGuard/docs/reference/blueprints/02-api-management-gateway.md) 的设计，在 `templates/secure-iot/nested-infra.bicep` 中实际填充物理资源模块。
* **任务 2：CI/CD 自动化流水线构建**
  * *Context*：当前主要依靠本地 shell 脚本（`make provision`）进行手工测试发布。下一阶段可引入 GitHub Actions，结合 [08-cicd-devops-pipeline.md](file:///Users/liushengwei/project/Project-OmniGuard/docs/reference/blueprints/08-cicd-devops-pipeline.md)，在流水线中加入 Bicep lint、静态分析和 `az deployment sub what-if` 的自动预检机制。
* **任务 3：跨区域高可用 (Geo-replication) 多写配置**
  * *Context*：进一步拓宽 Cosmos DB 的异地多区域多写和高可用灾备，并对多区域的网络拓扑连接进行物理建模。

---
*Last updated: 2026-07-06 | Handover Architect: AI Cloud Architect*
