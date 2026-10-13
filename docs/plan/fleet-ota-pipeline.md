---
id: "DOC-PLAN-FLEET-OTA-PIPELINE-MD-75"
title: "fleet ota pipeline"
summary: "fleet ota pipeline — specification reference auto-profiled into the OmniDocs multi-perspective index. (plan/fleet-ota-pipeline.md)"
version: "1.0.0"
updated_at: "2026-08-15"
authors: ["Shengwei Liu"]
domains:
  - multi-agent
perspectives:
  - cloud-architecture
  - frontend-engineering
layers:
  - cross-cutting
doc_type: specification
status: draft
code_refs: []
test_refs: []
---
# Fleet OTA Pipeline — 边缘模型灰度发布与自动回滚
# Fleet OTA Pipeline — Edge Model Canary Release & Automatic Rollback

> **Status:** Proposed (Plan) · **Aligned with:** [extension-analysis.md](./extension-analysis.md) · [dashboard-redesign-v2.md](./dashboard-redesign-v2.md) · **Study sync:** AZ-400 DevOps Engineer Expert
> **估计工期:** 7–10 天（与 AZ-400 学习并行，学一段做一段）
> **Supercedes:** 无（新增维度，非重构）

---

## 1. 痛点与定位 / The Gap & Positioning

### 1.1 Claude 指出的缺口

之前的画像 — "没有成熟边缘-云团队的中型公司" — 需要一个**具体的技术缺口**去对应，不能只停留在"云架构 + 技术判断"层面。

> **当前项目证明的是：什么时候该用边缘、什么时候该回云端（Kinematic-Token 定理）。
> 没有回答的是：边缘上跑的那个模型，怎么安全地更新？**

真实场景里，AGV / 机器人车队的边缘模型不是一次部署完就不动了，它会**持续迭代**：
- 新版本怎么**灰度推**（灰度 = canary）？
- 出问题怎么**秒级回滚**？
- 怎么监控**某台设备升级后行为异常**？

这是任何有边缘设备的公司都会撞到的运维难题，且没有现成标准答案 — 这就是项目要补的"从演示级到运维级"的那一环。

### 1.2 为什么选它，不选别的

| 维度 | 评估 |
|---|---|
| 真实存在、未被本项目解决 | ✅ 现有架构没有"版本/发布/回滚"概念 |
| 直接复用 AZ-400 正在学的内容 | ✅ CI/CD、灰度发布、自动回滚、监控反馈 = DevOps 考试核心 |
| 把考试知识点实证到项目里 | ✅ 学习与构建变成同一件事，不是两件事 |
| 面试追问升级 | ✅ 从"这个模拟对不对" → "如果车队有 50 台设备，你这套怎么扩展" |
| 视觉可演示（0 秒理解） | ✅ "把新版本推到 10% 设备 → 指标越界 → 自动回滚" 无需前置课 |
| 与已否决维度不冲突 | ✅ 非 D1（SLM 质量降级）、非 D2（WAL/向量钟脑裂），是全新的 Ops 维度 |

---

## 2. 与 AZ-400 认证的对齐 / AZ-400 Alignment

### 2.1 考试知识点 → 项目功能映射

| AZ-400 知识点 | 本项目落地为 | 阶段 |
|---|---|---|
| 发布策略：Canary / Blue-Green / Rolling / Rings / Recreate | OTA 模拟的 4 环发布 + 真实 ACA Revision 流量切分 | P1 / P2 |
| 发布门禁 Release Gates & 审批 Approvals | OTA 晋升阶段人工审批（GitHub Environments 保护规则） | P2 |
| 自动回滚 Automated Rollback | OTA 健康指标越界 → 自动回滚 + 审计事件 | P1 / P3 |
| 部署环 Deployment Rings | OTA 模拟的 Canary(10%) → 25% → 50% → 100% | P1 |
| CI/CD Pipeline as Code | GitHub Actions `deploy-ota.yml` | P2 |
| 包与版本管理（semver / 制品） | 模型版本注册表 `ModelVersionRegistry`（semver 约定） | P1 |
| 持续反馈：Application Insights / Azure Monitor | Track B 健康监控作业 + live 仪表盘整合 | P3 |
| 错误预算 Error Budget | 舰队健康面板的 error budget 仪表 | P1 / P3 |
| 自愈平台 / 自主平台 | 健康检查失败 → 自动回滚（self-healing） | P3 |

