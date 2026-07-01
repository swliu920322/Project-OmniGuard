# Architectural Decision Record (ADR 008)

## Title

ADR 008: Unified Step-Based Detection Loop for Kinematic Sandbox

---

## Status

**Implemented**

---

## Context

The kinematic sandbox initially used two different detection models:

- **Cloud mode**: step-based polling loop (`accumS ≥ nextS` → position check → detect or continue). The interval was `jittered(cloudLatencyMs)`.
- **Edge mode**: raw per-frame position check (`every frame → position ≥ offset boundary ? detect : continue`). No concept of "steps" — it was a trigger, not a rhythm.

This meant cloud and edge were fundamentally different algorithms. The edge path had offset hack `effectiveEdgeBoundaryM = clearanceBoundaryM + speed × edgeLatencyMs` that approximated processing delay but conflated continuous check with discrete poll.

Two code paths meant two chances for bugs, and the comparison was apples-to-oranges: "step-based slow polling" vs "continuous fast detection."

---

## Decision

Unify both modes into a single parameterized `requestAnimationFrame` loop:

```
accumulate deltaS → accum ≥ jittered(latency) ? step fires → position ≥ detectionBoundary? brake+log : log progress
```

Cloud supplies `cloudLatencyMs` + `clearanceBoundaryM`. Edge supplies `edgeLatencyMs` + `effectiveEdgeBoundaryM (= clearance + speed × edgeLatencyMs)`. The loop is parameterized, not forked.

Edge now runs a genuine step-based check at `edgeLatencyMs` intervals (typically 20ms → ~50 checks/s). Detection fires when a step finds the AGV past `effectiveEdgeBoundaryM`.

---

## Consequences

Positive:
- Apples-to-apples comparison: both sides are "poll every latency interval," just at different rates
- Edge now logs its steps too: `⚡ Step 42: 0.84m, 9.16m to wall.` — the cadence conveys "edge checks fast, detects early"
- One code path, half the bugs

Negative:
- Edge at 20ms produces ~400 steps per 8m run — needs toggle to avoid log spam (the `⚡ edge checks` button)

---

## Chinese Translation

### 标题

ADR 008: 运动学沙盒统一步进检测循环

### 背景

原有的运动学沙盒使用了两种不同的检测模型：

- **云端模式**：基于步进的轮询循环（`accumS ≥ nextS` → 位置检查 → 检测或继续），间隔为 `jittered(cloudLatencyMs)`。
- **边缘模式**：原始逐帧位置检查（`每帧 → 位置 ≥ 偏移边界 ? 检测 : 继续`），没有"步进"概念——是一个触发器，不是一种节奏。

这意味着云端和边缘从根本上是不用的算法。边缘路径使用了偏移技巧 `effectiveEdgeBoundaryM = clearanceBoundaryM + speed × edgeLatencyMs` 来近似处理延迟，但混淆了连续检查与离散轮询。

两套代码路径意味着两倍的 Bug 机会，且对比是苹果 vs 橙子："步进式慢轮询" vs "连续快速检测"。

### 决策

将两种模式统一为一个参数化的 `requestAnimationFrame` 循环：

```
累积 δt → 累积 ≥ 抖动(延迟) ? 步进触发 → 位置 ≥ 检测边界 ? 刹车+日志 : 记录进度
```

云端提供 `cloudLatencyMs` + `clearanceBoundaryM`。边缘提供 `edgeLatencyMs` + `effectiveEdgeBoundaryM（= 清空区 + 速度 × 边缘延迟）`。循环由参数决定，而不是分叉。

边缘现在在 `edgeLatencyMs` 间隔（通常 20ms → 约 50 次检查/秒）运行真正的步进式检查。当某一步检测到 AGV 已越过 `effectiveEdgeBoundaryM` 时触发检测。

### 结果

优点：
- 对等对比：两侧都是"每延迟区间轮询一次"，只是速率不同
- 边缘现在也记录自己的步进：`⚡ Step 42: 0.84m, 9.16m to wall.`——节奏传递出"边缘检查快、检测早"的信息
- 一套代码路径，一半的 Bug

缺点：
- 边缘在 20ms 下每次 8m 运行产生约 400 步——需要开关避免日志洪泛（`⚡ edge checks` 按钮）
