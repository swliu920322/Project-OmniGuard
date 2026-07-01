# Dashboard v2 — Development Specification
# Dashboard v2 — 详细开发规格书

> **Status:** Ready for implementation  
> **Estimated effort:** 5 days  
> **Prerequisites:** [dashboard-redesign-v2.md](./dashboard-redesign-v2.md) (design rationale), [research-agv-real-data.md](./research-agv-real-data.md) (parameter validation), [shared-physics-kernel.md](./shared-physics-kernel.md) (shared kernel concept)  
> **Test criteria:** Offline-only, no backend dependency, all 4 scenarios self-verifying.

---

## 1. File Inventory / 文件清单

### 1.1 New Files

| # | Path | Purpose |
|---|---|---|
| F1 | `src/app/shared/physics/kinematic-token.ts` | Shared pure math: braking distance, V_max, cloud latency from LLM params |
| F2 | `src/app/shared/physics/index.ts` | Re-exports |
| F3 | `src/app/dashboard/config/scenarios.ts` | 4 scenario presets with per-track config |
| F4 | `src/app/dashboard/hooks/useFleetSimulation2.ts` | Fleet hook: 3 tracks, single rAF, scenario management |
| F5 | `src/app/dashboard/components/FleetHeader.tsx` | Header with fleet status + nav links |
| F6 | `src/app/dashboard/components/FleetControlPanel.tsx` | Scenario buttons + global sliders + Token drawer |
| F7 | `src/app/dashboard/components/FleetTrackView.tsx` | 3-column grid: 3 AGV tracks + agent pipeline |
| F8 | `src/app/dashboard/components/AGVTrack.tsx` | Single AGV track (Canvas/SVG, mini kinematic bar) |
| F9 | `src/app/dashboard/components/AgentPipelineOverlay.tsx` | 3-agent status panel (Cloud/Edge/Brake) |
| F10 | `src/app/dashboard/components/TokenBreakdownDrawer.tsx` | 4 sub-sliders for LLM decomposition |

### 1.2 Modified Files

| # | Path | Change |
|---|---|---|
| M1 | `src/app/kinematic/lib/kinematic.ts` | `computeBrakingDistanceM` becomes re-export from `shared/physics` |
| M2 | `src/app/dashboard/page.tsx` | Full rewrite with new components |
| M3 | `src/app/dashboard/lib/physics.ts` | `applyPhysicsStep` calls `shared/physics` for kinematic math; keep battery/temp only |

### 1.3 Deleted Files

| # | Path | Reason |
|---|---|---|
| D1 | `src/app/dashboard/components/PhysicalTwinVisualizer.tsx` | Replaced by AGVTrack |
| D2 | `src/app/dashboard/components/CloudTopologyFlowchart.tsx` | Not relevant to kinematic narrative |
| D3 | `src/app/dashboard/components/SandboxPanel.tsx` | Not needed for fleet demo |
| D4 | `src/app/dashboard/components/AgentOrchestratorFlow.tsx` | Replaced by AgentPipelineOverlay |

---

## 2. Shared Physics Kernel (`shared/physics/kinematic-token.ts`)

### 2.1 API

```typescript
// ============= Types =============

export interface LLMBreakdownParams {
  networkRttMs: number;      // 5–2000, default 200
  promptTokens: number;      // 100–4000, default 500
  completionTokens: number;  // 100–8000, default 1500
  tokenRateTokS: number;     // 10–200, default 50
}

// ============= Pure Functions =============

/** Total cloud detection latency (ms), combining network RTT + LLM generation. */
export function computeCloudLatencyMs(b: LLMBreakdownParams): number {
  return b.networkRttMs + ((b.promptTokens + b.completionTokens) / b.tokenRateTokS) * 1000;
}

/** Total control loop latency in seconds: T_detect + T_brake. */
export function totalLoopLatencyS(
  detectionLatencyS: number,
  brakeLatencyS: number,
): number;

/** Maximum safe speed given clearance distance and total loop latency. */
export function vMaxMps(clearanceM: number, loopLatencyS: number): number;

/** Distance traveled during a given latency window at speed. */
export function slideDistanceM(speedMps: number, latencyS: number): number;

/** Distance traveled during brake engagement. (Renamed from computeBrakingDistanceM) */
export function brakingDistanceM(speedMps: number, brakeLatencyS: number): number;

/** Is the AGV safe given current speed, clearance, and latencies? */
export function isSafe(
  speedMps: number,
  clearanceM: number,
  detectionLatencyS: number,
  brakeLatencyS: number,
): boolean;
```

