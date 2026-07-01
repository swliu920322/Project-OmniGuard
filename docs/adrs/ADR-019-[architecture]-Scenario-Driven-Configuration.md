# Architectural Decision Record (ADR 019)

## Title

ADR 019: Scenario-Driven Configuration Architecture — Simulating the Strategy Pattern

---

## Status

**Implemented**

---

## Context

The fleet dashboard needs to demonstrate 4 distinct scenarios (Normal Ops, Cloud Spike, Verbose LLM, Edge Disabled). Each scenario defines:
- 3 track configs (per-AGV: cloud latency, edge latency, brake latency, LLM params)
- Global parameters (speed, clearance, track length)
- A human-readable one-liner for the demo narrative

The naive approach is conditional logic:

```typescript
function getTrackConfig(scenarioId: string, trackId: string) {
  if (scenarioId === "normal") {
    if (trackId === "agv01") return { cloudLatencyMs: 800, edgeLatencyMs: null };
    if (trackId === "agv02") return { cloudLatencyMs: 800, edgeLatencyMs: 20 };
    // ...
  }
  if (scenarioId === "cloud-spike") {
    // ... duplicate structure with different values
  }
}
```

This approach has well-known problems:
- **Brittle**: adding a new scenario requires adding a new `if` branch in every function that reads track config
- **Scattered**: scenario definitions leak into hooks, components, and UI logic — no single place to audit
- **Non-extensible**: adding a 5th scenario means modifying N files instead of 1
- **Presentation logic coupling**: the same `if/else` chain appears in the UI (which buttons to show), the physics engine (what latencies to use), and the pipeline overlay (what labels to display)

---

## Decision

**Model scenarios as pure data using a configuration-driven architecture (Strategy pattern without classes):**

```typescript
// config/scenarios.ts — pure data, zero logic

export interface Scenario {
  id: string;
  label: string;
  oneLiner: string;
  tracks: Record<TrackId, TrackConfig>;
  shared: { agvSpeedMps: number; clearanceM: number; totalDistanceM: number };
}

export interface TrackConfig {
  label: string;
  cloudLatencyMs: number | "computed";
  llm?: LLMBreakdownParams;       // only when cloudLatencyMs === "computed"
  edgeLatencyMs: number | null;   // null = edge disabled
  brakeLatencyMs: number;
}

export const SCENARIOS: Scenario[] = [ /* 4 entries */ ];
```

Architecture rules:
1. **`config/scenarios.ts` owns all scenario data** — no duplicate hardcoded values in hooks or components
2. **`useFleetSimulation2` reads the active scenario** and iterates `scenario.tracks` to initialize track state — zero scenario-specific logic in the hook
3. **UI components receive track state and scenario as props** — `FleetControlPanel` maps `SCENARIOS` to buttons, `FleetTrackView` renders `scenario.tracks` entries
4. **Adding a new scenario = adding one entry to `SCENARIOS` array** — no other code changes needed
5. **The `oneLiner` field is co-located with its data** — keeps the demo narrative close to the technical config, making it easy to verify "does this scenario tell the story we intend?"

This is the **Strategy pattern** applied to configuration: each `Scenario` is a strategy object that the engine executes without knowing its contents. The hook and components are the context that delegates to the strategy.

---

## Consequences

Positive:
- Adding "Edge Disabled" scenario required zero logic changes — just a new config entry with `edgeLatencyMs: null` for AGV-02
- Scenario list drives UI button rendering: `SCENARIOS.map(s => <button>{s.label}</button>)`
- One-liner co-location: 30-second demo script is immediately verifiable against config
- TypeScript catches mismatches: if `TrackConfig` adds a required field, all 4 scenarios must update — no runtime surprises
- Config is serializable (JSON) — could be loaded from an API or a file in the future
- The `"computed"` literal type (`cloudLatencyMs: number | "computed"`) acts as a tagged union — components can switch on it without string matching

Negative:
- Config is static TypeScript, not JSON — changing scenarios requires a rebuild (acceptable for our use case)
- Scenario data is duplicated in the user's mental model and the config file — must keep both in sync
- The `oneLiner` field is not executed or validated — it's documentation, not logic (could fall out of date with actual behavior)

### Evolution: From Implicit to Explicit Configuration

Earlier versions of the kinematic sandbox had hardcoded presets:

