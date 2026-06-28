#!/bin/bash
set -euo pipefail

# =========================================================================
# 📤 Project-OmniGuard: 部署 Python Function 到 Azure Serverless
# =========================================================================

PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"

echo "======================================================"
echo "📤 部署 Function App 到 Azure Serverless"
echo "======================================================"

# 检查登录
if ! az account show > /dev/null 2>&1; then
  echo "❌ 错误: 未登录 Azure，请先执行 'az login'"
  exit 1
fi

# 检查资源组和 Function App 是否存在
echo -e "\n✅ [1/4] 检查 Azure 资源..."
if ! az group exists --name "$RG" > /dev/null; then
  echo "❌ 错误: 资源组 $RG 不存在，请先执行 './sh/provision.sh'"
  exit 1
fi

FUNC_NAME=$(az functionapp list --resource-group "$RG" --query "[0].name" -o tsv 2>/dev/null || true)
if [ -z "$FUNC_NAME" ]; then
  echo "❌ 错误: 未在资源组 $RG 中找到 Function App"
  exit 1
fi

echo "🎯 目标 Function App: $FUNC_NAME"

# 读取 local.settings.json 中的 OpenAI 配置
echo -e "\n✅ [2/4] 同步 local.settings.json 配置到云端..."
SETTINGS_FILE="src/cloud-orchestrator/local.settings.json"

if [ ! -f "$SETTINGS_FILE" ]; then
  echo "❌ 错误: 找不到 $SETTINGS_FILE"
  echo "请先复制 local.settings.example.json 并填入必要的 OpenAI 凭证"
  exit 1
fi

# 提取关键配置
LLM_PROVIDER=$(grep -o '"LLM_PROVIDER": "[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
AZURE_OPENAI_ENDPOINT=$(grep -o '"AZURE_OPENAI_ENDPOINT": "[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
AZURE_OPENAI_API_KEY=$(grep -o '"AZURE_OPENAI_API_KEY": "[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
AZURE_OPENAI_DEPLOYMENT_NAME=$(grep -o '"AZURE_OPENAI_DEPLOYMENT_NAME": "[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
OPENAI_BASE_URL=$(grep -o '"OPENAI_BASE_URL": "[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
OPENAI_API_KEY=$(grep -o '"OPENAI_API_KEY": "[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)
OPENAI_MODEL=$(grep -o '"OPENAI_MODEL": "[^"]*"' "$SETTINGS_FILE" | cut -d'"' -f4)

echo "🔧 检测到的配置:"
echo "  LLM_PROVIDER: ${LLM_PROVIDER:-N/A}"
echo "  AZURE_OPENAI_DEPLOYMENT_NAME: ${AZURE_OPENAI_DEPLOYMENT_NAME:-N/A}"

# 构建 appsettings 数组
APP_SETTINGS=(
  "LLM_PROVIDER=${LLM_PROVIDER:-azure}"
  "LOCAL_MOCK_MODE=false"
  "PYTHON_ENABLE_INIT_INDEXING=1"
  "FUNCTIONS_WORKER_PROCESS_COUNT=2"
)

if [ "$LLM_PROVIDER" = "openai-compatible" ] || [ "$LLM_PROVIDER" = "thirdparty" ]; then
  APP_SETTINGS+=(
    "OPENAI_BASE_URL=${OPENAI_BASE_URL}"
    "OPENAI_API_KEY=${OPENAI_API_KEY}"
    "OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o-mini}"
    "LLM_MODEL=${OPENAI_MODEL:-gpt-4o-mini}"
  )
else
  APP_SETTINGS+=(
    "AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}"
    "AZURE_OPENAI_API_KEY=${AZURE_OPENAI_API_KEY}"
    "AZURE_OPENAI_DEPLOYMENT_NAME=${AZURE_OPENAI_DEPLOYMENT_NAME:-gpt-4o}"
    "LLM_MODEL=${AZURE_OPENAI_DEPLOYMENT_NAME:-gpt-4o}"
  )
fi

# 上传配置到云端 Function App
echo -e "\n✅ [3/4] 上传配置到函数应用..."
az functionapp config appsettings set \
  --name "$FUNC_NAME" \
  --resource-group "$RG" \
  --settings "${APP_SETTINGS[@]}" \
  --output none

echo "✅ 配置已上传"

# 部署 Python 代码
echo -e "\n✅ [4/4] 部署 Function 代码..."
cd src/cloud-orchestrator

func azure functionapp publish "$FUNC_NAME" --python --no-bundler

echo -e "\n======================================================"
echo "🎉 部署完成！"
echo "======================================================"
echo "📡 函数应用终结点: https://${FUNC_NAME}.azurewebsites.net/api/chat/stream"
echo "======================================================"

