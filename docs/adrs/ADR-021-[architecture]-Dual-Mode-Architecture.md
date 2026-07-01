# Architectural Decision Record (ADR 021)

## Title

ADR 021: Dual-Mode Architecture — Simulation (Pure Frontend) vs Live (Cloud-Backed) Under One Roof

---

## Status

**Implemented**

---

## Context

Project OmniGuard must serve two fundamentally different audiences with contradictory requirements:

| Stakeholder | Needs | Conflict |
|---|---|---|
| Thesis defense committee | Deterministic, repeatable demo — must work offline, must produce same result every time | "Real" means non-deterministic, network-dependent |
| Technical reviewer / engineer | Real infrastructure telemetry — actual latency numbers from Azure OpenAI, Cosmos DB metrics | "Simulated" means potentially unrealistic |
| Demo audience (general) | 5-second self-explanatory visual — clear cause and effect, no prerequisite knowledge | Real telemetry is complex and requires explanation |
| Author (maintainer) | Single codebase, minimal duplication, shared types and utilities | Two modes risk diverging into separate applications |

The naive approach is one page that tries to be both: show a simulation by default, but overlay "real" data when available. This fails because:

1. **Presentation conflict**: simulation needs simplified visuals (3 abstract AGV tracks) while live needs detailed topology diagrams (VNet, Cosmos DB, Private Endpoints). Squeezing both into one layout makes neither effective.
2. **State management conflict**: simulation uses local refs + rAF; live uses async fetch + API responses. One hook cannot cleanly switch between synchronous and asynchronous control flows.
3. **Credibility problem**: if simulation and real data are on the same page, the audience questions which numbers are real and which are simulated. The thesis committee needs a clear boundary.

---

## Decision

**Maintain two independent implementations under the same navigation roof, sharing only the physics kernel:**

```
/dashboard                  ─── Fleet Simulation (useFleetSimulation2)
  ├── 100% frontend
  ├── offline, deterministic
  ├── 4 scenario presets
  ├── 3 AGV tracks + agent pipeline
  └── Token Breakdown drawer (live param control)

/dashboard/live             ─── Live Cloud Integration (useFleetSimulation)
  ├── Requires Azure Functions (port 7071)
  ├── Real network latency + LLM response
  ├── 5 tenant scenarios with real safety rules
  ├── Physical Twin + Cloud Topology + Sandbox
  └── Three-Agent Orchestration Flow (real API calls)
```

### Sharing Boundaries

| Artifact | Shared? | Mechanism |
|---|---|---|
| Physics kernel | ✅ Shared | `shared/physics/kinematic-token.ts` — both import `brakingDistanceM`, `computeCloudLatencyMs` |
| Navigation layout | ✅ Shared | `dashboard/layout.tsx` — tabs: Theorem, Compare, Fleet, Live |
| TypeScript types | ⚠️ Partial | `LLMBreakdownParams` shared; `TrackConfig`, `Scenario` are sim-only |
| React components | ❌ Independent | Sim has `AGVTrack`, `FleetControlPanel`; live has `PhysicalTwinVisualizer`, `CloudTopologyFlowchart` |
| Hooks | ❌ Independent | Sim: `useFleetSimulation2` (rAF, refs); Live: `useFleetSimulation` (async, API) |
| Backend | ❌ Independent | Sim: none; Live: Azure Functions at `/api/simulate_agent/` |
| Styling | ⚠️ Partial | Both use `bg-slate-950` + `text-slate-100` theme but have independent component layouts |

### Why Not Unify

We explicitly chose NOT to create an abstraction layer over both modes (e.g., `SimulationEngine` interface with `FrontendSim` and `CloudSim` implementations). The reasons:

1. **False abstraction**: The two modes differ in control flow (sync rAF vs async fetch), data sources (local math vs API), and update granularity (every frame vs every 1-second poll). An interface that covers both would be either too vague (useless) or too detailed (leaking implementation).
2. **Evolution risk**: If one mode evolves to need a fundamentally different API (e.g., live adds WebSocket streaming), the interface breaks. Independence means each mode makes its own trade-offs.
3. **Cognitive overhead**: Developers reading one mode don't need to understand the other's interface. The shared kernel boundary is the only contract.

---

## Consequences

Positive:
- Each mode is optimized for its audience: sim is fast, deterministic, self-explanatory; live is realistic, data-rich, infrastructure-specific
- Clear boundary: the audience sees "simulation" or "live" with no ambiguity
- Independent evolution: sim can add a 5th scenario without touching live; live can switch to WebSocket without touching sim
- Shared kernel ensures the math is identical — the theorem is proven the same way in both modes
- Navigation tabs make both modes discoverable from either entry point

Negative:
- Code duplication: both modes have their own hooks, components, and state management patterns (~5000 lines sim + ~1900 lines live)
- Two different mental models for developers: ref-based rAF (sim) vs async state-machine (live)
- Live dashboard was restored from v1 (ADR-015) and not refactored to v2 patterns — tech debt if both converge
- Risk of UX inconsistency: if sim and live diverge in visual language, the shared layout won't compensate

### Decision Tree for Future Contributors

```
New feature needed:
├── Is it a new simulation scenario?
│   └── → Add config to config/scenarios.ts (zero code change)
├── Is it a new visualization (graph, chart, diagram)?
│   ├── Needed in both modes → add to shared/components/
│   ├── Sim only → add to dashboard/components/
│   └── Live only → add to dashboard/live/components/
├── Is it a new physics formula?
│   └── → Add to shared/physics/kinematic-token.ts
└── Is it a new navigation item?
    └── → Add to layout.tsx NAV_ITEMS
```