### 2.2 Unit Test Cases (in-code, not a test framework)

Verify these edge cases manually by logging or with Jest if available:

```typescript
// Case 1: 1 m/s, 2m clearance, 3s cloud + 15ms brake
isSafe(1.0, 2.0, 3.0, 0.015)
// → V_max = 2.0 / 3.015 ≈ 0.66 m/s, V_agv = 1.0 > 0.66 → false

// Case 2: 1 m/s, 2m clearance, 20ms edge + 15ms brake
isSafe(1.0, 2.0, 0.020, 0.015)
// → V_max = 2.0 / 0.035 ≈ 57.1 m/s, V_agv = 1.0 < 57.1 → true

// Case 3: computeCloudLatencyMs({ networkRttMs:200, promptTokens:500, completionTokens:4000, tokenRateTokS:50 })
// → 200 + (4500/50)*1000 = 200 + 90000 = 90200 ms = 90.2 s
```

### 2.3 Migration

```typescript
// kinematic/lib/kinematic.ts — add re-export:
export { brakingDistanceM as computeBrakingDistanceM, isSafe, vMaxMps } from "../../shared/physics";

// Remove the old local definition of computeBrakingDistanceM.
```

---

## 3. Scenario Config (`dashboard/config/scenarios.ts`)

### 3.1 Type Definitions

```typescript
export type TrackId = "agv01" | "agv02" | "agv03";

export interface TrackConfig {
  label: string;
  cloudLatencyMs: number | "computed";   // "computed" = derived from LLMBreakdownParams
  llm?: LLMBreakdownParams;              // required when cloudLatencyMs = "computed"
  edgeLatencyMs: number | null;          // null = edge disabled (AGV has no fallback)
  brakeLatencyMs: number;               // shared AGV hardware property
}

export interface Scenario {
  id: string;
  label: string;
  oneLiner: string;          // spoken in 5 seconds
  tracks: Record<TrackId, TrackConfig>;
  shared: {
    agvSpeedMps: number;
    clearanceM: number;
    totalDistanceM: number;
  };
}
```

### 3.2 The 4 Scenarios

```typescript
export const SCENARIOS: Scenario[] = [
  {
    id: "normal",
    label: "Normal Ops",
    oneLiner: "All three architectures survive under normal latency.",
    tracks: {
      agv01: { label: "Cloud-Only (Lean)", cloudLatencyMs: 800, edgeLatencyMs: null, brakeLatencyMs: 15 },
      agv02: { label: "Cloud + Edge",       cloudLatencyMs: 800, edgeLatencyMs: 20,   brakeLatencyMs: 15 },
      agv03: { label: "Cloud (Verbose)",    cloudLatencyMs: "computed", llm: { networkRttMs:200, promptTokens:500, completionTokens:500, tokenRateTokS:50 }, edgeLatencyMs: null, brakeLatencyMs: 15 },
    },
    shared: { agvSpeedMps: 1.0, clearanceM: 2.0, totalDistanceM: 10 },
  },
  {
    id: "cloud-spike",
    label: "Cloud Spike",
    oneLiner: "Network spike kills cloud-only. Edge Guardian saves the hybrid.",
    tracks: {
      agv01: { label: "Cloud-Only (Spike)", cloudLatencyMs: 5000, edgeLatencyMs: null, brakeLatencyMs: 15 },
      agv02: { label: "Cloud + Edge",        cloudLatencyMs: 5000, edgeLatencyMs: 20,   brakeLatencyMs: 15 },
      agv03: { label: "Cloud (Verbose)",     cloudLatencyMs: "computed", llm: { networkRttMs:200, promptTokens:500, completionTokens:500, tokenRateTokS:50 }, edgeLatencyMs: null, brakeLatencyMs: 15 },
    },
    shared: { agvSpeedMps: 1.0, clearanceM: 2.0, totalDistanceM: 10 },
  },
  {
    id: "verbose-llm",
    label: "Verbose LLM",
    oneLiner: "Network is fine, but the LLM talks too long. Cloud-only still dies.",
    tracks: {
      agv01: { label: "Cloud-Only (Lean)", cloudLatencyMs: 200, edgeLatencyMs: null, brakeLatencyMs: 15 },
      agv02: { label: "Cloud + Edge",       cloudLatencyMs: 200, edgeLatencyMs: 20,   brakeLatencyMs: 15 },
      agv03: { label: "Cloud (Verbose)",    cloudLatencyMs: "computed", llm: { networkRttMs:200, promptTokens:500, completionTokens:4000, tokenRateTokS:50 }, edgeLatencyMs: null, brakeLatencyMs: 15 },
    },
    shared: { agvSpeedMps: 1.0, clearanceM: 2.0, totalDistanceM: 10 },
  },
  {
    id: "edge-disabled",
    label: "Edge Disabled",
    oneLiner: "Without edge fallback, every AGV crashes.",
    tracks: {
      agv01: { label: "Cloud-Only (Spike)", cloudLatencyMs: 5000, edgeLatencyMs: null, brakeLatencyMs: 15 },
      agv02: { label: "Cloud + Edge (Dead)", cloudLatencyMs: 5000, edgeLatencyMs: null, brakeLatencyMs: 15 },
      agv03: { label: "Cloud (Verbose)",    cloudLatencyMs: "computed", llm: { networkRttMs:200, promptTokens:500, completionTokens:4000, tokenRateTokS:50 }, edgeLatencyMs: null, brakeLatencyMs: 15 },
    },
    shared: { agvSpeedMps: 1.0, clearanceM: 2.0, totalDistanceM: 10 },
  },
];
```

