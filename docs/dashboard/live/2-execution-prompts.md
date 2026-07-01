# Execution Prompts: Dashboard Core Refactoring

> **Document Status**: Active (AI Directive / 执行协议)
> **Reference**: Context-Isolated Subagent Directives

---

## 1. Directive 01: Implement Backend Simulation API

### Context Isolation & Dependencies

- **Target File**: `src/cloud-orchestrator/embodied_brain/brain.py`
- **Dependencies**: `load_scenario_config` and `ask_agent` from `utils.py`. Scenario registry located at `src/cloud-orchestrator/scenario_registry.json`.

### Directives

1. **Implement** an HTTP POST endpoint `/api/simulate_agent`.
2. **Extract** `tenant_id`, `obstacle_distance_cm`, `current_x`, and `target_speed` from the incoming JSON payload.
3. **Execute** the 3-Agent orchestration pipeline:
   - Classify intent via Agent 1 (Router).
   - Evaluate compliance rules via Agent 2 (Safety Firewall).
   - Compile actions to JSON schema via Agent 3 (Action Compiler), constraining output speed to `target_speed`.
4. **Enforce** safety short-circuits: Skip subsequent agent execution if Agent 1 flags `SENSOR_ERROR` or Agent 2 flags `BLOCK`.
5. **Return** JSON response including execution latency, final action arrays, and step-by-step pipeline traces.

### Off-Limit Code Boundaries

- **Do NOT modify** the existing `iot_telemetry_processor` EventHub trigger function.
- **Do NOT touch** telemetry Cosmos DB persistence logic (`upsert_item`) in the EventHub stream.

### Physical Validation Criteria

Execute the following curl command against the local Function runtime:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tenant_id":"Tenant-Alpha","obstacle_distance_cm":25,"current_x":5,"target_speed":50}' \
  http://localhost:7071/api/simulate_agent
```

- **Success Criteria**: Terminal stdout must print HTTP 200 with `status: "BLOCKED"` for Safety Agent, `status: "SHORT_CIRCUIT"` for Action Compiler, and `action: "stop"` in final actions list.

---

## 2. Directive 02: Implement Runtime Reverse Proxy Gateway

### Context Isolation & Dependencies

- **Target Directory**: `src/client-edge/src/app/`
- **Backend Endpoint**: `http://omni-backend.internal.<default-domain>/api/`

### Directives

1. **Delete** all compile-time rewrite configurations in `next.config.mjs`.
2. **Create** a catch-all dynamic route at `app/api/[...path]/route.ts`.
3. **Configure** the catch-all route with `export const dynamic = "force-dynamic"` to bypass build-time static HTML baking.
4. **Implement** an asynchronous forwarder that captures incoming request HTTP methods, headers, and payloads, dynamically forwards them to the internal backend container FQDN, and returns the response.
5. **Filter** out empty path segments from Next.js trailing slash routing using `pathSegments.filter(Boolean).join('/')` to prevent trailing slash mismatches.

### Off-Limit Code Boundaries

- **Do NOT touch** static asset compilation folders or next.js image export configuration settings.

### Physical Validation Criteria

Run `npm run build` in the client directory.

- **Success Criteria**: Build log must output `Route (app) /dashboard: (Static) prerendered as static content` with no hardcoded local URL binds in the generated HTML package.

---

## 3. Directive 03: Implement Non-Overlapping Navigation Loop

### Context Isolation & Dependencies

- **Target File**: `src/client-edge/src/app/dashboard/page.tsx`
- **API Route**: `/api/simulate_agent`

### Directives

1. **Remove** all `setInterval` loop timers inside the page telemetry trigger.
2. **Implement** a sequential, non-overlapping loop using recursive `setTimeout` scheduling.
3. **Configure** the loop to schedule the next telemetry payload request *only* after the active HTTP request has returned.
4. **Implement** ref-based state trackers (`useRef`) for `distance`, `currentX`, and `targetSpeed` to prevent stale closure data reads inside the timeout thread.
5. **Force** early loop termination if `isBlocked` is flagged in the pipeline trace or `stop` action is returned.

### Off-Limit Code Boundaries

- **Do NOT modify** the visual render blocks in `PhysicalTwinVisualizer` or the inline styles inside the topology component.

### Physical Validation Criteria

Open the browser's developer console network tab during active navigation.

- **Success Criteria**: The network trace must display a maximum queue depth of **1** active `/api/simulate_agent` request. No concurrent requests may pile up while a request is waiting for backend OpenAI completion.

