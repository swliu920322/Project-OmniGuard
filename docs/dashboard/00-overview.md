# Fleet Dashboard — Complete Reference

> Routes: `/dashboard` (simulation), `/dashboard/live` (real cloud integration)

---

## 1. Overview

The Fleet Dashboard is the main visual interface of Project OmniGuard. It exists in **two modes** that serve complementary purposes:

| Aspect | `/dashboard` (Simulation) | `/dashboard/live` (Live) |
|---|---|---|
| Backend dependency | None — 100% frontend | Azure Functions (cloud-orchestrator) |
| Data source | Shared physics kernel (`src/app/shared/physics/`) | Real Cosmos DB + Azure OpenAI calls |
| Latency source | Configurable parameter sliders | Measured network RTT + LLM response time |
| Primary audience | Thesis demo, scenario exploration | Technical review, live latency verification |
| Repeatability | Deterministic (no jitter) | Variable (real network conditions) |

The simulation mode proves the **Kinematic-Token Theorem**: cloud LLM response time is too slow for real-time AGV safety, and an edge fallback is required. The live mode validates this theorem with real Azure infrastructure.

---

## 2. Simulation Dashboard (`/dashboard`)

### 2.1 Core Idea

Three AGVs run simultaneously on parallel tracks (each 10m long, speed 1 m/s). Each AGV represents a different control architecture:

| AGV | Architecture | Step interval | Detection boundary | Brake latency |
|---|---|---|---|---|
| AGV-01 | Cloud-Only | `cloudLatencyMs` | `totalDistance - clearanceM` | 15ms |
| AGV-02 | Cloud + Edge | `edgeLatencyMs` (20ms when enabled) | `clearanceBoundary + speed × edgeLatency` | 15ms |
| AGV-03 | Cloud (computed) | Token breakdown formula | `totalDistance - clearanceM` (cloud-only) | 15ms |

The AGV moves **continuously** per animation frame (1 m/s × δt). Detection happens only at **step boundaries** (every `stepInterval` seconds). This simulates the polling-based safety loop of a real AGV.

### 2.2 Step-Based Detection Logic

```
Per frame:
  position += speed × deltaS                              (continuous motion)
  accumS += deltaS
  nextS = jittered(effectiveLatencyMs) / 1000             (recalculated every frame)

When accumS ≥ nextS:                                      (step boundary fires)
  if position ≥ totalDistance          → status = CRASHED
  if position ≥ detectionBoundaryM     → brake → status = SAFE_STOP
  accumS = 0
```

`nextS` is recomputed every frame from `resolveCloudLatencyMs()`, which reads `tokenLLMRef.current` — so Token Breakdown slider changes take effect immediately without restarting.

**Pause / Resume**: On pause, `trackSimsRef.current` preserves each track's `accumS` (time toward next step) and `stepNum`. On resume, these values are restored and `nextS` is refreshed from current latency — so step timing stays correct across pause/resume cycles. Without this, resuming with `accumS=0` would delay the next step by a full token cycle, potentially causing AGV-03 to crash in Normal Ops.

**Edge mode** (`edgeLatencyMs` != null):
- Step interval `nextS` = `edgeLatencyMs` (typically 20ms, near-continuous)
- Detection boundary = `clearanceBoundary + speed × edgeLatency / 1000` (extended safety margin)

**Cloud mode** (`edgeLatencyMs` == null):
- Step interval `nextS` = computed from cloud latency (200ms–5000ms typical)
- Detection boundary = `clearanceBoundary` (= `totalDistance - clearance`)

### 2.3 Four Scenarios

All scenarios are **deterministic** (jitter disabled) so every run produces the same outcome.

#### Normal Ops
- AGV-01: 800ms cloud step → step ~10 fires at 8.0m → brake at 8.015m → **SAFE**
- AGV-02: 20ms edge step → near-real-time detection → **SAFE**
- AGV-03: Lean LLM (2100ms computed) → step ~4 fires at 8.4m → brake → **SAFE**
- *Message*: All three architectures survive under normal latency.