**Scene 4 (Edge Disabled) semantics:** AGV-02 has `edgeLatencyMs: null` (no edge fallback), so despite having edge hardware, it's configured as cloud-only. All three crash—proving the necessity of the edge layer.

---

## 4. Fleet Hook (`useFleetSimulation2.ts`)

### 4.1 Interface

```typescript
interface TrackState {
  status: "idle" | "running" | "crashed" | "safe_stop";
  positionM: number;
  mode: "cloud" | "edge";        // which detection mode is active
}

interface UseFleetSimulation2Return {
  tracks: Record<TrackId, TrackState>;
  elapsedS: number;                // shared clock
  activeScenario: Scenario;

  // Fleet-level derived state
  fleetStatus: "idle" | "running" | "all_safe" | "any_crashed" | "mixed";

  // Controls
  selectScenario: (id: string) => void;
  updateGlobalSpeed: (v: number) => void;
  updateGlobalClearance: (c: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;

  // Token breakdown (affects AGV-03's cloudLatencyMs)
  updateTokenParam: (key: keyof LLMBreakdownParams, value: number) => void;
}
```

### 4.2 Internal Architecture

```
useFleetSimulation2
  │
  ├── Holds one Scenario (activeScenario)
  │     └── 3 × TrackConfig → per-track params
  │
  ├── Single requestAnimationFrame loop (ref-based)
  │     └── Each frame:
  │           1. Compute deltaS
  │           2. For each track:
  │               a. Update position: pos += speed × deltaS
  │               b. Accumulate step timer (cloud or edge)
  │               c. If timer > threshold (jittered):
  │                  - Check if position >= detectionBoundary
  │                  - If yes: apply brake, set final state
  │                  - If no: log progress, reset timer
  │               d. If position >= totalDistance: crash
  │           3. Update React state every 3 frames
  │           4. If all tracks done: stop loop
  │
  └── Token breakdown: when user changes LLMBreakdownParams,
      recompute AGV-03's cloudLatencyMs and restart simulation.
```

### 4.3 Key Implementation Details

**Single rAF:**
```typescript
const animRef = useRef<number | null>(null);
const genRef = useRef(0);  // increment on start/reset

const animate = (timestamp: number) => {
  if (myGen !== genRef.current) return;
  // ... update all 3 tracks ...
  if (anyTrackRunning && myGen === genRef.current) {
    animRef.current = requestAnimationFrame(animate);
  }
};
```

**Edge mode decision per track:**
```typescript
const effectiveMode: Mode = track.edgeLatencyMs !== null ? "edge" : "cloud";
const effectiveLatencyMs = effectiveMode === "edge" ? track.edgeLatencyMs! : track.cloudLatencyMs;
const detectionBoundaryM = effectiveMode === "edge"
  ? clearanceBoundaryM + speedMps * effectiveLatencyMs / 1000  // edge: offset detection
  : clearanceBoundaryM;                                          // cloud: at boundary
```

**Token breakdown triggers recompute:**
```typescript
const computeEffectiveCloud = (config: TrackConfig): number => {
  if (config.cloudLatencyMs !== "computed") return config.cloudLatencyMs;
  return computeCloudLatencyMs(config.llm!);
};
```

