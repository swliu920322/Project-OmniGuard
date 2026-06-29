# Blueprint 006: Dynamic Orchestration Sandbox

> **Document Status**: Active / Execution Phase
> **Target**: Upgrade the Control Plane to support dynamic Agent orchestration via UI payload injection, proving the decoupling of compute and configuration.

## 1. Backend Enhancement (动态规则注入)
**Action for Agy:**
Modify the `POST /simulate_agent` endpoint in `src/cloud-orchestrator/embodied_brain/brain.py`.
* **Input Payload Update**: Allow the request body to optionally accept `override_config` object containing `agent_router_prompt`, `agent_safety_rules`, and `agent_execution_schema`.
* **Logic Override**: When loading the scenario profile, if `override_config` is present in the request body, merge/overwrite the default JSON registry values for that specific request execution. 
* *Purpose*: This transforms the endpoint from a static executor into a dynamic testing sandbox.

## 2. Frontend Enhancement (沙盒测试面板)
**Action for Agy:**
Modify `src/client-edge/src/app/dashboard/page.tsx`.
1. **New Tab/View**: Add a "Sandbox / Orchestration Studio" tab next to "Physical Twin" and "Cloud Topology".
2. **Configuration Form**: In this view, expose `<textarea>` fields pre-filled with the current tenant's Default Agent prompts (Router Prompt, Safety Rules, Schema).
3. **Live Testing**: The user can edit the text in these textareas. When they click "Simulate", the frontend sends the modified text in the `override_config` payload to the backend.
4. **Visual Feedback**: The existing 3-Agent pipeline UI should react to this dynamically overridden logic, proving that the Agent's behavior is entirely driven by the injected configuration.