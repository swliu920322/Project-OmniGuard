> ⚠️ This document is written for presenters. Read it before showing `/kinematic` to an audience.

# How to Demonstrate the Kinematic-Token Theorem Sandbox

## Before you start

1. Open `/kinematic` in a browser.
2. Make sure the default parameters are loaded. If not, click **Reset**.
3. Decide whether you want to show a crash first or a safe stop first. Both work well; showing the crash first creates drama, then the edge fallback provides relief.

## Demo script A: the cloud-only crash

### Setup

Use these parameters:

- AGV Current Speed: **2.0 m/s**
- Network RTT: **800 ms**
- LLM Token Rate: **50 tokens/s**
- Prompt Tokens: **500**
- Completion Tokens: **100**
- Safety Clearance: **2.0 m**
- Mode: **Cloud-Only**

### What to say

> "This is a warehouse robot moving at 2 meters per second. It is 2 meters from a wall. We are asking a cloud AI to decide whether to brake. The AI is smart, but it needs to read 500 tokens of sensor data and write 100 tokens of instructions. At 50 tokens per second, that alone takes 12 seconds. Add 0.8 seconds of network delay, and the total response time is about 12.8 seconds."

### Action

Click **Run Simulation**.

### Expected result

- The robot moves across the track.
- The **Formula Card** turns red: `V_agv > V_max`.
- The robot hits the wall.
- A red **Collision** overlay appears.
- The Audit Log records a `[THEOREM VIOLATION]` entry.

### Closing line

> "The robot crashed not because the AI was wrong, but because physics ran out of time."

## Demo script B: the edge fallback save

### Setup

Keep the same parameters, but switch the mode to **Edge Fallback**.

### What to say

> "Now we add a local ultrasonic sensor. It is not as smart as the cloud AI, but it can react in 15 milliseconds. The same robot, the same speed, the same distance — but now the braking command comes from the edge."

### Action

Click **Run Simulation**.

### Expected result

- The robot stops close to its starting position.
- A cyan **Edge Safe Stop** overlay appears.
- The Audit Log records an `[EDGE BYPASS]` entry.

### Closing line

> "The cloud brain is still useful for planning, but the edge sensor is what keeps the robot alive."

## Demo script C: exploring the sliders

After the two main stories, invite the audience to suggest changes:

1. "What happens if we make the prompt shorter?" → Reduce Prompt Tokens to 100.
2. "What happens if the model is faster?" → Increase LLM Token Rate to 150.
3. "What happens if the robot is closer to the wall?" → Reduce Safety Clearance to 0.5 m.

Each change updates the formula card immediately, so the audience sees cause and effect in real time.

## Demo script D: the network jitter scenario

### Setup

- Mode: **Cloud-Only**
- Network RTT: **2000 ms**
- Everything else: default

### What to say

> "In a congested factory Wi-Fi, the network round-trip can spike to 2 seconds. Even with a fast model and short prompts, the robot cannot stop in time if it is moving quickly."

### Action

Click **Run Simulation**.

### Expected result

The robot crashes almost immediately because the wall is only 2 meters away and the delay is huge.

## Tips for a strong presentation

- **Use the full screen**: the page looks best on a large monitor.
- **Slow down**: let people read the formula card before starting the animation.
- **Point at the numbers**: show how `V_max` drops when RTT or token count grows.
- **Keep the log visible**: it records the story of each run.
- **Reset between demos**: click **Reset** so each scenario starts clean.

## Common questions and answers

**Q: Why not just make the AI faster?**
A: Even the fastest model still has network delay. And real-world obstacles can be very close.

**Q: Can the cloud AI ever be fast enough?**
A: Only if the robot is far away or moving slowly. The theorem sets a hard physical limit.

**Q: Is 15 ms realistic for edge sensors?**
A: Yes. Ultrasonic and LiDAR sensors commonly react in milliseconds, far faster than any cloud round-trip.

---

> ⚠️ 本文档面向演示者。向观众展示 `/kinematic` 之前请先阅读。

# 如何演示“运动学-Token 定理”沙箱

## 开始前