#### Cloud Spike
- AGV-01: 5000ms cloud → step 2 fires at 10.0m → **CRASHED**
- AGV-02: 20ms edge unaffected → **SAFE**
- AGV-03: Lean LLM (2100ms) → same as Normal Ops → **SAFE**
- *Message*: Network spike kills cloud-only. Edge Guardian saves the hybrid.

#### Verbose LLM
- AGV-01: 200ms fast cloud → **SAFE**
- AGV-02: 200ms + 20ms edge → **SAFE**
- AGV-03: Verbose LLM (16767ms computed) → reaches 10m at 10s, step fires at 16.8s → **CRASHED**
- *Message*: Network is fine, but the LLM talks too long. Cloud-only still dies.

Timeline for AGV-03 in this scenario:
- **t = 0–10s**: MOVING — Cloud Commander shows "Generating..." (cyan)
- **t = 10–16.8s**: OVERDUE (position ≥ totalDistance) — Cloud Commander still "Generating..." (cyan)
- **t = 16.8s+**: CRASHED — Cloud Commander shows "Returned too late" (red)

#### Edge Disabled
- AGV-01: 5000ms cloud → **CRASHED**
- AGV-02: 5000ms cloud, no edge fallback → **CRASHED**
- AGV-03: Verbose LLM (16767ms) → **CRASHED**
- *Message*: Without edge fallback, every AGV crashes.

### 2.4 Token Breakdown Formula

The `Token Breakdown` drawer in FleetControlPanel shows four sliders that control AGV-03's cloud latency in **real time**:

```
cloudLatencyMs = networkRttMs + ((promptTokens + completionTokens) / tokenRateTokS) × 1000
```

Scenario presets set initial drawer values via `tc.llm`, but user slider adjustments **override** them live through `tokenLLMRef.current`. The `resolveCloudLatencyMs()` callback always reads `tokenLLMRef.current` for computed tracks (ignoring `tc.llm`). Since `nextS` is recalculated every frame, the new latency takes effect on the very next step boundary — no reset needed.

A note in the drawer reads: *"These sliders control AGV-03's cloud latency in real-time. Scenario presets set initial values; adjust here to find the crash boundary."*

Real-world calibration (2026 benchmarks):

| Preset | networkRttMs | prompt | completion | tok/s | Result | Equivalent model |
|---|---|---|---|---|---|---|
| Lean | 100ms | 200 | 200 | 200 | **2100ms** | ~GPT-4o-mini |
| Verbose | 100ms | 500 | 2000 | 150 | **16767ms** | ~GPT-4o, long output |
| Drawer default | 80ms | 250 | 300 | 200 | **2830ms** | Mid-range model |

Reference data:
- GPT-4o output throughput: ~92 tok/s → blended rate ≈ 120–150 tok/s
- GPT-4o-mini: ~115 tok/s → blended ≈ 180–220 tok/s
- Groq Llama 3.1 8B: ~520 tok/s output → blended ≈ 300–500 tok/s (fast inference hardware)
- 5G URLLC round-trip: ~20ms average
- Serverless cloud control measured: 118–209ms (TU Delft, 2023)

### 2.5 Agent Pipeline (Right Column)

Shows the complete 3-layer decision chain for the **most interesting AGV** (prioritized: crashed → running → safe_stop → idle). Each card has a descriptive subtitle replacing the old "System 2 / System 1 / Hardware" labels:

```
┌─ ☁️ Cloud Commander ────────────────────────┐
│  Status: In time / Generating... /           │
│         Returned too late     (red)          │
│  Cloud-based LLM reasoning (slow)            │
└──────────────────────────────────────────────┘
                      ▼
┌─ ⚡ Edge Guardian ──────────────────────────┐
│  Status: Overridden & safe / Disabled       │
│  Edge compute reflex (fast)                  │
└──────────────────────────────────────────────┘
                      ▼
┌─ 🛑 Emergency Brake ────────────────────────┐
│  Status: Armed / Engaged but too late       │
│  Hardware safety brake                       │
└──────────────────────────────────────────────┘
```

Previously used "System 2 / System 1 / Hardware" which confused viewers; now uses plain-English subtitles.

For AGV-03 with computed latency: when crashed, Cloud Commander shows **"Returned too late"** (red) instead of "Generating..." (gray).

