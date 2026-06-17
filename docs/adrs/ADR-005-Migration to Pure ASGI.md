# Architectural Decision Record (ADR 004)

## Title

ADR 004: Pure ASGI V2 Topology and Inference Parameter Alignment for Project-OmniGuard Streaming Hub

---

## Status

**Approved**

---

## Context / Context Background

During the structural migration of the Project-OmniGuard compute plane to the Southeast Asia (Singapore) greenfield infrastructure, the streaming backend (DigitalHuman Brain) experienced critical platform-level failures:

* **Hybrid Binding Collisions**: Mixing native Azure Functions V2 HTTP worker decorators with FastAPI `Request`/`Response` parameters triggered silent serialization errors inside the Azure Functions Host, returning empty `400 Bad Request` packets.
* **Gateway Routing Slashes**: The default runtime routing engine clashed with FastAPI's native routing trees, appending overlapping prefixes to construct an illegal double-slash template (`api//{*route}`), crashing the worker process during startup.
* **Reasoning Model Enforcement**: The newly provisioned `gpt-5.4-mini` (Global Standard) deployment enforced strict structural parameter requirements, throwing `400 / 404 DeploymentNotFound` validation errors when fed legacy hyperparameters like `temperature` or deprecated system roles under outdated API versions.
* **Compute Plane Bottlenecks**: Running 4 concurrent Python worker processes over a single-core Basic B1 instance choked the host during Oryx remote builds and runtime cold starts, pinning vCPU utilization at 100% and causing 3-minute request timeouts.

---

## Decision Drivers

* **Strip Third-Party Risks**: Eliminate brittle, poorly maintained middleware wrappers (e.g., `azurefunctions-extensions-http-fastapi`) to guarantee long-term runtime stability.
* **Maximize Stream Throughput**: Achieve unbuffered Server-Sent Events (SSE) token delivery with a cross-border target latency of `<15ms`.
* **Lock Environment Idempotency**: Enforce exact configuration parity between local sandboxes (`local.settings.json`) and cloud environments (`Application Settings`).

---

## Considered Options & Trade-offs

### Option 1: Legacy HTTP Worker via Static Web App (SWA) Production Proxy

* **Pros**: Native binding validation and isolated virtual networks without cross-origin configuration overhead.
* **Cons**: SWA's 7-layer gateway forces aggressive response buffering, hoarding streaming tokens in memory until buffers fill, completely destroying real-time typing effects.

### Option 2: Pure Native Azure Functions V2 with Core ASGI Integration

* **Pros**: Hands 100% of routing sovereignty over to FastAPI; allows direct proxying of raw HTTP traffic with `X-Accel-Buffering: no` to kill buffering delays; drops external dependencies to maintain a pristine, lightweight deployment footprint.
* **Cons**: Demands manual cross-origin resource sharing (CORS) alignment at both the code level and the cloud platform gateway.

---

## Selected Decision

We selected **Option 2**. We bypassed unstable extension wrappers and anchored the architecture to the native `func.AsgiFunctionApp` framework. We wiped out the host-level `routePrefix` to hand full path resolution over to FastAPI, implemented strict payload cleansing for reasoning models, and scaled the underlying hardware to a B2 instance with targeted core-to-process thread limits.

---

## Implementation Details

### 1. Gateway Route Optimization (`host.json`)

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

### 2. Stream Architecture Core (`function_app.py`)

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
                "X-Accel-Buffering": "no"  # Critical: Disables proxy-level buffering
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

### 3. Production Dependency Manifest (`requirements.txt`)

```text
azure-functions
openai
azure-storage-blob
fastapi

```

---

## Consequences & Metrics

* **Dependency Stability**: Eradicated `ModuleNotFoundError` and `AttributeError` from the cloud runtime by enforcing an explicit, standard-library-first dependency tree.
* **Cold-Start Slashed**: Upgrading to a B2 instance (2 vCPUs, 3.5GB RAM) and constraining the orchestration variables (`PROCESS_COUNT=2`, `THREAD_COUNT=16`) cut application initialization times from 180 seconds down to **15 seconds**.
* **CORS Blockades Defeated**: Aligning the FastAPI middleware layers to `allow_credentials=False` completely resolved cross-origin handshake rejections, unblocking direct `localhost:3000` to remote cloud function execution.
* **Instantaneous Fluid Streaming**: Bypassed proxy aggregation buffers entirely, allowing fine-grained, token-by-token character typing directly onto the client interface.