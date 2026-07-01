# Kinematic Sandbox — Evolution of the UX

## Mise en Scène

The kinematic sandbox started as a minimal proof-of-concept: a single AGV barreling toward a wall, with a cloud controller checking its position every ~3 seconds. The math was correct, but the user experience was opaque. The numbers were right; the narrative was missing.

Over several iterations, we rebuilt the sandbox from a toy calculator into a **dual-narrative simulation** — one that lets an engineer *feel* the difference between cloud and edge latency, not just compute it.

---

## What Changed, and Why

### 1. Time-to-Distance Transparency

**The problem:** Log messages printed positions like `8.2m` and `8.17m` with no visible relationship to the latency values the user had configured. The user was left doing mental arithmetic: "3035 + 2686 + 2419 + 15 = 8155ms, so why `8.2`?"

**The fix:** We changed all position logging from `toFixed(1)` (decimeter resolution) to `toFixed(2)`/`toFixed(3)`. Braking distances, previously truncated by floating-point rounding of `0.015` → `"0.01"`, now display as `0.015`. Every number in the log traceable back to its formula without rounding ambiguity.

**Why it matters:** A simulation is only useful if the user can audit its results against their mental model. Sub-centimeter precision eliminates the "why doesn't this add up?" cognitive friction.

### 2. From Two Code Paths to One Abstraction

**The problem:** Cloud used a step-based polling loop (`accumS ≥ nextS` → check). Edge used a raw per-frame position check. Two different mental models, two different code paths, two different chances for a bug.

Cloud:
```
accumulate time → step fires every ~3s → check position → detect or continue
```

Edge:
```
every frame → position ≥ offset boundary ? detect : continue
```

The edge path had no concept of "steps" at all — it was a trigger, not a rhythm.

**The fix:** Both modes now run the same core loop:

```
accumulate delta → accum ≥ jittered(latency) ? step fires → position ≥ detectionBoundary ? brake+log : log progress
```

Cloud supplies `cloudLatencyMs` and `clearanceBoundaryM`. Edge supplies `edgeLatencyMs` and `effectiveEdgeBoundaryM (= clearance + speed × edgeLatencyMs)`. The loop is parameterized, not forked.

**Why it matters:** Unification means the edge's behavior is now step-based too. At `edgeLatencyMs = 20ms`, it checks position ~50 times per second, detects within ~2cm of the boundary, and logs each step. The comparison is apples-to-apples: both sides are "poll every latency interval", just at different rates.

### 3. Edge Gets Its Own Latency, Not an Offset Hack

**The original model:** Edge was "continuous detection with an offset." The offset `effectiveEdgeBoundaryM = clearanceBoundaryM + speed × edgeLatencyMs` approximated the distance the AGV travels during edge processing. Clever, but it conflated the continuous check with the discrete poll.

**The new model:** Edge uses a genuine step-based check at `edgeLatencyMs` intervals. Detection fires when a step finds the AGV past `effectiveEdgeBoundaryM`. This means:

- If `edgeLatencyMs = 20ms`, the first check that fires with the AGV at `≥ 8.02m` triggers the brake.
- The "effective boundary" still accounts for processing time, but the check itself is a discrete poll, mirroring the cloud's mechanism at a finer granularity.

**Why it matters:** The user now sees edge logs like:
```
⚡ Step 42: 0.84m, 9.16m to wall. (latency 21ms)
⚡ Step 86: 1.72m, 8.28m to wall. (latency 19ms)
...
🛡️ [SAFE STOP] Edge Step 401: response at 8.02m. Braking 0.015m → stop at 8.035m. (latency 18ms)
```

The cadence conveys "edge checks fast, detects early." The cloud cadence conveys "cloud checks slow, detects barely in time (or too late)." The contrast is visceral, not just numerical.

### 4. Compare Page: Side-by-Side Without Information Overload

**The problem:** The compare page ran both simulations in parallel but only logged cloud's steps by default. Edge contributed a single "detected at X" line. A user couldn't compare the *rhythm* of the two controllers side by side.