Priority ranking for selection: `crashed (3) > running (2) > safe_stop (1) > idle (0)`. A running AGV that has reached the wall (OVERDUE) takes priority over a safely stopped one. Label changed from "Worst:" to "Showing:" for clarity.

### 2.6 Status Badge Meanings

| Badge | Condition | Meaning |
|---|---|---|
| MOVING | status=running, pos < totalDistance | AGV actively driving |
| OVERDUE | status=running, pos ≥ totalDistance | AGV passed the wall but cloud hasn't responded |
| SAFE | status=safe_stop | Detected boundary in time, brakes engaged |
| CRASHED | status=crashed | Reached totalDistance without safe stop |
| IDLE | Not started | Waiting for Play |

Each AGV card also has a **bottom info row** showing:

| Field | Example | Source |
|---|---|---|
| Cloud latency | `cloud: 2100ms (computed)` or `cloud: 800ms` | `liveCloudMs` prop; appended `(computed)` when `cloudLatencyMs === "computed"` |
| Mode | `20ms edge` or `cloud-only` | `edgeLatencyMs` null check |
| Brake latency | `brake: 15ms` | `config.brakeLatencyMs` |

Below the config row, a **viewer annotation** (italic) describes each AGV's architecture in plain language:
- Cloud-only → `☁️ Cloud detection only — no edge fallback`
- Cloud + Edge → `☁️+⚡ Edge guardian overrides slow cloud`
- Computed (LLM) → `🧠 LLM token latency — tweak in Token Breakdown`
- On crash, appends `— 💥 Collided`

### 2.7 Button States & SimPhase State Machine

The simPhase state machine drives playback: `idle → running → paused → running ... → idle`.

| Phase | Button shows | Behavior |
|---|---|---|
| `idle` | ▶ Play | Calls `start()` — resets positions to 0, all AGVs running |
| `running` | (button disabled) | Animation active; Pause button enabled |
| `paused` (manual) | ▶ Resume | Calls `resume()` — continues from frozen position, preserves `accumS` |
| `paused` (auto-complete) | ▶ Play | Calls `start()` — fresh start; `fleetStatus` is `all_safe`/`any_crashed`/`mixed` |

The button distinguishes "user manually paused" (has running AGVs → "Resume") from "all AGVs finished" (no running AGVs → "Play") by checking `fleetStatus`:
- `fleetStatus === "paused"` → manual pause → show **Resume**
- `fleetStatus` is `all_safe`/`any_crashed`/`mixed` → auto-completed → show **Play**

### 2.8 Font Sizing

All dashboard text uses `11px`–`14px` fonts. Previous versions used `7px`–`10px` which were unreadable on dark backgrounds. Pipeline overlay cards are at `text-sm` (14px) with `text-[11px]` subtitles; AGVTrack body text is `text-[11px]`–`text-xs` (12px) with `text-slate-300/400` colors for contrast.

---

## 3. Live Dashboard (`/dashboard/live`)

### 3.1 Architecture

```
Browser (/dashboard/live)
  │
  ▼
Next.js API Route (route.ts)
  │  POST /api/simulate_agent/
  ▼
Azure Functions (cloud-orchestrator / brain.py)
  │
  ├── Cosmos DB (read/write historical state)
  ├── Azure OpenAI (3-agent pipeline)
  │     ├── Agent 1: Intent Router
  │     ├── Agent 2: Safety Guard
  │     └── Agent 3: Action Compiler
  └── Returns: latency_ms, pipeline_trace, final_actions, cloud_metrics
```

### 3.2 Three-Agent Orchestration Pipeline

| Agent | Role | System | Decision |
|---|---|---|---|
| Agent 1 (Intent Router) | Classify telemetry + route | System 2 (cloud) | PROCEED / AMBIGUOUS |
| Agent 2 (Safety Guard) | Safety rule enforcement | System 1 (cloud) | ALLOWED / BLOCKED |
| Agent 3 (Action Compiler) | Generate motor commands | System 2 (cloud) | BREAK / TURN / CONTINUE |

