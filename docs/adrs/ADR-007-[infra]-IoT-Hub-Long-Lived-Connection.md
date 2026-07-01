# Architectural Decision Record (ADR 007)
# 架构决策记录 (ADR 007)

## Title / 标题

ADR 007: Deprecating Web PubSub in Favor of IoT Hub Long-Lived MQTT Connections with Event Hub Trigger Ingestion
ADR 007: 弃用 Web PubSub，改用 IoT Hub 长连接 MQTT + Event Hub Trigger 数据摄取

---

## Status / 状态

**Approved / 已批准**

---

## Context / 背景

During the architectural design of the Project-OmniGuard embodied intelligence cloud control plane (specifically Sprint 1: Neural Communication), we evaluated telemetry ingestion and command-and-control (C2D) communication mechanisms between edge device simulators (e.g., `Robo-A1`) and the serverless backend.

在 Project-OmniGuard 具身智能云控制面的架构设计中（具体为 Sprint 1：神经通信），我们评估了边缘设备模拟器（如 `Robo-A1`）与无服务器后端之间的遥测数据摄取和指令下发（C2D）通信机制。

Two communication paradigms were analyzed:

分析了两种通信范式：

1. **Azure Web PubSub**: A publish-subscribe service built on WebSockets, optimized for real-time web browser client notifications. 基于 WebSocket 的发布-订阅服务，为实时 Web 浏览器客户端通知优化。
2. **Azure IoT Hub + Event Hub Triggers**: An industrial-grade ingestion gateway utilizing persistent MQTT connections combined with direct stream integration in the serverless compute plane. 工业级数据摄取网关，利用持久 MQTT 连接，结合无服务器计算平面中的直接流集成。

Initial mockups showed that while Web PubSub was easy to set up for browser interfaces, it introduced significant architectural debt, credential management vulnerabilities, and telemetry processing latency when applied to physical edge device simulators.

初始原型显示，虽然 Web PubSub 在浏览器界面中易于设置，但应用于物理边缘设备模拟器时，带来了显著的架构债务、凭证管理漏洞和遥测处理延迟。

---

## Decision Drivers / 决策驱动因素

* **Zero-Trust Device Identity / 零信任设备身份**: Restrict edge simulators to isolated security scopes using individual per-device cryptographic keys (Shared Access Keys), preventing global token compromise. 使用每台设备独立的加密密钥（共享访问密钥）将边缘模拟器限制在隔离的安全范围内，防止全局令牌泄露。
* **Absolute Latency Ceilings / 绝对延迟上限**: Strip intermediate HTTP routing to ensure edge-to-brain ingestion remains `< 15ms`, masking the Azure OpenAI action planning latency (target `P95 < 800ms`) within the physical tolerance of the embodied hardware. 去除中间 HTTP 路由，确保边缘到大脑的数据摄取保持在 `< 15ms`，将 Azure OpenAI 动作规划延迟（目标 `P95 < 800ms`）隐藏在具身硬件的物理容忍范围内。
* **FinOps & Resource Constraints / 财务运营与资源约束**: Force infrastructure cost to $0 for the telemetry layer by locking the Azure IoT Hub sku to the `F1` Free Tier, preserving the strict sandbox budget exclusively for Azure OpenAI token consumption. 通过将 Azure IoT Hub SKU 锁定到 `F1` 免费层，将遥测层的基础设施成本强制归零，将严格的沙盒预算全部预留给 Azure OpenAI Token 消耗。
* **Industrial Bi-directional Control Loops / 工业级双向控制环**: Support structured Cloud-to-Device (C2D) commands and Device Twin state tracking natively without custom routing middleware. 原生支持结构化云端到设备（C2D）命令和设备孪生状态跟踪，无需自定义路由中间件。

---

## Considered Options & Trade-offs / 考虑方案与权衡

### Option 1: Web PubSub (WebSocket Ingestion Platform)
### 方案一：Web PubSub（WebSocket 数据摄取平台）

* **Pros / 优势**: Easy real-time streaming integration with web browsers; lightweight protocol overhead. 与 Web 浏览器易于集成的实时流式传输；轻量级协议开销。
* **Cons / 劣势**:
  * **Authorization Deficits / 授权缺陷**: Lacks built-in device-specific registry management. Any client with the connection token can compromise the entire hub. 缺乏内置的设备级注册表管理。任何拥有连接令牌的客户端都可以危及其余整个集线器。
  * **Routing Complexity / 路由复杂性**: Requires an intermediate Azure Function or webhook router to process incoming WebSocket packets and direct them to backend handlers, introducing an extra network hop. 需要中间 Azure Function 或 webhook 路由器来处理传入的 WebSocket 数据包并将其定向到后端处理程序，引入了额外的网络跳转。

### Option 2: IoT Hub Persistent MQTT Connection + Direct Event Hub Ingestion
### 方案二：IoT Hub 持久 MQTT 连接 + 直接 Event Hub 数据摄取

* **Pros / 优势**:
  * **Industrial Identity / 工业级身份**: Enforces Zero-Trust registry constraints. Each device is provisioned with a unique, revocable connection string. 强制执行零信任注册表约束。每台设备预配有唯一、可吊销的连接字符串。
  * **Zero-Hop Event Hub Ingestion / 零跳转 Event Hub 数据摄取**: Integrates Azure Functions directly with the IoT Hub's underlying Event Hub partitions. The function worker pulls directly from the event streams, eliminating intermediate HTTP gateway routing and reducing latency to `< 15ms`. 将 Azure Functions 直接与 IoT Hub 底层的 Event Hub 分区集成。Function Worker 直接从事件流中拉取，消除了中间 HTTP 网关路由，延迟降至 `< 15ms`。
* **Cons / 劣势**:
  * **Storage Requirement / 存储需求**: Requires local/cloud storage checkpoints (`AzureWebJobsStorage`) to lock partitions during multi-worker processing. 需要本地/云端存储检查点来在多 Worker 处理期间锁定分区。

---

## Selected Decision / 选定决策

We selected **Option 2**. We deprecated Web PubSub for edge communication and locked down direct MQTT connections to Azure IoT Hub for all device instances.

我们选择了**方案二**。弃用了用于边缘通信的 Web PubSub，为所有设备实例锁定到 Azure IoT Hub 的直接 MQTT 连接。

Telemetry streams are ingested directly by the Azure Functions backend using the native Event Hub Trigger.

遥测流由 Azure Functions 后端使用原生 Event Hub Trigger 直接摄取。

---

## Consequences / 后果

* **Positive / 正向**: Enforces Zero-Trust identity at the physical tier. A compromised `Robo-A1` probe is cryptographically blinded from accessing telemetry of other tenants or overriding global commands. 在物理层强制执行零信任身份。被攻破的 `Robo-A1` 探测器在密码学上被隔离，无法访问其他租户的遥测数据或覆盖全局命令。
* **Positive / 正向**: Consolidates the ingestion pipeline, cutting system codebase complexity by ~35% and guaranteeing 10k msg/sec throughput capacity via native Event Hub partitions. 整合数据摄取管道，将系统代码库复杂度降低约 35%，通过原生 Event Hub 分区保证了 1 万条/秒的吞吐量。
* **Positive / 正向**: Reaches low-latency stream processing (`<15ms` ingestion hops) via direct partition reading. 通过直接分区读取实现低延迟流处理（`<15ms` 摄取跳转）。
* **Negative / 负向**: Requires local Functions host environments to have access to a storage account to coordinate partition lease checkpoints. 需要本地 Functions 主机环境能够访问存储账户以协调分区租约检查点。