**The fix:** Both sides now log their steps at their own cadence. Edge's check frequency is high (~50/s), so we added a toggle — **⚡ edge checks** — default off, sitting on the far right of the Audit Log header. When enabled, every edge check appears alongside cloud checks:

```
[CLOUD] ✅ Step 1: 2.42m, 7.58m to wall. (2419ms)
[EDGE]  ⚡ Step 247: 4.94m, 5.06m to wall. (19ms)
[EDGE]  ⚡ Step 296: 5.92m, 4.08m to wall. (21ms)
[CLOUD] ✅ Step 2: 5.10m, 4.90m to wall. (2686ms)
```

The density differential alone tells the story: edge checks two orders of magnitude more frequently.

### 5. Clean Slate, Every Run

**The problem:** Logs accumulated across runs, mixing old and new simulation traces. The user had to mentally filter or manually clear.

**The fix:** Both main and compare pages now call `setLogs([])` before every `start()`. Each run is a clean timeline.

### 6. Generation Counter to Prevent Stale Callbacks

**The engineering detail:** The animation loop uses `requestAnimationFrame`. If a user hits "Start" twice rapidly, two animation loops can briefly coexist, each writing to the same refs and corrupting state.

The fix was a monotonically increasing **generation counter** (`genRef`). Every `start()`/`reset()` increments it. Every frame checks `if (myGen !== genRef.current) return;`. This guarantees that any stale callback — even one already queued by the browser — is silently killed on arrival.

---

## The Result

| Before | After |
|---|---|
| Positions rounded to 1 decimal | Positions rounded to 2–3 decimals, fully auditable |
| Two different detection models (step vs continuous) | Unified step-based loop with latency parameter |
| Edge detection modeled as offset hack | Edge modeled as genuine step-based polling |
| Compare page: only cloud logs by default | Compare page: toggleable edge logs, side-by-side rhythm |
| Logs accumulate across runs | Logs clear on each start |
| Stale rAF callbacks could corrupt state | Generation counter kills stale frames |

The sandbox is no longer a calculator. It's a storytelling tool.

---

## 运动学沙盒 — 用户体验演进实录

### 背景

运动学沙盒最初只是一个极简的可行性验证：一辆 AGV 冲向墙壁，云端控制器每 ~3 秒检查一次位置。数学计算是正确的，但用户体验是晦涩的。数字对了，叙事缺失了。

经过多次迭代，我们将沙盒从玩具计算器重构为 **双重叙事模拟器**——让工程师能 *感受* 云与边缘延迟的差异，而非仅仅计算它。

---

### 核心改动与动机

#### 1. 时间到距离的透明化

**问题：** 日志打印的位置如 `8.2m`、`8.17m`，与用户配置的延迟数值之间没有可见的映射关系。用户被迫做心算："3035 + 2686 + 2419 + 15 = 8155ms，那 `8.2` 是什么？"

**修复：** 所有位置日志从 `toFixed(1)`（分米精度）改为 `toFixed(2)`/`toFixed(3)`。刹车距离曾被浮点舍入 `0.015` → `"0.01"` 截断，现在精确显示为 `0.015`。日志中的每个数字都可追溯到其公式，无舍入歧义。

**意义：** 仿真的价值在于用户能对照其心智模型审计结果。亚厘米级精度消除了"为什么加起来不对？"的认知摩擦。

#### 2. 从两条代码路径到单一抽象

**问题：** 云使用基于步进的轮询循环（`accumS ≥ nextS` → 检查），边缘使用原始的逐帧位置检查。两种不同的心智模型，两套不同的代码路径，两倍的 bug 机会。

**修复：** 两种模式现在运行相同的核心循环：

```
累积 δt → 累积 ≥ 抖动(延迟) ? 步进触发 → 位置 ≥ 检测边界 ? 刹车+日志 : 日志
```

云端提供 `cloudLatencyMs` + `clearanceBoundaryM`，边缘提供 `edgeLatencyMs` + `effectiveEdgeBoundaryM（= 清空区 + 速度 × 边缘延迟）`。循环由参数化决定，而非分叉。

