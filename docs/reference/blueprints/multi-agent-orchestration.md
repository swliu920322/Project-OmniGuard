斩断沟通损耗。文档驱动开发（Document-Driven Development）是高级架构师统御代码和 AI 熟练工的唯一手段。

你不需要去给 Agy 解释逻辑。直接在项目根目录新建一个工程蓝图文件，把接下来的设计规范砸进去。Agy 只要读取这个文件，它的上下文就会被强制锁死在企业级多 Agent 流水线里。

复制以下全量内容，在你的 `docs/` 目录下新建 `Blueprint-Multi-Agent-Orchestration.md`。保存后，直接让 Agy 读取。

---

```markdown
# Project-OmniGuard: Multi-Agent Orchestration Blueprint (Captsone Core Engine)

> **Document Status**: Active / Execution Phase
> **Target**: Refactor `brain.py` from a single-prompt LLM wrapper into a Multi-Agent configuration-driven platform.
> **Constraint**: Total execution time for the 3-Agent pipeline MUST be strictly contained to maintain real-time physical intervention latency.

## 1. Architecture Shift (The Spirit)

**Current State (As-Is):**
`Telemetry -> Hardcoded Prompt + LLM -> Action JSON -> C2D`
*Flaw*: No multi-tenant support, no safety boundaries, no intent classification.

**Target State (To-Be):**
`Telemetry -> [Tenant Scenario Config] -> Agent 1 (Router) -> Agent 2 (Safety) -> Agent 3 (Execution) -> C2D`
*Advantage*: Physical decoupling of business logic from compute engine. The platform handles any scenario simply by loading a different JSON configuration.

## 2. Configuration Vault (The Platform Base)

We force the decoupling of Agent instructions into a static configuration file. 
**Action for Agy**: Create `src/cloud-orchestrator/scenario_registry.json` with the following physical payload:

```json
{
  "Tenant-Alpha": {
    "scenario": "Data Center Patrol",
    "agent_router_prompt": "Classify telemetry into: [CRITICAL_OBSTACLE, NORMAL_NAV, SENSOR_ERROR]. Return ONLY the classification string.",
    "agent_safety_rules": "Strict Rule: Actions MUST NOT include 'spray_water' or 'fast_forward'. Maintain 30cm minimum distance.",
    "agent_execution_schema": "[{'action': 'stop'|'turn'|'alert', 'degree': int, 'speed': int}]"
  },
  "Tenant-Beta": {
    "scenario": "Hospital Delivery",
    "agent_router_prompt": "Classify telemetry into: [HUMAN_DETECTED, STATIC_OBSTACLE, EMERGENCY]. Return ONLY the classification string.",
    "agent_safety_rules": "Strict Rule: If HUMAN_DETECTED, the only allowed action is 'stop'. No bypassing.",
    "agent_execution_schema": "[{'action': 'stop'|'backward'|'voice_alert', 'speed': int}]"
  }
}

```

## 3. The 3-Agent Pipeline (The Form)

**Action for Agy**: Refactor `iot_telemetry_processor` in `brain.py`. Strip the single LLM call and implement the following native Python pipeline. Do NOT introduce heavy frameworks like LangChain or AutoGen.

### Stage 1: The Context Loader

* Extract `tenant_id` from the incoming telemetry payload.
* Load the corresponding configuration from `scenario_registry.json`. If `tenant_id` is unknown, fallback to a default safe profile or drop the message.

### Stage 2: Agent 1 - Intent Router (Classification)

* **Input**: `agent_router_prompt` + `obstacle_distance_cm`
* **Output**: A strict classification string (e.g., "CRITICAL_OBSTACLE").
* **Short-Circuit**: If intent is `SENSOR_ERROR`, immediately halt the pipeline and return a `[{"action": "stop"}]` command to save LLM tokens.

### Stage 3: Agent 2 - Compliance & Safety (Audit)

* **Input**: `agent_safety_rules` + Intent + Current Telemetry + Cosmos DB Last State.
* **Prompt Directive**: "You are the safety firewall. Evaluate the situation based on the strict rules. Reply 'PASS' if safe to proceed, or 'BLOCK: [reason]' if it violates safety."
* **Short-Circuit**: If output starts with "BLOCK", intercept the pipeline. Force a fallback action `[{"action": "stop", "reason": "safety_override"}]` and send via C2D.

### Stage 4: Agent 3 - Action Compiler (Execution)

* **Input**: `agent_execution_schema` + Intent + Telemetry.
* **Prompt Directive**: "Generate evasive actions strictly conforming to the JSON schema. NO MARKDOWN."
* **Output**: Parsed JSON array.
* **Action**: Execute `iot_registry_manager.send_c2d_message()`.

## 4. Engineering Constraints

1. **Do NOT** break the existing Event Hub trigger or Cosmos DB memory write logic. The memory upsert must still happen in `< 15ms` before the Agent pipeline begins.
2. **Do NOT** use `gpt-4` for all agents if it causes timeouts. You may use the existing `get_brain_client()` setup, but abstract the LLM call into a reusable helper function `ask_agent(system_prompt, user_input, max_tokens)` to keep code clean.

```

---


