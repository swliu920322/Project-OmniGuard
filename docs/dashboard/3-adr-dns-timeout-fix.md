# ADR: Azure Container Apps Migration & Networking Decision Log

> **Document Status**: Approved (Architecture Decision Records)
> **Reference**: ADR-008, ADR-009, ADR-010, ADR-011

---

## 1. ADR-008: Eliminating DNS timeouts by removing WEBSITE_DNS_SERVER

### Context

Following deployment of the backend API to the production environment on Azure Functions (Southeast Asia), the end-to-end telemetry response latency increased to **7.0s - 9.1s** per request. In contrast, local host runs registered a latency of only **3.5s - 4.5s**.

Network routing inspection revealed a consistent **5.0-second delay** during the initial socket connection to external Azure endpoints.

- **Root Cause**: The setting `WEBSITE_DNS_SERVER` was configured to `168.63.129.16` (Azure's internal DNS resolver), while `WEBSITE_VNET_ROUTE_ALL` was configured to `0` (restricting VNet routing to private RFC1918 traffic only).
- Because `168.63.129.16` is a public IP address (non-RFC1918), the OS container routed DNS requests through the public internet gateway instead of the VNet.
- Since `168.63.129.16` is only reachable internally, the queries timed out on the public gateway for exactly **5 seconds** before falling back to public DNS resolvers.

### Decision

1. **Remove** `WEBSITE_DNS_SERVER` completely from the compute-module.bicep template.
2. **Delete** the environment configuration key from the Azure App settings, allowing the container to inherit the default native resolver that handles both public internet names and Private DNS Zone endpoints.
3. **Refactor** the `AzureOpenAI` and `CosmosClient` client initializations in utils.py into global lazy singletons to reuse established TCP connections via HTTP Keep-Alive.

### Consequences

- **DNS Lookup Latency**: Dropped from 5000ms to < 5ms.
- **TLS Handshake Overhead**: Reduced from 3 handshakes to 1 handshake per request, saving 600ms ~ 1000ms on sequential calls.
- **Total Pipeline Latency**: Dropped from 7.2s ~ 9.1s to **1.5s ~ 2.5s** (72% performance improvement).

---

## 2. ADR-009: Replacing static rewrites with Next.js dynamic API routing

### Context

Deploying the static export frontend (`output: 'export'`) to Azure Static Web Apps (SWA) caused all API calls to throw a `500 Connection Refused` error pointing to `::1:7071`.

- **Root Cause**: During compile-time (`npm run build`), the Next.js compiler statically evaluated and baked the `next.config.mjs` `rewrites` configuration into the generated static HTML. Since there was no running backend environment during compilation, it hardcoded the API base to the fallback `http://localhost:7071`.

### Decision

1. **Strip** all compile-time rewrite configurations from `next.config.mjs`.
2. **Create** a catch-all dynamic route at `app/api/[...path]/route.ts`.
3. **Inject** the config `export const dynamic = "force-dynamic"` to bypass build-time static HTML baking, routing API requests dynamically at runtime using the internal Container App DNS FQDN: `http://omni-backend.internal.<default-domain>/api/`.

### Consequences

- **Build-Time Errors**: Dropped to **0** (no hardcoded ports in generated static files).
- **CORS Blocks**: Reduced to **0** (all API routing resolved internally).

---

## 3. ADR-011: Fixing POST 405 Method Not Allowed due to trailingSlash redirection

### Context

When the frontend sent POST requests to `/api/simulate_agent`, the backend Container App rejected the requests with an HTTP `405 Method Not Allowed` error.

- **Root Cause**: Next.js was configured with `trailingSlash: true` in `next.config.mjs`. When a request was sent to `/api/simulate_agent`, Next.js returned a `308 Permanent Redirect` pointing to `/api/simulate_agent/`.
- The browser automatically converted the `POST` request to a `GET` request on redirection, which was rejected by the backend FastAPI route.
- Furthermore, the `[...path]` split segments parsed by Next.js included an empty trailing segment `['simulate_agent', '']`. Re-joining them produced `/api/simulate_agent/` which failed to match the FastAPI route `/api/simulate_agent`.

### Decision

1. **Force** frontend requests to match target routes without triggering redirects.
2. **Filter** out empty array slots in the dynamic proxy path parser inside `route.ts` before re-joining: `const cleanPath = pathSegments.filter(Boolean).join('/')`.

### Consequences

- **HTTP Redirects**: Dropped from 1 to **0** per request.
- **Routing Mismatches**: Reduced to **0%**, completely eliminating 405 errors.

---

# 架构决策记录：Azure Container Apps (ACA) 迁移与网络优化决策矩阵

> **文档状态**：已批准（架构决策记录 / Architecture Decision Records）
> **参考**：ADR-008, ADR-009, ADR-010, ADR-011

---

## ADR-008：通过移除 WEBSITE_DNS_SERVER 消除 DNS 超时

### 背景

将后端 API 部署到 Azure Functions（东南亚）的生产环境后，端到端遥测响应延迟增加到每次请求 **7.0s - 9.1s**。相比之下，本地主机运行的延迟仅为 **3.5s - 4.5s**。

网络路由检查发现，在初始套接字连接到外部 Azure 端点时存在一致的 **5.0 秒延迟**。

- **根本原因**：`WEBSITE_DNS_SERVER` 设置为 `168.63.129.16`（Azure 内部 DNS 解析器），而 `WEBSITE_VNET_ROUTE_ALL` 设置为 `0`（仅将 VNet 路由限制为私有 RFC1918 流量）。
- 由于 `168.63.129.16` 是公有 IP 地址（非 RFC1918），OS 容器通过公网网关路由 DNS 请求而不是 VNet。
- 由于 `168.63.129.16` 仅在内部可达，查询在公网网关超时恰好 **5 秒**后才回退到公共 DNS 解析器。

### 决策

1. 从 compute-module.bicep 模板中**完全移除** `WEBSITE_DNS_SERVER`。
2. 从 Azure App 设置中**删除**环境配置键，允许容器继承处理公共互联网名称和私有 DNS Zone 端点的默认本机解析器。
3. 将 utils.py 中的 `AzureOpenAI` 和 `CosmosClient` 客户端初始化**重构**为全局懒加载单例，以通过 HTTP Keep-Alive 重用已建立的 TCP 连接。

### 结果

- **DNS 查询延迟**：从 5000ms 降至 < 5ms。
- **TLS 握手开销**：从每次请求 3 次握手减少到 1 次，节省顺序调用 600ms ~ 1000ms。
- **管道总延迟**：从 7.2s ~ 9.1s 降至 **1.5s ~ 2.5s**（性能提升 72%）。

---

## ADR-009：用 Next.js 动态 API 路由替换静态重写

### 背景

将静态导出前端（`output: 'export'`）部署到 Azure Static Web Apps (SWA) 导致所有 API 调用抛出指向 `::1:7071` 的 `500 Connection Refused` 错误。

- **根本原因**：在编译时（`npm run build`），Next.js 编译器静态评估并将 `next.config.mjs` 中的 `rewrites` 配置烘焙到生成的静态 HTML 中。由于编译时没有运行的后端环境，它将 API 基础硬编码为后备 `http://localhost:7071`。

### 决策

1. 从 `next.config.mjs` 中**剥离**所有编译时重写配置。
2. 在 `app/api/[...path]/route.ts` 创建全捕获动态路由。
3. **注入**配置 `export const dynamic = "force-dynamic"` 以绕过构建时静态 HTML 烘焙，在运行时使用内部 Container App DNS FQDN 动态路由 API 请求：`http://omni-backend.internal.<default-domain>/api/`。

### 结果

- **构建时错误**：降至 **0**（生成的静态文件中没有硬编码端口）。
- **CORS 阻止**：减少到 **0**（所有 API 路由在内部解析）。

---

## ADR-011：修复因 trailingSlash 重定向导致的 POST 405 Method Not Allowed

### 背景

当前端向 `/api/simulate_agent` 发送 POST 请求时，后端 Container App 以 HTTP `405 Method Not Allowed` 错误拒绝请求。

- **根本原因**：Next.js 在 `next.config.mjs` 中配置了 `trailingSlash: true`。当请求发送到 `/api/simulate_agent` 时，Next.js 返回指向 `/api/simulate_agent/` 的 `308 Permanent Redirect`。
- 浏览器在重定向时自动将 `POST` 请求转换为 `GET` 请求，被后端 FastAPI 路由拒绝。
- 此外，Next.js 解析的 `[...path]` 拆分段包含一个空的尾随段 `['simulate_agent', '']`。重新连接它们产生 `/api/simulate_agent/`，无法匹配 FastAPI 路由 `/api/simulate_agent`。

### 决策

1. **强制**前端请求匹配目标路由而不触发重定向。
2. 在 `route.ts` 中的动态代理路径解析器重新连接之前，**过滤**掉空的数组槽：`const cleanPath = pathSegments.filter(Boolean).join('/')`。

### 结果

- **HTTP 重定向**：从每次请求 1 次降至 **0** 次。
- **路由不匹配**：减少到 **0%**，完全消除 405 错误。
