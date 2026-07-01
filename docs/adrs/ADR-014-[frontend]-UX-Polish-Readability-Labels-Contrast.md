# Architectural Decision Record (ADR 014)

## Title

ADR 014: UX Polish — Readability, Labels, and Visual Contrast

---

## Status

**Implemented**

---

## Context

After implementing the fleet dashboard, several UX issues were identified during self-review and mock presentation walkthroughs:

1. **Font size**: All dashboard text used 7px–10px fonts. On the dark slate-950 background, this was nearly illegible — especially for older viewers or in projector environments. The "sleek" look sacrificed readability.

2. **Pipeline labels**: The Agent Pipeline overlay used "System 2 / System 1 / Hardware" as subtitles. These cognitive science terms required explanation even for technically literate audiences. The original v1 labels confused viewers who didn't know Kahneman's framework.

3. **"Worst:" label**: The pipeline header showed "Worst: AGV-XX" — implying the system was showing the worst-case AGV. This negative framing was unnecessary and could be misinterpreted as the system being broken.

4. **Crash status ambiguity**: When AGV-03 crashed after its cloud response finally arrived, the status remained "Generating..." (cyan, ambiguous — was it still waiting or had it crashed?). The actual response arrived but too late — the AGV was already dead.

5. **Architecture annotations**: Each AGV's config row had no explanation of what the three architectures meant. Viewers had to infer from numbers alone.

---

## Decision

Apply the following UX improvements holistically:

**Font sizing** (all `/dashboard` and kinematic components):
| Element | Before | After |
|---|---|---|
| Body text | 7px–10px | 11px–14px |
| Metric values | 10px | 13px–14px |
| Pipeline subtitles | 9px | 11px (italic) |
| Text color | slate-600 | slate-400 (for dark background) |

**Pipeline subtitles** (AgentPipelineOverlay):
- "System 2" → "Cloud-based LLM reasoning (slow)"
- "System 1" → "Edge compute reflex (fast)"
- "Hardware" → "Hardware safety brake"

**Label framing**: "Worst:" → "Showing:" — neutral framing, implies the system selects the most interesting AGV.

**Crash status**: When cloud response arrives but the AGV has already hit the wall, show "Returned too late" (red) instead of "Generating..." (cyan/gray).

**Architecture annotations** (AGVTrack): Italic description below the config row:
- Cloud-only: `☁️ Cloud detection only — no edge fallback`
- Cloud+Edge: `☁️+⚡ Edge guardian overrides slow cloud`
- Computed (LLM): `🧠 LLM token latency — tweak in Token Breakdown`
- On crash: appends `— 💥 Collided`

---

## Consequences

Positive:
- Readable on projectors and for viewers with visual impairments
- Pipeline self-explanatory without Kahneman prerequisite knowledge
- "Showing:" is neutral — not judgmental
- "Returned too late" precisely describes the failure mode
- Each AGV's role is described in one sentence — no inference needed

Negative:
- Larger fonts push some layout boundaries; AGVTrack rows are taller
- More text in the pipeline overlay means less space for animation
- ~15 component files modified for font size changes (mechanical but tedious)

---

## Chinese Translation

### 标题

ADR 014: 用户体验打磨 —— 可读性、标签与视觉对比度

### 背景

实现舰队 dashboard 后，在自查和模拟演示走查中发现若干 UX 问题：

1. **字体大小**：所有 dashboard 文字使用 7px–10px。在深色 slate-950 背景上几乎不可读——尤其是对年长观众或投影仪环境。"精致"的外观牺牲了可读性。
2. **管道标签**：Agent Pipeline 使用 "System 2 / System 1 / Hardware" 作为副标题。即使对技术观众也需要解释这些认知科学术语。
3. **"Worst:" 标签**：管道头部显示 "Worst: AGV-XX"——暗示系统在显示最差的 AGV。这种负面框架不必要，可能被误解为系统有问题。
4. **撞墙状态歧义**：当 AGV-03 的云响应最终到达时已撞墙，状态仍显示 "Generating..."（青色，模棱两可——是在等待还是已撞墙？）。实际响应已到达但为时已晚——AGV 已经死了。
5. **架构注释**：每台 AGV 的配置行没有解释三种架构的含义。观众只能从数字推断。

### 决策

整体应用以下 UX 改进：

**字体大小**（所有 `/dashboard` 和 kinematic 组件）：从 7–10px 提升到 11–14px，文字颜色从 slate-600 改为 slate-400（适配深色背景）。

**管道副标题**（AgentPipelineOverlay）：
- "System 2" → "Cloud-based LLM reasoning (slow)"
- "System 1" → "Edge compute reflex (fast)"
- "Hardware" → "Hardware safety brake"

**标签框架**："Worst:" → "Showing:"——中性框架，暗示系统选择了最有看头的 AGV。

**撞墙状态**：当云响应到达但 AGV 已撞墙时，显示 "Returned too late"（红色），而非 "Generating..."（青色/灰色）。

**架构注释**（AGVTrack）：配置行下方的斜体描述：
- 纯云端：`☁️ Cloud detection only — no edge fallback`
- 云+边缘：`☁️+⚡ Edge guardian overrides slow cloud`
- LLM 计算：`🧠 LLM token latency — tweak in Token Breakdown`
- 撞墙时追加 `— 💥 Collided`

### 结果

优点：
- 在投影仪上可读，对视障观众友好
- 管道无需 Kahneman 前置知识即可自解释
- "Showing:" 中性——非评判性
- "Returned too late" 精确描述了故障模式
- 每台 AGV 的角色一句话说清——无需推断

缺点：
- 较大字体挤压了部分布局边界；AGVTrack 行更高
- 管道中更多文字意味着动画空间变小
- 约 15 个组件文件因字体大小修改（机械但繁琐）