> **说明：** 考试大纲百分比会随版本变化，请以 MS Learn 最新 Skills Measured 为准。本表聚焦概念映射，不锁定权重。

### 2.2 学习节奏建议（学一段，做一段）

> 不要"先学完再动手"——那样学习没有载体；也不要"先做完再学"——那样项目缺理论支撑。
> 推荐：**每个 AZ-400 模块学完后，立刻把对应 Phase 做进项目。**

```
AZ-400 Module: 发布策略 → Phase 1（OTA 模拟控制面）
AZ-400 Module: CI/CD 管道 → Phase 2（真实 GitHub Actions + ACA）
AZ-400 Module: 监控反馈  → Phase 3（App Insights + 自动回滚闭环）
```

---

## 3. 核心概念：Ops 安全包络 / The OTA Theorem

为了与既有运动学-Token 定理对称，给 OTA 定义一个平行的"三因式"定理。

### 3.1 既有定理（物理安全包络）

$$
V_{max} \le \frac{D_{clearance}}{L_{network\_rtt} + \dfrac{T_{prompt}+T_{completion}}{S_{token\_rate}} + T_{brake}}
$$

三项各由舰队中一条轨道击破（L_network / T/S / Edge 短路）。

### 3.2 新增定理（运维安全包络）

$$
FleetRisk = P(regression) \times BlastRadius \times ExposureWindow
$$

| 因式 | 物理含义 | 被什么击破 | 对应工程机制 |
|---|---|---|---|
| $P(regression)$ | 新模型带回归的概率 | 无法在部署时控制 | 只能靠**检测**而非预防 |
| $BlastRadius$ | 暴露在坏版本下的设备比例 | **灰度/部署环** 缩小它 | Canary 10% → 25% → 50% → 100% |
| $ExposureWindow$ | $T_{detect} + T_{rollback}$ | **监控 + 自动回滚** 缩小它 | 健康指标越界 → 秒级回滚 |

> **一句话演示词：** *"运动学定理回答'边缘模型为什么必须存在'；OTA 定理回答'边缘模型换新版本时，怎么不让一个 bug 干掉整个车队'。前者证明物理安全，后者证明运维安全。"*

### 3.3 为什么这个叙事成立（避免重蹈 D1/D2 覆辙）

| 已否决维度 | 否决原因 | OTA 为何不同 |
|---|---|---|
| D1 SLM 降级 | 1D 轨道里 SLM 与硬编码规则视觉无差别 | OTA 讲的是**版本与运维状态**（徽章、健康仪表、回滚动画），视觉丰富 |
| D2 脑裂 / WAL | 需先讲向量钟才能理解 5 秒动画 | OTA "推新版本→坏了→回滚" 0 秒理解，且是 AZ-400 考试原题 |

---

## 4. 双轨架构 / Two Tracks

沿用项目"模拟 vs 真实"双模哲学（ADR-021）：

| | **Track A — 模拟** | **Track B — 真实** |
|---|---|---|
| 路由 / 入口 | `/dashboard/ota`（纯前端） | `.github/workflows/deploy-ota.yml` + 脚本 |
| 依赖 | 无后端，离线可用 | Azure Container Apps + ACR + App Insights |
| 数据源 | 本地状态机 + 共享物理内核 | 真实 ACA revision / 流量切分 / 遥测 |
| 目的 | 视觉化教学 + 5 秒自解释 + 面试武器 | 真实验证 + 考试知识点实证 |
| 成本 | $0 | 极低（ACA Standard 已有 + ACR 微量） |