---

## Chinese Translation

### 标题

ADR 021: 双模式架构 —— 仿真（纯前端）与真实（云后端）共处一室

### 背景

Project OmniGuard 必须服务于两个根本不同且需求矛盾的受众：

| 利益相关者 | 需求 | 冲突 |
|---|---|---|
| 论文答辩委员会 | 确定、可重复的演示——必须离线工作，每次产生相同结果 | "真实"意味着非确定、依赖网络 |
| 技术审查者/工程师 | 真实基础设施遥测——来自 Azure OpenAI、Cosmos DB 的实际延迟数据 | "仿真"意味着可能不真实 |
| 演示观众（普通） | 5 秒自解释的可视化——清晰的因果，无需前置知识 | 真实遥测数据复杂，需要解释 |
| 作者（维护者） | 单一代码库，最小化重复，共享类型和工具 | 两种模式有分离为独立应用的风险 |

直观做法是一个页面试图同时做两件事：默认显示仿真，但在数据可用时叠加上"真实"数据。这失败了因为：

1. **展示冲突**：仿真需要简化的视觉（3 条抽象 AGV 轨道），而真实需要详细的拓扑图（VNet、Cosmos DB、Private Endpoints）。将两者挤进一个布局使得两者都效果不好。
2. **状态管理冲突**：仿真使用本地 refs + rAF；真实使用异步 fetch + API 响应。一个 hook 无法干净地在同步和异步控制流之间切换。
3. **可信度问题**：如果仿真和真实数据在同一页上，观众会质疑哪些数字是真实的、哪些是仿真的。答辩委员会需要清晰的边界。

### 决策

**在同一导航屋顶下维护两个独立实现，仅共享物理内核：**

### 共享边界

| 制品 | 共享？ | 机制 |
|---|---|---|
| 物理内核 | ✅ 共享 | `shared/physics/kinematic-token.ts` —— 两者都导入 `brakingDistanceM`、`computeCloudLatencyMs` |
| 导航布局 | ✅ 共享 | `dashboard/layout.tsx` —— 标签：Theorem、Compare、Fleet、Live |
| TypeScript 类型 | ⚠️ 部分 | `LLMBreakdownParams` 共享；`TrackConfig`、`Scenario` 仅仿真 |
| React 组件 | ❌ 独立 | 仿真有 `AGVTrack`、`FleetControlPanel`；真实有 `PhysicalTwinVisualizer`、`CloudTopologyFlowchart` |
| Hooks | ❌ 独立 | 仿真：`useFleetSimulation2`（rAF，refs）；真实：`useFleetSimulation`（异步，API） |
| 后端 | ❌ 独立 | 仿真：无；真实：Azure Functions 在 `/api/simulate_agent/` |
| 样式 | ⚠️ 部分 | 两者都使用 `bg-slate-950` + `text-slate-100` 主题，但有独立的组件布局 |

### 为什么不做统一抽象

我们明确选择不创建覆盖两种模式的抽象层（例如 `SimulationEngine` 接口 + `FrontendSim`、`CloudSim` 实现）。原因：

1. **虚假抽象**：两种模式在控制流（同步 rAF vs 异步 fetch）、数据来源（本地数学 vs API）和更新粒度（每帧 vs 每 1 秒轮询）上不同。覆盖两者的接口要么太模糊（无用）、要么太详细（泄漏实现）。
2. **演进风险**：如果一种模式演进而需要根本上不同的 API（如真实添加 WebSocket 流式传输），接口会崩溃。独立意味着每种模式做自己的权衡。
3. **认知负担**：阅读一种模式的开发者不需要理解另一种模式的接口。共享内核边界是唯一的契约。

### 结果

优点：
- 每种模式为其受众优化：仿真快速、确定、自解释；真实逼真、数据丰富、基础设施特定
- 清晰边界：观众看到"仿真"或"真实"且无歧义
- 独立演进：仿真可添加第 5 个场景而不影响真实；真实可切换到 WebSocket 而不影响仿真
- 共享内核确保数学相同——定理在两种模式下以相同方式证明
- 导航标签使两种模式从任一入口都可发现

缺点：
- 代码重复：两种模式有各自的 hooks、组件和状态管理模式（~5000 行仿真 + ~1900 行真实）
- 开发者需要理解两种不同的心智模型：基于 ref 的 rAF（仿真）vs 异步状态机（真实）
- 真实版 dashboard 是从 v1 恢复的（ADR-015），未按 v2 模式重构——如果两者趋同则是技术债务
- UX 不一致的风险：如果仿真和真实在视觉语言上分歧，共享布局无法弥补

### 未来贡献者决策树

```
需要新功能：
├── 是新的仿真场景？
│   └── → 在 config/scenarios.ts 中添加配置（零代码修改）
├── 是新的可视化（图表、图形、图示）？
│   ├── 两种模式都需要 → 添加到 shared/components/
│   ├── 仅仿真 → 添加到 dashboard/components/
│   └── 仅真实 → 添加到 dashboard/live/components/
├── 是新的物理公式？
│   └── → 添加到 shared/physics/kinematic-token.ts
└── 是新的导航项？
    └── → 添加到 layout.tsx 的 NAV_ITEMS
```
