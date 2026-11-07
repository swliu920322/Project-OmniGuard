---
id: "DOC-DASHBOARD-OVERVIEW"
title: "AGV Dashboard Reference"
summary: "Current routes, simulation semantics, live-mode boundary, and interpretation rules for the AGV dashboard."
version: "2.0.0"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - cyber-physical-safety
  - edge-inference
perspectives:
  - frontend-engineering
  - academic-research
layers:
  - edge-client
doc_type: tutorial
status: accepted
code_refs:
  - "src/client-edge/src/app/dashboard/page.tsx"
  - "src/client-edge/src/app/dashboard/theorem/page.tsx"
  - "src/client-edge/src/app/dashboard/compare/page.tsx"
  - "src/client-edge/src/app/dashboard/live/page.tsx"
test_refs:
  - "tests/test_brain.py"
---
# AGV Dashboard Reference

The dashboard visualizes how decision latency changes the distance travelled by a simulated AGV. It is an explanatory model, not a physical robot controller or safety certification tool.

## Routes

| Route | Purpose | Source of values |
|---|---|---|
| /dashboard | Compare three AGV strategies in one simulation | Browser configuration |
| /dashboard/theorem | Explore latency, speed, and clearance for one AGV | Browser configuration |
| /dashboard/compare | Compare cloud and edge response paths | Browser configuration |
| /dashboard/live | Submit requests to the configured backend | Runtime response when available |

## What the simulation demonstrates

For a vehicle moving at speed v while waiting for a decision for time t:

    distance travelled while waiting = v × t

The dashboard makes this relationship visible. A slower local decision can still be safer than a richer remote decision if the remote path exceeds the available safety window.

This is a system-design demonstration. Real safety analysis also requires sensor uncertainty, braking dynamics, actuator delay, vehicle mass, surface conditions, control frequency, and a certified deterministic safety controller.

## Three-track comparison

The main dashboard compares:

1. **Cloud-only** — movement continues while the configured cloud decision is pending.
2. **Cloud plus edge** — a configured local safety path can stop the vehicle earlier.
3. **Token-heavy cloud** — cloud delay can be decomposed into network and token-related terms.

The tracks share a browser animation loop so their positions can be compared. Labels such as cloud, edge, and brake describe simulation roles; displayed milliseconds are not automatically benchmark measurements.

## Live mode

Live mode calls the configured backend and can display observed request timing. It is runtime-dependent:

- without a reachable backend it cannot validate Azure behavior;
- a successful local backend call is not proof of private networking;
- a deployed Azure call is evidence only for the named environment and time;
- model and provider metadata should be captured with any reported latency.

### How the live page works

- **The car moves on its own.** While a run is active, a motion loop moves the AGV at its current speed every frame. The cloud request runs in the background; its decision only changes the car when it arrives (for example a stop command). If the car reaches the obstacle first, it collides before the decision comes back.
- **Settings and car state are separate.** Obstacle distance, speed cap, X coordinate, tenant and prompts are settings and do not change while driving. The live gap shown on the twin is `distance - travelled`.
- **Start and Manual Single Step reset the car**, not the settings: position, HP, battery, temperature, speed, alert, logs and the latency readout go back to the scenario's starting state. "Reset all" also restores the settings.
- **Scenario presets** load settings plus a starting car state and say which pipeline path to expect. After a run the observed path is compared with the expectation, and "Run all scenarios" does this for every preset in turn (spaced by the backend rate limit of one request per five seconds).

| Preset | Starting state | Expected path | Model calls |
|---|---|---|---|
| Normal | 80 cm, 0.5 m/s | Router, Safety PASS, Compiler | 3 |
| Worker appears | 12 cm, 1.8 m/s | Safety blocks, Compiler skipped | 2 |
| Fallen cargo | 28 cm | Safety blocks, Compiler skipped | 2 |
| Overheating | 85 °C | Router flags a sensor fault | 1 (model-dependent) |
| Low battery | battery 3% | Backend hard gate | 0 |
| Hardware deadlock | HP 0 | Backend hard gate | 0 |

The Overheating expectation depends on the model's judgement, so a mismatch there is a finding rather than a bug. The other expectations are rules in the backend or the 30 cm safety limit.

The pipeline-timing panel shows only what the backend reports: per-agent latency and runtime, plus Cosmos figures when device-twin storage was actually used. The topology tab is a reference diagram of the Azure deployment, which is not deployed now.

### Languages

UI text lives in `src/client-edge/src/locales/translations.ts` (English and Chinese, switch in the sidebar). Add every key to both languages. Audit log lines produced by `lib/physics.ts` stay in English. The Fleet, Theorem and Compare pages are not translated yet.

Current behavior is defined by `src/client-edge/src/app/dashboard/live/page.tsx`.

## Relationship to benchmark results

The browser simulation and the Python benchmark answer different questions:

| Tool | Primary question |
|---|---|
| Dashboard | What happens to travelled distance when latency assumptions change? |
| Python benchmark | How did a configured multi-agent pipeline classify and time seeded scenarios in a named run? |

Do not copy browser defaults into a benchmark report. Do not use one benchmark average as a universal dashboard constant.

Canonical results and limitations are listed in the [evidence index](../evidence/README.md) and [benchmark guide](../../src/cloud-orchestrator/embodied_brain/benchmark_results/README.md).

## Interpreting safety outcomes

Aggregate accuracy is insufficient. A useful review asks:

- Did a critical obstacle become normal navigation?
- Did a normal scenario create a false alarm?
- Did the final action remain safe even when routing was wrong?
- How long was the tail of the latency distribution?
- Was the result measured, simulated, or configured?

The 60-scenario diagnostic run is particularly useful because it revealed a metric-definition problem: its five Router disagreements were labeled critical by a legacy 5–50 cm generator, but all were 31–46 cm, above the 30 cm blocking threshold, and all produced a final stop action. That observation belongs to the named diagnostic run, not to every model or deployment.

## Demo wording

Recommended:

> “This browser simulation shows the distance cost of delayed decisions. A separate named benchmark measured the cloud pipeline; its run conditions and limitations are preserved with the results.”

Avoid:

> “The dashboard proves that all cloud AI is unsafe.”

Also avoid describing a configured 15 ms brake delay or 20/60 ms edge value as hardware measurement unless a named hardware benchmark is linked.

## Maintenance

When dashboard defaults or formulas change:

1. update the relevant code and tests;
2. update this page;
3. do not rewrite historical benchmark results;
4. create an ADR if the interpretation or architecture boundary changes.
