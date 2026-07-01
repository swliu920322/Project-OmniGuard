# Architectural Decision Record (ADR 025)
# 架构决策记录 (ADR 025)

## Title / 标题

ADR 025: Kinematic Token Theorem Interactive Sandbox
ADR 025: Kinematic Token Theorem 交互式沙盒

## Status / 状态

**Approved / 已批准**

## Context / 背景

Embodied AI systems (AGVs, robots, drones) operate under hard physical deadlines. A cloud-only LLM control loop has two unavoidable latency sources: network RTT and token generation time. During this total delay the vehicle continues moving blindly. The theorem defines maximum safe speed: `V_max ≤ D_clearance / (L_network_rtt + (T_prompt + T_completion) / S_token_rate)`. A standalone interactive proof was needed to demonstrate this to audiences without requiring live Azure resources.

具身 AI 系统（AGV、机器人、无人机）在严格的物理时限下运行。纯云 LLM 控制环路有两个不可避免的延迟来源：网络 RTT 和 Token 生成时间。在此总延迟期间，车辆继续盲目移动。该定理定义了最大安全速度。需要一个独立的交互式证明来向受众演示这一点，而无需实时 Azure 资源。

## Decision Drivers / 决策驱动因素

* Zero backend dependency — pure client-side Next.js page.
* Visual, interactive proof that cloud-only latency cannot safely control fast hardware.
* Reusable math kernel shared with fleet dashboard.

* 零后端依赖——纯客户端 Next.js 页面。
* 可视化的交互式证明，纯云延迟无法安全控制快速硬件。
* 与舰队仪表板共享的可重用数学内核。

## Decision / 决策

Build a standalone Next.js sandbox at `/kinematic` (later `/dashboard/theorem`) using `requestAnimationFrame`-based animation. Implement a Component-Hook-Lib separation: `page.tsx` owns state, `components/` own rendering, `hooks/` own animation lifecycle, `lib/` own pure math. Provide Cloud-Only and Edge Fallback mode toggle, 6 parameter sliders, real-time `V_max` computation, and collision/safe-stop visualization.

构建一个独立的 Next.js 沙盒，位于 `/kinematic`（后迁移至 `/dashboard/theorem`），使用基于 `requestAnimationFrame` 的动画。实现组件-钩子-库分离：`page.tsx` 拥有状态，`components/` 拥有渲染，`hooks/` 拥有动画生命周期，`lib/` 拥有纯数学计算。提供纯云和边缘回退模式切换、6 个参数滑块、实时 `V_max` 计算以及碰撞/安全停止可视化。

## Consequences / 后果

* **Positive / 正向**: Fully offline, demo-able without any Azure subscription or backend.
* **Positive / 正向**: Shared physics kernel (`kinematic-token.ts`) reused by fleet simulation (ADR-009).
* **Positive / 正向**: Clear before/after narrative — collision in Cloud-Only mode → safe stop in Edge Fallback.

* **正向**: 完全离线，无需任何 Azure 订阅或后端即可演示。
* **正向**: 共享物理内核被舰队模拟重用（ADR-009）。
* **正向**: 清晰的之前/之后叙事——纯云模式下碰撞 → 边缘回退模式下安全停止。
