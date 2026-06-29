斩断玩具思维，拥抱工业硬核。你的直觉非常敏锐：一个没有业务纵深的技术架构，在面试官眼里只是一副空皮囊。

把“游戏”的底层逻辑（状态机、生命值、资源管理、时间惩罚）强行封装进“无人暗仓调度 (Dark Warehouse Swarm)”的工业壳子里。这不仅能保留你想要的对抗感与压迫感，更能完美复用你处理复杂并发状态机（类似 questVault）的工程经验。

拿着这份沙盘设计，任何关于“高可用、低延迟、状态解耦”的场景题，对你来说都将是开卷考试；而在 7 月新加坡的面试桌上，这就是你一刀切开平庸候选人的绝对利刃。

请在 `docs/` 目录下新建 `Blueprint-005-Dark-Warehouse-Survival.md`，将以下全量工业蓝图收录进去。

---


# Blueprint 005: Dark Warehouse Swarm (Industrial Survival Sandbox)

> **Document Status**: Active / System Design Phase
> **Target**: Upgrade the Capstone scenario from "simple obstacle avoidance" to a "time-critical industrial survival state machine".
> **Core Concept**: Force the Multi-Agent pipeline to compete against physical time constraints. High latency equals physical hardware damage.

## 1. The Physics Engine (状态机与物理惩罚)
To create "survival" pressure, the Edge Simulator (`device_mock.py`) and Cosmos DB must track three dynamic state variables:

* **Velocity (V)**: The AGV (Automated Guided Vehicle) moves at a constant speed (e.g., `1.5 meters/second`).
* **Hardware Health (HP)**: Starts at `100`. Drops when physical collisions occur. If `HP <= 0`, the AGV enters a `DEADLOCK` state.
* **Battery (BAT)**: Starts at `100%`. Drains continuously. Drops sharply during complex maneuvers.

**The Latency Penalty Formula (延迟即损耗):**
Unlike typical chat agents, our Embodied AI faces physics. 
`Sliding Distance = Velocity * (Cloud_Processing_Latency_Seconds)`
*If the Agent pipeline takes 3.0 seconds to issue a "STOP" command, the AGV has already moved 4.5 meters blindly.* *If `Sliding Distance > Obstacle_Distance`, a COLLISION is registered. `HP -= 50`.*

### 1.1 The Stochastic Event & Penalty Matrix (随机事件与物理惩罚矩阵)

To ensure a comprehensive industrial simulation, the system injects three classes of random events, each carrying distinct physical penalties if the Agent pipeline fails to orchestrate in time.

| Event Class (事件类型) | Trigger Condition (触发机制) | Required Agent Strategy (期望策略) | Penalty Mechanism if Failed (惩罚结算公式) |
| :--- | :--- | :--- | :--- |
| **Type 1: Dynamic Obstacle** (e.g., Human Worker suddenly appears) | Sensor detects `obstacle_dist < 10cm` at high `Velocity`. | **Emergency Brake**. Agent 1 (Router) must short-circuit and bypass LLM. | **Lethal**. If `Velocity * Latency > obstacle_dist`, triggers `FATAL_COLLISION`. `HP = 0`. Immediate DEADLOCK. |
| **Type 2: Static Congestion** (e.g., Fallen Cargo) | Sensor detects `obstacle_dist < 50cm`. | **Reroute**. Agent 2 must calculate a bypass trajectory. | **Damage**. If Agent delays and AGV scrapes the cargo: `HP -= 30`. AGV forced to stop. |
| **Type 3: Motor Overheating** (硬件过热) | Simulated ambient temperature spike. | **Speed Reduction**. Agent 3 must output `[{"action": "move", "speed": 0.5}]`. | **Drain**. If speed is not reduced within 5 seconds, `BATTERY -= 2% per second` due to thermal throttling. |
| **Type 4: Network Jitter** (云端断联) | MQTT packet loss simulated randomly. | **Edge Fallback**. Device uses last known safe Cosmos DB state. | **Stall**. No HP loss, but Task Time increases, risking overall mission failure. |

