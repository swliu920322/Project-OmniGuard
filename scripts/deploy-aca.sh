#!/bin/bash
set -euo pipefail

# =========================================================================
# 🚀 Project-OmniGuard: Azure Container Apps (ACA) 容器部署总线
# =========================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 默认租户前缀
PREFIX="omni"
PARAM_FILE="$SCRIPT_DIR/../.azure/main.parameters.json"

# 如果参数文件存在，动态从参数文件中提取真实的前缀，以支持自定义租户前缀的 ACA 滚动部署
if [ -f "$PARAM_FILE" ]; then
  PREFIX=$(python3 -c "import json; print(json.load(open('$PARAM_FILE'))['parameters'].get('prefix', {}).get('value', 'omni'))" 2>/dev/null || echo "omni")
fi

RG="${PREFIX}-guard-infra-sea-rg"
BACKEND_NAME="${PREFIX}-backend"
FRONTEND_NAME="${PREFIX}-frontend"

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

# 从 local.settings.json 读取 OpenAI/DeepSeek 凭据与提供商设置
LOCAL_SETTINGS="$SCRIPT_DIR/../src/cloud-orchestrator/local.settings.json"
OPENAI_KEY=""
OPENAI_ENDPOINT=""
OPENAI_DEPLOYMENT=""
LLM_PROVIDER=""
OPENAI_MODEL_NAME=""
if [ -f "$LOCAL_SETTINGS" ]; then
  OPENAI_KEY=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('AZURE_OPENAI_API_KEY','') or json.load(open('$LOCAL_SETTINGS'))['Values'].get('OPENAI_API_KEY',''))" 2>/dev/null || true)
  OPENAI_ENDPOINT=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('AZURE_OPENAI_ENDPOINT','') or json.load(open('$LOCAL_SETTINGS'))['Values'].get('OPENAI_BASE_URL',''))" 2>/dev/null || true)
  OPENAI_DEPLOYMENT=$(python3 -c "import json; d=json.load(open('$LOCAL_SETTINGS'))['Values']; print(d.get('AZURE_OPENAI_DEPLOYMENT_NAME','') or d.get('OPENAI_API_DEPLOYMENT_NAME','') or d.get('OPENAI_DEPLOYMENT_NAME',''))" 2>/dev/null || true)
  LLM_PROVIDER=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('LLM_PROVIDER',''))" 2>/dev/null || true)
  OPENAI_MODEL_NAME=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('OPENAI_MODEL_NAME',''))" 2>/dev/null || true)
fi

# 构建并推送 Backend 镜像
echo -e "\n📦 [1/4] 构建并推送后端镜像 (FastAPI) 到 ACR..."
cd "$SCRIPT_DIR/../src/cloud-orchestrator"
docker build --no-cache --platform linux/amd64 -t "${ACR_NAME}.azurecr.io/omniguard-backend:latest" .
docker push "${ACR_NAME}.azurecr.io/omniguard-backend:latest"

# 构建并推送 Frontend 镜像
echo -e "\n📦 [2/4] 构建并推送前端镜像 (Next.js Standalone) 到 ACR..."
cd "$SCRIPT_DIR/../src/client-edge"
docker build --no-cache --platform linux/amd64 -t "${ACR_NAME}.azurecr.io/omniguard-frontend:latest" .
docker push "${ACR_NAME}.azurecr.io/omniguard-frontend:latest"

# 触发 Backend Container App 升级
echo -e "\n🔄 [3/4] 触发后端 Container App 滚动发布..."
BACKEND_ENV_VARS="TRIGGER_VERSION=$(date +%s)"
if [ -n "$OPENAI_KEY" ]; then
  BACKEND_ENV_VARS+=" OPENAI_API_KEY=$OPENAI_KEY"
  BACKEND_ENV_VARS+=" AZURE_OPENAI_API_KEY=$OPENAI_KEY"
fi
if [ -n "$OPENAI_ENDPOINT" ]; then
  BACKEND_ENV_VARS+=" OPENAI_BASE_URL=$OPENAI_ENDPOINT"
  BACKEND_ENV_VARS+=" AZURE_OPENAI_ENDPOINT=$OPENAI_ENDPOINT"
fi
if [ -n "$OPENAI_DEPLOYMENT" ]; then
  BACKEND_ENV_VARS+=" OPENAI_API_DEPLOYMENT_NAME=$OPENAI_DEPLOYMENT"
  BACKEND_ENV_VARS+=" OPENAI_DEPLOYMENT_NAME=$OPENAI_DEPLOYMENT"
  BACKEND_ENV_VARS+=" AZURE_OPENAI_DEPLOYMENT_NAME=$OPENAI_DEPLOYMENT"
fi
if [ -n "$LLM_PROVIDER" ]; then
  BACKEND_ENV_VARS+=" LLM_PROVIDER=$LLM_PROVIDER"
fi
if [ -n "$OPENAI_MODEL_NAME" ]; then
  BACKEND_ENV_VARS+=" OPENAI_MODEL_NAME=$OPENAI_MODEL_NAME"
fi
if [ -n "$OPENAI_KEY" ] || [ -n "$OPENAI_ENDPOINT" ] || [ -n "$OPENAI_DEPLOYMENT" ] || [ -n "$LLM_PROVIDER" ]; then
  echo "🔑 已注入 LLM 凭据与提供商设置 (Provider: ${LLM_PROVIDER:-azure}, Source: local.settings.json)"
fi
az containerapp update \
  --name "$BACKEND_NAME" \
  --resource-group "$RG" \
  --image "${ACR_NAME}.azurecr.io/omniguard-backend:latest" \
  --set-env-vars "$BACKEND_ENV_VARS" \
  --output none

# 触发 Frontend Container App 升级
echo -e "\n🔄 [4/4] 触发前端 Container App 滚动发布..."
az containerapp update \
  --name "$FRONTEND_NAME" \
  --resource-group "$RG" \
  --image "${ACR_NAME}.azurecr.io/omniguard-frontend:latest" \
  --set-env-vars TRIGGER_VERSION="$(date +%s)" PORT="80" \
  --output none

# 提取发布地址
REAL_FE_URL=$(az containerapp show --resource-group "$RG" --name "$FRONTEND_NAME" --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")

echo -e "\n======================================================"
echo "🎉 全线部署完成！代码已成功载入新加坡 Container Apps。"
if [ -n "$REAL_FE_URL" ]; then
  echo "📡 仪表盘访问端点: https://$REAL_FE_URL"
fi
echo "======================================================"
