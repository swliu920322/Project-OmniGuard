#!/bin/bash
set -euo pipefail

# =========================================================================
# 🏗️  Project-OmniGuard: 部署 Azure 基础设施
# =========================================================================

PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"
LOCATION="southeastasia"
DEPLOYMENT_NAME="omni-permanent-base"

echo "======================================================"
echo "🏗️  部署 Azure 基础设施"
echo "======================================================"

# 检查 Azure CLI 登录
echo -e "\n✅ [1/3] 检查 Azure 登录状态..."
if ! az account show > /dev/null 2>&1; then
  echo "❌ 错误: 未登录 Azure，请先执行 'az login'"
  exit 1
fi

CURRENT_SUB=$(az account show --query "name" -o tsv)
echo "📌 当前订阅: $CURRENT_SUB"

# 提取 local.settings.json 中的 OpenAI 凭证，防止 ACA 密钥为空报错
OPENAI_KEY=""
OPENAI_DEPLOYMENT="gpt-5.4-mini"
SETTINGS_FILE="src/cloud-orchestrator/local.settings.json"

if [ -f "$SETTINGS_FILE" ]; then
  OPENAI_KEY=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['Values'].get('AZURE_OPENAI_API_KEY', ''))" 2>/dev/null || echo "")
  OPENAI_DEPLOYMENT=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['Values'].get('AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-5.4-mini'))" 2>/dev/null || echo "")
fi

if [ -z "$OPENAI_KEY" ]; then
  echo "⚠️  警告: 未能在 $SETTINGS_FILE 中找到 AZURE_OPENAI_API_KEY，将使用临时占位密钥进行基础设施部署..."
  OPENAI_KEY="dummy-openai-key-replace-me"
fi

# 部署 Bicep 模板
echo -e "\n✅ [2/3] 部署 Bicep 基础设施..."
az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file .azure/main.bicep \
  --parameters location="$LOCATION" prefix="$PREFIX" openAiKey="$OPENAI_KEY" openAiDeploymentName="$OPENAI_DEPLOYMENT" \
  --output table

# 提取资源信息
echo -e "\n✅ [3/3] 提取资源信息..."
REAL_ACR_NAME=$(az acr list --resource-group "$RG" --query "[0].name" -o tsv 2>/dev/null || echo "")
REAL_ST_NAME=$(az storage account list --resource-group "$RG" --query "[0].name" -o tsv 2>/dev/null || echo "")
REAL_FE_URL=$(az containerapp show --resource-group "$RG" --name "omni-frontend" --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")

if [ -z "$REAL_ACR_NAME" ] || [ -z "$REAL_ST_NAME" ]; then
  echo "⚠️  警告: 未能完全提取资源信息"
else
  echo "🎯 已部署的资源:"
  echo "  ACR 名称: $REAL_ACR_NAME"
  echo "  Storage 名称: $REAL_ST_NAME"
  if [ -n "$REAL_FE_URL" ]; then
    echo "  Frontend URL: https://$REAL_FE_URL"
  fi
fi

echo -e "\n======================================================"
echo "✅ 基础设施部署完成！"
echo "======================================================"
echo "📝 下一步 (ACA 容器化发布流程):"
echo "  1. 执行 './sh/deploy-aca.sh' 打包并推送 Docker 镜像，部署到 Azure Container Apps"
echo "======================================================"

