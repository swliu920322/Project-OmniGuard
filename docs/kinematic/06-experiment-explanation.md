# What Is This Experiment Really Verifying?

> This document is for first-time visitors to the `/kinematic` page who are not familiar with robots or AI.

## One-sentence conclusion

**Cloud AI can "think deeply", but the robot's body cannot wait.**

This page uses a small car animation to turn this statement into something you can verify with your own hands.

---

## 1. First, look at the scenario

Imagine an automated guided vehicle (AGV) in a warehouse, with a wall suddenly appearing ahead. It must decide: should I brake?

This decision can be made in two places:

### 1.1 Cloud Brain (Cloud-Only)

The vehicle sends camera footage and laser ranging data to a remote data center.
The data center has a very powerful AI (like GPT-4).
The AI reads the data, thinks for a few seconds, and writes back an instruction: "brake".
The vehicle receives the instruction and executes the brake.

**Problem**: From "sending data" to "receiving instruction", there is a time gap. The vehicle will not stop during this time; it will continue moving forward.

### 1.2 Edge Reflex (Edge Fallback)

The vehicle has an ultrasonic sensor on its bumper.
When the sensor detects that distance is less than the safe value, it immediately notifies the local controller to brake.
The entire process does not need to go to the cloud, nor does it wait for AI text generation.

**Advantage**: Extremely fast, typically only a few to a dozen milliseconds.

---

## 2. What does the formula on the page mean?

### Cloud-Only Formula

```
V_max = D_clearance / ( L_network_rtt + (T_prompt + T_completion) / S_token_rate )
```

| Symbol | Plain English |
|--------|---------------|
| `V_max` | The maximum safe speed the vehicle can travel at under the current configuration |
| `D_clearance` | How far the vehicle is from the wall |
| `L_network_rtt` | How long it takes for data to go to the cloud and return |
| `T_prompt` | How long the sensor description sent to the AI is |
| `T_completion` | How long the AI's response instruction is |
| `S_token_rate` | How many words (tokens) the AI can write per second |

**The denominator is the total time for the AI to receive data, make a decision, and send the decision back.**

### Edge Fallback Formula

```
V_max = D_clearance / T_edge_reaction
```

| Symbol | Plain English |
|--------|---------------|
| `T_edge_reaction` | Time from when the local sensor detects danger to when the vehicle starts braking |

This formula is much simpler because the edge has no AI inference and no network round-trip.

---

## 3. How to understand the parameter panel?

The parameter panel on the left side of the page has two layers:

### 3.1 Physical Parameters (Always visible)

- **AGV Current Speed**: The vehicle's current speed.
  - Higher speed means longer braking distance.
  - Exceeding `V_max` is a dangerous state.

- **Safety Clearance**: The distance between the vehicle and the wall.
  - Shorter distance means lower allowed safe speed.
  - Like driving too close to the car ahead; higher risk of rear-end collision.

### 3.2 Parameters in the Cloud tab

Only when switching to Cloud-Only mode do these parameters truly affect the result:

- **Network RTT**: Network latency.
  - Factory Wi-Fi congestion, cross-ocean data centers, poor signal — all increase this number.

- **LLM Token Rate**: How fast the AI generates text.
  - Larger models are usually slower; smaller models or specialized chips may be faster.

- **Prompt Tokens**: The length of input sent to the AI.
  - For example: "Front distance 2 meters, speed 1.5 m/s, battery 80%, temperature 45°C..." — the longer it is, the longer the AI takes to read.

- **Completion Tokens**: The length of the AI's response.
  - For example: "Execute brake, force 80%" is longer than "brake", and takes longer to generate.

### 3.3 Parameters in the Edge tab

- **Edge Reaction Time**: The reaction time of the local sensor + controller.
  - Default is 15ms, meaning after ultrasonic ranging, the controller brakes the vehicle within 15 milliseconds.
  - You can increase it (simulating slower local equipment) or decrease it (simulating faster hardware).

---

## 4. What do the red/green indicators on the formula card mean?

The formula card has a badge at the bottom:

- **Green Safe**: `V_agv ≤ V_max`
  - The vehicle's current speed is below the safety limit.
  - Even running in the current mode, it can stop before hitting the wall.

- **Red Unsafe**: `V_agv > V_max`
  - The vehicle's current speed is above the safety limit.
  - In the current control mode, the vehicle will hit the wall before the brake takes effect.

### Example

Suppose you see:

```
Unsafe: V_agv (2.8 m/s) > V_max (0.16 m/s)
```

This means:

> The vehicle is currently running at 2.8 meters per second, but according to the current cloud latency and AI speed, it can only safely travel at a maximum of 0.16 meters per second. If it maintains 2.8 m/s, it will definitely hit the wall before the "brake" instruction arrives.

---

## 5. How to watch the animation?

### Cloud-Only Mode

