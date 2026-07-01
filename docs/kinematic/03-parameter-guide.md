# Parameter Guide

The left side of the `/kinematic` page contains six sliders. Here is what each one does, in plain language.

## 1. AGV Current Speed

- **What it is**: How fast the robot is moving.
- **Range**: 0.1 to 3.0 meters per second.
- **Effect**: Higher speed means a longer braking distance. If speed exceeds `V_max`, the robot is unsafe.
- **Real-world analogy**: Driving faster on a highway means you need more distance to stop.

## 2. Network RTT

- **What it is**: Round-trip time — how long a signal takes to go from the robot to the cloud and back.
- **Range**: 20 to 2000 milliseconds.
- **Effect**: Larger RTT increases total cloud delay and lowers `V_max`.
- **Real-world analogy**: The lag you feel during a bad video call.

## 3. LLM Token Rate

- **What it is**: How many tokens the AI model can generate per second.
- **Range**: 10 to 150 tokens per second.
- **Effect**: Faster models produce answers quicker, raising `V_max`. Slower models make the situation more dangerous.
- **Real-world analogy**: A fast speaker vs. a slow speaker explaining the same thing.

## 4. Prompt Tokens

- **What it is**: The length of the instructions and sensor data sent to the AI.
- **Range**: 50 to 2000 tokens.
- **Effect**: Longer prompts take longer to process, lowering `V_max`.
- **Real-world analogy**: Reading a long report before you can make a decision.

## 5. Completion Tokens

- **What it is**: The length of the AI's answer.
- **Range**: 10 to 500 tokens.
- **Effect**: Longer answers take longer to generate, lowering `V_max`.
- **Real-world analogy**: Asking someone to explain their decision in a single word vs. a full essay.

## 6. Safety Clearance

- **What it is**: The distance between the robot and the obstacle.
- **Range**: 0.1 to 5.0 meters.
- **Effect**: More space gives the robot more time to stop, raising `V_max`.
- **Real-world analogy**: Following another car at 50 meters vs. 5 meters.

## Quick rules of thumb

- If you want to see a crash: increase speed, increase RTT, decrease token rate, or shorten clearance.
- If you want to see a safe stop: decrease speed, increase clearance, or switch to Edge Fallback mode.
- Prompt and completion length matter most when the token rate is low.

---

# 参数指南

`/kinematic` 页面左侧有六个滑块。下面是每个滑块的通俗解释。

## 1. AGV Current Speed（机器人当前速度）

- **含义**：机器人移动的速度。
- **范围**：0.1 到 3.0 米/秒。
- **影响**：速度越快，刹车距离越长。如果速度超过 `V_max`，机器人就不安全。
- **生活类比**：高速公路上开得越快，停车距离越长。

## 2. Network RTT（网络往返时间）

- **含义**：信号从机器人到云端再回来的时间。
- **范围**：20 到 2000 毫秒。
- **影响**：RTT 越大，云端总延迟越大，`V_max` 越低。
- **生活类比**：视频通话卡顿时感受到的延迟。

## 3. LLM Token Rate（LLM token 速率）

- **含义**：AI 模型每秒能生成多少个 token。
- **范围**：10 到 150 tokens/秒。
- **影响**：模型越快，答案越早出来，`V_max` 越高；模型越慢，越危险。
- **生活类比**：说话快的人和说话慢的人解释同一件事。

## 4. Prompt Tokens（输入 token 数）

- **含义**：发给 AI 的指令和传感器数据长度。
- **范围**：50 到 2000 tokens。
- **影响**：prompt 越长，处理时间越长，`V_max` 越低。
- **生活类比**：做决定前要先读完一份长报告。

## 5. Completion Tokens（输出 token 数）

- **含义**：AI 回复的长度。
- **范围**：10 到 500 tokens。
- **影响**：回复越长，生成时间越长，`V_max` 越低。
- **生活类比**：让别人用一个词解释决定，还是写一篇小作文解释。

## 6. Safety Clearance（安全净空距离）

- **含义**：机器人与障碍物之间的距离。
- **范围**：0.1 到 5.0 米。
- **影响**：空间越大，机器人停车时间越充裕，`V_max` 越高。
- **生活类比**：跟车距离是 50 米还是 5 米。

## 快速经验法则

- 想看撞墙：提高速度、提高 RTT、降低 token 速率、缩短净空距离。
- 想看安全停下：降低速度、增加净空距离，或切换到 Edge Fallback 模式。
- Prompt 和 completion 长度在 token 速率低的时候影响最大。