---

# 执行协议：大盘核心模块重构任务书

> **文档状态**：已激活（AI 指令 / AI Directive）
> **参考**：上下文隔离子智能体指令

---

## 指令 01：实现后端模拟 API

### 上下文隔离与依赖

- **目标文件**：`src/cloud-orchestrator/embodied_brain/brain.py`
- **依赖**：`utils.py` 中的 `load_scenario_config` 和 `ask_agent`。场景注册表位于 `src/cloud-orchestrator/scenario_registry.json`。

### 指令

1. **实现** HTTP POST 端点 `/api/simulate_agent`。
2. **提取** 入站 JSON 负载中的 `tenant_id`、`obstacle_distance_cm`、`current_x` 和 `target_speed`。
3. **执行** 三智能体编排管道：
   - 通过智能体 1（路由器）分类意图。
   - 通过智能体 2（安全防火墙）评估合规规则。
   - 通过智能体 3（动作编译器）将动作编译为 JSON schema，将输出速度限制为 `target_speed`。
4. **强制执行** 安全短路：如果智能体 1 标记 `SENSOR_ERROR` 或智能体 2 标记 `BLOCK`，则跳过后续智能体执行。
5. **返回** 包含执行延迟、最终动作数组和逐步管道跟踪的 JSON 响应。

### 禁止修改的代码边界

- **不要修改**现有的 `iot_telemetry_processor` EventHub 触发函数。
- **不要触碰** EventHub 流中的遥测 Cosmos DB 持久化逻辑（`upsert_item`）。

### 物理验证标准

针对本地 Function 运行时执行以下 curl 命令：

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"tenant_id":"Tenant-Alpha","obstacle_distance_cm":25,"current_x":5,"target_speed":50}' \
  http://localhost:7071/api/simulate_agent
```

- **成功标准**：终端 stdout 必须打印 HTTP 200，其中安全智能体的 `status: "BLOCKED"`、动作编译器的 `status: "SHORT_CIRCUIT"`，以及最终动作列表中的 `action: "stop"`。

---

## 指令 02：实现运行时反向代理网关

### 上下文隔离与依赖

- **目标目录**：`src/client-edge/src/app/`
- **后端端点**：`http://omni-backend.internal.<default-domain>/api/`

### 指令

1. **删除** `next.config.mjs` 中的所有编译时重写配置。
2. **创建** 位于 `app/api/[...path]/route.ts` 的全捕获动态路由。
3. **配置** 全捕获路由使用 `export const dynamic = "force-dynamic"` 以绕过构建时静态 HTML 烘焙。
4. **实现** 异步转发器，捕获入站请求的 HTTP 方法、头和负载，动态转发到内部后端容器 FQDN，并返回响应。
5. **过滤** Next.js 尾随斜杠路由中的空路径段，使用 `pathSegments.filter(Boolean).join('/')` 防止尾随斜杠不匹配。

### 禁止修改的代码边界

- **不要触碰**静态资产编译文件夹或 next.js 图像导出配置设置。

### 物理验证标准

在 client 目录中运行 `npm run build`。

- **成功标准**：构建日志必须输出 `Route (app) /dashboard: (Static) prerendered as static content`，生成的 HTML 包中没有硬编码的本地 URL 绑定。

---

## 指令 03：实现无重叠导航循环

### 上下文隔离与依赖

- **目标文件**：`src/client-edge/src/app/dashboard/page.tsx`
- **API 路由**：`/api/simulate_agent`

### 指令

1. **移除** 页面遥测触发器内的所有 `setInterval` 循环计时器。
2. **使用** 递归 `setTimeout` 调度实现顺序、无重叠的循环。
3. **配置** 循环仅在活动 HTTP 请求返回后才调度下一次遥测负载请求。
4. **实现** 基于 ref 的状态跟踪器（`useRef`），用于 `distance`、`currentX` 和 `targetSpeed`，以防止超时线程内的闭包数据读取过时。
5. **强制** 如果管道跟踪中标记了 `isBlocked` 或返回了 `stop` 动作，则提前终止循环。

### 禁止修改的代码边界

- **不要修改** `PhysicalTwinVisualizer` 中的视觉渲染块或拓扑组件内的内联样式。

### 物理验证标准

在主动导航期间打开浏览器的开发者控制台网络标签。

- **成功标准**：网络跟踪必须显示最大队列深度为 **1** 的活动 `/api/simulate_agent` 请求。当请求等待后端 OpenAI 完成时，不允许并发请求堆积。