**意义：** 统一意味着边缘的行为现在也是步进式的。当 `edgeLatencyMs = 20ms` 时，它每秒检查位置约 50 次，在边界 2cm 内检测到障碍物，并记录每一步。对比是对等的：两侧都是"每延迟区间轮询一次"，只是速率不同。

#### 3. 边缘拥有自己的延迟，而非偏移技巧

**原模型：** 边缘是"带偏移的连续检测"———`effectiveEdgeBoundaryM = clearanceBoundaryM + 速度 × edgeLatencyMs` 近似模拟了 AGV 在边缘处理期间行驶的距离。巧妙，但混淆了连续检查与离散轮询。

**新模型：** 边缘使用真正的步进式检测，间隔为 `edgeLatencyMs`。当某一步发现 AGV 已越过 `effectiveEdgeBoundaryM` 时触发检测。这意味着：

- 若 `edgeLatencyMs = 20ms`，AGV 刚到 `8.02m` 后的第一次检查即触发刹车。
- "有效边界"仍然考虑了处理时间，但检查本身是离散轮询，以更细粒度镜像了云端的机制。

**意义：** 用户现在看到的边缘日志如：
```
⚡ Step 42: 0.84m, 9.16m to wall. (latency 21ms)
...
🛡️ [SAFE STOP] Edge Step 401: response at 8.02m. ...
```
这种节奏传递出"边缘检查快、检测早"的信息。云的节奏传递出"云检查慢、勉强赶在最后（或已经来不及）"的信息。这种对比是直观可感的，而不仅仅是数字上的。

#### 4. 对比页面：并排展示，但不过载

**问题：** 对比页面并行运行两个仿真，但默认只记录云的步进日志。边缘只贡献一行"在 X 处检测"。用户无法并排比较两个控制器的*节奏*。

**修复：** 两侧现在按各自的节奏记录步进日志。边缘的检查频率高（约 50/s），因此我们添加了一个开关——**⚡ edge checks**——默认关闭，位于审计日志标题栏最右侧。开启后，每次边缘检查都会与云检查并列显示：

```
[CLOUD] ✅ Step 1: 2.42m, 7.58m to wall. (2419ms)
[EDGE]  ⚡ Step 247: 4.94m, 5.06m to wall. (19ms)
[CLOUD] ✅ Step 2: 5.10m, 4.90m to wall. (2686ms)
```

密度的差异本身就在述说故事：边缘的检查频率高于云两个数量级。

#### 5. 每次运行都是干净的起点

**问题：** 日志跨运行累积，新旧仿真痕迹混杂。用户需要心理过滤或手动清空。

**修复：** 主页面和对比页面现在都在 `start()` 前调用 `setLogs([])`。每次运行都是一个干净的时间线。

#### 6. 代际计数器防止陈旧回调

**工程细节：** 动画循环使用 `requestAnimationFrame`。如果用户快速双击"开始"，两个动画循环可能短暂共存，各自写入相同的 ref 并损坏状态。

修复方案是一个单调递增的**代际计数器**（`genRef`）。每次 `start()`/`reset()` 递增该计数器。每帧检查 `if (myGen !== genRef.current) return;`。这保证任何陈旧回调——即使是浏览器已入队的回调——在到达时被静默终止。

---

### 成果对比

| 之前 | 之后 |
|---|---|
| 位置四舍五入到 1 位小数 | 位置精确到 2–3 位小数，完全可审计 |
| 两种不同的检测模型（步进 vs 连续） | 统一的步进循环，延迟参数化 |
| 边缘检测建模为偏移技巧 | 边缘建模为真实的步进轮询 |
| 对比页面默认只显示云日志 | 对比页面可切换边缘日志，并排展示节奏 |
| 日志跨运行累积 | 每次开始运行自动清空日志 |
| 陈旧 rAF 回调可能损坏状态 | 代际计数器杀死陈旧帧 |
