# Architectural Decision Record (ADR 010)

## Title

ADR 010: Dashboard v2 — 100% Frontend Fleet Simulation

---

## Status

**Implemented**

---

## Context

The original `/dashboard/live` page had a fundamental credibility problem:

1. **Backend dependency**: Without Azure Functions running on port 7071, the page was a blank shell. This made it unreliable for thesis defense demos where network/infra failures are unacceptable.
2. **Black-box pipeline**: The Intent Router → Safety Firewall → Action Compiler flow required ~2 minutes of verbal explanation. A good demo should be self-explanatory in 5 seconds.
3. **Single AGV**: The live dashboard showed only one AGV at a time — impossible to compare architectures side by side.
4. **No scenario system**: Every run depended on real telemetry, making deterministic replays impossible.

The kinematic sandbox had already proven the theorem for a single AGV. The question was: how to scale from "one AGV, two modes" to "fleet of three, four scenarios" — without introducing backend dependencies.

---

## Decision

Replace the backend-dependent live dashboard with a **100% pure frontend fleet simulation** at `/dashboard`, with the following architecture:

- **3 AGVs on parallel tracks**: AGV-01 (cloud-only), AGV-02 (cloud+edge), AGV-03 (cloud with computed LLM latency)
- **Single `requestAnimationFrame`** drives all three tracks — no frame drift
- **4 scenario presets** defined in `config/scenarios.ts`: Normal Ops, Cloud Spike, Verbose LLM, Edge Disabled
- **Step-based detection**: same unified loop from ADR-008, extended to 3 tracks
- **Token Breakdown drawer**: 4 sliders controlling AGV-03's latency via the formula `networkRttMs + (prompt + completion) / tokenRate × 1000`
- **Offline-first**: works with no network, no backend, no API calls

Explicitly de-scoped (per phase2-roadmap.md analysis):
- **Dimension 1 (SLM Fallback)**: In a 1D track, SLM and hardcoded rules produce identical braking behavior. The label "Powered by Phi-3" adds zero demo value.
- **Dimension 2 (WAL/Consensus)**: High cognitive load for demo audiences (must explain Write-Ahead Log + Vector Clocks + conflict resolution for 5 seconds of "merge succeeded"). Demo ROI is poor.

---

## Consequences

Positive:
- Offline-capable at all times — reliable for thesis defense and interviews
- 5-second self-explanatory: three tracks, color-coded outcomes, no narration needed
- Four scenarios cover all theorem terms: network term (Cloud Spike), token term (Verbose LLM), edge term (Edge Disabled)
- Fleet-level status (all_safe, any_crashed, mixed, paused) derived from 3 tracks

Negative:
- Live mode (real cloud calls) still requires backend — moved to `/dashboard/live` as an optional deep-dive
- ~5000 lines of new frontend code (all TypeScript, no new dependencies)
- Some real-world nuance lost (jitter disabled for determinism, brake latency optimistic at 15ms)

---

## Chinese Translation

### 标题

ADR 010: Dashboard v2 —— 纯前端舰队仿真

### 背景

原有的 `/dashboard/live` 页面存在根本性的可信度问题：

1. **后端依赖**：没有 Azure Functions（端口 7071），页面就是空白壳。这在论文答辩场景中是致命弱点——网络故障不可接受。
2. **黑盒管线**：Intent Router → Safety Firewall → Action Compiler 流程需要约 2 分钟口头解释。好的演示应该在 5 秒内自我解释。
3. **单 AGV**：一次只显示一台 AGV——无法并排对比架构。
4. **无场景系统**：每次运行依赖真实遥测数据，无法确定性重放。

### 决策

将依赖后端的 dashboard 替换为 `/dashboard` 下的**纯前端舰队仿真**，架构如下：

- **3 台 AGV 平行轨道**：AGV-01（纯云端）、AGV-02（云+边缘）、AGV-03（云端 + LLM 计算延迟）
- **单 `requestAnimationFrame`** 驱动三轨——无帧漂移
- **4 个场景预设**：Normal Ops、Cloud Spike、Verbose LLM、Edge Disabled
- **步进检测**：同 ADR-008 的统一循环，扩展到 3 轨
- **Token Breakdown 抽屉**：4 个滑块通过公式 `networkRttMs + (prompt + completion) / tokenRate × 1000` 控制 AGV-03 延迟
- **离线优先**：无网络、无后端、无 API 调用仍可工作

明确不做（基于 phase2-roadmap.md 分析）：
- **Dimension 1 (SLM 降级)**：1D 轨道中 SLM 与硬编码规则产生相同刹车效果，标签无演示增量
- **Dimension 2 (WAL/共识)**：演示认知成本过高（需先讲 WAL + 向量钟 + 冲突仲裁才能理解 5 秒的"合并成功"）

### 结果

优点：
- 随时离线可用——答辩和面试可靠
- 5 秒自解释：三轨、颜色编码结果、无需旁白
- 四个场景覆盖所有定理项：网络项 (Cloud Spike)、Token 项 (Verbose LLM)、Edge 项 (Edge Disabled)
- 舰队级状态（all_safe, any_crashed, mixed, paused）从 3 轨推导

缺点：
- 真实版（真实云调用）仍需后端——移至 `/dashboard/live` 作为可选的深入探索
- 约 5000 行新前端代码（纯 TypeScript，无新依赖）
- 牺牲了一些真实感（禁用抖动以确保确定性，刹车延迟乐观取值 15ms）
