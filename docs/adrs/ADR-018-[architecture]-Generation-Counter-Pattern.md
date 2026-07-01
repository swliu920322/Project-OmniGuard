# Architectural Decision Record (ADR 018)

## Title

ADR 018: Generation Counter Pattern for Stale Callback Invalidation

---

## Status

**Implemented**

---

## Context

The `requestAnimationFrame` animation loop is asynchronous and stateful. When a user interacts with the simulation, several race conditions can occur:

**Scenario A — Double-click "Start"**:
User clicks "▶ Play" twice rapidly. Two rAF loops start. Loop 1 (from click 1) and Loop 2 (from click 2) both write to the same `posRef`, `accumS`, and `statusRef`. The writes race — sometimes Loop 1's `setFinal("crashed", ...)` wins, sometimes Loop 2's. The outcome is non-deterministic.

**Scenario B — Rapid scenario switch**:
User clicks "Cloud Spike" while "Normal Ops" is running. The scenario switch calls `reset()` (increments gen, kills current loop), then `start()` (starts new loop with new params). But if `reset()` → `start()` completes before the old rAF callback fires, the old callback (still holding `myGen = oldGen`) runs with the new params — producing incorrect physics.

**Scenario C — React StrictMode double-render**:
In development, React StrictMode intentionally double-invokes effects. If the animation effect is set up and torn down twice, two overlapping loops can coexist.

**Scenario D — Token slider change mid-run**:
The fleet hook must reset and restart the simulation when token params change while running. If the reset → restart sequence interleaves with a pending rAF callback, the same corruption occurs.

---

## Decision

**Introduce a monotonically increasing generation counter (`genRef`) that invalidates stale callbacks:**

```typescript
const genRef = useRef(0); // shared across all hooks

// Every entry point increments gen:
const start = useCallback(() => {
  genRef.current += 1;    // invalidate all prior loops
  // ... reset refs, set status to "running"
}, [cleanup]);

const reset = useCallback(() => {
  genRef.current += 1;    // kill any running loop
  // ... reset everything to idle
}, [cleanup]);

// Inside the animation loop:
const myGen = genRef.current;  // captured at loop start

const animate = (timestamp: number) => {
  if (myGen !== genRef.current) return;  // ← stale callback guard
  // ... physics ...
  if (myGen === genRef.current) {
    animRef.current = requestAnimationFrame(animate); // ← no infinite loop if stale
  }
};
```

Key properties:
- **Non-cooperative**: stale callbacks don't need to know they're stale — they self-terminate on first frame check
- **Atomic**: `genRef.current += 1` is synchronous and atomic between JavaScript turns. Two concurrent clicks cannot "split" the increment
- **Zero-cost when idle**: no polling, no timers, no subscriptions — just one integer comparison per frame
- **Composable**: genRef can be shared across multiple sub-loops (e.g., one useCompareSimulation uses it for both cloud and edge tracks)

The pattern is used in:
- `useKinematicSimulation` (single track)
- `useCompareSimulation` (2 tracks)
- `useFleetSimulation2` (3 tracks)

---

## Consequences

Positive:
- Eliminates all rAF race conditions at source — no special-case handling for double-click, rapid switch, or StrictMode
- One integer comparison per frame (cost: ~0.0001ms) — negligible overhead
- Self-terminating: no need to track how many callbacks exist or manually clean them up
- Proven in production: zero reported bugs related to stale animation callbacks across all three hooks
- Works with React 18 StrictMode out of the box

Negative:
- Requires developers to remember the `if (myGen !== genRef.current) return;` guard in every animation loop
- Shared genRef across independent loops means incrementing gen kills all loops, not just one (acceptable for our use case — all loops are part of the same simulation)
- Debugging: if a callback is mysteriously not executing, check whether gen was incremented unexpectedly

### Alternative Considered: AbortController

We considered passing an `AbortSignal` from an `AbortController` to the animation loop, and calling `abort()` on restart. Rejected because:
- `AbortController` is designed for `fetch()` cancellation, not rAF loops
- AbortController doesn't abort an already-queued rAF callback — it would only prevent the *next* queued frame
- The generation counter pattern is simpler (one integer) and covers more edge cases (already-queued callbacks)

---

## Chinese Translation

### 标题

ADR 018: 代际计数器模式 —— 陈旧回调失效方案

### 背景

`requestAnimationFrame` 动画循环是异步且有状态的。当用户与仿真交互时，可能发生多种竞态条件：

**场景 A —— 双击"Start"**：用户快速点击两次"▶ Play"。两个 rAF 循环启动。Loop 1（来自第一次点击）和 Loop 2（来自第二次点击）都向同一个 `posRef`、`accumS` 和 `statusRef` 写入。写入竞争——有时 Loop 1 的 `setFinal("crashed", ...)` 胜出，有时 Loop 2 的。结果是非确定性的。

**场景 B —— 快速切换场景**：用户在 "Normal Ops" 运行时点击 "Cloud Spike"。场景切换调用 `reset()`（递增 gen，杀死当前循环），然后调用 `start()`（用新参数启动新循环）。但如果 `reset()` → `start()` 在旧的 rAF 回调触发之前完成，旧回调（仍持有 `myGen = oldGen`）会用新参数运行——产生错误的物理计算。

**场景 C —— React StrictMode 双重渲染**：在开发环境中，React StrictMode 故意双重调用 effects。如果动画 effect 被 setup/teardown 两次，两个重叠的循环可能共存。

**场景 D —— 运行时 Token 滑块变化**：当 Token 参数在运行时变化时，舰队 hook 必须重置并重启仿真。如果 reset → restart 的顺序与待处理的 rAF 回调交错，同样的数据损坏会发生。

### 决策

**引入单调递增的代际计数器（`genRef`）来使陈旧回调失效：**

关键特性：
- **非协作式**：陈旧回调不需要知道自己过期了——它们在第一次帧检查时自我终止
- **原子性**：`genRef.current += 1` 在 JavaScript 轮次之间是同步且原子的。两个并发的点击无法"分裂"增量
- **空闲时零成本**：无轮询、无定时器、无订阅——每帧只需一个整数比较
- **可组合**：genRef 可以在多个子循环之间共享（例如 `useCompareSimulation` 为云端和边缘轨道共用同一个 genRef）

该模式用于：
- `useKinematicSimulation`（单轨）
- `useCompareSimulation`（2 轨）
- `useFleetSimulation2`（3 轨）

### 结果

优点：
- 从源头消除所有 rAF 竞态条件——双击、快速切换、StrictMode 无需特殊处理
- 每帧一次整数比较（成本 ~0.0001ms）——可忽略的开销
- 自我终止：无需跟踪存在多少回调或手动清理它们
- 经生产验证：三个 hook 中零报告与陈旧动画回调相关的 Bug
- 开箱即用于 React 18 StrictMode

缺点：
- 开发者需记得在每个动画循环中写 `if (myGen !== genRef.current) return;` 保护
- 跨独立循环共享 genRef 意味着递增 gen 会杀死所有循环而非仅一个（对我们的用例可接受——所有循环属同一仿真）
- 调试：如果回调神秘地不执行，检查 gen 是否被意外递增

### 曾考虑的可选方案：AbortController

考虑过将 `AbortSignal` 从 `AbortController` 传递给动画循环，在重启时调用 `abort()`。被否决因为：
- `AbortController` 是为 `fetch()` 取消设计的，不适用于 rAF 循环
- AbortController 不能中止已入队的 rAF 回调——只能阻止*下一个*排队的帧
- 代际计数器模式更简单（一个整数）且覆盖更多边界情况（已入队的回调）
