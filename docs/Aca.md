# Blueprint 007: IaC Topology Refactoring for Azure Container Apps (ACA)

> **Document Status**: Active / IaC Execution Phase
> **Target**: Refactor the `.azure/` Bicep templates to completely deprecate Azure Functions/SWA and orchestrate a zero-trust ACA environment in `southeastasia`.
> **FinOps Strategy**: Utilize ACA Consumption Tier but force `minReplicas=1` and high vCPU allocations to eliminate cold starts while maintaining cost efficiency.

## 1. Deprecation & Cleanup (斩断旧基建)
**Action for Agy:**
Scan the existing `.azure/` directory (specifically `compute-module.bicep` or equivalent).
* **DELETE** all resource definitions for `Microsoft.Web/staticSites` (Azure Static Web Apps).
* **DELETE** all resource definitions for `Microsoft.Web/serverfarms` (App Service Plan) and `Microsoft.Web/sites` (Azure Functions).
* *Architectural Intent*: We are migrating to a pure containerized compute plane. No dead IaC code is allowed.

## 2. New Infrastructure Components (注入新基建)
**Action for Agy:**
Introduce the following new Azure native resources into the Bicep templates. **ALL resources MUST be strictly localized to `location: 'southeastasia'`**.

### A. Azure Container Registry (ACR)
* **Resource**: `Microsoft.ContainerRegistry/registries`
* **SKU**: `Basic`
* **Purpose**: To host the Dockerized Next.js and FastAPI images.

### B. Log Analytics Workspace
* **Resource**: `Microsoft.OperationalInsights/workspaces`
* **Purpose**: Mandatory prerequisite for ACA environments to sink telemetry and stdout logs.

### C. Container Apps Environment (The VNet Boundary)
* **Resource**: `Microsoft.App/managedEnvironments`
* **Config**: Link it to the Log Analytics Workspace.
* **Purpose**: Creates the secure subnet boundary for our containers.

### D. Backend Container App (FastAPI / brain.py)
* **Resource**: `Microsoft.App/containerApps`
* **Ingress**: `external: false` (CRITICAL: Internal VNet traffic ONLY. Zero Trust boundary).
* **Target Port**: `8000`
* **Scale**: `minReplicas: 1`, `maxReplicas: 3` (Eliminates cold start).
* **Compute**: `cpu: 1.0`, `memory: 2.0Gi` (High compute for fast OpenAI TLS handshakes).
* **Secrets/Env**: Pass Cosmos DB and OpenAI keys here.

### E. Frontend Container App (Next.js Dashboard)
* **Resource**: `Microsoft.App/containerApps`
* **Ingress**: `external: true` (Public internet access enabled).
* **Target Port**: `3000`
* **Scale**: `minReplicas: 1`, `maxReplicas: 2`.
* **Compute**: `cpu: 0.5`, `memory: 1.0Gi`.
* **Env Variable**: `BACKEND_API_URL` must point to the internal FQDN of the Backend ACA (e.g., `http://<backend-app-name>.internal`).

## 3. Deployment Flow (Execution Verification)
Once Agy updates the Bicep files, it must provide the exact Azure CLI commands (`az deployment group create` or `make provision`) for the user to execute the infrastructure spin-up.