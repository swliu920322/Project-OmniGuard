# Architectural Decision Record (ADR 026)
# 架构决策记录 (ADR 026)

## Title / 标题

ADR 026: Fleet Control Plane Dashboard — Embodied AI Digital Twin
ADR 026: 舰队控制面板——具身 AI 数字孪生

## Status / 状态

**Approved / 已批准**

## Context / 背景

The multi-agent pipeline and tenant isolation mechanisms existed only as backend logic — invisible to observers. There was no visual proof that the 3-Agent pipeline (Router → Safety → Compiler) was executing, no way to demonstrate short-circuit behavior, and no exposure of latency metrics. A control plane dashboard was needed to transform opaque backend execution into visible, demonstrable evidence.

多 Agent 流水线和租户隔离机制仅作为后端逻辑存在——对观察者不可见。没有视觉证据表明 3-Agent 流水线（路由器 → 安全 → 编译器）正在执行，无法演示短路行为，也没有延迟指标暴露。需要一个控制面板将不透明的后端执行转化为可见的、可证明的证据。

## Decision Drivers / 决策驱动因素

* Visually prove multi-tenant isolation (same distance → different blocking behavior per tenant).
* Visually prove 3-Agent pipeline execution and short-circuit (pass/safety block/grey out).
* Expose cloud latency as a first-class dashboard metric.

* 可视化证明多租户隔离（相同距离 → 每个租户不同的阻断行为）。
* 可视化证明 3-Agent 流水线执行和短路（放行/安全拦截/变灰）。
* 将云延迟作为仪表板的一级指标暴露。

## Decision / 决策

Build an audit-trail HTTP API pattern (no WebSocket): frontend sends `POST /api/simulate_agent`, backend returns full `pipeline_trace` + `latency_ms` + `final_action` in JSON. Frontend renders a three-panel layout: left (radar/probe visualization), middle (3 Agent nodes with color-coded status), right (audit terminal with raw JSON). Use Tenant dropdown + distance slider + trigger button.

构建审计追踪 HTTP API 模式（无 WebSocket）：前端发送 `POST /api/simulate_agent`，后端返回完整的 `pipeline_trace` + `latency_ms` + `final_action` JSON。前端渲染三面板布局：左侧（雷达/探针可视化）、中间（3 个 Agent 节点，带颜色编码状态）、右侧（审计终端，显示原始 JSON）。使用租户下拉菜单 + 距离滑块 + 触发按钮。

## Consequences / 后果

* **Positive / 正向**: Interview-ready visual proof — tenant isolation, short-circuit, latency all visible.
* **Positive / 正向**: Zero business logic in frontend (pure state renderer) prevents architecture leakage.
* **Negative / 负向**: Requires backend `/simulate_agent` endpoint to be always available for demo.

* **正向**: 面试级视觉证明——租户隔离、短路、延迟全部可见。
* **正向**: 前端零业务逻辑（纯状态渲染器）防止架构泄露。
* **负向**: 需要后端 `/simulate_agent` 端点始终可用于演示。
