# Fleet Dashboard — Presentation Script

> **Target audience**: Thesis defense committee / Tech interviewers
> **Duration**: ~8–10 minutes
> **Prerequisite**: Local dev server running (`npm run dev`), browser open at `http://localhost:3000`

---

## English Script

---

### 0. Opening (30s)

**Navigate to**: `http://localhost:3000/dashboard`

**Presenter action**: Point at the screen.

**Script**:

> "Good morning/afternoon. Today I'll demonstrate Project OmniGuard — a cyber-physical control plane for autonomous guided vehicles.
>
> The core question is simple: **Can a cloud-based LLM control a fast-moving robot in real time?**
>
> We'll answer this in three steps:
> 1. First, the math — the Kinematic-Token Theorem
> 2. Then, a fleet-level simulation comparing three architectures
> 3. And finally, if time permits, a live demo connected to real Azure infrastructure"

---

### 1. Kinematic Sandbox — The Theorem (2 min)

**Navigate to**: `http://localhost:3000/kinematic`

**Presenter action**: The page loads with a single track, AGV at left, wall at right. Sliders on the left panel.

**Script**:

> "Let's start with the math. This is the Kinematic-Token sandbox.
>
> We have an AGV moving toward a wall at constant speed. The red zone at the right is the clearance zone — once the AGV enters it, it must detect the wall and brake before hitting it.
>
> The key insight: **the AGV does not detect continuously**. It runs a control loop at fixed intervals. Between two checks, the AGV slides blindly."

**Presenter action**: Click "▶ Run Simulation" with default cloud mode.

> "Watch. In cloud-only mode, the AGV moves smoothly, but detection only happens at step boundaries. Here the cloud latency is 800ms — that means one check every 0.8 seconds. By the time it detects the wall..."

**Let the simulation run until crash**.

> "...it's too late. The AGV slides through the clearance zone and **collides**."

**Presenter action**: Click "↺ Reset". Switch mode to "Edge" by clicking the "Edge" tab/button.

> "Now watch what happens with edge fallback. Edge detection runs at 20ms — 40 times faster. The AGV checks its position almost continuously."

**Click "▶ Run Simulation" in edge mode. Let it safe-stop.**

> "This time, the edge detects the boundary in time and engages the emergency brake. **Safe stop at 8.4 meters.** "

**Presenter action**: Open the Token Breakdown section (if collapsed). Point to the formula.

> "This is the Kinematic-Token Theorem:

> ```
> Vmax ≤ Clearance / (Network_RTT + (Prompt + Completion) / Token_Rate + Brake_Time)
> ```

> The denominator has three terms: network delay, LLM generation time, and hardware brake latency. **Any one of them can kill the robot.** "

---

### 2. Compare Page — Cloud vs Edge Side-by-Side (1 min)

**Navigate to**: `http://localhost:3000/kinematic/compare`

**Presenter action**: Point to the two tracks side by side.

**Script**:

> "Let's compare cloud-only vs edge fallback side by side under identical conditions."

**Click "▶ Run Compare"**.

> "Same speed. Same clearance. Same wall. The left AGV uses cloud detection at 800ms. The right AGV uses edge detection at 20ms.
>
> Watch the step counters — the edge AGV takes many more steps because it checks far more frequently."

**Let both run to completion. Left crashes, right safe-stops.**

> "The cloud AGV collides. The edge AGV stops safely. **Under identical conditions, the only difference is detection latency.**
>
> This is the fundamental proof: cloud LLM latency — even at a 'fast' 800ms — is too slow for real-time safety. You need an edge fallback."

---

### 3. Fleet Dashboard — Three Architectures, Four Scenarios (4 min)

**Navigate to**: `http://localhost:3000/dashboard`

**Presenter action**: Point to the four-column layout (AGV-01, AGV-02, AGV-03, Agent Pipeline).

**Script**:

> "Now let's scale up. The fleet dashboard runs three AGVs simultaneously, each representing a different control architecture:
>
> - **AGV-01, left**: Cloud-only. No edge fallback. Pure cloud detection.
> - **AGV-02, center**: Cloud + Edge hybrid. Edge guardian can override.
> - **AGV-03, right**: Cloud-only with LLM-computed latency. The Token Breakdown drawer controls its cloud delay in real time.
>
> On the far right is the Agent Pipeline — it shows the decision chain for the most interesting AGV at any moment."