**关系：** Track A 先做（教学与演示），Track B 后做（实证），两者共用同一套**概念模型**（版本注册表、健康指标、回滚策略、审计事件）— 概念在 Track A 中定义并被 Track B 复述。

---

## 5. Track A 详细设计（模拟 OTA 控制面）

### 5.1 核心概念

- **ModelVersionRegistry**：版本注册表（semver）。`v1.0.0`（稳定，当前线上）、`v2.0.0`（候选，带**潜在回归**）。
- **FleetDevice**：虚拟设备（50 台），每台持有一个 `version`。设备有确定的 `trafficLoad`（0..1，决定回归是否被触发）。
- **Deployment Rings**：Canary(10%) → 25% → 50% → 100%，每环晋升需"健康观测 + 门禁"。
- **Health Metrics**：`crashRate`、`latencyAnomalyRate`、`errorBudget`（滚动窗口聚合）。
- **Rollback Policy**：`shouldRollback()` 越界 → 自动回滚 → 审计事件。
- **AuditLog**：复用/扩展现有 `AuditLog` 组件，记录每个发布事件（deploy / promote / rollback / alert）。

### 5.2 v2.0.0 的"潜在回归"设计（关键）

回归必须**微妙**——单元测试通过、现场才炸，否则演示没有教育意义。

> **v2.0.0 回归设定：** 宣称刹车反应从 15ms 优化到 12ms，但该值只在低负载下成立；
> 真实公式 `brakeLatency = 12 + trafficLoad × 8`（ms）。当设备负载 > 0.75 时，实际刹车延迟超过安全包络 → 特定设备撞墙。

- 每台设备的 `trafficLoad` 是**确定性**的（seed 生成），因此演示结果可复现（延续舰队模拟"无 jitter、确定性"哲学）。
- Canary 队列入围设备由 seed 决定，确保"Regression Caught"场景中 canary 环恰好包含高负载设备，**必然**触发回滚。

### 5.3 三个 OTA 场景预设

| # | 场景 | 剧情 | 教学点 |
|---|---|---|---|
| 1 | **Clean Release** | v2.0.0 无回归 → canary 健康 → 全量晋升 → 全部设备升级成功 | 正常发布流程、部署环、晋升门禁 |
| 2 | **Regression Caught**（招牌） | v2.0.0 有回归 → canary 环 crashRate 越界 → **自动回滚** → 车队回到 v1.0.0 | "灰度为什么存在"——5 秒自解释 |
| 3 | **Regression Slipped** | 同 v2.0.0 bug，但发布配置错误：canary 太小(1%)、观测窗太短、阈值过松 → bug 扩散到 50% 才回滚 | 门禁参数（canary 大小/观测窗/阈值）决策的重要性——对应舰队模拟里 "Edge Disabled" 的角色 |

**Regression Slipped 的设计意义：** 与前三个场景形成"如果你跳过这一步会怎样"的对照，直接展示 AZ-400 里 release gate 参数权衡。

### 5.4 组件与文件清单

```
src/client-edge/src/app/dashboard/ota/
├── page.tsx                        # OTA 控制面主页面
├── config/releases.ts              # 版本注册表 + bug profile + 3 个 OTA 场景预设
├── hooks/useOtaSimulation.ts       # 舰队 + 发布状态机 + 健康监控（单 rAF、ref-based、gen counter，复用 useFleetSimulation2 模式）
└── components/
    ├── OtaHeader.tsx               # 发布状态徽章 + 当前版本
    ├── ReleaseRingsPanel.tsx       # 4 环部署 UI（Canary/25/50/100 + 晋升/回滚按钮 + 门禁状态）
    ├── FleetHealthPanel.tsx        # 各环健康仪表（crashRate / latencyAnomaly / errorBudget）
    ├── DeviceCohortView.tsx        # 50 台虚拟设备网格（版本徽章、状态、点击下钻到物理轨道）
    └── RollbackAuditConsole.tsx    # 审计事件流（复用/扩展 AuditLog）

src/client-edge/src/app/shared/physics/ota-metrics.ts   # 纯函数：crashRate / errorBudget / shouldRollback / fleetRisk
```

