# Phase 2 Roadmap — Polish & Token Breakdown
# 第二阶段路线 — 打磨与 Token 分解

> This plan assumes Dimension 3 (Kinematic Sandbox) is substantially complete. It evaluates what remains worth doing and what should be explicitly skipped.

---

## 1. Completed — Dimension 3: Kinematic Sandbox

| Deliverable | Status |
|---|---|
| Single-mode simulation (cloud-only / edge-only) | ✅ Done |
| Side-by-side compare page (`/kinematic/compare`) | ✅ Done |
| Unified step-based detection loop (both modes) | ✅ Done |
| Edge latency as proper step-based polling | ✅ Done |
| Brake latency (AGV hardware property) | ✅ Done |
| Presets (4 scenarios) | ✅ Done |
| Audit log with generation-counter safety | ✅ Done |
| Log precision (`toFixed(2/3)`) | ✅ Done |
| Clear logs on start | ✅ Done |
| Compare-page toggle for edge progress logs | ✅ Done |

**Verdict:** The kinematic sandbox fully proves the core thesis — cloud latency is the bottleneck, edge fallback is the remedy. The demo is visceral, interactive, and self-explanatory.

---

## 2. Planned — Dimension 3 Enhancement: LLM Token Breakdown

### 2.1 Why

The original theorem formula includes a token-specific term:

$$V_{max} \le \frac{D_{clearance}}{L_{network\_rtt} + \frac{T_{prompt} + T_{completion}}{S_{token\_rate}} + T_{brake}}$$

The current sandbox collapses this into a single `cloudLatencyMs` parameter. Adding the breakdown completes the mathematical model and makes the academic argument explicit:

- *Even with zero network latency, generating 2000 tokens at 50 tok/s adds 40 seconds to the control loop.*
- *This is why cloud LLMs cannot control fast-moving hardware, regardless of 5G.*

### 2.2 What Changes

**Toggle on the cloud slider panel** — "Break down LLM latency" (default OFF).

| When OFF (current behavior) | When ON |
|---|---|
| `cloudLatencyMs` shown as one slider, freely adjustable | `cloudLatencyMs` becomes **read-only, auto-computed** |
| — | 4 sub-sliders appear: `Network RTT`, `Prompt tokens`, `Completion tokens`, `Token rate` |
| Formula shows "T_detect = cloudLatencyMs" | Formula shows `L_network + (T_prompt + T_completion) / S_token` |

**Computed value:**
```
cloudLatencyMs = networkRttMs + (promptTokens + completionTokens) / tokenRateTokS * 1000
```

### 2.3 Parameter Additions (only active when breakdown ON)

| Parameter | Default | Range | Why |
|---|---|---|---|
| `networkRttMs` | 200 | 5–2000 | Pure network round-trip |
| `promptTokens` | 500 | 100–4000 | LLM input context size |
| `completionTokens` | 1500 | 100–8000 | LLM output length |
| `tokenRateTokS` | 50 | 10–200 | GPT-4o typical: 30–90 tok/s |

### 2.4 Files Affected

- `kinematic/lib/kinematic.ts` — new type alias `LLMBreakdownParams`, conditional default
- `kinematic/components/ParameterPanel.tsx` — collapsible breakdown section inside cloud category
- `kinematic/components/FormulaCard.tsx` — dual formula display (simple / decomposed)
- `kinematic/hooks/useKinematicSimulation.ts` — read computed `cloudLatencyMs` (no logic change, just input)
- `kinematic/hooks/useCompareSimulation.ts` — same

### 2.5 Demo Impact

**High.** An audience member can slide `completionTokens` from 500 → 4000 and watch the cloud AGV's stop position move from "barely safe" → "crash" in real time. This makes the academic formula tangible:

> *"Generating a longer response kills the robot."*

### 2.6 Effort

**~1 day** (pure frontend, no backend changes, no new dependencies).

---

## 3. Skipped — Dimension 1: Edge SLM Fallback

### 3.1 What Was Considered

When cloud disconnects, fall back to a local Small Language Model (Phi-3-mini) running on the edge device or browser (via ONNX Runtime Web).

### 3.2 Why Skip

