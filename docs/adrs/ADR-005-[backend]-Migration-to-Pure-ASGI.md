# Architectural Decision Record (ADR 005)
# 架构决策记录 (ADR 005)

## Title / 标题

ADR 005: Pure ASGI V2 Topology and Inference Parameter Alignment for Project-OmniGuard Streaming Hub
ADR 005: Project-OmniGuard 流式中枢的纯 ASGI V2 拓扑与推理参数对齐

---

## Status / 状态

**Approved / 已批准**

---

## Context / 背景

During the structural migration of the Project-OmniGuard compute plane to the Southeast Asia (Singapore) greenfield infrastructure, the streaming backend (DigitalHuman Brain) experienced critical platform-level failures:

在 Project-OmniGuard 计算平面向东南亚（新加坡）新基础设施迁移期间，流式后端（数字人大脑）遇到了严重的平台级故障：

* **Hybrid Binding Collisions / 混合绑定冲突**: Mixing native Azure Functions V2 HTTP worker decorators with FastAPI `Request`/`Response` parameters triggered silent serialization errors inside the Azure Functions Host, returning empty `400 Bad Request` packets. 混合使用原生 Azure Functions V2 HTTP worker 装饰器与 FastAPI `Request`/`Response` 参数，在 Azure Functions Host 内部触发了静默序列化错误，返回空 `400 Bad Request` 包。
* **Gateway Routing Slashes / 网关路由斜杠冲突**: The default runtime routing engine clashed with FastAPI's native routing trees, appending overlapping prefixes to construct an illegal double-slash template (`api//{*route}`), crashing the worker process during startup. 默认运行时路由引擎与 FastAPI 原生路由树冲突，追加了重叠前缀，形成非法双斜杠模板 (`api//{*route}`)，导致工作进程在启动时崩溃。
* **Reasoning Model Enforcement / 推理模型强制要求**: The newly provisioned `gpt-5.4-mini` (Global Standard) deployment enforced strict structural parameter requirements, throwing `400 / 404 DeploymentNotFound` validation errors when fed legacy hyperparameters like `temperature` or deprecated system roles under outdated API versions. 新部署的 `gpt-5.4-mini`（Global Standard）强制执行严格的结构化参数要求，在收到 `temperature` 等旧版超参数或过时 API 版本下的已弃用 system roles 时抛出 `400 / 404 DeploymentNotFound` 验证错误。
* **Compute Plane Bottlenecks / 计算平面瓶颈**: Running 4 concurrent Python worker processes over a single-core Basic B1 instance choked the host during Oryx remote builds and runtime cold starts, pinning vCPU utilization at 100% and causing 3-minute request timeouts. 在单核 Basic B1 实例上运行 4 个并发 Python 工作进程，在 Oryx 远程构建和运行时冷启动期间阻塞了主机，vCPU 利用率达到 100%，导致 3 分钟请求超时。

---

## Decision Drivers / 决策驱动因素

* **Strip Third-Party Risks / 消除第三方风险**: Eliminate brittle, poorly maintained middleware wrappers (e.g., `azurefunctions-extensions-http-fastapi`) to guarantee long-term runtime stability. 消除脆弱且维护不善的中间件包装器，确保长期运行时稳定性。
* **Maximize Stream Throughput / 最大化流吞吐量**: Achieve unbuffered Server-Sent Events (SSE) token delivery with a cross-border target latency of `<15ms`. 实现无缓冲的 SSE Token 传输，跨境目标延迟 `<15ms`。
* **Lock Environment Idempotency / 锁定环境幂等性**: Enforce exact configuration parity between local sandboxes (`local.settings.json`) and cloud environments (`Application Settings`). 强制本地沙箱与云环境之间配置完全一致。

---

## Considered Options & Trade-offs / 考虑方案与权衡

### Option 1: Legacy HTTP Worker via Static Web App (SWA) Production Proxy
### 方案一：通过 SWA 生产代理的传统 HTTP Worker

* **Pros / 优势**: Native binding validation and isolated virtual networks without cross-origin configuration overhead. 原生绑定验证和隔离虚拟网络，无跨域配置开销。
* **Cons / 劣势**: SWA's 7-layer gateway forces aggressive response buffering, hoarding streaming tokens in memory until buffers fill, completely destroying real-time typing effects. SWA 的 7 层网关强制激进响应缓冲，在内存中囤积流式 Token 直到缓冲区填满，彻底破坏了实时打字效果。

### Option 2: Pure Native Azure Functions V2 with Core ASGI Integration
### 方案二：原生 Azure Functions V2 + 核心 ASGI 集成

