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

# 部署 Bicep 模板
echo -e "\n✅ [2/3] 部署 Bicep 基础设施..."
az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file .azure/main.bicep \
  --parameters location="$LOCATION" prefix="$PREFIX" \
  --output table

# 提取资源信息
echo -e "\n✅ [3/3] 提取资源信息..."
REAL_FUNC_NAME=$(az functionapp list --resource-group "$RG" --query "[0].name" -o tsv 2>/dev/null || echo "")
REAL_ST_NAME=$(az storage account list --resource-group "$RG" --query "[0].name" -o tsv 2>/dev/null || echo "")

if [ -z "$REAL_FUNC_NAME" ] || [ -z "$REAL_ST_NAME" ]; then
  echo "⚠️  警告: 未能完全提取资源信息"
else
  echo "🎯 已部署的资源:"
  echo "  Function App 名称: $REAL_FUNC_NAME"
  echo "  Storage 名称: $REAL_ST_NAME"
fi

echo -e "\n======================================================"
echo "✅ 基础设施部署完成！"
echo "======================================================"
echo "📝 下一步:"
echo "  1. 编辑 src/cloud-orchestrator/digitalhuman/local.settings.json"
echo "  2. 填入 Azure OpenAI 或第三方 OpenAI 凭证"
echo "  3. 执行 './sh/start.sh' 启动前后端"
echo "  4. 执行 './sh/deploy-function.sh' 部署到云端"
echo "======================================================"

