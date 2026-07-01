# Architectural Decision Record (ADR 020)

## Title

ADR 020: Recognition and Implementation of Step-Based Detection as the Universal Control-Loop Abstraction

---

## Status

**Implemented**

---

## Context

This decision represents one of the most architecturally significant insights of the project: **cloud and edge detection are not different mechanisms — they are the same mechanism at different polling frequencies.**

### The Misconception

Initially, we modeled cloud and edge as fundamentally different:

| Aspect | Cloud | Edge |
|---|---|---|
| Mental model | "Network request-response cycle" | "Continuous hardware monitoring" |
| Implementation | Step-based poll: `accum ≥ latency ? check` | Per-frame trigger: `every frame if pos ≥ boundary` |
| Latency source | Network RTT + LLM generation | Sensor read + NPU inference |
| Failure mode | "Response too late" | "Processing overflow" |

This distinction seemed natural: cloud is remote and slow, edge is local and fast. The code reflected this — two completely different paths in `useKinematicSimulation.ts`.

### The Realization

During a code review, we mapped both paths onto a common timeline:

```
Cloud:   [move] → [wait ~3000ms] → [check position] → [move] → [wait ~3000ms] → ...
Edge:    [move] → [wait ~20ms]   → [check position] → [move] → [wait ~20ms]   → ...
```

The only difference is the wait duration. Cloud waits for an HTTP response (network + LLM). Edge waits for a sensor read (NPI inference). Both are "move → wait → check → repeat." Both are step-based polling loops with a parameterized interval.

The edge "continuous check" was an illusion: even the fastest sensor reads happen at discrete intervals (1–10ms for lidar, 20–100ms for NPU inference). There is no such thing as "continuous" in a digital control loop.

### Why This Matters

This recognition enables:

1. **Parameterized architecture**: one loop, one set of correctness proofs, one bug surface. The interval parameter captures all variation.
2. **Apples-to-apples comparison**: when comparing cloud vs edge on the compare page, the audience sees the same algorithm at two different speeds — not two different algorithms.
3. **Mathematical precision**: both sides can be analyzed with the same formula: `slideDistance = speed × interval`. No offset hacks, no special cases.
4. **Extensibility**: a hypothetical "fog layer" with 100ms latency just adds another interval value — no code change.

---

## Decision

**Model all detection modes as a single parameterized step-based polling loop:**

```typescript
// The universal control-loop abstraction

type DetectionMode = {
  intervalMs: number;
  detectionBoundaryM: number;  // clearanceBoundaryM + speed × interval (for edge)
};

// One loop, parameterized by mode
function stepLoop(mode: DetectionMode) {
  accumS += deltaS;
  if (accumS >= mode.intervalMs / 1000) {
    if (position >= mode.detectionBoundaryM) {
      brake();
    }
    accumS = 0;
  }
}

// Cloud mode: interval = cloudLatencyMs, boundary = clearanceBoundaryM
// Edge mode: interval = edgeLatencyMs, boundary = clearanceBoundaryM + speed × edgeLatencyMs/1000
```

The implementation uses a single `useEffect` in `useKinematicSimulation.ts` that switches on `mode` only to select which `latencyMs` and `detectionBoundaryM` to use — the loop body is identical.

This abstraction was then extended from 1 track to 3 tracks in `useFleetSimulation2.ts` — the same universal loop, just called with different `intervalMs` per track.

---

## Consequences

Positive:
- Single code path: one set of bugs, one set of optimizations, one place to verify correctness
- Conceptual elegance: "detection rate determines safety" — a clean causal chain
- Extensible: adding a new detection mode (e.g., "5G MEC" with 10ms) requires zero loop changes
- Pedagogical value: the compare page becomes "same algorithm, different speed" — instantly understandable
- Edge step logs at 20ms cadence (~50 checks/s) visually demonstrate the frequency differential

Negative:
- Edge's `effectiveEdgeBoundaryM = clearanceBoundaryM + speed × edgeLatencyMs / 1000` is still an approximation — it doesn't account for variable step durations within the interval
- At 20ms edge interval, the approximation error is `speed × 20ms = 0.02m` — negligible but technically present
- The unified abstraction hides a subtle assumption: cloud and edge failures have different root causes (network vs compute), which matters for production debugging but not for the kinematic proof

### The Edge "Effective Boundary" Formula

The decision to use `effectiveEdgeBoundaryM = clearanceBoundaryM + agvSpeedMps × edgeLatencyMs / 1000` warrants explicit justification:

At step time `t`, the AGV has already traveled `agvSpeedMps × (edgeLatencyMs / 1000)` meters since the previous step started. The detection fires at position `P` where `P ≥ clearanceBoundaryM`. If the first step that fires after entering the clearance zone occurs exactly at `P = clearanceBoundaryM + ε`, the AGV traveled an additional `agvSpeedMps × edgeLatencyMs / 1000` during that step's interval. Adding this to the boundary gives the worst-case position where detection actually occurs.