If Agent 2 returns **BLOCKED**, the pipeline short-circuits: Agent 3 shows **SKIPPED** and the system executes an immediate safety stop. This saves LLM tokens and guarantees low-latency safety.

### 3.3 Deployment Topology

| Component | Azure Service | Network | SKU |
|---|---|---|---|
| Frontend | Container Apps (`omni-frontend`) | Public ingress, VNet outbound | Standard |
| Backend | Container Apps (`omni-backend`) | `external: false` (VNet internal) | Standard |
| Database | Cosmos DB (NoSQL) | Private Endpoint | Serverless (autoscale) |
| Storage | Azure Storage (Queue + Blob) | Private Endpoint | Standard LRS |
| State | Azure Cosmos DB | Single-master writes | Session consistency |
| AI | Azure OpenAI (gpt-5.4-mini) | Outbound NAT Gateway | Global Standard |

Both frontend and backend run in the same ACA environment within the Singapore Spoke VNet (`omni-spoke-vnet`, `10.1.0.0/16`).

### 3.4 Telemetry Displayed

- **Latency gauge**: Shows actual `latency_ms` from the cloud-orchestrator response
- **Physical Twin**: SVG visualizer with AGV position, battery, temperature, velocity
- **Cloud Topology**: Network topology diagram showing VNet, Private Endpoints, Azure services
- **Infra Telemetry Panel**: Cosmos DB RU charge, write latency, execution environment, VNet isolation status
- **Audit Terminal Console**: Scrollable log of every simulation step with timestamps
- **Sandbox Studio**: Editable router prompts, safety rules, and execution schema for testing what-if scenarios

---

## 4. Simulation vs Live — When to Use Which

| Goal | Use |
|---|---|
| Explain the latency problem to non-technical audience | `/dashboard` — deterministic, visual, controllable |
| Demo the 3-architecture comparison | `/dashboard` — side-by-side AGV tracks |
| Prove the math / theorem | `/dashboard` — shared physics kernel |
| Show real Azure infrastructure works | `/dashboard/live` — live API calls |
| Validate latency numbers with real network | `/dashboard/live` — measured RTT + LLM time |
| Test edge cases (sandbox) | `/dashboard/live` — editable prompts |

---

## 5. File Map

```
src/app/dashboard/
├── page.tsx                        # Simulation dashboard (v2)
├── config/scenarios.ts             # 4 scenario presets with TrackConfig
├── hooks/useFleetSimulation2.ts    # Fleet simulation hook (single-rAF, 3 tracks; simPhase state machine; trackSimsRef accumS preservation)
├── components/
│   ├── FleetHeader.tsx             # Sticky header with mode indicator
│   ├── FleetControlPanel.tsx       # Scenario buttons, playback, global sliders
│   ├── FleetTrackView.tsx          # 4-column grid layout
│   ├── AGVTrack.tsx                # Single AGV track bar SVG
│   ├── AgentPipelineOverlay.tsx    # 3-layer decision pipeline (worst-case AGV)
│
├── live/                           # Live dashboard (restored from v1)
│   ├── page.tsx
│   ├── config/simulation.ts
│   ├── hooks/useFleetSimulation.ts
│   ├── lib/
│   │   ├── physics.ts
│   │   └── simulation.ts
│   └── components/
│       ├── ControlPanel.tsx
│       ├── PhysicalTwinVisualizer.tsx
│       ├── CloudTopologyFlowchart.tsx
│       ├── AgentOrchestratorFlow.tsx
│       ├── InfraTelemetryPanel.tsx
│       ├── AuditTerminalConsole.tsx
│       └── SandboxPanel.tsx

src/app/shared/physics/             # Shared kernel (imported by both modes)
├── kinematic-token.ts
└── index.ts

src/cloud-orchestrator/             # Azure Functions backend (live mode)
├── function_app.py
├── embodied_brain/brain.py
└── ...
```

---

# Fleet Dashboard — 完整参考手册

> 路由: `/dashboard`（模拟版），`/dashboard/live`（真实云集成版）

---

## 1. 概述

Fleet Dashboard 是 Project OmniGuard 的核心可视化界面，包含**两种模式**，互为补充：