---

## 5. Component Specs

### 5.1 `FleetHeader.tsx`

```
┌──────────────────────────────────────────────────────┐
│  ● [Fleet Status Badge]     Fleet Kinematic Control  │
│                               ┌──────────┐ ┌───────┐ │
│                               │ Kinematic │ │Compare│ │
│                               └──────────┘ └───────┘ │
└──────────────────────────────────────────────────────┘
```

Props: `fleetStatus: FleetStatus`, `latencyGauge: { max: number; min: number }`.

Status badge colors: `idle` (slate), `running` (cyan pulse), `all_safe` (emerald), `any_crashed` (red pulse).

### 5.2 `FleetControlPanel.tsx`

```
┌──────────────────────────────────────────────────────┐
│  [Normal Ops] [Cloud Spike] [Verbose LLM] [Edge Dis] │  ← scenario buttons
│                                                       │
│  Speed [━━━━━━━━●━━━━━━━━] 1.0 m/s                    │  ← global sliders
│  Clearance [━━━━━━━━●━━━━] 2.0 m                      │
│                                                       │
│  ▶ Play  ⏸ Pause  ↺ Reset                             │
│                                                       │
│  ▼ Token Breakdown  (AGV-03 Cloud Latency)            │  ← collapsible
│    ├─ Network RTT    [━━━●━━━━━━] 200 ms              │
│    ├─ Prompt Tokens  [━━━●━━━━] 500 tok               │
│    ├─ Completion     [━━━●━━] 4000 tok                │
│    └─ Token Rate    [━━━━●━━━] 50 tok/s               │
│    Computed cloudLatencyMs: 90,200 ms                  │  ← read-only
└──────────────────────────────────────────────────────┘
```

Props: `onSelectScenario`, `onStart`, `onPause`, `onReset`, `onUpdateSpeed`, `onUpdateClearance`, `onUpdateTokenParam`.

The **Edge Disabled** button is red-tinted, with a warning icon. Clicking it shows a tooltip: "This proves why edge is not optional."

### 5.3 `FleetTrackView.tsx`

3-column responsive grid:

```
┌────────────┬────────────┬────────────┬──────────────┐
│  AGV-01    │  AGV-02    │  AGV-03    │  Agent       │
│  Cloud-Only│  Cloud+Edge│  Verbose   │  Pipeline    │
│            │            │            │              │
│  ╔══════╗  │  ╔══════╗  │  ╔══════╗  │  ☁️ Cloud    │
│  ║ AGV  ║→□│  ║ AGV  ║→□│  ║ AGV  ║→□│  Commander   │
│  ╚══════╝  │  ╚══════╝  │  ╚══════╝  │  (Detected)  │
│      ──►□  │      ──►□  │      ──►□  │              │
│  8.2/10m   │  8.0/10m   │  8.0/10m   │  ⚡ Edge     │
│  💥 Crashed│  🛡️ Safe   │  💥 Crashed│  Guardian    │
│            │            │            │  (Overridden) │
│            │            │            │              │
│            │            │            │  🛑 Emergency │
│            │            │            │  Brake (Idle) │
└────────────┴────────────┴────────────┴──────────────┘
```

Props: `tracks: Record<TrackId, TrackState>`, `scenario: Scenario`, `elapsedS: number`.

### 5.4 `AGVTrack.tsx`

Renders a single kinematic track bar.

**Visual layout (horizontal):**
```
┌────┬─────────────────────────────────────────────┬────┐
│  0m│  🚚 ───────────── /_//_//_//_ //  🧱        │10m │
│    │  green zone       │ red zone   │ wall       │    │
│    │                   │clearance   │            │    │
│    │                   │boundary    │            │    │
└────┴─────────────────────────────────────────────┴────┘
└─ position: 3.2m  ─┘  clearance: 2.0m  status: running
```

- Green zone: safe area (0m to clearanceBoundaryM)
- Red zone: clearance zone (clearanceBoundaryM to wall)
- AGV icon: moving rectangle or SVG icon
- Wall: barrier at totalDistanceM
- Status overlay: 💥 / 🛡️ / ⏳ / running pulse

**Props:**
```typescript
interface AGVTrackProps {
  label: string;
  positionM: number;
  totalDistanceM: number;
  clearanceM: number;
  status: TrackState;
  mode: "cloud" | "edge";
  trackId: TrackId;
}
```

