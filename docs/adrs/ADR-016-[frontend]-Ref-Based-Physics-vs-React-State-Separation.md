# Architectural Decision Record (ADR 016)

## Title

ADR 016: Ref-Based Physics Engine Decoupled from React Rendering Layer

---

## Status

**Implemented**

---

## Context

The simulation loop runs at 60fps via `requestAnimationFrame`. On every frame, it must:
1. Compute new positions for 3 AGVs (`pos += speed × deltaS`)
2. Accumulate step timers for each track
3. Check collision boundaries and apply braking logic
4. Render visual updates

The naive approach is to store all physics state in React `useState` and update it every frame. We prototyped this in early kinematic experiments and hit three problems:

**A. Render bottleneck**: `setState` triggers a React re-render. At 60fps × 3 tracks = 180 potential re-renders/second. Each re-render runs the component tree diff — most of it unnecessary because only the AGV position SVG attribute changed, not the layout. Frame times jumped from ~4ms (pure physics) to ~16ms (with React reconciliation), leaving no headroom for other work.

**B. Stale closure capture**: The `animate()` callback is a closure over the component's render scope. If React re-renders mid-animation (e.g., because a parent component changed a slider value), the old closure's `paramsRef` may hold stale values. We'd need `useCallback` + dependency arrays that change every frame — defeating the purpose.

**C. Physics ≠ UI frequency**: The physics engine needs sub-millisecond precision for accumS timers. React state is batched and asynchronous — `setPositionM(newPos)` doesn't take effect until the next render cycle. By the time the state is read, 2–3 frames may have passed, making accumS calculations incorrect.

---

## Decision

**Separate physics state (refs) from rendering state (React) with a strict ownership model:**

```
┌─────────────────────────────────────────────────────┐
│                useFleetSimulation2                     │
│                                                       │
│  ┌─────────────────┐     ┌────────────────────────┐  │
│  │  Physics Engine  │     │   React State (public)  │  │
│  │  (refs, mutable) │     │  (setState, triggers    │  │
│  │                  │     │   re-render)            │  │
│  │  posRef          │────▶│  positionM (every 3fr)  │  │
│  │  accumS          │     │  status (on change)     │  │
│  │  stepNum         │     │  stepCount (on step)    │  │
│  │  statusRef       │     │  fleetStatus (derived)  │  │
│  │  nextS           │     └────────────────────────┘  │
│  │  genRef          │                                  │
│  └─────────────────┘                                   │
│       │                                                │
│       │ owns the "truth"                               │
│       ▼                                                │
│  requestAnimationFrame(animate)                        │
│    every frame: update refs + React state every 3fr   │
└─────────────────────────────────────────────────────┘
```

Data flow:
1. **Physics refs** (`posRef`, `accumS`, `stepNum`, `statusRef`): Mutable, read/written every frame. No React involvement. This is the single source of truth for the AGV's physical state.
2. **React state** (`positionM`, `status`, `stepCount`): Updated every 3 frames or on state transitions (crash/safe_stop). Triggers re-render only when visible changes occur.
3. **`paramsRef` / `onLogRef` / `modeRef`**: Refs that hold the latest version of props/callbacks. Updated every render via `paramsRef.current = params` — ensures the animation loop always reads fresh values without stale closures.

Throttle: `if (frameCount % 3 === 0) setPositionM(newPos)` — renders at ~20fps, physics runs at 60fps. The human eye cannot distinguish 20fps from 60fps for a smooth-moving SVG circle.

---

## Consequences

Positive:
- Physics runs at full 60fps without React overhead (~4ms/frame vs ~16ms/frame)
- Stale closures eliminated: `paramsRef.current` is always fresh, no dependency array needed
- Physics state never delayed by React batching — accumS measured in real wall-clock time
- Rendering at 20fps is visually indistinguishable from 60fps for this use case (smooth SVG translation)
- Status transitions (crash/safe_stop) use immediate `setState` — no 3-frame delay for critical visual feedback

Negative:
- Mental model complexity: developers must understand "refs for physics truth, state for display"
- Two parallel state tracks to keep coherent — a bug in one (e.g., update ref but not state) causes inconsistency
- Debugging is harder: refs don't show in React DevTools — must log or add dedicated debug UI
- Every new physics variable needs the "ref + optional throttled state" pattern, not just a single `useState`