| 维度 | `/dashboard`（模拟） | `/dashboard/live`（真实） |
|---|---|---|
| 后端依赖 | 无 — 纯前端计算 | Azure Functions（cloud-orchestrator） |
| 数据来源 | 共享物理内核（`src/app/shared/physics/`） | 真实 Cosmos DB + Azure OpenAI |
| 延迟数据 | 滑块配置参数 | 实测网络 RTT + LLM 响应时间 |
| 面向人群 | 论文演示、场景探索 | 技术审查、真实延迟验证 |
| 可重复性 | 确定性的（无 jitter） | 随网络条件变化 |

模拟版用于证明**运动学-Token 定理**：云端 LLM 响应时间对 AGV 实时安全来说太慢，必须引入边缘 fallback。真实版用真实的 Azure 基础设施验证这个定理。

---

## 2. 模拟版 Dashboard (`/dashboard`)

### 2.1 核心设计

三台 AGV 在平行轨道上同时运行（轨道 10m，速度 1 m/s），每台车代表不同的控制架构：

| AGV | 架构 | Step 间隔 | 检测边界 | 刹车延迟 |
|---|---|---|---|---|
| AGV-01 | 纯云端 | `cloudLatencyMs` | 8m（= 10m - 2m clearance） | 15ms |
| AGV-02 | 云 + 边缘 | `edgeLatencyMs`（启用时 20ms） | `8m + 速度 × 边缘延迟` | 15ms |
| AGV-03 | 云端（公式计算） | Token 分解公式 | 8m（纯云端模式） | 15ms |

AGV 每帧平滑移动，检测只在 **step 边界** 触发——模拟真实 AGV 的轮询安全回路。

### 2.2 Step 检测逻辑

```
每帧：
  position += speed × deltaS                            （连续运动）
  accumS += deltaS
  nextS = jittered(effectiveLatencyMs) / 1000           （每帧重新计算）

当 accumS ≥ nextS 时：                                  （step 触发）
  如果 position ≥ 总长         → 状态 = CRASHED
  如果 position ≥ 检测边界     → 刹车 → 状态 = SAFE_STOP
  accumS = 0
```

`nextS` 每帧通过 `resolveCloudLatencyMs()` 重新计算（读取 `tokenLLMRef.current`），因此 Token Breakdown 滑块的变化立即生效，无需重启。

**暂停 / 恢复**：暂停时 `trackSimsRef.current` 保存每台 AGV 的 `accumS`（距下次 step 的时间）和 `stepNum`。恢复时恢复这些值并刷新 `nextS`，保持 step 时序正确。如果没有这个保护，恢复时 `accumS=0` 会导致 step 延迟一个完整 token 周期，可能使 AGV-03 在 Normal Ops 中撞墙。

**边缘模式**（`edgeLatencyMs` != null）：step 间隔 `nextS` = `edgeLatencyMs`（通常 20ms，近乎连续检测），检测边界 = `clearanceBoundary + speed × edgeLatency / 1000`（扩展安全余量）。

**云端模式**（`edgeLatencyMs` == null）：step 间隔 `nextS` = 云端延迟计算值，检测边界 = `clearanceBoundary`。

### 2.3 四个场景

所有场景**完全确定**（无 jitter），每次运行结果一致。

#### Normal Ops（正常运营）
- AGV-01: 800ms 云端 → step ~10 在 8.0m 触发 → 刹停 8.015m → **安全**
- AGV-02: 20ms 边缘 → 近乎实时检测 → **安全**
- AGV-03: Lean LLM (2100ms) → step ~4 在 8.4m → 刹车 → **安全**
- *寓意*：正常延迟下所有架构都能存活。

#### Cloud Spike（云网络尖峰）
- AGV-01: 5000ms 云端 → step 2 在 10.0m 触发 → **撞墙**
- AGV-02: 20ms 边缘不受影响 → **安全**
- AGV-03: Lean LLM (2100ms) → 同 Normal Ops → **安全**
- *寓意*：网络尖峰杀死纯云端。Edge Guardian 拯救混合架构。

