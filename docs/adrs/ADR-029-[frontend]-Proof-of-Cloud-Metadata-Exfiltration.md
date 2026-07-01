# Architectural Decision Record (ADR 029)
# 架构决策记录 (ADR 029)

## Title / 标题

ADR 029: Proof of Cloud — Metadata Exfiltration for Infrastructure Authenticity
ADR 029: 云原生自证——基础设施真实性的元数据透出

## Status / 状态

**Approved / 已批准**

## Context / 背景

The dashboard UI could be convincingly mocked with pure frontend code (static JSON, `setTimeout` animations). External observers (interviewers, professors) had no way to distinguish between a real cloud backend and a frontend-only mock. This undermined trust in the entire architecture. Hard Azure metadata — Cosmos DB RU charges, partition IDs, VNet status — cannot be forged.

仪表板 UI 可以用纯前端代码（静态 JSON、`setTimeout` 动画）令人信服地模拟。外部观察者（面试官、教授）无法区分真实的云后端和纯前端模拟。这削弱了对整个架构的信任。硬 Azure 元数据——Cosmos DB RU 消耗、分区 ID、VNet 状态——无法伪造。

## Decision Drivers / 决策驱动因素

* Prove real Azure infrastructure execution, not frontend mock.
* Expose infrastructure metadata that is impossible to forge client-side.
* Map each cloud resource to its IaC source file (Bicep provenance).

* 证明真实的 Azure 基础设施执行，而非前端模拟。
* 暴露客户端无法伪造的基础设施元数据。
* 将每个云资源映射到其 IaC 源文件（Bicep 溯源）。

## Decision / 决策

Return a `cloud_metrics` object from `/simulate_agent` containing Cosmos DB RU charge, write latency, execution environment name, VNet isolation status, and IoT Hub routing info. Add an "Architecture Mode" toggle in the frontend that switches between Physical Twin view and a Cloud Topology flowchart. Annotate each topology node with its Bicep source file (e.g., IoT Hub → `nested-infra.bicep`).

从 `/simulate_agent` 返回一个 `cloud_metrics` 对象，包含 Cosmos DB RU 消耗、写入延迟、执行环境名称、VNet 隔离状态和 IoT Hub 路由信息。在前端添加"架构模式"切换开关，在物理孪生视图和云拓扑流程图之间切换。为每个拓扑节点标注其 Bicep 源文件（例如 IoT Hub → `nested-infra.bicep`）。

## Consequences / 后果

* **Positive / 正向**: Eliminates "frontend mock" skepticism — RU charges and VNet status are Azure-native.
* **Positive / 正向**: IaC traceability proves deployment authenticity and infrastructure-as-code discipline.
* **Negative / 负向**: Mock RU data initially (real extraction adds overhead); acceptable for demo phase.

* **正向**: 消除"前端模拟"的怀疑——RU 消耗和 VNet 状态是 Azure 原生的。
* **正向**: IaC 可追溯性证明了部署的真实性和基础设施即代码的纪律。
* **负向**: 初始阶段使用模拟 RU 数据（真实提取会增加开销）；演示阶段可接受。