### Alternative Considered: `useReducer` + requestAnimationFrame

We considered using `useReducer` with a dispatch from within rAF, but rejected because:
- Dispatching 60 times/second would queue 60 actions/frame — reducer must be pure and fast, but the React reconciliation cost remains
- Dispatch from rAF is technically allowed but discouraged by React docs
- Still doesn't solve the stale-closure problem cleanly

---

## Chinese Translation

### 标题

ADR 016: 基于 Ref 的物理引擎与 React 渲染层分离

### 背景

仿真循环通过 `requestAnimationFrame` 以 60fps 运行。每帧需要：
1. 计算 3 台 AGV 的新位置（`pos += speed × deltaS`）
2. 累加每轨的 step 计时器
3. 检测碰撞边界并应用刹车逻辑
4. 更新视觉渲染

直观的做法是将所有物理状态存在 React `useState` 中，每帧更新。我们在早期 kinematic 实验中尝试过，遇到三个问题：

**A. 渲染瓶颈**：`setState` 触发 React 重新渲染。60fps × 3 轨 = 每秒 180 次潜在重渲染。每次重渲染运行组件树 diff——大多数是不必要的，因为只有 AGV 位置的 SVG 属性改变了，布局没变。帧时间从 ~4ms（纯物理）飙升到 ~16ms（含 React 协调），没有余量做其他工作。

**B. 陈旧闭包捕获**：`animate()` 回调是对组件渲染作用域的闭包。如果 React 在动画中间重新渲染（例如因父组件修改了滑块值），旧闭包中的 `paramsRef` 可能持有过时值。需要用 `useCallback` + 每帧变化的依赖数组——这违背了初衷。

**C. 物理 ≠ UI 频率**：物理引擎需要亚毫秒级精度用于 accumS 计时器。React 状态是批量且异步的——`setPositionM(newPos)` 要到下一次渲染周期才生效。等到状态被读取时，2-3 帧可能已经过去了，使得 accumS 计算不准确。

### 决策

**将物理状态（refs）与渲染状态（React）分离，采用严格的所有权模型：**

数据流：
1. **物理 refs**（`posRef`, `accumS`, `stepNum`, `statusRef`）：可变的，每帧读/写。不涉及 React。这是 AGV 物理状态的唯一真相源。
2. **React 状态**（`positionM`, `status`, `stepCount`）：每 3 帧或在状态转换时（crash/safe_stop）更新。仅在发生可见变化时触发重渲染。
3. **`paramsRef` / `onLogRef` / `modeRef`**：持有最新属性/回调值的 refs。每次渲染通过 `paramsRef.current = params` 更新——确保动画循环始终读取新鲜值，无陈旧闭包。

节流：`if (frameCount % 3 === 0) setPositionM(newPos)` —— 以 ~20fps 渲染，物理以 60fps 运行。人眼无法区分 20fps 和 60fps 的平滑移动 SVG 圆。

### 结果

优点：
- 物理以完全 60fps 运行，无 React 开销（~4ms/帧 vs ~16ms/帧）
- 消除陈旧闭包：`paramsRef.current` 始终新鲜，无需依赖数组
- 物理状态不会因 React 批量更新而延迟——accumS 以真实挂钟时间计量
- 20fps 渲染与 60fps 在此用例中视觉上无区别（平滑 SVG 平移）
- 状态转换（crash/safe_stop）使用即时 `setState`——关键视觉反馈无 3 帧延迟

缺点：
- 心智模型复杂：开发者需理解"refs 是物理真相，state 是显示"
- 两条并行的状态轨道需要保持一致——一个 Bug（如更新了 ref 但没更新 state）会导致不一致
- 调试更难：refs 在 React DevTools 中不可见——需要日志或专门的调试 UI
- 每个新物理变量都需要"ref + 可选节流的 state"模式，而非单一的 `useState`

### 曾考虑的可选方案：`useReducer` + requestAnimationFrame

考虑过使用 `useReducer` 从 rAF 中 dispatch，但被否决因为：
- 每秒 dispatch 60 次会队列 60 个 actions/帧——reducer 必须纯且快，但 React 协调成本仍在
- 从 rAF 中 dispatch 技术上允许但 React 文档不推荐
- 仍不能干净解决陈旧闭包问题