```typescript
// kinematic/lib/kinematic.ts — old approach
export const PRESETS: Preset[] = [
  { label: "Warehouse AGV", params: { ... }, mode: "cloud" },
  // ...
];
```

The dashboard v2 evolved this into `Scenario` with:
- Per-track configuration (3 tracks × 4 params each)
- Track-level edge/LLM flags
- Separate `shared` and `tracks` concerns
- Human-readable `oneLiner`

This evolution reflects the growing complexity from "one AGV, two modes" to "three AGVs, four scenarios, per-track LLM decomposition."

---

## Chinese Translation

### 标题

ADR 019: 场景驱动配置架构 —— 模拟策略模式

### 背景

舰队 dashboard 需演示 4 个不同的场景（Normal Ops、Cloud Spike、Verbose LLM、Edge Disabled）。每个场景定义：
- 3 个轨道配置（每台 AGV：云端延迟、边缘延迟、刹车延迟、LLM 参数）
- 全局参数（速度、清空区、轨道长度）
- 一句话描述（用于演示叙事）

直观做法是条件逻辑：

```typescript
function getTrackConfig(scenarioId: string, trackId: string) {
  if (scenarioId === "normal") { if (trackId === "agv01") return ... }
  if (scenarioId === "cloud-spike") { ... }
}
```

这种方法有已知问题：脆弱（新增场景需在读取配置的每个函数中加 `if` 分支）、散乱（场景定义泄漏到 hooks、组件和 UI 逻辑中）、不可扩展（加第 5 个场景需改 N 个文件）、UI/物理逻辑耦合。

### 决策

**将场景建模为纯数据，采用配置驱动架构（无类的策略模式）：**

架构规则：
1. **`config/scenarios.ts` 拥有所有场景数据**——hooks 或组件中无重复硬编码值
2. **`useFleetSimulation2` 读取活动场景**并迭代 `scenario.tracks` 来初始化轨道状态——hook 中零场景特定逻辑
3. **UI 组件接收轨道状态和场景作为 props**——`FleetControlPanel` 将 `SCENARIOS` 映射为按钮，`FleetTrackView` 渲染 `scenario.tracks` 条目
4. **新增场景 = 在 `SCENARIOS` 数组中添加一条**——无需其他代码更改
5. **`oneLiner` 字段与其数据共处一处**——使演示叙事接近技术配置，易于验证"这个场景传达了我们要的故事吗？"

这就是**策略模式**的配置应用：每个 `Scenario` 是一个策略对象，引擎执行它而无需了解其内容。hook 和组件是委托给策略的上下文。

### 结果

优点：
- 添加 "Edge Disabled" 场景无需逻辑更改——只需在配置中将 AGV-02 的 `edgeLatencyMs` 设为 null
- 场景列表驱动 UI 按钮渲染：`SCENARIOS.map(s => <button>{s.label}</button>)`
- 一句话描述与数据共处：30 秒演示脚本可立即对照配置验证
- TypeScript 捕获不匹配：如果 `TrackConfig` 新增必填字段，所有 4 个场景必须更新——无运行时意外
- 配置可序列化（JSON）——将来可从 API 或文件加载
- `"computed"` 字面量类型（`cloudLatencyMs: number | "computed"`）充当 tagged union——组件可基于它切换而无字符串匹配

缺点：
- 配置是静态 TypeScript，非 JSON——更改场景需要重新构建（对我们的用例可接受）
- 场景数据在用户心智模型和配置文件中重复——两者必须保持同步
- `oneLiner` 字段不被执行或验证——它是文档而非逻辑（可能随时间推移与实际行为脱节）

### 演进：从隐式到显式配置

早期版本的 kinematic 沙盒使用硬编码预设：

```typescript
// kinematic/lib/kinematic.ts — 旧方式
export const PRESETS: Preset[] = [
  { label: "Warehouse AGV", params: { ... }, mode: "cloud" },
];
```

Dashboard v2 将其演进为 `Scenario`，包含：
- 每轨配置（3 轨 × 4 参数）
- 轨道级边缘/LLM 标志
- 分离的 `shared` 和 `tracks` 关注点
- 人类可读的 `oneLiner`

这种演进反映了从"一台 AGV，两种模式"到"三台 AGV，四个场景，每轨 LLM 分解"的复杂度增长。
