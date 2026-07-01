# Cloud-Only vs. Edge Fallback

The `/kinematic` page has a toggle at the top: **Cloud-Only** and **Edge Fallback**. These represent two very different philosophies for controlling robots.

## Cloud-Only mode

### How it works

All thinking happens in a remote data center.

1. The robot sends sensor data to the cloud.
2. A large AI model reasons about the situation.
3. The model returns a command.
4. The robot executes the command.

### Strengths

- The AI can be extremely powerful.
- Easy to update the model centrally.
- Can use the latest large models.

### Weaknesses

- **Delay is unavoidable**: network RTT + token generation time.
- For fast robots or close obstacles, the answer arrives too late.
- The page shows this as a **red collision**.

### When it is safe

- The robot is moving slowly.
- The obstacle is far away.
- The model is fast and the network is excellent.

## Edge Fallback mode

### How it works

A simple, local sensor handles emergencies directly.

1. The ultrasonic or LiDAR sensor continuously measures distance.
2. If the distance drops below a safe threshold, the robot brakes immediately.
3. No cloud call is needed for the emergency stop.

### Strengths

- **Extremely fast**: the demo uses 15 ms as the reaction time.
- Works even if the network is down.
- Prevents fatal crashes.

### Weaknesses

- The local sensor is "dumber" than a cloud AI.
- It only knows "obstacle close → stop", not complex strategy.

### When it wins

- High-speed robots.
- Close obstacles.
- Any situation where milliseconds matter.

## The lesson

Cloud AI and edge sensors are not competitors. They are **layers**:

- **Cloud AI** handles high-level planning when time allows.
- **Edge fallback** is the safety net that takes over when physics demands it.

The sandbox proves that you need both. A system that relies only on the cloud is elegant but dangerous.

---

# Cloud-Only 与 Edge Fallback 对比

`/kinematic` 页面顶部有一个切换开关：**Cloud-Only** 和 **Edge Fallback**。它们代表了两种完全不同的机器人控制哲学。

## Cloud-Only 模式

### 工作原理

所有思考都在远程数据中心完成。

1. 机器人把传感器数据发到云端。
2. 大模型分析当前情况。
3. 模型返回一个指令。
4. 机器人执行指令。

### 优点

- AI 可以非常强大。
- 模型可以集中更新。
- 可以使用最新的大模型。

### 缺点

- **延迟不可避免**：网络往返 + token 生成时间。
- 对于快速机器人或近距离障碍物，答案回来得太晚。
- 页面上显示为**红色撞击**。

### 什么时候安全

- 机器人移动很慢。
- 障碍物很远。
- 模型很快、网络极好。

## Edge Fallback 模式

### 工作原理

简单、本地的传感器直接处理紧急情况。

1. 超声波或激光雷达传感器持续测量距离。
2. 一旦距离低于安全阈值，机器人立刻刹车。
3. 紧急情况不需要调用云端。

### 优点

- **极快**：演示中反应时间固定为 15 毫秒。
- 即使网络中断也能工作。
- 防止致命撞击。

### 缺点

- 本地传感器比云端 AI "笨"。
- 它只知道"障碍物近 → 停下"，不能做复杂策略。

### 什么时候胜出

- 高速机器人。
- 近距离障碍物。
- 任何毫秒必争的场景。

## 核心教训

云端 AI 和边缘传感器不是竞争对手，而是**分层协作**：

- **云端 AI** 在时间允许时做高层规划。
- **Edge fallback** 是安全网，在物理规律要求时必须接管。

这个沙箱证明：只依赖云端的系统看起来优雅，但很危险。两者都需要。