1. Stay in Cloud-Only mode.
2. Increase the speed a bit (e.g., above 1.5 m/s).
3. Increase Prompt Tokens / Completion Tokens a bit, or decrease Token Rate.
4. Click **Run Simulation**.
5. Observe:
   - The vehicle will travel all the way until it hits the wall.
   - The formula card turns red.
   - The log shows `[THEOREM VIOLATION]`.

**This shows**: It is not that the AI is not smart enough, but that the AI's "answer" came too late.

### Edge Fallback Mode

1. Switch to Edge Fallback mode.
2. Keep the speed unchanged.
3. Click **Run Simulation**.
4. Observe:
   - The vehicle only travels a short distance before stopping.
   - The formula card turns green (as long as speed does not exceed Edge's `V_max`).
   - The log shows `[EDGE BYPASS]`.

**This shows**: Local sensors react extremely fast and can brake the vehicle before danger occurs.

---

## 6. How should the two modes be compared?

| Comparison Item | Cloud-Only | Edge Fallback |
|----------------|------------|---------------|
| Decision Location | Remote data center | Vehicle local |
| Latency Source | Network RTT + AI token generation | Sensor + controller hardware reaction |
| Typical Latency | Hundreds of ms to tens of seconds | Milliseconds to tens of ms |
| Intelligence Level | Can make complex decisions | Can only make simple judgments (e.g., distance < threshold → brake) |
| Suitable Scenarios | Non-urgent planning tasks | Urgent safety control |
| Experimental Result | Prone to crashes | Can stop safely |

---

## 7. Common misconceptions

### Misconception 1: "Just make the AI faster, right?"

No. Even the fastest AI has network latency. If the vehicle is only 20cm from the wall and moving fast, even if the AI responds in 0.1 seconds, it is too late.

### Misconception 2: "Edge mode doesn't use AI, isn't it too dumb?"

Not dumb, but a division of labor. Complex decisions (like "which route to take to bypass obstacles") can be left to cloud AI; but life-or-death decisions like "we're about to crash, must brake immediately" must be made locally.

### Misconception 3: "This experiment is only about speed?"

No. It is related to four factors simultaneously:

1. Vehicle speed (faster is more dangerous)
2. Distance from wall (closer is more dangerous)
3. Control loop latency (longer is more dangerous)
4. Control mode (Cloud or Edge)

---

## 8. One-sentence summary

> **Cloud AI is responsible for "how to walk better", edge reflex is responsible for "don't crash".**

> This sandbox proves: only cloud without edge, the robot crashes; only edge without cloud, the robot survives, but may not be smart enough in routing. Both are indispensable.

---

# 这个实验到底在验证什么？

> 本文面向第一次打开 `/kinematic` 页面、对机器人或 AI 不太熟悉的人。

## 一句话结论

**云端 AI 可以"想得很深"，但身体（机器人）等不起。**

这个页面用一辆小车的动画，把这句话变成你可以亲手验证的事实。

---

## 1. 先看场景

想象仓库里有一辆自动搬运车（AGV），它前方突然出现一堵墙。它必须决定：要不要刹车？

这个决定可以由两个地方来做：

### 1.1 云端大脑（Cloud-Only）

小车把摄像头拍到的画面、激光测距数据，打包发到远程数据中心。
数据中心里有一个很强大的 AI（比如 GPT-4）。
AI 读完数据，思考几秒，写回一条指令："刹车"。
小车收到指令，执行刹车。

**问题**：从"发数据"到"收到指令"，中间有时间。小车在这段时间里不会停下，它会继续往前冲。

### 1.2 边缘神经反射（Edge Fallback）

小车保险杠上装了一个超声波传感器。
传感器发现距离小于安全值，立刻通知本地控制器刹车。
整个过程不需要去云端，也不需要等 AI 生成文字。

**优点**：极快，通常只要几毫秒到十几毫秒。

---

## 2. 页面上的公式是什么意思？

### Cloud-Only 公式

```
V_max = D_clearance / ( L_network_rtt + (T_prompt + T_completion) / S_token_rate )
```

| 符号 | 人话 |
|------|------|
| `V_max` | 在当前配置下，小车能安全行驶的最快速度 |
| `D_clearance` | 小车离墙还有多远 |
| `L_network_rtt` | 数据去云端再回来要多久 |
| `T_prompt` | 发给 AI 的传感器描述有多长 |
| `T_completion` | AI 写回的指令有多长 |
| `S_token_rate` | AI 每秒能写多少字（token） |

**分母就是 AI 拿到数据、做出决定、把决定送回来的总时间。**

### Edge Fallback 公式

```
V_max = D_clearance / T_edge_reaction
```

| 符号 | 人话 |
|------|------|
| `T_edge_reaction` | 本地传感器发现危险到小车开始刹车的时间 |

这个公式简单得多，因为边缘没有 AI 推理，也没有网络往返。

---

## 3. 参数面板怎么理解？

页面左侧的参数面板分为两层：

### 3.1 物理参数（Always visible）

- **AGV Current Speed**：小车当前速度。
  - 速度越快，刹车距离越长。
  - 超过 `V_max` 就是危险状态。

- **Safety Clearance**：小车离墙的距离。
  - 距离越短，允许的安全速度越低。
  - 就像开车跟车太近，追尾风险越高。

### 3.2 Cloud 标签页里的参数

只有切换到 Cloud-Only 模式，这些参数才真正影响结果：

- **Network RTT**：网络延迟。
  - 工厂 Wi-Fi 拥堵、跨洋数据中心、信号不好，都会让这个数字变大。

- **LLM Token Rate**：AI 生成文字的速度。
  - 模型越大通常越慢；小模型或专用芯片可能更快。

- **Prompt Tokens**：发给 AI 的输入长度。
  - 比如："前方距离 2 米，速度 1.5 m/s，电池 80%，温度 45°C…" 越长，AI 读得越久。

- **Completion Tokens**：AI 回复的长度。
  - 比如："执行刹车，力度 80%" 比 "刹车" 长，生成时间也更长。

### 3.3 Edge 标签页里的参数

- **Edge Reaction Time**：本地传感器+控制器的反应时间。
  - 默认 15 ms，表示超声波测距后，控制器在 15 毫秒内让小车开始刹车。
  - 你可以把它调大（模拟更慢的本地设备）或调小（模拟更快的硬件）。

---

## 4. 公式卡片上的红绿提示是什么意思？

公式卡片下方有一个徽章：

- **绿色 Safe**：`V_agv ≤ V_max`
  - 小车当前速度低于安全上限。
  - 即使按当前模式跑，也能在撞墙前停下。

- **红色 Unsafe**：`V_agv > V_max`
  - 小车当前速度高于安全上限。
  - 按当前控制模式，小车会在刹车生效前撞到墙。

### 举个例子

假设你看到：

```
Unsafe: V_agv (2.8 m/s) > V_max (0.16 m/s)
```

意思是：

> 小车现在每秒跑 2.8 米，但按当前云端延迟和 AI 速度，它每秒最多只能安全跑 0.16 米。如果保持 2.8 米/秒，它一定会在"刹车"指令回来之前撞墙。

---

## 5. 怎么观看动画？

### Cloud-Only 模式

1. 保持 Cloud-Only 模式。
2. 把速度调高一点（比如 1.5 m/s 以上）。
3. 把 Prompt Tokens / Completion Tokens 调大一点，或把 Token Rate 调低。
4. 点击 **Run Simulation**。
5. 观察：
   - 小车会一路前进，直到撞上墙。
   - 公式卡片变红。
   - 日志出现 `[THEOREM VIOLATION]`。

**这说明**：不是 AI 不够聪明，而是 AI 的"回答"来得太晚。

### Edge Fallback 模式

1. 切换到 Edge Fallback 模式。
2. 保持速度不变。
3. 点击 **Run Simulation**。
4. 观察：
   - 小车只走很短一段距离就停下。
   - 公式卡片变绿（只要速度不超过 Edge 的 `V_max`）。
   - 日志出现 `[EDGE BYPASS]`。

**这说明**：本地传感器反应极快，能在危险发生前刹住车。

---

## 6. 两个模式应该怎么对比？

| 对比项 | Cloud-Only | Edge Fallback |
|--------|-----------|---------------|
| 决策位置 | 远程数据中心 | 小车本地 |
| 延迟来源 | 网络 RTT + AI token 生成 | 传感器+控制器硬件反应 |
| 典型延迟 | 几百毫秒到十几秒 | 几毫秒到几十毫秒 |
| 智能程度 | 可以做复杂决策 | 只能做简单判断（如距离<阈值→刹车） |
| 适合场景 | 不紧急的规划任务 | 紧急安全控制 |
| 实验结果 | 容易撞墙 | 能安全停下 |

---

## 7. 常见误解

### 误解 1："把 AI 做得更快不就行了？"

不行。再快的 AI 也有网络延迟。如果小车离墙只有 20 厘米、速度又快，即使 AI 0.1 秒回答，也来不及。

### 误解 2："Edge 模式不用 AI，是不是太笨？"

不是笨，而是分工。复杂决策（比如"绕开障碍物走哪条路"）可以交给云端 AI；但"马上就要撞了，必须立刻刹车"这种生死决策，必须本地做。

### 误解 3："这个实验只和速度有关？"

不是。它同时和四个因素有关：

1. 小车速度（越快越危险）
2. 离墙距离（越近越危险）
3. 控制回路延迟（越长越危险）
4. 控制模式（Cloud 还是 Edge）

---

## 8. 一句话总结

> **云端 AI 负责"怎么走得更好"，边缘反射负责"别撞死"。**

> 这个沙箱证明：只有云端没有边缘，机器人会撞墙；只有边缘没有云端，机器人活下来了，但可能绕路绕得不够聪明。两者缺一不可。