#### Verbose LLM（啰嗦的 LLM）
- AGV-01: 200ms 快云 → **安全**
- AGV-02: 200ms + 20ms 边缘 → **安全**
- AGV-03: Verbose LLM (16767ms) → 10s 到终点，16.8s step 触发 → **撞墙**
- *寓意*：网络没问题，但 LLM 说话太慢。纯云端依然会死。

AGV-03 在此场景的时间线：
- **t = 0–10s**：MOVING — Cloud Commander 显示 "Generating..."（青色）
- **t = 10–16.8s**：OVERDUE（位置 ≥ 总距离）— Cloud Commander 仍显示 "Generating..."（青色）
- **t = 16.8s+**：CRASHED — Cloud Commander 显示 "Returned too late"（红色）

#### Edge Disabled（边缘禁用）
- AGV-01: 5000ms 云端 → **撞墙**
- AGV-02: 5000ms 云端，无边缘回退 → **撞墙**
- AGV-03: Verbose LLM (16767ms) → **撞墙**
- *寓意*：没有边缘回退，每台车都撞。

### 2.4 Token 分解公式

FleetControlPanel 中的 Token Breakdown 抽屉提供四个滑块，**实时**控制 AGV-03 的云端延迟：

```
cloudLatencyMs = networkRttMs + ((promptTokens + completionTokens) / tokenRateTokS) × 1000
```

场景预设通过 `tc.llm` 设置抽屉初始值，但用户滑动滑块会通过 `tokenLLMRef.current` **实时覆盖**。`resolveCloudLatencyMs()` 始终读取 `tokenLLMRef.current`（忽略 `tc.llm`）。由于 `nextS` 每帧重新计算，新的延迟值在下一个 step 边界立即生效——无需重置。

抽屉中显示提示："These sliders control AGV-03's cloud latency in real-time. Scenario presets set initial values; adjust here to find the crash boundary."

基于 2026 年真实基准校准：

| 预设 | networkRttMs | prompt | completion | tok/s | 结果 | 对应真实模型 |
|---|---|---|---|---|---|---|
| Lean | 100ms | 200 | 200 | 200 | **2100ms** | ~GPT-4o-mini |
| Verbose | 100ms | 500 | 2000 | 150 | **16767ms** | ~GPT-4o 长输出 |
| Drawer 默认 | 80ms | 250 | 300 | 200 | **2830ms** | 中端模型 |

参考数据：
- GPT-4o 输出吞吐: ~92 tok/s → 综合率 ≈ 120–150 tok/s
- GPT-4o-mini: ~115 tok/s → 综合率 ≈ 180–220 tok/s
- Groq Llama 3.1 8B: ~520 tok/s 输出 → 综合率 ≈ 300–500 tok/s（超快推理硬件）
- 5G URLLC 往返: ~20ms 平均
- Serverless 云控实测: 118–209ms（TU Delft, 2023）

### 2.5 Agent Pipeline（右侧列）

展示**最有看头**的 AGV 的完整 3 层决策链（优先级：crashed → running → safe_stop → idle）。每张卡片增加了描述性副标题，替代原有的 "System 2 / System 1 / Hardware"：

```
┌─ ☁️ Cloud Commander ────────────────────────┐
│  状态: In time / Generating... /             │
│        Returned too late     (red)           │
│  Cloud-based LLM reasoning (slow)            │
└──────────────────────────────────────────────┘
                      ▼
┌─ ⚡ Edge Guardian ──────────────────────────┐
│  状态: Overridden & safe / Disabled         │
│  Edge compute reflex (fast)                  │
└──────────────────────────────────────────────┘
                      ▼
┌─ 🛑 Emergency Brake ────────────────────────┐
│  状态: Armed / Engaged but too late         │
│  Hardware safety brake                       │
└──────────────────────────────────────────────┘
```

原标签 "System 2 / System 1 / Hardware" 让观众困惑，现改为平实的英文描述。

对于 AGV-03 的计算延迟模式：撞墙时 Cloud Commander 显示 **"Returned too late"**（红色），而不是 "Generating..."（灰色）。

AGV 选择优先级：`crashed (3) > running (2) > safe_stop (1) > idle (0)`。已经到墙边还在跑的（OVERDUE）优先于安全停下的。标签从 "Worst" 改为 "Showing" 以更中立。

