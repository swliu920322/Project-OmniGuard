# Architectural Decision Record (ADR 028)
# 架构决策记录 (ADR 028)

## Title / 标题

ADR 028: Multi-Agent Orchestration Engine — Configuration-Driven Pipeline
ADR 028: 多 Agent 编排引擎——配置驱动流水线

## Status / 状态

**Approved / 已批准**

## Context / 背景

The `brain.py` was a single-prompt LLM wrapper: `Telemetry → Hardcoded Prompt + LLM → Action JSON → C2D`. This had no multi-tenant support, no safety boundaries, no intent classification, and no short-circuit capability. Every tenant's logic was hardcoded, making customization impossible without code changes.

`brain.py` 是一个单提示词 LLM 封装器：`遥测数据 → 硬编码提示词 + LLM → 动作 JSON → C2D`。这没有多租户支持、没有安全边界、没有意图分类、没有短路能力。每个租户的逻辑都是硬编码的，不修改代码就无法定制。

## Decision Drivers / 决策驱动因素

* Physical decoupling of business logic from compute engine — any scenario via JSON config.
* Short-circuit capability to save LLM tokens on trivial/error inputs.
* Strict total execution time budget for real-time physical intervention.

* 业务逻辑与计算引擎的物理解耦——任何场景通过 JSON 配置实现。
* 短路能力，在琐碎/错误输入上节省 LLM Token。
* 实时物理干预的严格总执行时间预算。

## Decision / 决策

Refactor `brain.py` into a 3-Agent pipeline with configuration-driven architecture:

1. **Context Loader**: Extract `tenant_id`, load config from `scenario_registry.json`.
2. **Agent 1 (Intent Router)**: Classify telemetry (CRITICAL_OBSTACLE / NORMAL_NAV / SENSOR_ERROR). Short-circuit on SENSOR_ERROR.
3. **Agent 2 (Safety Firewall)**: Evaluate against tenant safety rules. Output PASS or BLOCK:[reason]. Short-circuit on BLOCK → force stop.
4. **Agent 3 (Action Compiler)**: Generate structured JSON conforming to tenant schema. Send via C2D.

No LangChain/AutoGen — pure native Python with a reusable `ask_agent()` helper.

将 `brain.py` 重构为 3-Agent 流水线，采用配置驱动架构：

1. **上下文加载器**：提取 `tenant_id`，从 `scenario_registry.json` 加载配置。
2. **Agent 1（意图路由器）**：分类遥测数据（严重障碍物/正常导航/传感器错误）。传感器错误时短路。
3. **Agent 2（安全防火墙）**：根据租户安全规则评估。输出 PASS 或 BLOCK:[原因]。在 BLOCK 时短路 → 强制停止。
4. **Agent 3（动作编译器）**：生成符合租户模式的结构化 JSON。通过 C2D 发送。

不使用 LangChain/AutoGen——纯原生 Python，带可重用的 `ask_agent()` 辅助函数。

## Consequences / 后果

* **Positive / 正向**: New tenant = new JSON entry, zero code changes.
* **Positive / 正向**: Short-circuit saves tokens and reduces latency for trivial cases.
* **Positive / 正向**: Clean interview narrative — show pipeline trace with BLOCKED node highlighted.
* **Negative / 负向**: Three sequential LLM calls increase total latency; mitigated by short-circuit.

* **正向**: 新租户 = 新 JSON 条目，零代码更改。
* **正向**: 短路在琐碎情况下节省 Token 并减少延迟。
* **正向**: 清晰的面试叙事——显示流水线追踪，BLOCKED 节点高亮。
* **负向**: 三个顺序 LLM 调用增加了总延迟；通过短路缓解。