---

#### 3.1 Normal Ops (30s)

**Presenter action**: Ensure "Normal Ops" scenario is selected. Click "▶ Play".

**Script**:

> "First scenario: Normal Operations. All three architectures should survive.
>
> Watch AGV-01 — cloud-only at 800ms. It detects at the boundary and brakes in time.
> AGV-02 with edge at 20ms — near-real-time, stops easily.
> AGV-03 with computed latency at 2100ms — slower, but still detects in time.
>
> **All three safe.** Under normal latency, every architecture works."

**Let all three finish (safe_stop). Point to the green SAFE badges.**

---

#### 3.2 Cloud Spike (1 min)

**Presenter action**: Click "Cloud Spike" scenario. Click "▶ Play".

**Script**:

> "Second scenario: Cloud Spike. Network latency jumps to 5000ms for the cloud-only AGVs.
>
> AGV-01 — cloud-only at 5000ms. One step every 5 seconds. At 1m/s, it slides 5 meters between checks. It enters the clearance zone at 8 meters, but the next step fires at 10 meters — **straight into the wall.** "

**Let AGV-01 crash. AGV-02 safe-stops. AGV-03 also safe-stops.**

> "AGV-02 has edge override at 20ms. The edge checks 250 times faster than the cloud. It detects the boundary and stops safely. **The cloud was too slow, but the edge saved it.**
>
> AGV-03 uses computed latency — since its LLM parameters weren't changed, it still runs at 2100ms and stops safely.
>
> The message: **A network spike kills cloud-only. Edge guardian saves the hybrid.** "

---

#### 3.3 Verbose LLM (1 min)

**Presenter action**: Click "Verbose LLM" scenario. Click "▶ Play".

**Script**:

> "Third scenario: Verbose LLM. Network is fine — only 200ms. But the LLM generates 2500 tokens of output at 150 tokens per second. That's 16.7 seconds of computation.
>
> AGV-01 with 200ms cloud latency — fast, stops safely.
> AGV-02 with 200ms cloud plus 20ms edge — also safe.
>
> But AGV-03 — the verbose LLM — takes 16.7 seconds per step. The AGV reaches the wall in 10 seconds. It sits at the wall for another 6.7 seconds waiting for the next cloud response. **The badge shows 'OVERDUE' during this window.** "

**Let AGV-03 crash. Point to the "OVERDUE" badge, then the red "CRASHED" badge.**

> "When the step finally fires at 16.7 seconds, the AGV has been at the wall for 6 seconds. **Status: CRASHED.**
>
> The Agent Pipeline shows Cloud Commander in red: **'Returned too late'** — not 'Generating...' anymore, because it actually returned, but the AGV was already dead.
>
> The message: **Network can be perfect, but a 'talkative' LLM still kills the robot. This proves the Token term in the theorem: (Prompt + Completion) / Token_Rate.** "

---

#### 3.4 Token Breakdown — Live Control (1 min)

**Presenter action**: Click the "Token Breakdown ▼" drawer to open it. Ensure the simulation is stopped or reset.

**Script**:

> "Now, the Token Breakdown drawer is not just informational — it **controls AGV-03's latency in real time.**
>
> Let's start with the Verbose LLM scenario again. AGV-03 will crash. But watch what happens when we adjust the sliders."

**Click "▶ Play" on Verbose LLM. Let AGV-03 start running. While it's running, drag the "Token Rate" slider up to 500 tok/s.**

> "While it's running, I can increase the token generation rate. The cloud latency drops from 16.7 seconds to..."
>
> *(point to the computed latency readout)*
>
> "...about 6 seconds. Since the nextS is recalculated every frame, the next step fires sooner. The AGV might still crash, but the crash happens later — or if I push the sliders far enough, it could even stop safely."

**Pause and reset. Try a different combination:**

> "Or, I can set the scenario to Normal Ops and **intentionally crash AGV-03 by making its latency worse**. Increase Completion tokens to 4000, drop Token Rate to 50. Now the same AGV that was safe at default settings will crash. **This lets the audience find the exact boundary between safe and crash — the theorem's Vmax limit in real time.** "

---

#### 3.5 Edge Disabled (30s)

**Presenter action**: Click "Edge Disabled" scenario. Click "▶ Play".

**Script**:

> "Final scenario: Edge Disabled. AGV-02 has no edge fallback — both cloud AGVs run at 5000ms, and AGV-03 uses verbose LLM at 16.7 seconds.
>
> All three crash. No architecture survives.
>
> The message: **Without edge fallback, every AGV fails. The edge guardian is not optional — it's mandatory for safety.** "

---

### 4. Live Dashboard — Real Infrastructure (optional, 1 min)

**Navigate to**: `http://localhost:3000/dashboard/live`

**Prerequisite**: Azure Functions (cloud-orchestrator) running locally.

**Presenter action**: Point to the live telemetry.

**Script**:

> "If we have the Azure backend running, we can switch to the live dashboard. Here, instead of simulated latency, we call real Azure OpenAI endpoints through our cloud-orchestrator.
>
> The latency shown here is measured — network RTT plus actual GPT-4o-mini generation time. The three-agent pipeline (Intent Router → Safety Guard → Action Compiler) runs on real Azure Functions behind a VNet.
>
> This validates the theorem with real infrastructure, not just simulation."

---

### 5. Closing (30s)

**Script**:

> "To summarize:
>
> 1. **The Kinematic-Token Theorem** mathematically proves that cloud LLM latency — whether from network delay or token generation — is too slow for real-time AGV safety.
> 2. **The fleet simulation** demonstrates this visually: three architectures, four scenarios, one clear conclusion.
> 3. **An edge fallback is not optional.** It's the only way to guarantee safety when cloud latency spikes or the LLM takes too long.
>
> Thank you. I'm happy to take questions."

---

---

## Chinese Script / 中文演示稿

---

### 0. 开场白 (30s)

**导航至**: `http://localhost:3000/dashboard`

**动作**: 指向屏幕。

**讲稿**：

> "各位好。今天我来演示 Project OmniGuard——一个面向自动导引车的物理信息控制面。
>
> 核心问题很简单：**基于云的 LLM 能否实时控制一台高速移动的机器人？**
>
> 我将分三步回答：
> 1. 首先看数学——运动学-Token 定理
> 2. 然后看舰队级仿真——三种架构并排对比
> 3. 如果时间允许，最后连真实 Azure 基础设施看实时数据"

---

### 1. 运动学沙盒 — 定理演示 (2 分钟)

**导航至**: `http://localhost:3000/kinematic`

**动作**: 页面加载后，指向左侧参数面板和右侧轨道。AGV 在左边，墙在右边。

**讲稿**：

> "我们先看数学。这是运动学-Token 沙盒。
>
> 一台 AGV 以恒定速度向墙行驶。右侧红色区域是 clearance 区——一旦 AGV 进入这个区域，必须在撞墙前检测到并刹车。
>
> 关键洞察：**AGV 不是连续检测的。** 它以固定间隔运行控制循环。两次检测之间，AGV 在盲滑。"

**动作**: 点击 "▶ Run Simulation"，默认 cloud 模式。

> "看。云端模式下，AGV 平滑移动，但检测只在 step 边界触发。这里云端延迟是 800ms——意味着每 0.8 秒检测一次。等它检测到墙……"

**让仿真跑到撞墙**。

> "……已经太晚了。AGV 滑过整个 clearance 区，**撞墙了**。"

**动作**: 点击 "↺ Reset"。切换到 "Edge" 模式。

> "现在看边缘回退的效果。边缘检测每 20ms 一次——快 40 倍。AGV 几乎连续检查位置。"

**点击 "▶ Run Simulation"，边缘模式。让安全停止。**

> "这次，边缘及时检测到了边界并触发紧急刹车。**在 8.4 米处安全停止。** "

**动作**: 展开 Token Breakdown（如果折叠的话）。指向公式。

> "这就是运动学-Token 定理：

> ```
> Vmax ≤ Clearance / (Network_RTT + (Prompt + Completion) / Token_Rate + Brake_Time)
> ```

> 分母有三项：网络延迟、LLM 生成时间、硬件刹车延迟。**任何一项都能杀死机器人。** "

---

### 2. 对比页 — 云端 vs 边缘并排对比 (1 分钟)

**导航至**: `http://localhost:3000/kinematic/compare`

**动作**: 指向两条并排轨道。

**讲稿**：

> "我们来对比云端和边缘——完全相同的条件下并排运行。"

**点击 "▶ Run Compare"**。

> "同样的速度、同样的 clearance、同样的墙。左边 AGV 用 800ms 云端检测。右边用 20ms 边缘检测。
>
> 看步数计数器——边缘 AGV 步数多得多，因为它检测频率高得多。"

