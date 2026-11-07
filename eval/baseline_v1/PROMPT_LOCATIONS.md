# Prompt locations in the original implementation

Line numbers refer to the archived copies under `original/` (identical to the tag). Text is not repeated here except the router prompts, to avoid a second copy that could drift.

## Router (intent) prompts, 5 places

| # | Where | Labels | Used by |
|---|---|---|---|
| 1 | `src/cloud-orchestrator/scenario_registry.json`, Tenant-Alpha, line 4 | `CRITICAL_OBSTACLE`, `NORMAL_NAV`, `SENSOR_ERROR` | production path (`brain.py`) and the live page |
| 2 | same file, Tenant-Beta, line 10 | `HUMAN_DETECTED`, `STATIC_OBSTACLE`, `EMERGENCY` | production path for tenant Beta |
| 3 | `src/client-edge/src/app/dashboard/live/config/simulation.ts`, `DEFAULT_CONFIGS`, lines 42 and 47 | same as 1 and 2 | live-page sandbox defaults |
| 4 | `src/cloud-orchestrator/embodied_brain/benchmark.py`, `ROUTER_PROMPT`, line 50 | Alpha's three labels, with a one-line description each | historical benchmark |
| 5 | `src/cloud-orchestrator/embodied_brain/benchmark_no_safety.py`, `ROUTER_PROMPT`, line 24 | identical to 4 (verified byte-equal) | no-safety ablation |

Prompts 1/2/3 are the terse form `Classify telemetry into: [..]. Return ONLY the classification string.` Prompt 4 is the descriptive form:

```
You are an intent classifier for an AGV fleet. Classify the telemetry into exactly one label:
- CRITICAL_OBSTACLE: obstacle is dangerously close, immediate action required
- NORMAL_NAV: normal navigation, no immediate danger
- SENSOR_ERROR: sensor readings indicate malfunction (battery critical, overheating, low HP)

Respond with ONLY the label, nothing else.
```

## What the router receives

`brain.py`, `router_input`, lines 104 and 298 of the archived file: distance, X, velocity, HP, battery, temperature and device id, as one string. There is **no field for a person, an emergency or free text**, so Tenant-Beta's `HUMAN_DETECTED` and `EMERGENCY` have no reliable basis in the input.

## Other agent prompts (not changed in this round unless stated later)

| Agent | Where |
|---|---|
| Safety | `brain.py` lines 116 and 312; `benchmark.py` line 59 (`SAFETY_SYSTEM_PROMPT`), rules at line 57 |
| Compiler | `brain.py` lines 142 and 341; `benchmark.py` line 67; `benchmark_no_safety.py` line 31 |
| Single-agent ablation | `benchmark_baseline.py` line 24 (`SINGLE_AGENT_PROMPT`) |

## Parsing

The reply is upper-cased and tested with `"SENSOR_ERROR" in reply`: `brain.py` lines 109 and 305, `benchmark.py` line 125. Any other reply (including an invalid label) is passed to the next stage unchanged.