**共享内核新增 `ota-metrics.ts`**（与 `kinematic-token.ts` 对称，单一事实源、可单测）：

```ts
export interface OtaHealthParams {
  cohortCrashCount: number;
  cohortCompleted: number;
  observationWindowS: number;
  errorBudgetPct: number;       // 默认 5%（canary 环）/ 1%（舰队全局）
}
export function crashRatePct(p: OtaHealthParams): number;
export function shouldRollback(p: OtaHealthParams): boolean;   // crashRate > threshold 且窗口足够
export function exposureWindowS(detectS: number, rollbackS: number): number; // T_detect + T_rollback
export function fleetRisk(regressionP: number, blastRadius: number, exposureWindowS: number): number;
```

**修改文件：** `dashboard/layout.tsx` 增加导航项 `🚀 OTA`。

### 5.5 状态机

```
                 reset() / selectScenario()
    ┌─────────┐ ─────────────────────────────→ ┌─────────┐
    │ build   │                                │  idle   │
    └────┬────┘                                └────┬────┘
         │ deploy(v2 → canary 10%)                  │ start()
         ▼                                          ▼
    ┌─────────┐   healthy + gate    ┌─────────┐
    │ canary  │ ──────────────────→ │ promote │ (25% → 50% → 100%)
    └────┬────┘   (观测窗内无越界)     └────┬────┘
         │                                  │
   unhealthy / threshold breach             ▼
         ▼                            ┌─────────┐
    ┌─────────┐                       │  done   │  (全量晋升)
    │ rollback│ ◀─────────────────────┘
    └────┬────┘  (回到上一稳定版本)
         │ audit event
         ▼
    ┌─────────┐
    │  idle   │
    └─────────┘
```

**任意状态 → `rollback` 触发条件：** `shouldRollback()` 为真（当前环 crashRate 超阈值 且 观测窗时长足够），或用户手动回滚。

---

## 6. Track B 详细设计（真实流水线）

### 6.1 为什么用 ACA Revision Canary

Azure Container Apps **原生支持多 revision + 流量权重切分**，无需额外服务即可实现 canary / blue-green：

```
az containerapp update \
  --name omni-backend --revision-suffix v2 \
  --image <acr>/omni-backend:v2.0.0
az containerapp ingress traffic set \
  --name omni-backend \
  --revision-name <v2> --weight 10 \
  --revision-name <v1> --weight 90
```

### 6.2 流水线结构 `.github/workflows/deploy-ota.yml`

```
┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│ Job Build│ → │Job Canary│ → │ Job Monitor  │ → │  Job Promote     │ → │ Job Rollback │
│ build+push│   │deploy rev│   │ poll health  │   │  (Env gates:     │   │ on breach:   │
│ ACR image │   │ +split 10│   │ App Insights │   │  25/50/100%)     │   │ revert weight│
└──────────┘   └──────────┘   └──────┬───────┘   └──────────────────┘   └──────┬───────┘
                                     │ healthy? ── pass ──→ Promote
                                     │ fail ───────────────→ Rollback (auto)
```

| 步骤 | 说明 | AZ-400 知识点 |
|---|---|---|
| Build | `docker build` → `az acr push`（tag: semver + sha） | 制品管理、容器镜像 |
| Canary | 部署新 revision，流量切 10/90 | Canary 发布 |
| Monitor | `scripts/ota/monitor-health.py` 轮询 App Insights KQL（错误率 / p95 延迟），返回 pass/fail | 持续反馈、release gate |
| Promote | GitHub Environments `canary`/`production` + **required reviewer** 审批 → 25→50→100 | 审批门禁、部署环 |
| Rollback | `az containerapp ingress traffic set` 流量回到稳定 revision（秒级） | 自动回滚 |

### 6.3 辅助文件

