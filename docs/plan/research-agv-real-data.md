# AGV Real-World Parameter Research
# AGV 真实参数调研

> Sources: ANSI/ITSDF B56.5, ISO 3691-4:2023, ISO 13855, NIST test reports, real AGV product datasheets (Romias, Boreal Tech, Reeman, SICK, Actemium).

---

## 1. AGV Speed / 实际速度

| Context | Real Value | Source |
|---|---|---|
| **Typical warehouse pallet AGV** | **1.0 – 1.5 m/s** | Product datasheets (Romias VNP15, Boreal VNST20) |
| **Max safety-rated speed** | **3.5 m/s** | ANT driven navigation |
| **ISO-mandated low speed** (no active scanner) | **0.3 m/s** | ISO 3691-4 §5.13 |
| **Turning / cornering** | 0.3 – 0.6 m/s | Product specs |
| **Used in demo:** | **1.0 m/s** (default) | — |

## 2. Braking Distance / 刹车距离

| Speed | Measured Stop Distance | Source |
|---|---|---|
| **1.0 m/s** | **~0.30 m** (30 cm) | Chinese AGV vendor spec (CN) |
| **1.5 m/s** | **~0.50 m** (50 cm) | Same vendor |
| **1.5 m/s (2-ton loaded)** | **~2.5 m** | Actemium engineering estimate |
| **ISO max allowed** | **≤ 1.7 m** | ANSI/ITSDF B56.5 / NIST |

### Braking distance breakdown (ISO 13855 formula):
```
S_min = v × tr + v² / (2a) + C
```
Where:
- `tr` = total system response time (scanner + PLC + brake actuation)
- `a` = deceleration (~2.0 m/s² for loaded AGV)
- `C` = safety margin (~200 mm)

**Example** (500 kg AGV at 1.5 m/s):
- Scanner: 80 ms
- PLC + brake: 120 ms
- `tr` = 200 ms → `v × tr` = 0.30 m
- `v² / (2a)` = 2.25 / 4 = 0.56 m
- `C` = 0.20 m
- **Total: 1.06 m**

## 3. Safety Clearance / 安全清空区

| Regulation | Value | Detail |
|---|---|---|
| ISO 3691-4 minimum side clearance | **≥ 0.5 m** | From walls / fixed structures |
| Protection zone must exceed | **> braking distance** | Scanner field = f(speed) |
| Safety margin (C) | **0.2 m** | ISO 13855 |
| Hard stop without scanner | **≤ 0.3 m/s** + bumper | ISO 3691-4 |
| **Used in demo:** | **2.0 m** (default) | Conservative classroom value |

## 4. System Latency Breakdown / 系统延迟分解

### 4.1 Cloud LLM Control Loop

| Stage | Real Value | Demo Default |
|---|---|---|
| Network RTT (WiFi/LTE to Azure) | **50 – 200 ms** (spike 500–3000 ms) | 200 ms |
| Prompt tokens (input context) | 200 – 2000 tokens | 500 |
| Completion tokens (output) | 200 – 4000 tokens | 1500 |
| GPT-4o token rate | **30 – 90 tok/s** | 50 tok/s |
| GPT-4o-mini token rate | 100 – 200 tok/s | — |
| **Total cloud latency** | **≈ 0.2s + (2500 tok)/(50 tok/s) = 50.2s** | variable |

### 4.2 Edge Controller Loop

| Stage | Real Value | Demo Default |
|---|---|---|
| Edge controller scan cycle | **1 – 10 ms** | — |
| Edge AI inference (NPU) | **20 – 100 ms** | — |
| Rule-based check | **< 1 ms** | — |
| Sensor read + processing | **10 – 50 ms** | — |
| **Total edge latency** | **10 – 100 ms** | **20 ms** |

### 4.3 Brake Hardware

| Stage | Real Value | Demo Default |
|---|---|---|
| Brake relay actuation | **10 – 100 ms** | — |
| PLC processing | **10 – 50 ms** | — |
| Servo brake full engagement | **5 – 15 ms** | — |
| **Total brake latency** | **15 – 150 ms** | **15 ms** |

## 5. Track Length / 跑道长度

| Context | Real Value | Demo Default |
|---|---|---|
| Typical warehouse aisle | **10 – 30 m** | — |
| Narrow corridor AGV | **5 – 8 m** | — |
| Demo sandbox | **10 m** | **10 m** |

## 6. Summary: Demo Parameters vs Reality

| Parameter | Real Range | Our Default | Verdict |
|---|---|---|---|
| `agvSpeedMps` | 0.3 – 3.5 m/s | **1.0** | ✅ conservative, typical |
| `clearanceM` | 0.5 – 3.0 m | **2.0** | ✅ |
| `totalDistanceM` | 5 – 30 m | **10** | ✅ |
| `brakeLatencyMs` | 15 – 150 ms | **15** | ✅ optimistic but plausible |
| `cloudLatencyMs` (single param) | 200 – 30000 ms | **3000** | ✅ conservative aggregate |
| `edgeLatencyMs` | 10 – 100 ms | **20** | ✅ typical for edge PLC |
| `networkRttMs` (token breakdown) | 50 – 200 ms | **200** | ✅ |
| `tokenRateTokS` | 30 – 200 tok/s | **50** | ✅ GPT-4o realistic |
| `promptTokens` | 200 – 2000 | **500** | ✅ |
| `completionTokens` | 200 – 4000 | **1500** | ✅ |

## 7. Key Takeaways for v2 Dashboard

1. **AGV-01 (Cloud Spike, RTT=5000ms):**
   Realistic during peak hours / WiFi congestion in warehouse. Matches operator reports of "AGV stalled mid-aisle."

2. **AGV-03 (Verbose LLM, completionTokens=4000):**
   Real LLM scenario. GPT-4o generating a 4000-token safety report at 50 tok/s adds 80s to control loop. No AGV waits that long.

3. **Default 15ms brake latency:**
   Optimistic (real relay adds ~50ms). But the demo only needs it to illustrate the concept cleaner; realism is secondary to story clarity.
