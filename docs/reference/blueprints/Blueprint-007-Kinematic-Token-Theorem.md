# Blueprint 007: Kinematic-Token Theorem Sandbox

> **Document Status**: Active / Implemented
> **Target**: Provide a standalone, interactive proof that cloud-only LLM latency cannot safely control fast-moving embodied hardware.
> **Route**: `/kinematic`

---

## 1. Background

Embodied AI systems (AGVs, robots, drones) operate under hard physical deadlines. A cloud-only LLM control loop has two unavoidable latency sources:

1. **Network RTT** — time for telemetry to reach the cloud and the command to return.
2. **Token generation time** — `T_prompt + T_completion` divided by the model's token rate.

During this total delay the vehicle continues to move blindly. The theorem defines the maximum safe speed:

```
V_max ≤ D_clearance / ( L_network_rtt + (T_prompt + T_completion) / S_token_rate )
```

If the AGV's actual speed exceeds `V_max`, it will collide before a cloud-only stop command can take effect. A local edge bypass (e.g. ultrasonic/LiDAR short-circuit, ~15 ms) is therefore not optional — it is a safety requirement.

---

## 2. Architecture

The sandbox is a **pure-client Next.js page** at `/kinematic`. It requires no backend changes, no Azure resources, and no additional dependencies.

### 2.1 File structure

```text
src/client-edge/src/app/kinematic/
├── page.tsx                              # Page shell: state + layout
├── lib/
│   └── kinematic.ts                      # Pure math + slider configs
├── components/
│   ├── KinematicHeader.tsx               # Title + mode toggle + reset
│   ├── ParameterPanel.tsx                # 6 parameter sliders
│   ├── FormulaCard.tsx                   # Theorem + computed metrics
│   ├── SimulationStage.tsx               # AGV track animation
│   └── AuditLog.tsx                      # Event terminal
└── hooks/
    └── useKinematicSimulation.ts         # requestAnimationFrame loop
```

### 2.2 Design principle

- **Page (`page.tsx`) owns what changes**: parameter state, mode state, log state, derived result, and high-level callbacks.
- **Components own what is stable**: rendering, local hover/focus states, and pure visual computations.
- **Hook owns the animation lifecycle**: start, reset, frame ticking, collision/safe-stop detection, and log emission.
- **Lib owns the math**: all formulas are deterministic pure functions.

This separation makes the page easy to modify (e.g. add a new slider, change default values) without touching the animation or rendering code.

---

## 3. State flow

```text
┌─────────────────┐
│  ParameterPanel │───(onChange)──▶ params state
└─────────────────┘

┌─────────────────┐
│  KinematicHeader│───(onModeChange)──▶ mode state
└─────────────────┘

params + mode
    │
    ▼
computeKinematicResult(params) ──▶ result
    │
    ▼
useKinematicSimulation({ params, result, mode, onLog })
    │
    ├──▶ isRunning / agvOffsetPercent / hasCrashed / hasStopped
    │
    ▼
SimulationStage (visualizes current frame)
```

Logs are emitted from the hook when the simulation starts, stops safely, or crashes. They are collected in the page and rendered by `AuditLog`.

---

## 4. Component responsibilities

### 4.1 `lib/kinematic.ts`

Exports:

- `KinematicParams` — 6 numeric inputs.
- `KinematicResult` — cloud/edge latency, `V_max`, braking distances, safety flags.
- `SliderConfig` + `SLIDERS` — reusable slider metadata.
- `DEFAULT_PARAMS` — sensible defaults for first load.
- `computeKinematicResult(params)` — the theorem implementation.
- `formatLatency(seconds)` — human-readable latency string.

### 4.2 `components/KinematicHeader.tsx`

- Page title and one-sentence theorem explanation.
- Cloud-Only / Edge Fallback mode toggle.
- Reset button (resets params, mode, logs, and simulation).

### 4.3 `components/ParameterPanel.tsx`

- Renders 6 sliders from `SLIDERS`.
- Each slider shows label, current value, min/max, and emits `onChange(key, value)`.

### 4.4 `components/FormulaCard.tsx`

- Displays the theorem in a stylized, color-coded form.
- Shows cloud latency, edge latency, both `V_max` values, braking distance, and clearance.
- Renders a safety badge: green when `V_agv ≤ V_max`, red and pulsing when unsafe.

### 4.5 `components/SimulationStage.tsx`

- Draws the track, grid, wall, safety envelope, warning zone, stop-boundary marker, and AGV icon.
- Receives animation state via props and renders the current frame only.
- Shows crash overlay or safe-stop overlay when the simulation ends.
- Includes a **Run Simulation** button that calls `onStart()`.

### 4.6 `components/AuditLog.tsx`

- Scrollable terminal-style panel.
- Each entry is prefixed with a timestamp.

### 4.7 `hooks/useKinematicSimulation.ts`

- Manages `isRunning`, `agvOffsetPercent`, `hasCrashed`, `hasStopped`.
- Uses `requestAnimationFrame` to advance the AGV.
- Computes wall position and stop boundary from current params/result.
- In **Cloud-Only** mode: collision occurs when AGV reaches the wall.
- In **Edge Fallback** mode: AGV stops at the braking-distance boundary.
- Emits descriptive log messages on start/crash/safe-stop.

---

## 5. Interaction scenarios

### Scenario A: Unsafe cloud-only control

- Parameters: `V_agv = 2.0 m/s`, `RTT = 800 ms`, `token_rate = 50`, `prompt = 500`, `completion = 100`, `clearance = 2.0 m`.
- Result: cloud latency ≈ 12 s, `V_max ≈ 0.17 m/s`.
- Simulation: AGV reaches the wall and triggers a collision overlay.
- Log: `[THEOREM VIOLATION] Cloud-only latency ... exceeds braking distance ...`.

### Scenario B: Safe edge bypass

- Same parameters, but mode switched to **Edge Fallback**.
- Result: edge latency = 15 ms, braking distance ≈ 3.0 cm.
- Simulation: AGV stops well before the wall.
- Log: `[EDGE BYPASS] Ultrasonic/LiDAR short-circuit engaged within 15 ms ...`.

---

## 6. Navigation

The Dashboard (`/dashboard`) keeps a header link **🧮 Kinematic Theorem →** that opens `/kinematic` in the same tab. This preserves the existing dashboard workflow while giving the theorem its own dedicated, full-screen presentation surface.

---

## 7. Acceptance criteria

- [x] `/kinematic` is a standalone route and renders without errors.
- [x] `page.tsx` contains only state, derived data, callbacks, and layout.
- [x] All rendering lives in atomic components under `components/`.
- [x] Animation logic is isolated in `hooks/useKinematicSimulation.ts`.
- [x] The theorem formula and all computed metrics are correct.
- [x] Cloud-Only mode can demonstrate collision; Edge Fallback mode can demonstrate safe stop.
- [x] Logs are emitted and displayed in the Audit Log panel.
- [x] `npm run build` passes with no TypeScript errors.
- [x] No new runtime dependencies are introduced.

---

## 8. Future extensions

1. **Export scenario**: add a button to download current params/result as JSON for reproducible demos.
2. **Preset scenarios**: provide one-click presets such as "Warehouse forklift", "Highway drone", "Hospital delivery".
3. **Backend integration**: optionally read real `latency_ms` and token counts from `/api/simulate_agent` traces to mirror the live system.
4. **3D visualization**: replace the 2D track with a Three.js canvas for stronger visual impact.