**Implementation:** SVG, responsive width. AGV position is computed as `(positionM / totalDistanceM) × trackWidth`.

### 5.5 `AgentPipelineOverlay.tsx`

3 cards stacked vertically, right column.

```
┌──────────────────────────┐
│  ☁️ Cloud Commander      │
│  ────────────────────── │
│  Status: Detected (too   │
│  late)                    │
│  Latency: 5000ms          │
│  (system 2)               │
├──────────────────────────┤
│  ⚡ Edge Guardian         │
│  ────────────────────── │
│  Status: Overridden       │
│  Latency: 20ms            │
│  (system 1)               │
├──────────────────────────┤
│  🛑 Emergency Brake       │
│  ────────────────────── │
│  Status: Standby          │
│  Latency: 15ms            │
│  (hardware)               │
└──────────────────────────┘
```

**Status states per agent:**

| Agent | idle | running | safe | crashed |
|---|---|---|---|---|
| Cloud Commander | `☁️ Awaiting` (slate) | `☁️ Detecting...` (cyan pulse) | `☁️ Passed` (emerald) | `☁️ Too late` (red) / `☁️ Never responded` (gray pulse) |
| Edge Guardian | `⚡ Standby` (slate) | `⚡ Monitoring` (cyan pulse) | `⚡ Passed` (emerald) | `⚡ Overridden` (amber) / `⚡ Disabled` (red) |
| Emergency Brake | `🛑 Armed` (slate) | `🛑 Armed` (slate) | `🛑 Armed` (slate) | `🛑 Engaged` (red pulse) |

