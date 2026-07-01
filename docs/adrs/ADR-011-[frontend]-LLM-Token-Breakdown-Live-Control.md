# Architectural Decision Record (ADR 011)

## Title

ADR 011: LLM Token Breakdown — Live Latency Control

---

## Status

**Implemented**

---

## Context

The kinematic theorem's formula includes a token-specific term:

```
Vmax ≤ Clearance / (Network_RTT + (Prompt + Completion) / Token_Rate + Brake_Time)
```

The original `cloudLatencyMs` parameter collapsed all three denominator terms into a single knob. This hid the academic argument: even with zero network latency, generating 2000 tokens at 50 tok/s adds 40 seconds to the control loop.

The phase2-roadmap.md had already endorsed token breakdown as the highest-ROI enhancement (~1 day, high demo value). However, the original dashboard-redesign.md omitted it entirely while scheduling lower-ROI features (WAL, SLM).

---

## Decision

Decompose the single `cloudLatencyMs` parameter into four sub-parameters:

| Parameter | Default | Range | Meaning |
|---|---|---|---|
| `networkRttMs` | 200 | 5–2000 ms | Network round-trip |
| `promptTokens` | 500 | 100–4000 | LLM input context |
| `completionTokens` | 1500 | 100–8000 | LLM output length |
| `tokenRateTokS` | 50 | 10–200 | Token generation rate |

Formula: `cloudLatencyMs = networkRttMs + ((promptTokens + completionTokens) / tokenRateTokS) × 1000`

In the fleet dashboard, the Token Breakdown drawer controls AGV-03's cloud latency in real time:
- Scenario presets set initial drawer values via `tc.llm`
- User slider adjustments override them live through `tokenLLMRef.current`
- `resolveCloudLatencyMs()` always reads `tokenLLMRef.current` (ignores `tc.llm`)
- Since `nextS` is recalculated every frame (per ADR-008), new latency takes effect on the very next step boundary — no reset needed

Real-world calibration (2026 benchmarks):
- Lean: 100ms RTT + 200 prompt + 200 completion @ 200 tok/s = **2100ms** (~GPT-4o-mini)
- Verbose: 100ms RTT + 500 prompt + 2000 completion @ 150 tok/s = **16767ms** (~GPT-4o long output)
- Drawer default: 80ms + 250 + 300 @ 200 tok/s = **2830ms** (mid-range)

---

## Consequences

Positive:
- "Even with zero network latency, generating more tokens kills the robot" — tangible demonstration
- Audience can slide completionTokens from 500 → 4000 and watch AGV-03's stop position move from safe → crash
- Completes the theorem formula: all three denominator terms visually validated
- No restart needed — per-frame nextS recalculation makes changes immediate

Negative:
- Adds complexity to the UI: 4 sliders instead of 1
- Only affects AGV-03; AGV-01 and AGV-02 use fixed `cloudLatencyMs` values
- "Why can't I control all three AGVs' latency?" is a potential audience question (need to explain: AGV-03 represents the LLM-computed scenario)

---

## Chinese Translation

### 标题

ADR 011: LLM Token 分解 —— 实时延迟控制

### 背景

运动学定理公式包含一个 Token 特定项：

```
Vmax ≤ Clearance / (Network_RTT + (Prompt + Completion) / Token_Rate + Brake_Time)
```

原始的 `cloudLatencyMs` 参数将三项分母合并为一个旋钮。这隐藏了学术论证：即使网络延迟为零，在 50 tok/s 下生成 2000 个 Token 也会给控制环路增加 40 秒。

phase2-roadmap.md 已认可 Token 分解为最高 ROI 的增强（约 1 天，高演示价值）。然而，原始的 dashboard-redesign.md 完全遗漏了它，同时安排了更低 ROI 的功能（WAL、SLM）。

### 决策

将单一的 `cloudLatencyMs` 参数分解为四个子参数：

| 参数 | 默认值 | 范围 | 含义 |
|---|---|---|---|
| `networkRttMs` | 200 | 5–2000 ms | 网络往返 |
| `promptTokens` | 500 | 100–4000 | LLM 输入上下文 |
| `completionTokens` | 1500 | 100–8000 | LLM 输出长度 |
| `tokenRateTokS` | 50 | 10–200 | Token 生成速率 |

公式：`cloudLatencyMs = networkRttMs + ((promptTokens + completionTokens) / tokenRateTokS) × 1000`

在舰队 dashboard 中，Token Breakdown 抽屉实时控制 AGV-03 的云端延迟：
- 场景预设通过 `tc.llm` 设置初始值
- 用户滑块调整通过 `tokenLLMRef.current` 实时覆盖
- `resolveCloudLatencyMs()` 始终读取 `tokenLLMRef.current`（忽略 `tc.llm`）
- 由于 `nextS` 每帧重新计算（见 ADR-008），新延迟在下一个 step 边界立即生效——无需重置

基于 2026 年真实基准：Lean = 2100ms（~GPT-4o-mini），Verbose = 16767ms（~GPT-4o 长输出），抽屉默认 = 2830ms（中端模型）。

### 结果

优点：
- "即使网络延迟为零，生成更多 Token 也会杀死机器人"——直观可证的演示
- 观众可以滑动 completionTokens 从 500 到 4000，看 AGV-03 停止位置从安全 → 撞墙
- 补全定理公式：三个分母项都在视觉上得到验证
- 无需重启——每帧 nextS 重新计算使更改立即生效

缺点：
- 增加 UI 复杂度：4 个滑块代替 1 个
- 仅影响 AGV-03；AGV-01 和 AGV-02 使用固定 `cloudLatencyMs` 值
- "为什么不能控制所有三台 AGV 的延迟？"是潜在的观众问题（需要解释：AGV-03 代表 LLM 计算场景）
