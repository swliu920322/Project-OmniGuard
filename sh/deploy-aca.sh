#!/bin/bash
set -euo pipefail

# =========================================================================
# 🚀 Project-OmniGuard: Azure Container Apps (ACA) 容器部署总线
# =========================================================================

PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"

echo "======================================================"
echo "🚀 正在检索部署环境和 Azure 算力节点..."
echo "======================================================"

# 检查 Azure 登录状态
if ! az account show > /dev/null 2>&1; then
  echo "❌ 错误: 未登录 Azure，请先执行 'az login'"
  exit 1
fi

# 检索 ACR 名称
echo "🔍 检索资源组 $RG 中的 Azure Container Registry..."
ACR_NAME=$(az acr list --resource-group "$RG" --query "[0].name" -o tsv 2>/dev/null || true)
if [ -z "$ACR_NAME" ]; then
  echo "❌ 错误: 资源组 $RG 中未找到 Container Registry，请先运行 make provision 部署基础设施！"
  exit 1
fi
echo "🎯 找到 Container Registry: $ACR_NAME"

# 登陆 ACR
echo -e "\n🔐 正在登陆 ACR..."
az acr login --name "$ACR_NAME"

# 构建并推送 Backend 镜像
echo -e "\n📦 [1/4] 构建并推送后端镜像 (FastAPI) 到 ACR..."
cd src/cloud-orchestrator
docker build --no-cache --platform linux/amd64 -t "${ACR_NAME}.azurecr.io/omniguard-backend:latest" .
docker push "${ACR_NAME}.azurecr.io/omniguard-backend:latest"

# 构建并推送 Frontend 镜像
echo -e "\n📦 [2/4] 构建并推送前端镜像 (Next.js Standalone) 到 ACR..."
cd ../client-edge
docker build --no-cache --platform linux/amd64 -t "${ACR_NAME}.azurecr.io/omniguard-frontend:latest" .
docker push "${ACR_NAME}.azurecr.io/omniguard-frontend:latest"

# 触发 Backend Container App 升级
echo -e "\n🔄 [3/4] 触发后端 Container App 滚动发布..."
az containerapp update \
  --name "omni-backend" \
  --resource-group "$RG" \
  --image "${ACR_NAME}.azurecr.io/omniguard-backend:latest" \
  --set-env-vars TRIGGER_VERSION="$(date +%s)" \
  --output none

# 触发 Frontend Container App 升级
echo -e "\n🔄 [4/4] 触发前端 Container App 滚动发布..."
az containerapp update \
  --name "omni-frontend" \
  --resource-group "$RG" \
  --image "${ACR_NAME}.azurecr.io/omniguard-frontend:latest" \
  --set-env-vars TRIGGER_VERSION="$(date +%s)" PORT="80" \
  --output none

# 提取发布地址
REAL_FE_URL=$(az containerapp show --resource-group "$RG" --name "omni-frontend" --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")

echo -e "\n======================================================"
echo "🎉 全线部署完成！代码已成功载入新加坡 Container Apps。"
if [ -n "$REAL_FE_URL" ]; then
  echo "📡 仪表盘访问端点: https://$REAL_FE_URL"
fi
echo "======================================================"