**The kinematic sandbox cannot visually distinguish SLM from a hard-coded rule.** In a 1D braking simulation, the result is identical regardless of whether the decision comes from Phi-3 or an `if (position >= boundary) brake()` check. The user sees "AGV stops at 8.03m" — the label "Powered by Phi-3" adds zero demo value.

**The real SLM story lives in the chat panel, not the track.**
- When cloud is online: GPT-4o answers "Obstacle 2m ahead, suggest decelerating to 0.3 m/s."
- When cloud is offline + SLM fallback: Phi-3 answers "Obstacle. Brake."
- The contrast is semantic (quality of response), not kinematic (position of stop).

If a future phase adds **chat-level graceful degradation** (e.g., a target detection / Q&A panel that switches between cloud LLM and local SLM), the SLM story becomes demo-worthy. Until then, adding "SLM" labels to the sandbox is cosmetic.

### 3.3 Verdict

**Do not implement.** If the chat panel ever gets built, revisit with a concrete: "This response is from GPT-4o → now from Phi-3" side-by-side.

---

## 4. Skipped — Dimension 2: Distributed Brain-Split

### 4.1 What Was Considered

A dashboard toggle for "Network Partition / Dark Zone" that:
1. Stages commands to an IndexedDB WAL while disconnected
2. Shows a vector-clock conflict resolution graph on reconnect
3. Demonstrates domain-specific priority (safety overrides cloud)

### 4.2 Why Skip

**High cognitive load for demo audiences.** To understand the visualization, the viewer must already know:
- What a Write-Ahead Log is
- What a Vector Clock looks like
- Why physical safety priority beats cloud command priority

This is 2–3 minutes of prerequisite explanation for 5 seconds of "oh, the merge resolved correctly."

**Compare with Dimension 3:** The AGV crash is understood in 0 seconds of explanation. Brain-split requires a distributed systems lecture.

**Academic value is real, but the demo ROI is poor for general audiences.** If the target presentation is a distributed systems conference talk, this becomes relevant. For a general engineering demo or EngD interview, it dilutes the clear story that Dimension 3 tells.

### 4.3 Verdict

**Do not implement.** The concept is strong on paper but the implementation cost (~3 days) yields a demo that requires too much explanation to impress.

---

## 5. Summary Prioritization

| Task | Type | Effort | Demo ROI | Decision |
|---|---|---|---|---|
| LLM Token Breakdown | D3 Enhancement | ~1 day | High — "Longer response = dead AGV" | **✅ Next** |
| Edge SLM Fallback | D1 | ~1 day | Low — "Same stop, different label" | **❌ Skip** |
| Brain-Split / WAL Sync | D2 | ~3 days | Low — "Too much explanation needed" | **❌ Skip** |

**Immediate next step:** Implement the LLM token breakdown in the kinematic sandbox. This closes the last gap in the original theorem formula and gives examiners a direct lever to explore why "more tokens = less safety."

---

## 中文总结

### 已完成：Dimension 3 运动学沙盒
单轨仿真、对比页面、统一循环、边缘步进检测、刹车延迟、预设场景、审计日志、精度优化、日志清空、对比页开关 — 全部完成。

### 下一步：LLM Token 分解（~1 天）
目前 `cloudLatencyMs` 是单一参数。增加一个"展开 LLM 延迟"开关，拆分为：
- `networkRttMs`（网络 RTT）
- `promptTokens`（提示词长度）
- `completionTokens`（生成长度）
- `tokenRateTokS`（生成速率）

公式从 `T_detect = cloudLatencyMs` 变为 `T_detect = L_network + (T_prompt + T_completion) / S_token`。

**演示价值**：滑动"生成长度"滑块，看云端 AGV 从安全刹停 → 撞墙。一句话："生成更多 Token = 杀死机器人。"

### 不做：Dimension 1（SLM 降级）
在 1D 轨道里，SLM 和硬编码规则产生相同的刹车效果。真实价值在 chat 面板的语义降级，不在轨道标签。如果以后做 chat 层再单独规划。

### 不做：Dimension 2（脑裂收敛）
概念硬核，但演示认知成本太高（需要先讲 WAL、向量时钟、冲突仲裁才能理解 5 秒的"合并成功"动画）。学术价值在论文里，不在 demo 里。