### 2.6 状态徽章含义

| 标签 | 条件 | 含义 |
|---|---|---|
| MOVING | status=running, pos < totalDistance | AGV 正在行驶 |
| OVERDUE | status=running, pos ≥ totalDistance | AGV 已过终点但云尚未响应 |
| SAFE | status=safe_stop | 及时检测到边界，刹车已锁 |
| CRASHED | status=crashed | 未安全停下即到达终点 |
| IDLE | 未启动 | 等待点击 Play |

每个 AGV 卡片底部还有一个 **信息行**，展示：

| 字段 | 示例 | 来源 |
|---|---|---|
| 云端延迟 | `cloud: 2100ms (computed)` 或 `cloud: 800ms` | `liveCloudMs` 属性；当 `cloudLatencyMs === "computed"` 时追加 `(computed)` |
| 模式 | `20ms edge` 或 `cloud-only` | `edgeLatencyMs` 是否为 null |
| 刹车延迟 | `brake: 15ms` | `config.brakeLatencyMs` |

信息行下方还有一条斜体**观众注释**，平实描述该 AGV 的架构：
- 纯云端 → `☁️ Cloud detection only — no edge fallback`
- 云 + 边缘 → `☁️+⚡ Edge guardian overrides slow cloud`
- LLM 计算 → `🧠 LLM token latency — tweak in Token Breakdown`
- 撞墙时追加 `— 💥 Collided`

### 2.7 按钮状态与 SimPhase 状态机

simPhase 状态机驱动播放控制：`idle → running → paused → running ... → idle`。

| 阶段 | 按钮文字 | 行为 |
|---|---|---|
| `idle` | ▶ Play | 调用 `start()` — 重置位置到 0，所有 AGV 开始运行 |
| `running` | 按钮禁用 | 动画进行中；Pause 按钮可用 |
| `paused`（手动暂停） | ▶ Resume | 调用 `resume()` — 从冻结位置继续，保留 `accumS` |
| `paused`（自动结束） | ▶ Play | 调用 `start()` — 重新开始；`fleetStatus` 为 `all_safe`/`any_crashed`/`mixed` |

按钮通过 `fleetStatus` 区分"用户手动暂停"（还有 AGV 在跑 → "Resume"）和"所有 AGV 已完成"（无 AGV 在跑 → "Play"）：
- `fleetStatus === "paused"` → 手动暂停 → 显示 **Resume**
- `fleetStatus` 为 `all_safe`/`any_crashed`/`mixed` → 自动结束 → 显示 **Play**

### 2.8 字体大小

所有 dashboard 文字使用 `11px`–`14px`。之前版本使用 `7px`–`10px`，在深色背景下难以阅读。Pipeline 卡片标题 `text-sm` (14px)，副标题 `text-[11px]`；AGVTrack 正文 `text-[11px]`–`text-xs` (12px)，颜色 `text-slate-300/400` 保证对比度。

---

## 3. 真实版 Dashboard (`/dashboard/live`)

### 3.1 架构

```
浏览器 (/dashboard/live)
  │
  ▼
Next.js API 路由 (route.ts)
  │  POST /api/simulate_agent/
  ▼
Azure Functions (cloud-orchestrator / brain.py)
  │
  ├── Cosmos DB（读写历史状态）
  ├── Azure OpenAI（3-Agent 流水线）
  │     ├── Agent 1: 意图路由
  │     ├── Agent 2: 安全守卫
  │     └── Agent 3: 动作编译
  └── 返回: latency_ms, pipeline_trace, final_actions, cloud_metrics
```

### 3.2 三 Agent 编排流水线

| Agent | 角色 | 归属系统 | 输出 |
|---|---|---|---|
| Agent 1（意图路由） | 分类遥测数据 + 路由 | System 2（云端） | PROCEED / AMBIGUOUS |
| Agent 2（安全守卫） | 安全规则执行 | System 1（云端） | ALLOWED / BLOCKED |
| Agent 3（动作编译） | 生成电机指令 | System 2（云端） | BREAK / TURN / CONTINUE |

