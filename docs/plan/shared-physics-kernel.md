# Shared Physics Kernel — Explanation
# 共享物理内核 — 概念详解

## What It Is / 是什么

A single file of pure math functions that both `/kinematic` and `/dashboard` import from.

```
src/client-edge/src/app/shared/physics/kinematic-token.ts
```

It contains all the **deterministic physical formulas** (braking distance, V_max, cloud latency from LLM parameters) — zero React, zero side effects, immutable pure functions.

## Why It Exists / 为什么需要

### The Problem Today

Two copies of similar physics logic:

| File | Contains | Problem |
|---|---|---|
| `kinematic/lib/kinematic.ts:45` | `computeBrakingDistanceM` | OK, but only kinematic uses it |
| `dashboard/lib/physics.ts:148` | `applyPhysicsStep` | Contains duplicated `distance = speed × time` math |

If the V_max formula is updated for kinematic but forgotten in dashboard, the two pages disagree. An examiner comparing them will notice the inconsistency.

### The Solution

Extract the shared math into one module. Both pages call the same functions:

```typescript
Before:                    After:
kinematic.ts               kinematic.ts → re-exports from shared
  computeBrakingDistanceM    computeBrakingDistanceM (same API)
  
dashboard/physics.ts       dashboard/physics.ts
  (duplicate speed math)      calls shared/physics functions
```

## What Goes In / 包含哪些函数

All pure functions that answer "how far does the AGV travel during latency X at speed Y":

| Function | Inputs | Output | Used By |
|---|---|---|---|
| `brakingDistanceM` | speedMps, brakeLatencyS | meters | kinematic, dashboard |
| `slideDistanceM` | speedMps, latencyS | meters (during detection) | kinematic, dashboard |
| `vMaxMps` | clearanceM, loopLatencyS | m/s (safety envelope) | kinematic (FormulaCard) |
| `totalLoopLatencyS` | netRttMs, prompt, completion, tokenRate, brakeMs | seconds | FormulaCard, dashboard |
| `computeCloudLatencyMs` | LLMBreakdownParams | ms | ParameterPanel, dashboard |

## What Stays Out / 不包含

| Logic | Where It Stays | Why |
|---|---|---|
| React state management | in hooks (`useKinematicSimulation`, `useFleetSimulation2`) | Framework concern |
| React component rendering | in TSX files | UI concern |
| Dashboard-only metrics (battery, temp) | `dashboard/lib/physics.ts` | Not kinematic-related |
| rAF animation loop | in hooks | Framework concern |
| Jitter computation | in hooks | Simulation concern, not pure physics |

## Deployment

The shared kernel is a plain `.ts` file with zero dependencies. No build tool change needed — Next.js resolves `shared/` via its default `src/` root.

---

## 简而言之

就是一份被两处引用的纯数学文件，而不是两处各抄一份公式。改一处，两页同时生效。考官指着一页公式问"和另一页一致吗？"，答案是的，因为它们是同一行代码。
