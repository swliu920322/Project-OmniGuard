# Blueprint 003: Embodied AI Fleet Dashboard Integration

> **Document Status**: Active / Execution Phase
> **Target**: Build the Next.js React frontend (`/dashboard`) to visually render the backend 3-Agent state machine.

## 1. Objective (目标)
Transform the invisible backend `/simulate_agent` API into an interactive Control Plane. The UI must explicitly prove to observers (interviewers/professors) that the multi-agent tenant isolation and short-circuit mechanisms are physically functioning.

## 2. Engineering Constraints (约束)
* **Zero Business Logic**: The frontend is a "Dumb Terminal". It MUST NOT calculate safety or routing. It only renders the JSON state returned by the backend.
* **Minimalist Tech Stack**: Strictly use native React (`useState`, `useEffect`) and Tailwind CSS. **Prohibit** the introduction of heavy charting libraries (e.g., ECharts, Chart.js).
* **Network Boundary**: The Next.js dev server runs on `localhost:3000`. The Azure Function runs on `localhost:7071`. Ensure API calls point to the correct port.

## 3. Design Pattern (设计模式)
* **State-Driven UI (状态驱动渲染)**: The UI is a pure function of the `pipeline_trace` array returned by the API. 
* **Enum Mapping**: Map the backend `status` explicitly to Tailwind color classes:
  * `PASS` -> Green (e.g., `bg-green-500/20 border-green-500`)
  * `BLOCKED` -> Red (e.g., `bg-red-500/20 border-red-500`)
  * `SHORT_CIRCUIT` -> Gray/Disabled (e.g., `bg-gray-800 border-gray-600 opacity-50`)

## 4. Data Flow (数据流转)
1. **[Trigger]**: User clicks "Simulate Event" -> React captures `tenant_id` (Dropdown) and `distance` (Slider).
2. **[Request]**: `POST http://localhost:7071/simulate_agent` with payload `{"tenant_id": "...", "obstacle_distance_cm": ..., "current_x": 0}`.
3. **[Response]**: Backend returns `{ latency_ms, final_action, pipeline_trace }`.
4. **[Render]**: 
   * Left Zone: Animate or update probe status.
   * Middle Zone: Iterate through `pipeline_trace` and update the 3 Agent Node cards with the mapped colors and `decision` text.
   * Right Zone: Stringify the raw JSON response into a `<pre><code>` block.

## 5. Execution Steps for Agy
1. Create `src/client-edge/src/app/dashboard/page.tsx`.
2. Implement the 3-column UI layout using Tailwind CSS grid/flex.
3. Wire up the `fetch` call to the local backend.
4. Test with both `Tenant-Alpha` (trigger block at 10cm) and `Tenant-Beta` (trigger block at 40cm).
5. Output the local access URL when complete.

## 6.
这份蓝图不仅仅是写给 AI 看的代码需求，它实际上是你在答辩和面试时的核心讲稿。我为你拆解里面的底层逻辑：

1. 为什么要强调“Zero Business Logic (零业务逻辑)”？
在云架构中，最忌讳的就是“逻辑泄露”。如果你在前端写了 if (distance < 30) { alert('危险') }，这叫玩具。
真正的企业级平台，所有的规则（医院不能撞人、机房不能喷水）都在后端的 Cosmos DB 里。前端就像一个纯粹的“显示器”。这份蓝图强制 Agy 把前端写成一个“傻瓜终端（Dumb Terminal）”，这是高阶架构师对前后端绝对物理隔离的把控。

2. 设计模式里的 Enum Mapping (状态映射) 有什么用？
后端现在会吐出三种状态：PASS（放行）、BLOCKED（安全拦截）、SHORT_CIRCUIT（短路跳过）。
把这三个词和前端的颜色（绿、红、灰）强行绑定。当答辩评委看到页面上的 Agent 3（Action Compiler）因为 Agent 2 的拦截而瞬间变成“灰色”时，“短路节约算力”这个抽象概念，就变成了肉眼可见的物理现实