**让两者都跑到结束。左边撞墙，右边安全停止。**

> "云端 AGV 撞墙了。边缘 AGV 安全停下。**完全相同条件，唯一区别是检测延迟。**
>
> 这是根本性证明：云端 LLM 延迟——即使 '快' 到 800ms——对实时安全来说也太慢了。你必须有边缘回退。"

---

### 3. 舰队 Dashboard — 三种架构，四个场景 (4 分钟)

**导航至**: `http://localhost:3000/dashboard`

**动作**: 指向四列布局（AGV-01, AGV-02, AGV-03, Agent Pipeline）。

**讲稿**：

> "现在放大到舰队级别。舰队 dashboard 同时运行三台 AGV，每台代表不同的控制架构：
>
> - **最左边 AGV-01**：纯云端。无边缘回退。
> - **中间 AGV-02**：云 + 边缘混合。边缘守护者可以接管。
> - **最右边 AGV-03**：云端，LLM 计算延迟。Token Breakdown 抽屉实时控制它的云端延迟。
>
> 最右侧是 Agent Pipeline——显示当前最有看头的 AGV 的决策链。"

---

#### 3.1 Normal Ops（正常运营）(30s)

**动作**: 确保选中 "Normal Ops"。点击 "▶ Play"。

**讲稿**：

> "第一个场景：正常运营。三种架构都应该存活。
>
> 看 AGV-01——800ms 纯云端。在边界检测到并及时刹车。
> AGV-02 20ms 边缘——近乎实时检测，轻松停下。
> AGV-03 计算延迟 2100ms——慢一些，但仍然及时检测。
>
> **全部安全。** 正常延迟下，每种架构都能工作。"

**让三台都跑完（safe_stop）。指向绿色的 SAFE 徽章。**

---

#### 3.2 Cloud Spike（云网络尖峰）(1 分钟)

**动作**: 点击 "Cloud Spike" 场景。点击 "▶ Play"。

**讲稿**：

> "第二个场景：云网络尖峰。纯云端 AGV 的网络延迟飙升到 5000ms。
>
> AGV-01——5000ms 纯云端。每 5 秒一次 step。1m/s 速度下，每次检测之间滑行 5 米。它在 8 米处进入 clearance 区，但下一次 step 在 10 米处触发——**直接撞墙。** "

**让 AGV-01 撞墙。AGV-02 安全停下。AGV-03 也安全停下。**

> "AGV-02 有 20ms 边缘接管。边缘检测比云快 250 倍。它检测到边界，安全停止。**云太慢了，但边缘救了它。**
>
> AGV-03 用计算延迟——LLM 参数没变，仍然是 2100ms，安全停下。
>
> 寓意：**网络尖峰杀死纯云端。Edge Guardian 拯救混合架构。** "

---

#### 3.3 Verbose LLM（啰嗦的 LLM）(1 分钟)

**动作**: 点击 "Verbose LLM" 场景。点击 "▶ Play"。

**讲稿**：

> "第三个场景：啰嗦的 LLM。网络很好——只有 200ms。但 LLM 生成了 2500 个 token 的输出，每秒 150 token。这就是 16.7 秒的计算时间。
>
> AGV-01 200ms 云延迟——快，安全停下。
> AGV-02 200ms 云 + 20ms 边缘——也安全。
>
> 但 AGV-03——啰嗦的 LLM——每一步需要 16.7 秒。AGV 在 10 秒时就到了墙。它在墙边又等了 6.7 秒等待下一次云端响应。**这段时间徽章显示 'OVERDUE'。** "

**让 AGV-03 撞墙。指向 "OVERDUE" 徽章，然后指向红色的 "CRASHED" 徽章。**

> "step 最终在 16.7 秒触发时，AGV 已经在墙边停了 6 秒。**状态：CRASHED。**
>
> Agent Pipeline 中的 Cloud Commander 显示红色：**'Returned too late'**——不再是 'Generating...'，因为它确实返回了响应，但 AGV 早就死了。
>
> 寓意：**网络可以完美，但 '话多' 的 LLM 仍然能杀死机器人。这证明了定理中的 Token 项：(Prompt + Completion) / Token_Rate。** "

---

#### 3.4 Token Breakdown — 实时控制 (1 分钟)

