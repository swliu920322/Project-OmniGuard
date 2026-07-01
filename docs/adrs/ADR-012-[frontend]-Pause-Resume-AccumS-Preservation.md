# Architectural Decision Record (ADR 012)

## Title

ADR 012: Pause/Resume with AccumS Preservation

---

## Status

**Implemented**

---

## Context

The fleet simulation's simPhase state machine supports playback control: `idle → running → paused → running ... → idle`.

The original implementation's `pause()` stopped the animation loop, and `resume()` created fresh `trackSims` objects with `accumS = 0`. This caused a subtle but critical bug:

When paused mid-run and resumed, each track's step timer (`accumS`) was reset to zero. Since `nextS` represents the full latency interval (e.g., 5000ms for AGV-01 in Cloud Spike), the first step after resume would be delayed by the full interval — not the remaining time. For AGV-03 with computed latency (16767ms in Verbose LLM), this meant an extra 16.7s delay on top of the already-precarious timing, pushing it from "barely safe" to "crashed."

This was especially confusing because:
- The same scenario produced different outcomes depending on whether the user used pause/resume
- It looked like a non-deterministic bug (but was actually deterministic — just wrong)
- It undermined the trust in the simulation's correctness

---

## Decision

Introduce a `trackSimsRef` that preserves each track's step state across pause/resume:

- `launchAnimation()` writes the current `trackSims` (which includes `accumS`, `stepNum`, and `nextS`) to `trackSimsRef.current`
- `pause()` freezes positions but does NOT change `statusRef.current` (keeps AGVs as "running")
- `resume()` reads `trackSimsRef.current` first — if present, restores `accumS` and `stepNum`, and only refreshes `nextS` from current latency
- If `trackSimsRef.current` is null (first start, not a resume), falls back to creating fresh `trackSims`
- Button logic distinguishes "user manually paused" (has running AGVs → show "Resume") from "all AGVs finished" (no running AGVs → show "Play") via `fleetStatus === "paused"`

---

## Consequences

Positive:
- Correct step timing across pause/resume: AGV-03 no longer crashes in Normal Ops after resume
- Same scenario always produces same outcome regardless of pause/resume usage
- User trust: pause/resume is "just freezing time," not changing physics

Negative:
- Slight complexity increase: hook now manages both ref-based state (for physics) and React state (for rendering)
- `trackSimsRef` must be written in both `launchAnimation` (initial run) and `resume` (re-run after pause)
- Need to null-check `trackSimsRef.current` on first run vs. resume

---

## Chinese Translation

### 标题

ADR 012: 暂停/恢复的 AccumS 持久化

### 背景

舰队仿真支持 simPhase 状态机播放控制：`idle → running → paused → running ... → idle`。

原始实现的 `pause()` 停止动画循环，`resume()` 创建全新的 `trackSims` 对象，其中 `accumS = 0`。这导致了一个微妙但严重的 Bug：

在运行中暂停后恢复时，每台 AGV 的 step 计时器（`accumS`）被重置为 0。由于 `nextS` 代表完整的延迟间隔（例如 Cloud Spike 中 AGV-01 的 5000ms），恢复后的第一次 step 会被延迟整个间隔——而不是剩余时间。对于 AGV-03 的计算延迟（Verbose LLM 中 16767ms），这意味着在本来就很危险的时序上额外增加 16.7 秒，将状态从"勉强安全"推向"撞墙"。

这尤其令人困惑：
- 同一场景根据用户是否使用暂停/恢复产生不同的结果
- 看起来像非确定性 Bug（但实际上是确定性的——只是计算错误）
- 破坏了用户对仿真正确性的信任

### 决策

引入 `trackSimsRef`，在暂停/恢复时保持每台 AGV 的 step 状态：

- `launchAnimation()` 将当前的 `trackSims`（包含 `accumS`、`stepNum`、`nextS`）写入 `trackSimsRef.current`
- `pause()` 冻结位置但**不更改** `statusRef.current`（保持 AGV 状态为 "running"）
- `resume()` 首先读取 `trackSimsRef.current`——如果存在，恢复 `accumS` 和 `stepNum`，仅从当前延迟刷新 `nextS`
- 如果 `trackSimsRef.current` 为 null（首次启动，不是恢复），则回退到创建全新的 `trackSims`
- 按钮逻辑通过 `fleetStatus === "paused"` 区分"用户手动暂停"（还有 AGV 在跑 → 显示 "Resume"）和"所有 AGV 已完成"（无 AGV 在跑 → 显示 "Play"）

### 结果

优点：
- 暂停/恢复后的 step 时序正确：AGV-03 在 Normal Ops 中恢复后不再撞墙
- 同一场景无论是否使用暂停/恢复都产生相同结果
- 用户体验信任：暂停/恢复就是"冻结时间"，而不是改变物理

缺点：
- 复杂度略有增加：hook 现在同时管理基于 ref 的状态（物理计算）和 React 状态（渲染）
- `trackSimsRef` 必须在 `launchAnimation`（首次运行）和 `resume`（暂停后恢复）中同时写入
- 需要在首次运行与恢复之间做 null 检查