* **Pros / 优势**: Hands 100% of routing sovereignty over to FastAPI; allows direct proxying of raw HTTP traffic with `X-Accel-Buffering: no` to kill buffering delays; drops external dependencies to maintain a pristine, lightweight deployment footprint. 将 100% 路由主权交给 FastAPI；允许通过 `X-Accel-Buffering: no` 直接代理原始 HTTP 流量以消除缓冲延迟；移除外部依赖，保持干净轻量的部署足迹。
* **Cons / 劣势**: Demands manual cross-origin resource sharing (CORS) alignment at both the code level and the cloud platform gateway. 需要在代码层和云平台网关层手动对齐 CORS。

---

## Selected Decision / 选定决策

We selected **Option 2**. We bypassed unstable extension wrappers and anchored the architecture to the native `func.AsgiFunctionApp` framework. We wiped out the host-level `routePrefix` to hand full path resolution over to FastAPI, implemented strict payload cleansing for reasoning models, and scaled the underlying hardware to a B2 instance with targeted core-to-process thread limits.

我们选择了**方案二**。绕过了不稳定的扩展包装器，将架构锚定到原生 `func.AsgiFunctionApp` 框架。清除了主机级 `routePrefix`，将完整路径解析交给 FastAPI，为推理模型实现了严格的有效负载清洗，并将底层硬件扩展到 B2 实例，配置了针对性的核心到进程线程限制。

---

## Implementation Details / 实现细节

### 1. Gateway Route Optimization / 网关路由优化 (`host.json`)

```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  },
  "extensions": {
    "http": {
      "routePrefix": ""
    }
  }
}
```

### 2. Stream Architecture Core / 流式架构核心 (`function_app.py`)

```python
import json
import os
import traceback
import azure.functions as func
from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

fastapi_app = FastAPI()

# Strict W3C Compliance: allow_credentials MUST be False when allow_origins is ["*"]
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@fastapi_app.post("/api/chat/stream")
async def chat_proxy(request: Request):
    try:
        req_body = await request.json()
        user_message = req_body.get("message", "")

        OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
        DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5.4-mini")
        OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")

        from openai import AsyncAzureOpenAI
        client = AsyncAzureOpenAI(
            azure_endpoint=OPENAI_ENDPOINT,
            api_key=OPENAI_API_KEY,
            api_version="2024-10-01-preview"
        )

        # Defensive Parameter Sanitization for Modern Reasoning Models
        response = await client.chat.completions.create(
            model=DEPLOYMENT_NAME,
            messages=[
                {"role": "system", "content": "You are Shengwei's Streaming Avatar."},
                {"role": "user", "content": user_message}
            ],
            max_completion_tokens=4000,
            stream=True
        )

        async def stream_factory():
            async for chunk in response:
                if chunk.choices and len(chunk.choices) > 0:
                    text = chunk.choices[0].delta.content or ""
                    if text:
                        yield text

        return StreamingResponse(
            stream_factory(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    except Exception as e:
        return Response(
            content=json.dumps({"error": str(e), "traceback": traceback.format_exc()}),
            status_code=400,
            media_type="application/json"
        )

# Direct ASGI Mapping Assignment
app = func.AsgiFunctionApp(app=fastapi_app, http_auth_level=func.AuthLevel.ANONYMOUS)
```

### 3. Production Dependency Manifest / 生产依赖清单 (`requirements.txt`)

```text
azure-functions
openai
azure-storage-blob
fastapi
```

---

## Consequences & Metrics / 后果与指标

* **Dependency Stability / 依赖稳定性**: Eradicated `ModuleNotFoundError` and `AttributeError` from the cloud runtime by enforcing an explicit, standard-library-first dependency tree. 通过强制执行以标准库优先的显式依赖树，从云运行时中消除了 `ModuleNotFoundError` 和 `AttributeError`。
* **Cold-Start Slashed / 冷启动大幅降低**: Upgrading to a B2 instance (2 vCPUs, 3.5GB RAM) and constraining the orchestration variables (`PROCESS_COUNT=2`, `THREAD_COUNT=16`) cut application initialization times from 180 seconds down to **15 seconds**. 升级到 B2 实例（2 vCPU，3.5GB 内存）并限制编排变量，将应用初始化时间从 180 秒降至 **15 秒**。
* **CORS Blockades Defeated / 攻克 CORS 封锁**: Aligning the FastAPI middleware layers to `allow_credentials=False` completely resolved cross-origin handshake rejections, unblocking direct `localhost:3000` to remote cloud function execution. 将 FastAPI 中间层对齐到 `allow_credentials=False`，完全解决了跨域握手拒绝问题，解除了从 `localhost:3000` 直接调用远程云函数的阻塞。
* **Instantaneous Fluid Streaming / 瞬时流畅流式传输**: Bypassed proxy aggregation buffers entirely, allowing fine-grained, token-by-token character typing directly onto the client interface. 完全绕过了代理聚合缓冲区，实现了细粒度的、逐 Token 的字符直接输入到客户端界面。
