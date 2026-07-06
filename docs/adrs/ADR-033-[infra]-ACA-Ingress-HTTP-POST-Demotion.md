# Architectural Decision Record (ADR 033)
# 架构决策记录 (ADR 033)

## Title / 标题
ACA Internal Ingress HTTP-to-HTTPS Redirect Causing POST-to-GET Demotion — Allow-Insecure & Env-Var Unification
ACA 内部 Ingress HTTP→HTTPS 重定向导致 POST 降级为 GET——Allow-Insecure 与环境变量统一治理

## Status / 状态
**Approved / 已批准**

## Context / 背景

The frontend proxy (`src/client-edge/src/app/api/[...path]/route.ts`) forwards all `/api/*` HTTP requests from the Next.js ACA container to the backend ACA container via an internal DNS name (`http://omni-backend.internal.*.azurecontainerapps.io`).

The backend ACA was provisioned with `ingress.allowInsecure: false` (the default). This caused the internal Envoy ingress to return a **302 redirect** from HTTP to HTTPS for every request.

Node.js `fetch` (with default `redirect: 'follow'`) follows the 302 redirect but, per the HTTP/1.1 spec for 301/302, **changes the method from POST to GET**. The backend FastAPI receives `GET /api/simulate_agent` instead of `POST /api/simulate_agent` and returns `405 Method Not Allowed`.

This is distinct from the previously-documented Next.js `trailingSlash: true` 308 redirect issue — that occurred at the browser level and was fixed via `pathSegments.filter(Boolean).join('/')`. The ACA-level redirect is an infrastructure behavior invisible to the frontend code.

Additionally, the backend Python modules use three different sets of environment variable names for Azure OpenAI credentials (`OPENAI_*`, `AZURE_OPENAI_*`, `OPENAI_API_*`), but the Bicep templates only provisioned `OPENAI_API_KEY` and `OPENAI_DEPLOYMENT_NAME`, causing "Azure OpenAI credentials missing" or wrong-deployment-name 502 errors.

前端 proxy 通过内部 DNS 用 HTTP 转发 `/api/*` 请求到 backend ACA。backend ACA 的 `ingress.allowInsecure` 默认为 `false`，导致内部 Envoy 返回 302 重定向到 HTTPS。Node.js `fetch` 跟随 302 时将 POST 降级为 GET，后端 FastAPI 收到 GET 返回 405。

这与之前 Next.js `trailingSlash` 的 308 重定向问题不同——那个发生在浏览器层，已通过 `filter(Boolean)` 修复。ACA 层重定向前端代码完全不可见。

此外，后端 Python 模块使用了三种不同的环境变量名（`OPENAI_*`、`AZURE_OPENAI_*`、`OPENAI_API_*`），但 Bicep 模板只注入了 `OPENAI_API_KEY` 和 `OPENAI_DEPLOYMENT_NAME`，导致凭据缺失或部署名错误。

## Decision Drivers / 决策驱动因素

- Backend ACA is internal-only (`external: false`); HTTPS between containers within the same ACA environment adds no security benefit but breaks POST requests
- The project uses a mixed-subscription model — the deployment subscription lacks Azure OpenAI quota; credentials come from a different subscription and are stored in `local.settings.json`, not Key Vault
- Three Python modules (`digitalhuman/router.py`, `embodied_brain/utils.py`, `kol_analysis/inference_engine.py`) use different env-var naming conventions, creating maintenance overhead
- Manual env-var overrides via `az containerapp update --set-env-vars` are lost on the next `az containerapp update --image`

- backend ACA 仅为内部访问（`external: false`），同一 ACA 环境内的容器间 HTTPS 无安全收益但破坏 POST 请求
- 项目使用混合订阅模式——部署订阅无 OpenAI 额度，凭据来自不同订阅并存储在 `local.settings.json` 而非 Key Vault
- 三个 Python 模块使用了不同的环境变量命名约定，增加了维护成本
- 通过 `az containerapp update --set-env-vars` 的手动覆盖在下次 `--image` 更新时会丢失

## Decision / 决策

### 1. Allow Insecure on Backend ACA Ingress
Set `ingress.allowInsecure: true` on the backend ACA to disable the HTTP→HTTPS redirect for internal traffic. Persisted in all three Bicep templates (`.azure/compute-module.bicep`, sandbox, secure-iot).

### 2. Local-First Env-Var Injection via deploy-aca.sh
Modify `sh/deploy-aca.sh` to read `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and deployment name from `local.settings.json` and inject them as ACA environment variables on every deployment. This bypasses the Key Vault reference that was automatically inserted by `deployManagedIdentities: true` with an empty/expired secret.

The script injects both `OPENAI_*` and `AZURE_OPENAI_*` variants to satisfy all three Python modules. If the local file is absent, the existing ACA env vars (including the Key Vault reference) are preserved unchanged.

### 3. Update Python utils.py for Resilient Env-Var Resolution
Modify `embodied_brain/utils.py` to try `OPENAI_*` → `OPENAI_DEPLOYMENT_NAME` → `AZURE_OPENAI_*` in sequence, matching the pattern already used by `kol_analysis/inference_engine.py`.

### 4. Bicep Template Augmentation
Add `openAiEndpoint` parameter and populate all missing env-var variants (`OPENAI_API_DEPLOYMENT_NAME`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`) in all three Bicep templates for consistency during greenfield provisioning.

### 1. Backend ACA 允许不安全流量
设置 `allowInsecure: true` 禁用内部 HTTP→HTTPS 重定向。已写入全部三个 Bicep 模板。

### 2. deploy-aca.sh 本地优先注入
修改部署脚本，每次部署时从 `local.settings.json` 读取 OpenAI 凭据注入为 ACA 环境变量。同时注入 `OPENAI_*` 和 `AZURE_OPENAI_*` 两种变体。本地文件不存在时保留 ACA 现有值不变。

### 3. Python utils.py 弹性变量解析
`utils.py` 按 `OPENAI_*` → `OPENAI_DEPLOYMENT_NAME` → `AZURE_OPENAI_*` 顺序回退，与 `inference_engine.py` 一致。

### 4. Bicep 模板补充
新增 `openAiEndpoint` 参数，补齐所有 `AZURE_OPENAI_*` 和 `OPENAI_API_DEPLOYMENT_NAME` 环境变量。

## Consequences / 后果

### Positive / 正向
- POST method is preserved end-to-end between frontend proxy and backend FastAPI
- `make deploy-aca` automatically injects working credentials from the developer's local configuration
- All three Python modules can resolve OpenAI credentials regardless of which env-var convention is used
- Greenfield provisioning via Bicep includes all necessary env vars out of the box

### Negative / 负向
- `allowInsecure: true` permits plaintext HTTP within the ACA environment; acceptable because the backend is internal-only
- `local.settings.json` contains plaintext API keys; these are now injected into ACA env vars on each deploy, creating a secret-management gap if multiple developers share the deployment
- The deploy script currently reads only one local file; a CI/CD pipeline would need a different mechanism

### Positive / 正向
- POST 方法在 proxy 与 backend 间完整保留
- `make deploy-aca` 自动注入开发者本地配置中的有效凭据
- 三个 Python 模块均可解析 OpenAI 凭据，不受变量名差异影响
- 全新部署时 Bicep 内置所有必要环境变量

### Negative / 负向
- `allowInsecure: true` 允许 ACA 内部明文 HTTP；因 backend 仅内部访问可接受
- `local.settings.json` 包含明文 API key，每次部署注入到 ACA env vars；多开发者共享部署时需管理密钥同步
- 部署脚本仅读取本地文件；CI/CD 流水线需不同机制