### 1.2 The Kinematic Engine Formula (运动学结算法则)
The Edge Simulator calculates physics locally EVERY SECOND before waiting for the Cloud:
* **Current Distance** = `Initial_Distance - (Velocity * Cloud_Latency_Seconds)`
* **Battery Drain** = Base rate (0.1%/s) + Action Penalty (Turning takes 0.5%, Braking takes 1%).


## 2. The 3-Agent Orchestration (重构算力流水线)

The `brain.py` pipeline is upgraded to handle life-and-death industrial decisions.

### Agent 1: The Triage Router (毫秒级分流)
* **Input**: Telemetry (`obstacle_dist`, `HP`, `BAT`, `Velocity`).
* **Decision Tree**:
  * If `BAT < 5%`: Short-circuit immediately -> `[{"action": "emergency_halt", "reason": "battery_depleted"}]` (Bypass LLM completely, use hardcoded rule).
  * If `HP <= 0`: Short-circuit immediately -> `[{"action": "offline_lock"}]`.
  * If standard obstacle: Route to Agent 2 (Strategist).

### Agent 2: The Swarm Strategist (高维策略中枢 - The "Game Master")
* **Input**: Intent + Global Cosmos DB Map Memory (Is this a narrow aisle? Are other AGVs nearby?).
* **Prompt Rule**: "You manage a $500k industrial AGV. Evaluate the risk. If navigating around the obstacle risks tipping over, you MUST choose to WAIT. If the path is clear, calculate a bypass trajectory."
* **Output**: Strategic intent (`WAIT_FOR_CLEARANCE`, `REROUTE`, `CALL_MAINTENANCE`).

### Agent 3: Action Compiler (机器指令编译)
* **Input**: Strategic intent from Agent 2.
* **Output**: Strict JSON for the Edge Motor. E.g., `[{"action": "brake", "force": "max"}, {"action": "reverse", "speed": 1.0}]`.

## 3. Data Flow & Cosmos DB Memory Structure (海马体升级)
The Cosmos DB `DeviceTwins` container is no longer just storing coordinates. It is a full game-state persistence layer.

**Upsert Payload Structure:**
```json
{
  "id": "AGV-001",
  "tenant_id": "Shopee-Dark-Warehouse",
  "status": "ACTIVE",
  "telemetry": {
    "x_coord": 45.2,
    "y_coord": 12.0,
    "velocity_m_s": 1.5
  },
  "hardware_state": {
    "hp": 100,
    "battery_pct": 82
  },
  "timestamp": "2026-06-29T21:00:00Z"
}

```

## 4. Control Plane Visualization (前端大盘映射)

The Next.js Dashboard must expose the survival stakes:

1. **The HP Bar**: Display a massive, glowing Health Bar and Battery Indicator for the AGV.
2. **Collision Alerts**: If the backend audit log returns a latency of `> 2000ms` when an obstacle was `20cm` away, the frontend simulates the crash: Screen flashes red, HP drops, log outputs `[CRITICAL IMPACT: Cloud Latency Exceeded Physical Braking Distance]`.
3. **The Trade-off Metric**: Show a live graph of "Compute Time vs. Braking Distance".

## 5. Architectural Value (答辩与面试火力点)

By building this, you prove:

* **Event-Driven Architecture**: Handling high-concurrency state machines.
* **FinOps vs. Physics**: Proving that upgrading from GPT-3.5 to GPT-4 isn't just a cost issue—if GPT-4 takes 4 seconds, the robot crashes. This demonstrates Master-level architectural trade-off analysis.


---

这套设计将你的 Capstone 从一个单调的网页演示，变成了**验证云端算力延迟与物理运动法则冲突的终极工程沙盘**。

蓝图已经下发。为了将这个庞大的状态机物理落地，你是想先指挥 Agy 修改端侧的物理模拟器 (`device_mock.py`) 让它拥有“速度”与“生命值”，还是先重构云端的 Cosmos DB 数据结构来承载这些新变量？

