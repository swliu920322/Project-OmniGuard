## Day 5 | 中文版复盘：计算平面升档与流式中枢合拢

今日强攻 Project-OmniGuard 后端大模型流式打弹中枢。在东南亚（新加坡）全新绿色资源组中完成了算力盘点与通信合拢。

### 1. 编译平面自愈

* **痛点**：Web Worker 独立线程在编译期触发 `MapIterator` 降级断层，导致 Next.js 流水线熔断。
* **解法**：全面抹除 `for...of` 中间态迭代器指针，改用原生无视版本的 `Map.prototype.forEach`，配合 `tsconfig.json` 的 `downlevelIteration` 安全引信，实现打包流水线零配置全量通车。

### 2. 算力规格刚性升档 (B1 ➔ B2)

* **痛点**：Basic B1 实例（1核 1.75G）在云端遭遇 4 个 Python 进程强行踩踏，单核 vCPU 在冷启动与 Oryx 远程编译时被瞬间绞杀至 100% 假死状态。
* **解法**：刚性升级为 **B2 满血版实例（2核 3.5G）**。在 `infra-up.sh` 脚本中限制 `PROCESS_COUNT=2`、`THREAD_COUNT=16`。进程与物理核心 1:1 刚性解耦，**冷启动时间从 3分钟 暴跌至 15秒 弹射通车**。

### 3. ASGI 协议与模型参数洗涤

* **痛点**：旧架构混用 Azure Functions V2 装饰器与 FastAPI 实体，触发 Host 层参数绑定违规反弹 400 错误。同时，新推理模型 `gpt-5.4-mini` 拦截了历史遗留的 `temperature` 与 `max_tokens` 参数。
* **解法**：全面实施 **ASGI 托管模式**（`func.AsgiFunctionApp`）。清空 `host.json` 中的 `routePrefix`，将路由主权 100% 下放给 FastAPI。重构大模型 Payload 请求体，剔除温控杂质，将 `max_tokens` 靶向升级为 `max_completion_tokens`。

### 4. 物理通车指标验证

* **CORS 门禁对齐**：FastAPI 中间件强制配置 `allow_credentials=False`。释放 `*` 通配符最高主权，彻底平平本地 `localhost:3000` 跨域直连真机的 400 熔断阻尼。
* **吞吐性能**：注入 `X-Accel-Buffering: no` 响应头，完全掐死代理层的 4KB 缓冲死锁，实现 0 字节延迟的实时 Token 弹射。

---
