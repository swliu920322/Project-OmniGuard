# 蓝图 08: CI/CD 与 DevOps 流水线

> **领域**: DevOps | **优先级**: P1 | **复杂度**: 中 | **预估工时**: 2~3天

---

## 1. 现状分析

### 当前做法
- 部署通过 `sh/` 下 Shell 脚本手动执行
- 无持续集成 (CI) — 代码提交无自动检查
- 无持续部署 (CD) — 手动 `az containerapp update`
- Bicep 模板无 Lint 校验
- 无部署审批流程
- 无自动化测试

### 脚本清单

| 脚本 | 作用 | 自动化 |
|------|------|--------|
| `sh/provision.sh` | 部署 Bicep 基础设施 | 手动 |
| `sh/infra-up.sh` | 完整部署 + AI provider 选择 | 手动 |
| `sh/deploy-aca.sh` | Docker build + push + ACA rollout | 手动 |
| `sh/deploy-core.sh` | Functions publish | 手动 |
| `sh/destroy.sh` | 销毁资源 | 手动 |

---

## 2. 目标架构

```
GitHub Repository
  │
  ├── Push to main / PR
  │       │
  │       ▼
  │  GitHub Actions (CI)
  │  ├── Lint (Bicep + Python + TypeScript)
  │  ├── Type Check (tsc —noEmit)
  │  ├── Unit Tests (pytest / jest)
  │  └── Build (Docker build, dry-run)
  │
  ├── Merge to main
  │       │
  │       ▼
  │  GitHub Actions (CD)
  │  ├── Bicep Validate + What-If
  │  ├── Deploy Infra (az deployment)
  │  ├── Build & Push Docker to ACR
  │  ├── Deploy ACA (Blue/Green)
  │  └── Smoke Test (health check)
  │
  └── Tag (v*.*.*) → Production
          │
          ▼
     GitHub Actions (Prod CD)
      ├── Deploy to Production
      └── Approval Gate Required
```

---

## 3. 实施步骤

### Step 1: GitHub Actions CI Workflow

创建 `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Bicep Lint
        run: |
          az bicep build --file .azure/main.bicep

      - name: Python Lint
        run: |
          pip install ruff
          ruff check src/cloud-orchestrator/

      - name: TypeScript Lint
        run: |
          cd src/client-edge
          npm ci
          npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Python Tests
        run: |
          cd src/cloud-orchestrator
          pip install -r requirements.txt
          pytest tests/ || echo "No tests yet"
      - name: TypeScript Tests
        run: |
          cd src/client-edge
          npm ci
          npm test || echo "No tests yet"

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Backend Docker
        run: docker build -t backend:ci ./src/cloud-orchestrator
      - name: Build Frontend Docker
        run: docker build -t frontend:ci ./src/client-edge
```

### Step 2: GitHub Actions CD Workflow

创建 `.github/workflows/cd.yml`:

