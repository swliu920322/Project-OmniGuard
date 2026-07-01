# Architectural Decision Record (ADR 023)
# 架构决策记录 (ADR 023)

## Title / 标题

ADR 023: Dark Warehouse Survival State Machine — Industrial-Grade Simulation Engine
ADR 023: 无人暗仓生存状态机——工业级模拟引擎

## Status / 状态

**Approved / 已批准**

## Context / 背景

The capstone "simple obstacle avoidance" scenario was too superficial for enterprise demonstration. It lacked physical consequence pressure — latency was an academic number, not a life-or-death metric. To prove cloud-latency dangers in embodied AI, the simulation needed real physical penalties (collision damage, battery drain, deadlock).

Capstone 的"简单避障"场景对企业级演示来说过于肤浅。它缺乏物理后果压力——延迟只是一个学术数字，而不是生死攸关的指标。为了在具身 AI 中证明云延迟的危险性，模拟需要真实的物理惩罚（碰撞损伤、电池消耗、死锁）。

## Decision Drivers / 决策驱动因素

* Force observable causality between cloud latency and hardware damage.
* Create interview-ready talking points around high-concurrency state machines.
* Reuse existing MQTT/Cosmos DB infrastructure without new services.

* 在云延迟和硬件损坏之间建立可观察的因果关系。
* 围绕高并发状态机制造面试级别的讨论点。
* 重用现有的 MQTT/Cosmos DB 基础设施，不引入新服务。

## Decision / 决策

Upgrade the simulation engine to a survival state machine with three tracked variables: Velocity (m/s), Hardware Health (HP, 0–100), Battery (BAT, 0–100%). Introduce four stochastic event classes (Dynamic Obstacle, Static Congestion, Motor Overheating, Network Jitter) each with distinct penalty formulas. The edge simulator calculates physics locally every second using the latency-to-sliding-distance formula `Sliding Distance = Velocity × Cloud_Latency`.

将模拟引擎升级为生存状态机，跟踪三个变量：速度（m/s）、硬件生命值（HP, 0–100）、电池（BAT, 0–100%）。引入四类随机事件（动态障碍物、静态拥堵、电机过热、网络抖动），每类具有不同的惩罚公式。边缘模拟器每秒使用延迟-滑行距离公式 `滑行距离 = 速度 × 云延迟` 在本地计算物理状态。

## Consequences / 后果

* **Positive / 正向**: Latency becomes a tangible, visually demonstrable threat (collision = HP drop = deadlock).
* **Positive / 正向**: Validates edge-fallback necessity under real physics constraints.
* **Negative / 负向**: Adds state complexity — Cosmos DB must persist `hardware_state` alongside telemetry.

* **正向**: 延迟变成有形的、可视化可证明的威胁（碰撞 = HP 下降 = 死锁）。
* **正向**: 在真实物理约束下验证了边缘回退的必要性。
* **负向**: 增加了状态复杂性——Cosmos DB 必须与遥测数据一起持久化 `hardware_state`。