The overlay reads from the per-track latencies and final state. Shows the **worst-case** track status for each agent (e.g., if any track's cloud failed, Cloud Commander shows "Too late").

**Props:**
```typescript
interface AgentPipelineOverlayProps {
  tracks: Record<TrackId, TrackState>;
  scenario: Scenario;
  activeAgentId: TrackId | null;  // which track is "selected" in the fleet
}
```

### 5.6 `TokenBreakdownDrawer.tsx`

Collapsible drawer with 4 sub-sliders. Only active when the current scenario has a track using `cloudLatencyMs: "computed"`.

```
┌─ ▼ Token Breakdown (AGV-03 Cloud Latency) ──────────┐
│  Network RTT:    [━━━━●━━━━━━━] 200 ms     ↗ 5-2000  │
│  Prompt Tokens:  [━━━●━━━━━━━━] 500 tok   ↗ 100-4000 │
│  Completion:     [━━━●━━━━━━━━] 4000 tok  ↗ 100-8000 │
│  Token Rate:     [━━━━━━●━━━━] 50 tok/s   ↗ 10-200   │
│  ─────────────────────────────────────────           │
│  Computed:  200 + (4500/50)×1000 = 90,200 ms (90.2s) │
└──────────────────────────────────────────────────────┘
```

Each slider calls `updateTokenParam(key, value)` on the fleet hook, which recomputes AGV-03's `cloudLatencyMs` and resets the sim.

---

## 6. State Machine / Each Track

```
                reset()
    ┌───────┐ ──────────→ ┌───────┐
    │ idle  │             │ idle  │
    └───┬───┘             └───┬───┘
        │ start()             │
        ▼                     │
    ┌───────┐                 │
    │running│                 │
    └───┬───┘                 │
        │                     │
    ┌───┴────────┐            │
    ▼            ▼            │
┌───────┐   ┌─────────┐      │
│crashed│   │safe_stop│      │
└───────┘   └─────────┘      │
    │            │            │
    └──── reset()/────────────┘
         selectScenario()
```

**Transitions:**
- `running → crashed`: AGV hits wall (position ≥ totalDistanceM) OR detection arrives too late (finalPos ≥ totalDistanceM)
- `running → safe_stop`: Detection fires within clearance zone + brake stops AGV before wall
- Any → `idle`: `reset()` or `selectScenario()`

---

## 7. Visual Behavior by State

| AGV State | Track Visual | Agent Pipeline |
|---|---|---|
| `idle` | AGV at 0m, gray track | All agents "Awaiting" (slate) |
| `running` | AGV moving, pulse glow | Cloud/Edge "Detecting..." or "Monitoring" (cyan pulse) |
| `crashed` | AGV at wall, 💥 overlay, red flash | Cloud "Too late" (red), Edge "Disabled" or "Overridden" |
| `safe_stop` | AGV at stop position, 🛡️ overlay, cyan glow | Appropriate agent "Passed" or "Overridden" |

**Fleet-level status derived from 3 tracks:**
```
all idle       → "Idle"
any running    → "Running"  
all safe_stop  → "All Safe" (emerald)
any crashed    → "Crashed" (red pulse)
```

---

## 8. Implementation Order / 实施顺序

### Phase 0: Shared Kernel (1 day)

```
Day 1:
  [ ] Create src/app/shared/physics/kinematic-token.ts with all pure functions
  [ ] Create src/app/shared/physics/index.ts
  [ ] Update kinematic/lib/kinematic.ts to re-export from shared
  [ ] Verify /kinematic and /kinematic/compare still work identically
```

**Verification:** Load `/kinematic`. Run default preset. Observe same behavior as before.

### Phase 1: Fleet Hook + Config (1.5 days)

```
Day 2-3:
  [ ] Create src/app/dashboard/config/scenarios.ts
  [ ] Create useFleetSimulation2.ts (3 tracks, single rAF, scenario management)
  [ ] Add token breakdown update path (AGV-03 recompute)
  [ ] Test hook by console.logging 3 track states without UI
```

**Verification:** Hook produces correct final states for each scenario (knows which tracks crash and which stop).

### Phase 2: Track Visuals + Pipeline (1.5 days)

```
Day 4-5:
  [ ] Create AGVTrack.tsx (SVG track with position/clearance/status)
  [ ] Create AgentPipelineOverlay.tsx
  [ ] Create FleetTrackView.tsx (3-column grid)
  [ ] Create FleetHeader.tsx
  [ ] Create FleetControlPanel.tsx
  [ ] Create TokenBreakdownDrawer.tsx
```

**Verification:** Run "Cloud Spike" scenario. AGV-01 crashes visually, AGV-02 stops safely, AGV-03 stops safely (lean LLM). Pipeline shows Cloud Commander → "Too late", Edge Guardian → "Overridden".

### Phase 3: Page Integration (1 day)

```
Day 5-6:
  [ ] Rewrite dashboard/page.tsx with new components
  [ ] Delete D1-D4 (old components)
  [ ] Clean up imports
  [ ] Full offline test of all 4 scenarios
  [ ] Verify /kinematic regression
```

**Verification:** Unplug network. All 4 scenarios work. `/kinematic` and `/kinematic/compare` unchanged.

---

## 9. Edge Cases / 边界情况

| # | Scenario | Expected Behavior |
|---|---|---|
| 1 | AGV-03 `cloudLatencyMs = "computed"` but `llm` is undefined | Fall back to `cloudLatencyMs = 3000` (default) and log warning |
| 2 | User rapidly switches scenarios while running | `selectScenario` calls `reset()`, generation counter kills current rAF |
| 3 | All 3 tracks finish at different times | Fleet status waits for all 3 before showing "All Safe" or "Mixed" |
| 4 | AGV stops exactly at wall (finalPos = totalDistanceM) | Show as `crashed` (contact counts as collision) |
| 5 | Token params changed while running | Reset simulation, restart with new `cloudLatencyMs` |
| 6 | Edge mode is active but `edgeLatencyMs = null` | Treat as cloud-only (effectiveMode = "cloud") |

---

## 10. Regression Checklist

Before calling the redesign done, verify these pages are unchanged:

- [ ] `/kinematic` — preset loads, cloud and edge modes work
- [ ] `/kinematic/compare` — both tracks run, toggle works
- [ ] `/` — startup console loads
- [ ] `/resume` — loads
- [ ] `/iac` — loads
- [ ] `/iac/canvas` — loads

---

## 11. Demo Script (90 seconds)

1. **Open dashboard**: 3 AGVs idle at start line.
2. **Click "Normal Ops" → Play**: All 3 reach wall safely. "Normal conditions, all architectures work."
3. **Reset → "Cloud Spike" → Play**: AGV-01 crashes, AGV-02 safe, AGV-03 safe. "Network spike kills cloud-only. Edge Guardian saves the hybrid."
4. **Reset → "Verbose LLM" → Play**: AGV-01 safe, AGV-02 safe, AGV-03 crashes. "Network is fast, but LLM talks too long. Cloud-only still dies."
5. **Reset → "Edge Disabled" → Play**: All 3 crash. "Without edge fallback, every AGV dies. Edge is not optional."
6. **(Optional) → "Verbose LLM" → Open Token drawer → Drag completionTokens**: Watch AGV-03's crash position change in real time.