```
.github/workflows/deploy-ota.yml    # 主发布流水线
.github/workflows/ota-rollback.yml  # 手动回滚工作流（失败演练用）
scripts/ota/canary-split.sh         # 流量切分封装
scripts/ota/rollback.sh             # 回滚封装（可复用为 auto-rollback 触发）
scripts/ota/monitor-health.py       # App Insights 健康轮询（KQL）
```

### 6.4 可选后端扩展（P3 之后评估）

- `cloud-orchestrator` 接入 OpenTelemetry，发射自定义指标 `sim_crash_rate` / `agent_latency_ms`，供 App Insights 与 live 仪表盘消费。
- 设备注册表：Cosmos DB 中 `desiredVersion` / `reportedVersion` 双字段，模拟设备轮询采用新版本（把"OTA"落到设备语义，而非仅容器语义）。**注意：** 此扩展若过度设计会滑向 D2，务必只保留版本采纳，不做冲突消解。

---

## 7. 分阶段路线图 / Phased Roadmap

> 对齐 AZ-400 学习节奏：**学一段，做一段。**

### Phase 0 — 概念定型（0.5 天）

- [ ] 本文档获批
- [ ] 与 AZ-400 官方 Skills Measured 核对知识点映射表
- [ ] 后续：批准后提交 ADR-036 `[architecture]-Fleet-OTA-Pipeline`（符合 `_STANDARDS.md`）

### Phase 1 — Track A 模拟 OTA 控制面（2–3 天）

- [ ] `shared/physics/ota-metrics.ts` 纯函数 + 单测用例
- [ ] `config/releases.ts`：版本注册表 + bug profile + 3 个场景
- [ ] `useOtaSimulation.ts`：舰队 50 设备 + 发布状态机 + 健康监控（单 rAF）
- [ ] 组件：`ReleaseRingsPanel` / `FleetHealthPanel` / `DeviceCohortView` / `RollbackAuditConsole`
- [ ] `layout.tsx` 导航 + `page.tsx` 整合
- [ ] **验收：** 断网可用；3 个场景结果确定；"Regression Caught" 5 秒自解释

### Phase 2 — Track B 真实流水线（2–3 天）

- [ ] ACR + ACA revision canary 手动演练成功
- [ ] `deploy-ota.yml` 全流程（build → canary → monitor → promote）
- [ ] GitHub Environments + required reviewer 审批门禁
- [ ] `ota-rollback.yml` + `rollback.sh` 手动回滚演练
- [ ] **验收：** 一次完整发布：canary 10% → 审批晋升 → 100%；一次手动回滚 < 60 秒

### Phase 3 — 监控反馈闭环（1–2 天）

- [ ] `monitor-health.py` 轮询 App Insights KQL，接入 promote job
- [ ] `shouldRollback` 对接真实遥测（模拟崩溃事件注入或 API 错误率）
- [ ] live 仪表盘整合健康面板（可复用 `InfraTelemetryPanel` 模式）
- [ ] **验收：** 注入故障 → 自动回滚 → 审计事件完整

### Phase 4 — 整合与演示（1 天）

- [ ] `docs/dashboard/00-overview.md` 补充 OTA 章节
- [ ] 演示脚本（复用 `presentation-script.md` 风格）
- [ ] 回归测试：既有 4 路由 + `/kinematic` 无回归
- [ ] 更新 `PROJECT_MEMORY.md` 页面职责表

**总工期：~7–10 天**（不含 AZ-400 学习时间，学习与构建并行）。

---

## 8. 验收标准 / Acceptance Criteria

- [ ] **离线可用**：断网 + 无后端时，`/dashboard/ota` 3 场景全部可演示
- [ ] **5 秒自解释**：静音录屏，陌生人能指出"哪个环坏了、发生了什么、为什么回滚"
- [ ] **确定性**：同场景每次运行结果一致（seed 固定）
- [ ] **定理完整**：Ops 安全包络三因式（P × BlastRadius × ExposureWindow）在 UI 有对应展示
- [ ] **共享内核**：`grep -r "shouldRollback\|crashRatePct"` 仅命中 `shared/physics/ota-metrics.ts`
- [ ] **无回归**：`/dashboard`、`/dashboard/theorem`、`/dashboard/compare`、`/dashboard/live`、`/kinematic` 行为不变
- [ ] **真实闭环**（Track B）：故障注入 → 自动回滚 → 审计事件三件套完成