如果 Agent 2 返回 **BLOCKED**，流水线短路：Agent 3 显示 **SKIPPED**，系统执行紧急安全停止。这节省 LLM token 并保证低延迟安全响应。

### 3.3 部署拓扑

| 组件 | Azure 服务 | 网络 | SKU |
|---|---|---|---|
| 前端 | Container Apps (`omni-frontend`) | 公网入口，VNet 出站 | Standard |
| 后端 | Container Apps (`omni-backend`) | `external: false`（VNet 内） | Standard |
| 数据库 | Cosmos DB (NoSQL) | 私有端点 | Serverless（自动伸缩） |
| 存储 | Azure Storage（队列 + Blob） | 私有端点 | Standard LRS |
| 状态存储 | Azure Cosmos DB | 单主写入 | Session 一致性 |
| AI | Azure OpenAI（gpt-5.4-mini） | 出站 NAT 网关 | Global Standard |

前端和后端运行在同一个 ACA 环境中，位于新加坡 Spoke VNet（`omni-spoke-vnet`, `10.1.0.0/16`）。

### 3.4 展示的遥测数据

- **延迟表计**: 显示来自 cloud-orchestrator 的实时 `latency_ms`
- **物理孪生**: SVG 可视化器显示 AGV 位置、电量、温度、速度
- **云拓扑**: 网络拓扑图（VNet、私有端点、Azure 服务）
- **基础设施遥测面板**: Cosmos DB RU 消耗、写入延迟、执行环境、VNet 隔离状态
- **审计终端控制台**: 每个模拟步骤的可滚动日志（带时间戳）
- **沙箱工作室**: 可编辑的路由提示词、安全规则和执行模式，用于测试 what-if 场景

---

## 4. 模拟版 vs 真实版 — 什么时候用哪个

| 目标 | 使用 |
|---|---|
| 向非技术人员解释延迟问题 | `/dashboard` — 确定、直观、可控 |
| 演示三种架构对比 | `/dashboard` — 并排 AGV 轨道 |
| 证明数学/定理 | `/dashboard` — 共享物理内核 |
| 展示真实 Azure 基础设施工作 | `/dashboard/live` — 真实 API 调用 |
| 用真实网络验证延迟数据 | `/dashboard/live` — 实测 RTT + LLM 时间 |
| 测试边界情况（沙箱） | `/dashboard/live` — 可编辑提示词 |

---

## 5. 文件清单

```
src/app/dashboard/
├── page.tsx                        # 模拟版 Dashboard (v2)
├── config/scenarios.ts             # 4 个场景预设 + TrackConfig
├── hooks/useFleetSimulation2.ts    # 舰队模拟 hook（单 rAF，3 轨道；simPhase 状态机；trackSimsRef accumS 保护）
├── components/
│   ├── FleetHeader.tsx             # 粘性头部 + 模式指示器
│   ├── FleetControlPanel.tsx       # 场景按钮、播放控制、全局滑块
│   ├── FleetTrackView.tsx          # 4 列网格布局
│   ├── AGVTrack.tsx                # 单台 AGV 轨道 SVG
│   ├── AgentPipelineOverlay.tsx    # 3 层决策流水线（最差 AGV）
│
├── live/                           # 真实版 Dashboard（从 v1 恢复）
│   ├── page.tsx
│   ├── config/simulation.ts
│   ├── hooks/useFleetSimulation.ts
│   ├── lib/
│   │   ├── physics.ts
│   │   └── simulation.ts
│   └── components/
│       ├── ControlPanel.tsx
│       ├── PhysicalTwinVisualizer.tsx
│       ├── CloudTopologyFlowchart.tsx
│       ├── AgentOrchestratorFlow.tsx
│       ├── InfraTelemetryPanel.tsx
│       ├── AuditTerminalConsole.tsx
│       └── SandboxPanel.tsx

src/app/shared/physics/             # 共享物理内核（两种模式共用）
├── kinematic-token.ts
└── index.ts

src/cloud-orchestrator/             # Azure Functions 后端（真实模式使用）
├── function_app.py
├── embodied_brain/brain.py
└── ...
```
