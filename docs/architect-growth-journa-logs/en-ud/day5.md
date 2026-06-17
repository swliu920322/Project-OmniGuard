
## Day 5 | English Version: Compute Escalation & Stream Hub Alignment

Today's execution focused on migrating and upgrading the Project-OmniGuard streaming backend (DigitalHuman Brain) onto the Southeast Asia (Singapore) greenfield infrastructure.

### 1. Web Worker Compilation Fix

* **Issue**: Web Worker threads threw iteration degradation errors (`MapIterator`) during the build phase, stalling the Next.js CI/CD pipeline.
* **Fix**: Stripped all legacy `for...of` loops over map structures. Replaced them with native `Map.prototype.forEach` and activated the `downlevelIteration` compiler flag in `tsconfig.json` to ensure zero-overhead builds.

### 2. Compute Upgrade & FinOps Realignment (B1 to B2)

* **Issue**: The low-tier Basic B1 instance choked under 4 concurrent Python worker processes competing over 1 single vCPU core, resulting in long cold-start delays (>180s) and Oryx remote compile stalls.
* **Fix**: Upgraded the compute tier to a **B2 instance (2 vCPUs, 3.5 GB RAM)**. Patched `infra-up.sh` to enforce `PROCESS_COUNT=2` and `THREAD_COUNT=16`. This 1:1 process-to-core binding **slashed cold-start latency from 3 minutes down to ~15 seconds**.

### 3. ASGI Topology & Reasoning Model Protocol Sync

* **Issue**: Mixing native Azure Functions V2 HTTP decorators with FastAPI routing arguments injected parameter binding violations, returning blank HTTP 400 errors. Concurrently, the newly provisioned `gpt-5.4-mini` model rejected historical parameters like `temperature`.
* **Fix**: Migrated to a pure ASGI topology driven by `func.AsgiFunctionApp`. Cleared the host-level `routePrefix` in `host.json` to eliminate route-doubling bugs. Cleansed the LLM request payload by removing hyperparameter noise and targeting `max_completion_tokens` directly.

### 4. Verification Metrics

* **W3C CORS Resolution**: Enforced `allow_credentials=False` inside the FastAPI `CORSMiddleware` block. This satisfied W3C wildcard requirements, unblocking direct `localhost:3000` traffic to the Singapore compute nodes.
* **Streaming Throughput**: Injected the `X-Accel-Buffering: no` header into the response stream. This bypassed all upstream proxy buffers, delivering instant token-by-token rendering to the front-end client.