**动作**: 点击 "Token Breakdown ▼" 展开抽屉。确保仿真已停止或重置。

**讲稿**：

> "Token Breakdown 抽屉不只是信息展示——它**实时控制 AGV-03 的延迟。**
>
> 我们再跑一次 Verbose LLM 场景。AGV-03 会撞墙。但看我调整滑块后会发生什么。"

**点击 "▶ Play" 运行 Verbose LLM。AGV-03 正在跑时，把 "Token Rate" 滑块拖到 500 tok/s。**

> "在运行中，我调高 token 生成速率。云端延迟从 16.7 秒降到……"
>
> *(指向计算后的延迟数值)*
>
> "……大约 6 秒。因为 nextS 每帧重新计算，下一个 step 会更早触发。AGV 可能仍然会撞，但撞得更晚——或者如果我把滑块推得足够远，它甚至能安全停下。"

**暂停并重置。尝试不同的组合：**

> "或者，我可以选 Normal Ops 场景，然后**故意让 AGV-03 延迟变差来撞墙**。把 Completion tokens 提到 4000，Token Rate 降到 50。原本安全的 AGV-03 现在会撞。**这让观众可以实时找到安全与撞墙之间的精确边界——定理的 Vmax 极限。** "

---

#### 3.5 Edge Disabled（边缘禁用）(30s)

**动作**: 点击 "Edge Disabled" 场景。点击 "▶ Play"。

**讲稿**：

> "最后一个场景：边缘禁用。AGV-02 没有边缘回退——两台云端 AGV 都是 5000ms，AGV-03 用啰嗦 LLM 16.7 秒。
>
> 三台全撞。没有一种架构能存活。
>
> 寓意：**没有边缘回退，每台 AGV 都会失败。边缘守护者不是可选项——它是保证安全的必要条件。** "

---

### 4. 真实版 Dashboard — 真实基础设施（可选，1 分钟）

**导航至**: `http://localhost:3000/dashboard/live`

**前置条件**: Azure Functions (cloud-orchestrator) 在本地运行。

**动作**: 指向实时遥测数据。

**讲稿**：

> "如果 Azure 后端在运行，我们可以切换到真实版 dashboard。这里显示的延迟不是仿真的——是真实调用 Azure OpenAI 端点测得的。
>
> 显示的延迟是实测值——网络 RTT 加实际 GPT-4o-mini 生成时间。三 Agent 流水线（意图路由 → 安全守卫 → 动作编译）运行在 VNet 内的真实 Azure Functions 上。
>
> 这用真实基础设施验证了定理，而不仅仅是仿真。"

---

### 5. 结束语 (30s)

**讲稿**：

> "总结一下：
>
> 1. **运动学-Token 定理**从数学上证明了云端 LLM 延迟——无论是网络延迟还是 token 生成延迟——对实时 AGV 安全来说都太慢。
> 2. **舰队仿真**直观地展示了这一点：三种架构、四个场景、一个明确的结论。
> 3. **边缘回退不是可选项。** 当云延迟飙升或 LLM 耗时过长时，它是保证安全的唯一方式。
>
> 谢谢。欢迎提问。"

---

## Quick Reference Card / 快速参考卡

### Page flow

```
/dashboard (opening) → /kinematic (theorem) → /kinematic/compare (proof) → /dashboard (fleet × 4 scenarios)
```

### Scenario outcomes (quick lookup)

| Scenario | AGV-01 | AGV-02 | AGV-03 |
|---|---|---|---|
| Normal Ops | SAFE (800ms) | SAFE (20ms edge) | SAFE (2100ms computed) |
| Cloud Spike | **CRASHED** (5000ms) | SAFE (edge override) | SAFE (2100ms) |
| Verbose LLM | SAFE (200ms) | SAFE (200ms+edge) | **CRASHED** (16767ms) |
| Edge Disabled | **CRASHED** (5000ms) | **CRASHED** (5000ms, no edge) | **CRASHED** (16767ms) |

### Key phrases

- "Slides blindly between steps"
- "Three terms in the denominator: network, token generation, brake"
- "Same conditions, different latency → different outcome"
- "The edge guardian is not optional"
- "This proves the Token term: talkative LLM kills the robot"

### Keyboard shortcuts (if applicable)
- Play/Pause: click button
- Reset: click button
- Scenario select: click card
- Token drawer: click "Token Breakdown ▼"