---

## 9. 明确不做 / De-scope

| 不做项 | 原因 |
|---|---|
| 真实设备固件 OTA（MCU 层） | 无物理设备，超出项目边界 |
| 设备注册表冲突消解（向量钟等） | D2 已否决，仅保留 `desiredVersion/reportedVersion` 采纳语义 |
| SLM 质量降级可视化 | D1 已否决，与本维度无关 |
| Prometheus / Grafana 自建监控栈 | 用 App Insights / 简单指标，避免引入运维复杂度 |
| 多区域 / 多环境发布（dev/staging/prod 全链） | 单环境演示即可，考试叙事足够；需要时作为后续 |

---

## 10. 风险与依赖 / Risks & Dependencies

| 风险 | 缓解 |
|---|---|
| OTA 模拟复杂度膨胀，与舰队模拟重复 | 严格复用单 rAF / ref-based / gen counter 模式与共享内核 |
| Azure 成本（ACA revision 保留 / ACR / App Insights） | 保持 revision 数量受限、监控查询限量；成本预计极低 |
| AZ-400 大纲变动 | 以 MS Learn 最新 Skills Measured 为准，概念映射不锁版本 |
| 过度设计滑向 D2 | 在 Phase 边界明确"不做"清单，评审时对照 §9 |

---

## 11. 面试叙事 / Interview Narrative

> **追问："如果车队现在有 50 台设备，你这套怎么扩展？"**

回答骨架：
1. **部署环缩小 BlastRadius**：先 10% canary，观测健康后 25/50/100 晋升，任何时刻最多 10% 设备暴露在未验证版本下。
2. **错误预算 + 监控缩小 ExposureWindow**：crashRate / latencyAnomaly 聚合进 error budget，越界立即触发 `shouldRollback()`。
3. **自动回滚把 T_rollback 压到秒级**：ACA revision 流量一键切回稳定版，全程留审计。
4. **这套正好是 AZ-400 发布策略的实证**：canary、deployment rings、release gates、automated rollback、continuous feedback — 考试知识点和项目是同一件事。

> 关键对比句：**"运动学-Token 定理证明的是'模型够快才能安全'；OTA 定理证明的是'版本迭代够稳才能长期安全'。一个管物理层，一个管运维层。"**

---

## 12. 中文总结

当前项目证明了"什么时候该用边缘、什么时候该回云端"，但没有回答"边缘模型怎么安全地更新"。本项目补齐的正是这一环：**Fleet OTA Pipeline — 边缘模型灰度发布与自动回滚。**

它有三重价值：
1. **真实痛点**：任何有边缘设备的公司都会撞到的运维难题，且没有标准答案；
2. **AZ-400 实证**：CI/CD、灰度发布、自动回滚、监控反馈 = 考试核心，学习与构建合一；
3. **演示升级**：从"这个模拟对不对"升级到"50 台设备怎么扩展"，说服力高一个量级。

**架构上**分两轨：Track A 模拟 OTA 控制面（`/dashboard/ota`，纯前端、确定性、离线可用），Track B 真实流水线（GitHub Actions + ACR + ACA revision canary + App Insights），共享同一套概念模型与新增的 `shared/physics/ota-metrics.ts` 内核。

**学习节奏**：学一段 AZ-400，做一段项目（P1 发布策略 → P2 CI/CD → P3 监控反馈），两者互相喂养。

> **一句话：运动学定理回答"边缘模型为什么必须存在"，OTA 定理回答"边缘模型换版本时怎么不让一个 bug 干掉整个车队"——前者证明物理安全，后者证明运维安全。**
