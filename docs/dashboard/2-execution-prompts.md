# Execution Prompts: Dashboard Core Refactoring
# 执行协议：大盘核心模块重构任务书

> **Document Status**: Active (AI Directive / 执行协议)
> **Reference**: Context-Isolated Subagent Directives

---

## 1. Directive 01: Implement Backend Simulation API

### Context Isolation & Dependencies
* **Target File**: `src/cloud-orchestrator/embodied_brain/brain.py`
* **Dependencies**: `load_scenario_config` and `ask_agent` from `utils.py`. Scenario registry located at `src/cloud-orchestrator/scenario_registry.json`.

### Directives
1. **Implement** an HTTP POST endpoint `/api/simulate_agent`.
2. **Extract** `tenant_id`, `obstacle_distance_cm`, `current_x`, and `target_speed` from the incoming JSON payload.
3. **Execute** the 3-Agent orchestration pipeline:
   * Classify intent via Agent 1 (Router).
   * Evaluate compliance rules via Agent 2 (Safety Firewall).
   * Compile actions to JSON schema via Agent 3 (Action Compiler), constraining output speed to `target_speed`.
4. **Enforce** safety short-circuits: Skip subsequent agent execution if Agent 1 flags `SENSOR_ERROR` or Agent 2 flags `BLOCK`.
5. **Return** JSON response including execution latency, final action arrays, and step-by-step pipeline traces.

### Off-Limit Code Boundaries
* **Do NOT modify** the existing `iot_telemetry_processor` EventHub trigger function.
* **Do NOT touch** telemetry Cosmos DB persistence logic (`upsert_item`) in the EventHub stream.

### Physical Validation Criteria
Execute the following curl command against the local Function runtime:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tenant_id":"Tenant-Alpha","obstacle_distance_cm":25,"current_x":5,"target_speed":50}' \
  http://localhost:7071/api/simulate_agent
```
* **Success Criteria**: Terminal stdout must print HTTP 200 with `status: "BLOCKED"` for Safety Agent, `status: "SHORT_CIRCUIT"` for Action Compiler, and `action: "stop"` in final actions list.

---

## 2. Directive 02: Implement Runtime Reverse Proxy Gateway

### Context Isolation & Dependencies
* **Target Directory**: `src/client-edge/src/app/`
* **Backend Endpoint**: `http://omni-backend.internal.<default-domain>/api/`

### Directives
1. **Delete** all compile-time rewrite configurations in `next.config.mjs`.
2. **Create** a catch-all dynamic route at `app/api/[...path]/route.ts`.
3. **Configure** the catch-all route with `export const dynamic = "force-dynamic"` to bypass build-time static HTML baking.
4. **Implement** an asynchronous forwarder that captures incoming request HTTP methods, headers, and payloads, dynamically forwards them to the internal backend container FQDN, and returns the response.
5. **Filter** out empty path segments from Next.js trailing slash routing using `pathSegments.filter(Boolean).join('/')` to prevent trailing slash mismatches.

### Off-Limit Code Boundaries
* **Do NOT touch** static asset compilation folders or next.js image export configuration settings.

### Physical Validation Criteria
Run `npm run build` in the client directory.
* **Success Criteria**: Build log must output `Route (app) /dashboard: (Static) prerendered as static content` with no hardcoded local URL binds in the generated HTML package.

---

## 3. Directive 03: Implement Non-Overlapping Navigation Loop

### Context Isolation & Dependencies
* **Target File**: `src/client-edge/src/app/dashboard/page.tsx`
* **API Route**: `/api/simulate_agent`

### Directives
1. **Remove** all `setInterval` loop timers inside the page telemetry trigger.
2. **Implement** a sequential, non-overlapping loop using recursive `setTimeout` scheduling.
3. **Configure** the loop to schedule the next telemetry payload request *only* after the active HTTP request has returned.
4. **Implement** ref-based state trackers (`useRef`) for `distance`, `currentX`, and `targetSpeed` to prevent stale closure data reads inside the timeout thread.
5. **Force** early loop termination if `isBlocked` is flagged in the pipeline trace or `stop` action is returned.

### Off-Limit Code Boundaries
* **Do NOT modify** the visual render blocks in `PhysicalTwinVisualizer` or the inline styles inside the topology component.

### Physical Validation Criteria
Open the browser's developer console network tab during active navigation.
* **Success Criteria**: The network trace must display a maximum queue depth of **1** active `/api/simulate_agent` request. No concurrent requests may pile up while a request is waiting for backend OpenAI completion.
