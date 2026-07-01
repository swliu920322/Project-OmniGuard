# Architectural Decision Record (ADR 015)

## Title

ADR 015: Live Dashboard Restoration from Git History

---

## Status

**Implemented**

---

## Context

During the Phase 3 dashboard rewrite (ADR-010), the original live dashboard files were deleted or overwritten. The live dashboard (`/dashboard/live`) — a v1 artifact with real Azure Function integration showing the 3-agent pipeline with real cloud calls — was replaced by the pure frontend fleet simulation.

However, the live dashboard still had value:
- It validated the theorem with **real infrastructure**, not just simulation
- The agent pipeline (Intent Router → Safety Guard → Action Compiler) showed the actual cloud orchestration
- Technical reviewers wanted to see real network latency numbers, not just simulated parameters
- The thesis defense committee expected a "real vs simulation" comparison

The live files were still available in git history at commit `cecaf29`.

---

## Decision

Restore the live dashboard from git commit `cecaf29` under `/dashboard/live`:

- 12 files, 1879 lines total, all TypeScript/TSX
- Key components: ControlPanel, PhysicalTwinVisualizer, CloudTopologyFlowchart, AgentOrchestratorFlow, InfraTelemetryPanel, AuditTerminalConsole, SandboxPanel
- Hooks: `useFleetSimulation` (real cloud calls via `/api/simulate_agent/`)
- Config: 5 tenant scenarios with per-tenant safety rules
- `git checkout cecaf29 -- <paths>` to restore files, then `git reset HEAD` to unstage

Navigation added:
- Fleet header: "LIVE" link → `/dashboard/live` (added in FleetHeader, removed later per user request)
- Live header: "◀ SIM" link → `/dashboard` (for returning to simulation)
- Previous "🧮 Theorem" and "🧮 Kinematic Theorem →" links updated to `/dashboard/theorem`

---

## Consequences

Positive:
- Both simulation and live modes coexist at `/dashboard` and `/dashboard/live`
- No code duplication: live uses Azure Functions, sim uses pure frontend
- Thesis defense can demo both: "simulated theory" → "real validation"
- Navigation between modes is intuitive (shared layout tabs)

Negative:
- Live mode requires Azure Functions on port 7071 — not offline-capable
- Live dashboard is a restored v1 artifact, not refactored to v2 patterns
- Two different codebases to maintain if live evolves independently
- Live dashboard has its own independent layout with duplicate styling (navigation links in header, etc.)

---

## Chinese Translation

### 标题

ADR 015: 从 Git 历史恢复真实版 Dashboard

### 背景

在 Phase 3 dashboard 重写（ADR-010）期间，原始的真实版 dashboard 文件被删除或覆盖。这个 v1 版本的 `/dashboard/live` 集成了真实的 Azure Functions，展示了 3-Agent 流水线和真实云调用。

然而，真实版 dashboard 仍有价值：
- 它用**真实基础设施**验证了定理，而非仅仿真
- Agent 流水线（意图路由 → 安全守卫 → 动作编译）展示了实际的云编排
- 技术审查者希望看到真实的网络延迟数字，而非仅仿真参数
- 论文答辩委员会期望"真实 vs 仿真"对比

真实版文件仍在 git 历史 commit `cecaf29` 中可用。

### 决策

从 git commit `cecaf29` 恢复真实版 dashboard 到 `/dashboard/live`：

- 12 个文件，共 1879 行，纯 TypeScript/TSX
- 关键组件：ControlPanel、PhysicalTwinVisualizer、CloudTopologyFlowchart、AgentOrchestratorFlow、InfraTelemetryPanel、AuditTerminalConsole、SandboxPanel
- Hook：`useFleetSimulation`（通过 `/api/simulate_agent/` 调真实云）
- 配置：5 个租户场景，每个有独立的安全规则
- 恢复方式：`git checkout cecaf29 -- <paths>`，然后 `git reset HEAD` 取消暂存

导航处理：
- Fleet header：添加 "LIVE" 链接 → `/dashboard/live`（后在用户要求下移除）
- Live header："◀ SIM" 链接 → `/dashboard`（返回仿真）
- 之前的 "🧮 Theorem" 和 "🧮 Kinematic Theorem →" 链接更新为 `/dashboard/theorem`

### 结果

优点：
- 仿真和真实两种模式共存于 `/dashboard` 和 `/dashboard/live`
- 无代码重复：live 使用 Azure Functions，sim 使用纯前端
- 论文答辩可以同时演示："仿真理论" → "真实验证"
- 模式间导航直观（共享布局 Tab）

缺点：
- Live 模式需要 Azure Functions（端口 7071）——不适用于离线场景
- Live dashboard 是恢复的 v1 制品，而非按 v2 模式重构
- 如果 live 独立演进，需要维护两套代码
- Live dashboard 有自己独立的布局（头部中的导航链接等重复样式）