1. 在浏览器中打开 `/kinematic`。
2. 确认已加载默认参数。如果没有，点击 **Reset**。
3. 决定先演示撞墙还是先演示安全停下。两种开场都很好：先撞墙更有戏剧性，然后 edge fallback 带来转折和释然。

## 演示脚本 A：纯云端撞墙

### 参数设置

- AGV Current Speed：**2.0 m/s**
- Network RTT：**800 ms**
- LLM Token Rate：**50 tokens/s**
- Prompt Tokens：**500**
- Completion Tokens：**100**
- Safety Clearance：**2.0 m**
- Mode：**Cloud-Only**

### 讲解词

> “这是一台仓库机器人，以每秒 2 米的速度前进，离墙只有 2 米。我们要让云端 AI 来决定是否刹车。AI 很聪明，但它需要先读 500 个 token 的传感器数据，再写 100 个 token 的指令。以每秒 50 个 token 的速度，光生成就需要 12 秒。再加上 0.8 秒的网络延迟，总响应时间约为 12.8 秒。”

### 操作

点击 **Run Simulation**。

### 预期结果

- 机器人穿过轨道前进。
- **公式卡片**变红：`V_agv > V_max`。
- 机器人撞上墙壁。
- 出现红色 **Collision** 覆盖层。
- 审计日志记录 `[THEOREM VIOLATION]` 条目。

### 收尾句

> “机器人撞墙不是因为 AI 错了，而是因为物理世界没有给 AI 足够的时间。”

## 演示脚本 B：边缘 fallback 救场

### 参数设置

保持刚才的参数不变，只把模式切换为 **Edge Fallback**。

### 讲解词

> “现在我们加入一个本地超声波传感器。它不如云端 AI 聪明，但它能在 15 毫秒内做出反应。同一台机器人、同样的速度、同样的距离——但刹车指令现在来自边缘。”

### 操作

点击 **Run Simulation**。

### 预期结果

- 机器人在离起点很近的位置停下。
- 出现青色 **Edge Safe Stop** 覆盖层。
- 审计日志记录 `[EDGE BYPASS]` 条目。

### 收尾句

> “云端大脑仍然适合做规划，但边缘传感器才是让机器人活下来的关键。”

## 演示脚本 C：玩转滑块

讲完两个主故事后，可以邀请观众提建议：

1. “如果 prompt 更短会怎样？” → 把 Prompt Tokens 调到 100。
2. “如果模型更快会怎样？” → 把 LLM Token Rate 调到 150。
3. “如果机器人离墙更近会怎样？” → 把 Safety Clearance 调到 0.5 m。

每次改动都会立即更新公式卡片，观众可以实时看到因果关系。

## 演示脚本 D：网络抖动场景

### 参数设置

- Mode：**Cloud-Only**
- Network RTT：**2000 ms**
- 其他：保持默认

### 讲解词

> “在拥挤的工厂 Wi-Fi 里，网络往返时间可能飙升到 2 秒。即使模型很快、prompt 很短，只要机器人移动稍快，它也无法及时停下。”

### 操作

点击 **Run Simulation**。

### 预期结果

由于墙只有 2 米远而延迟巨大，机器人几乎立刻撞墙。

## 演示技巧

- **全屏展示**：页面在大显示器上效果最好。
- **放慢节奏**：开启动画前，让观众先读公式卡片。
- **指着数字讲**：展示当 RTT 或 token 数增加时，`V_max` 如何下降。
- **保持日志可见**：日志记录了每次运行的故事。
- **每次演示前重置**：点击 **Reset**，让每个场景都干净开始。

## 常见问题与回答

**Q：为什么不能把 AI 做得更快？**
A：即使最快的模型也有网络延迟。而且真实世界的障碍物可能非常近。

**Q：云端 AI 有没有可能快到够用？**
A：只有在机器人离障碍物很远或移动很慢时才够用。定理给出了一个硬物理上限。

**Q：15 毫秒的边缘传感器反应时间现实吗？**
A：现实。超声波和激光雷达传感器通常在毫秒级反应，比任何云端往返都快得多。
