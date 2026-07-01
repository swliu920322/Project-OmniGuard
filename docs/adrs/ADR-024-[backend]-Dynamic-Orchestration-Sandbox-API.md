# Architectural Decision Record (ADR 024)
# 架构决策记录 (ADR 024)

## Title / 标题

ADR 024: Dynamic Orchestration Sandbox — Configuration-Driven Agent API
ADR 024: 动态编排沙盒——配置驱动的 Agent API

## Status / 状态

**Approved / 已批准**

## Context / 背景

The `/simulate_agent` endpoint was a static executor — it loaded fixed scenario configs and returned predetermined results. There was no way to test agent behavior variations without modifying `scenario_registry.json` and redeploying. This hindered rapid prototyping and sandboxed experimentation.

`/simulate_agent` 端点是一个静态执行器——它加载固定的场景配置并返回预定结果。在不修改 `scenario_registry.json` 和重新部署的情况下，无法测试 Agent 行为的变化。这阻碍了快速原型设计和沙盒实验。

## Decision Drivers / 决策驱动因素

* Enable runtime prompt/schema injection without redeployment.
* Prove compute-configuration decoupling for interview defense.
* Maintain backward compatibility — existing callers must work unchanged.

* 支持无需重新部署的运行时提示/模式注入。
* 为面试答辩证明计算-配置解耦。
* 保持向后兼容性——现有调用者必须无变化地工作。

## Decision / 决策

Extend `POST /simulate_agent` to accept an optional `override_config` object (`agent_router_prompt`, `agent_safety_rules`, `agent_execution_schema`). When present, merge/overwrite the default JSON registry values for that request only. Add a "Sandbox / Orchestration Studio" tab in the frontend with editable textareas pre-filled with current tenant defaults.

扩展 `POST /simulate_agent` 以接受可选的 `override_config` 对象（`agent_router_prompt`、`agent_safety_rules`、`agent_execution_schema`）。当存在时，仅对该次请求合并/覆盖默认 JSON 注册表值。在前端添加"沙盒/编排工作室"标签页，提供预填充当前租户默认值的可编辑文本框。

## Consequences / 后果

* **Positive / 正向**: Instant agent behavior iteration — edit prompts in UI, click simulate, see results.
* **Positive / 正向**: Demonstrates architecture-level understanding of compute-configuration separation.
* **Negative / 负向**: Adds payload size; requires validation of injected config to prevent prompt injection.

* **正向**: 即时 Agent 行为迭代——在 UI 中编辑提示词，点击模拟，查看结果。
* **正向**: 展示了对计算-配置分离的架构级理解。
* **负向**: 增加了有效负载大小；需要验证注入的配置以防止提示注入。