```yaml
name: CD
on:
  push:
    branches: [main]

jobs:
  deploy-infra:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Bicep Validate
        run: |
          az bicep build --file .azure/main.bicep
          az deployment group validate \
            --resource-group ${{ vars.RESOURCE_GROUP }} \
            --template-file .azure/main.bicep \
            --parameters location=southeastasia prefix=omni

      - name: Bicep What-If
        run: |
          az deployment group what-if \
            --resource-group ${{ vars.RESOURCE_GROUP }} \
            --template-file .azure/main.bicep \
            --parameters location=southeastasia prefix=omni

      - name: Deploy Bicep
        run: |
          az deployment group create \
            --resource-group ${{ vars.RESOURCE_GROUP }} \
            --template-file .azure/main.bicep \
            --parameters location=southeastasia prefix=omni

  deploy-app:
    needs: deploy-infra
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Build & Push Backend
        run: |
          az acr login --name ${{ vars.ACR_NAME }}
          docker build -t ${{ vars.ACR_NAME }}.azurecr.io/omni-backend:${{ github.sha }} ./src/cloud-orchestrator
          docker push ${{ vars.ACR_NAME }}.azurecr.io/omni-backend:${{ github.sha }}

      - name: Build & Push Frontend
        run: |
          docker build -t ${{ vars.ACR_NAME }}.azurecr.io/omni-frontend:${{ github.sha }} ./src/client-edge
          docker push ${{ vars.ACR_NAME }}.azurecr.io/omni-frontend:${{ github.sha }}

      - name: Deploy Backend ACA
        run: |
          az containerapp update \
            --name omni-backend \
            --resource-group ${{ vars.RESOURCE_GROUP }} \
            --image ${{ vars.ACR_NAME }}.azurecr.io/omni-backend:${{ github.sha }} \
            --revision-suffix "pr-${{ github.sha }}"

      - name: Deploy Frontend ACA
        run: |
          az containerapp update \
            --name omni-frontend \
            --resource-group ${{ vars.RESOURCE_GROUP }} \
            --image ${{ vars.ACR_NAME }}.azurecr.io/omni-frontend:${{ github.sha }} \
            --revision-suffix "pr-${{ github.sha }}"

      - name: Smoke Test
        run: |
          FRONTEND_URL=$(az containerapp show -n omni-frontend -g ${{ vars.RESOURCE_GROUP }} --query properties.configuration.ingress.fqdn -o tsv)
          curl -f --retry 3 --retry-delay 10 "https://$FRONTEND_URL/"
```

### Step 3: GitHub Environment + Approval

```yaml
# .github/workflows/cd-prod.yml
name: CD Production
on:
  push:
    tags: ['v*']

jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment: production  # Requires approval in GitHub
    steps:
      - uses: actions/checkout@v4
      # ... similar but with production resource group
```

### Step 4: 本地开发体验

```makefile
# Makefile 已有, 增强
.PHONY: ci cd lint test

lint:  ## 本地运行 lint
	az bicep build --file .azure/main.bicep
	ruff check src/cloud-orchestrator/
	cd src/client-edge && npm run lint

test:  ## 本地运行测试
	cd src/cloud-orchestrator && pytest || true
	cd src/client-edge && npm test || true

ci: lint test  ## 本地模拟 CI

cd:  ## 本地部署 (CI 环境变量兼容)
	@echo "=== DEPLOY INFRA ===" && sh/sh/provision.sh
	@echo "=== DEPLOY APPS ===" && sh/sh/deploy-aca.sh
```

---

## 4. GitHub Secrets 配置

| Secret | 用途 | 来源 |
|--------|------|------|
| `AZURE_CREDENTIALS` | Service Principal JSON | `az ad sp create-for-rbac` |
| `ACR_NAME` | 容器注册表名 | Bicep 输出 |
| `RESOURCE_GROUP` | 资源组 | Bicep 输出 |
| `AZURE_SUBSCRIPTION_ID` | 订阅 ID | `az account show` |
| `AZURE_TENANT_ID` | 租户 ID | `az account show` |

---

## 5. 变更清单

| 文件 | 操作 |
|------|------|
| `.github/workflows/ci.yml` | 新增 |
| `.github/workflows/cd.yml` | 新增 |
| `.github/workflows/cd-prod.yml` | 新增 |
| `Makefile` | 增强 lint/test/ci/cd 目标 |

---

## 6. 验收标准

- [ ] PR 创建时自动触发 CI: Lint + Build 通过
- [ ] Merge 到 main 自动触发 CD: Bicep What-If + 部署
- [ ] 部署完成后自动执行 Smoke Test (HTTP 200)
- [ ] 生产环境 tag push 触发, 需 GitHub Environment Approval
- [ ] 本地运行 `make ci` 通过

---

## 7. 参考链接

- [GitHub Actions + Azure Login](https://github.com/marketplace/actions/azure-login)
- [Bicep GitHub Actions](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-github-actions)
- [Container Apps Deploy](https://learn.microsoft.com/en-us/azure/container-apps/containerapps-github-actions)