This is not a hack — it's the same logic as cloud's `totalDetectionDistance = speed × cloudLatencyMs / 1000`, just applied to the edge's shorter interval.

---

## Chinese Translation

### 标题

ADR 020: 将步进式检测识别并实现为通用控制循环抽象

### 背景

这个决策代表了项目中最具架构意义的洞察之一：**云端和边缘检测不是不同的机制——它们是不同轮询频率下的相同机制。**

### 误解

最初，我们将云端和边缘建模为根本性不同的：

| 方面 | 云端 | 边缘 |
|---|---|---|
| 心智模型 | "网络请求-响应周期" | "连续硬件监控" |
| 实现 | 步进轮询：`accum ≥ latency ? check` | 逐帧触发：`每帧 if pos ≥ 边界` |
| 延迟来源 | 网络 RTT + LLM 生成 | 传感器读取 + NPU 推理 |
| 失败模式 | "响应太迟" | "处理溢出" |

这种区分看起来很自然：云端远程且慢，边缘本地且快。代码反映了这一点——`useKinematicSimulation.ts` 中有两条完全不同的路径。

### 认识

在一次代码审查中，我们将两条路径映射到同一个时间线上：

```
云端：  [移动] → [等待 ~3000ms] → [检查位置] → [移动] → [等待 ~3000ms] → ...
边缘：  [移动] → [等待 ~20ms]   → [检查位置] → [移动] → [等待 ~20ms]   → ...
```

唯一的区别是等待时长。云端等待 HTTP 响应（网络 + LLM）。边缘等待传感器读取（NPU 推理）。两者都是"移动 → 等待 → 检查 → 重复"。两者都是参数化间隔的步进轮询循环。

边缘的"连续检查"是一种错觉：即使最快的传感器读取也在离散间隔发生（激光雷达 1–10ms，NPU 推理 20–100ms）。在数字控制循环中没有"连续"这回事。

### 为什么这很重要

这一认识使得以下成为可能：

1. **参数化架构**：一个循环，一套正确性证明，一个 Bug 面。间隔参数捕获所有变化。
2. **对等对比**：在对比页上比较云端和边缘时，观众看到的是同一算法以两种不同速度运行——而非两种不同算法。
3. **数学精确性**：两侧都可用同一公式分析：`slideDistance = speed × interval`。无需偏移技巧，无特殊情况。
4. **可扩展性**：假设的"雾层"100ms 延迟只需添加另一个间隔值——无需代码更改。

### 决策

**将所有检测模式建模为单一参数化步进轮询循环：**

实现使用 `useKinematicSimulation.ts` 中的一个 `useEffect`，仅在 `mode` 上切换以选择使用哪个 `latencyMs` 和 `detectionBoundaryM`——循环体相同。

此抽象随后从 1 轨扩展到 `useFleetSimulation2.ts` 中的 3 轨——同一个通用循环，只是每轨以不同的 `intervalMs` 调用。

### 结果

优点：
- 单一代码路径：一套 Bug、一套优化、一个验证正确性的地方
- 概念优雅："检测速率决定安全性"——清晰的因果链
- 可扩展：添加新检测模式（如 10ms 的"5G MEC"）无需循环更改
- 教学价值：对比页变成"同一算法，不同速度"——瞬间可理解
- 边缘 20ms 节奏（~50 次检查/秒）的 step 日志可视地展示了频率差异

缺点：
- 边缘的 `effectiveEdgeBoundaryM = clearanceBoundaryM + speed × edgeLatencyMs / 1000` 仍然是近似值——未考虑间隔内的可变步进时长
- 在 20ms 边缘间隔下，近似误差为 `speed × 20ms = 0.02m`——可忽略但技术上存在
- 统一抽象隐藏了一个微妙的假设：云端和边缘故障有不同的根本原因（网络 vs 计算），这对生产调试很重要，但对运动学证明不重要

### 边缘"有效边界"公式的论证

`effectiveEdgeBoundaryM = clearanceBoundaryM + agvSpeedMps × edgeLatencyMs / 1000` 的决策需要明确的理由：

在 step 时间 `t`，AGV 自上次 step 开始以来已经行驶了 `agvSpeedMps × (edgeLatencyMs / 1000)` 米。检测在位置 `P` 触发，`P ≥ clearanceBoundaryM`。如果在进入清空区后触发的第一次 step 恰好发生在 `P = clearanceBoundaryM + ε`，AGV 在此期间多行驶了 `agvSpeedMps × edgeLatencyMs / 1000`。将其添加到边界即可得到检测实际发生的最坏位置。

这不是 hack——它与云端的 `totalDetectionDistance = speed × cloudLatencyMs / 1000` 逻辑相同，只是应用于边缘更短的间隔。
