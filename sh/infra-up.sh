#!/bin/bash
set -euo pipefail

# =========================================================================
# 🔒 Project-OmniGuard: 专属雷达换装与凭证安全倒灌脚本
# =========================================================================

PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"
LOCATION="southeastasia"
DEPLOYMENT_NAME="omni-permanent-base-sea"

# 默认保留现有命名，但不再绑定硬编码订阅/密钥
TARGET_COG_RG="${TARGET_COG_RG:-eastSouthAsiaForAI}"
REAL_OPENAI_NAME="${REAL_OPENAI_NAME:-southeastaisa-0322-resource}"
DEFAULT_AZURE_DEPLOYMENT_NAME="${DEFAULT_AZURE_DEPLOYMENT_NAME:-gpt-4o}"

AI_PROVIDER="${AI_PROVIDER:-azure}"
AZURE_SUBSCRIPTION="${AZURE_SUBSCRIPTION:-}"
AZURE_OPENAI_RESOURCE_GROUP="${AZURE_OPENAI_RESOURCE_GROUP:-$TARGET_COG_RG}"
AZURE_OPENAI_ACCOUNT_NAME="${AZURE_OPENAI_ACCOUNT_NAME:-$REAL_OPENAI_NAME}"
AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT:-}"
AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY:-}"
AZURE_OPENAI_DEPLOYMENT_NAME="${AZURE_OPENAI_DEPLOYMENT_NAME:-$DEFAULT_AZURE_DEPLOYMENT_NAME}"
OPENAI_BASE_URL="${OPENAI_BASE_URL:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o-mini}"

echo "========================================================="
echo "🔒 [Step 1/4] 正在执行控制面登录态与订阅审计..."
echo "========================================================="
CURRENT_SUB=$(az account show --query "name" -o tsv 2>/dev/null || true)
if [ -z "$CURRENT_SUB" ]; then
  echo "❌ 错误: 未检测到 Azure CLI 登录凭证，请先执行 'az login'！"
  exit 1
fi

if [ -n "$AZURE_SUBSCRIPTION" ]; then
  az account set --subscription "$AZURE_SUBSCRIPTION"
  CURRENT_SUB=$(az account show --query "name" -o tsv)
fi
echo "🎯 当前活跃订阅: $CURRENT_SUB"
echo "🧭 运行模式: $AI_PROVIDER"

echo -e "\n========================================================="
echo "🔄 [Step 2/4] 正在验证纯净版 Bicep 拓扑树 (状态幂等对账)..."
echo "========================================================="
az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file .azure/main.bicep \
  --parameters location="$LOCATION" prefix="$PREFIX" \
  --output table

LLM_PROVIDER="azure"
LLM_ENDPOINT=""
LLM_API_KEY_VALUE=""
LLM_MODEL=""

if [[ "$AI_PROVIDER" == "thirdparty" || "$AI_PROVIDER" == "openai" || "$AI_PROVIDER" == "openai-compatible" ]]; then
  LLM_PROVIDER="openai-compatible"
  if [ -z "$OPENAI_BASE_URL" ] || [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ 错误: 第三方 OpenAI 模式需要同时提供 OPENAI_BASE_URL 与 OPENAI_API_KEY。"
    exit 1
  fi
  LLM_ENDPOINT="$OPENAI_BASE_URL"
  LLM_API_KEY_VALUE="$OPENAI_API_KEY"
  LLM_MODEL="$OPENAI_MODEL"
  echo -e "\n========================================================="
  echo "📡 [Step 3/4] 已切换到第三方 OpenAI 兼容接口，跳过跨订阅凭证收割..."
  echo "========================================================="
else
  echo -e "\n========================================================="
  echo "📡 [Step 3/4] 正在解算 Azure OpenAI 凭证..."
  echo "========================================================="

  if [ -z "$AZURE_OPENAI_ENDPOINT" ] && [ -n "$AZURE_OPENAI_ACCOUNT_NAME" ]; then
    AZURE_OPENAI_ENDPOINT="https://${AZURE_OPENAI_ACCOUNT_NAME}.openai.azure.com/"
  fi

  if [ -z "$AZURE_OPENAI_API_KEY" ]; then
    if [ -z "$AZURE_OPENAI_RESOURCE_GROUP" ] || [ -z "$AZURE_OPENAI_ACCOUNT_NAME" ]; then
      echo "❌ 错误: Azure 模式需要 AZURE_OPENAI_RESOURCE_GROUP 与 AZURE_OPENAI_ACCOUNT_NAME，或者直接提供 AZURE_OPENAI_API_KEY。"
      exit 1
    fi
    AZURE_OPENAI_API_KEY=$(az cognitiveservices account keys list --name "$AZURE_OPENAI_ACCOUNT_NAME" --resource-group "$AZURE_OPENAI_RESOURCE_GROUP" --query "key1" -o tsv)
  fi

  if [ -z "$AZURE_OPENAI_ENDPOINT" ] || [ -z "$AZURE_OPENAI_API_KEY" ]; then
    echo "❌ 错误: Azure OpenAI 端点或密钥仍为空。"
    exit 1
  fi

  LLM_ENDPOINT="$AZURE_OPENAI_ENDPOINT"
  LLM_API_KEY_VALUE="$AZURE_OPENAI_API_KEY"
  LLM_MODEL="$AZURE_OPENAI_DEPLOYMENT_NAME"
  echo "🟩 Azure OpenAI 凭证已解算完成。"
fi

echo -e "\n========================================================="
echo "⚡ [Step 4/4] 动态解算新计算平面并执行配置注入..."
echo "========================================================="
REAL_FUNC_NAME=$(az functionapp list --resource-group "$RG" --query "[0].name" -o tsv)

if [ -z "$REAL_FUNC_NAME" ]; then
  echo "❌ 错误: 未在新资源组 $RG 中寻获到 Function 计算节点！"
  exit 1
fi

echo "🎯 成功锁定真机计算大脑: $REAL_FUNC_NAME"
REAL_ST_NAME=$(az storage account list --resource-group "$RG" --query "[0].name" -o tsv)
REAL_ST_KEY=$(az storage account keys list --account-name "$REAL_ST_NAME" --resource-group "$RG" --query "[0].value" -o tsv)

APP_SETTINGS=(
  "AZURE_STORAGE_ACCOUNT_NAME=$REAL_ST_NAME"
  "AZURE_STORAGE_ACCOUNT_KEY=$REAL_ST_KEY"
  "LLM_PROVIDER=$LLM_PROVIDER"
  "LOCAL_MOCK_MODE=false"
  "WEBSITE_VNET_ROUTE_ALL=0"
  "FUNCTIONS_WORKER_PROCESS_COUNT=2"
  "PYTHON_THREADPOOL_THREAD_COUNT=16"
  "PYTHON_ENABLE_INIT_INDEXING=1"
)

if [ "$LLM_PROVIDER" = "openai-compatible" ]; then
  APP_SETTINGS+=(
    "OPENAI_BASE_URL=$LLM_ENDPOINT"
    "OPENAI_API_KEY=$LLM_API_KEY_VALUE"
    "OPENAI_MODEL=$LLM_MODEL"
    "LLM_MODEL=$LLM_MODEL"
  )
else
  APP_SETTINGS+=(
    "AZURE_OPENAI_ENDPOINT=$LLM_ENDPOINT"
    "AZURE_OPENAI_API_KEY=$LLM_API_KEY_VALUE"
    "AZURE_OPENAI_DEPLOYMENT_NAME=$LLM_MODEL"
    "LLM_MODEL=$LLM_MODEL"
  )
fi

az functionapp config appsettings set \
  --name "$REAL_FUNC_NAME" \
  --resource-group "$RG" \
  --settings "${APP_SETTINGS[@]}" \
  --output none

az functionapp restart --name "$REAL_FUNC_NAME" --resource-group "$RG"

echo "--------------------------------------------------------"
echo "🎉 全线大捷！云端 Function 已完成模式化接管。"
echo "🛡️ 当前 provider: $LLM_PROVIDER"
echo "🔗 本次启动配置已同步到本地 local.settings.json。"
echo "--------------------------------------------------------"

echo "📥 正在同步本地实弹调试账本 local.settings.json ..."

if [ "$LLM_PROVIDER" = "openai-compatible" ]; then
  cat <<EOF > src/cloud-orchestrator/digitalhuman/local.settings.json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "LOCAL_MOCK_MODE": "false",
    "AZURE_STORAGE_ACCOUNT_NAME": "${REAL_ST_NAME}",
    "AZURE_STORAGE_ACCOUNT_KEY": "${REAL_ST_KEY}",
    "LLM_PROVIDER": "${LLM_PROVIDER}",
    "OPENAI_BASE_URL": "${LLM_ENDPOINT}",
    "OPENAI_API_KEY": "${LLM_API_KEY_VALUE}",
    "OPENAI_MODEL": "${LLM_MODEL}",
    "LLM_MODEL": "${LLM_MODEL}",
    "PYTHON_ENABLE_INIT_INDEXING": 1
  }
}
EOF
else
  cat <<EOF > src/cloud-orchestrator/digitalhuman/local.settings.json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "LOCAL_MOCK_MODE": "false",
    "AZURE_STORAGE_ACCOUNT_NAME": "${REAL_ST_NAME}",
    "AZURE_STORAGE_ACCOUNT_KEY": "${REAL_ST_KEY}",
    "LLM_PROVIDER": "${LLM_PROVIDER}",
    "AZURE_OPENAI_ENDPOINT": "${LLM_ENDPOINT}",
    "AZURE_OPENAI_API_KEY": "${LLM_API_KEY_VALUE}",
    "AZURE_OPENAI_DEPLOYMENT_NAME": "${LLM_MODEL}",
    "LLM_MODEL": "${LLM_MODEL}",
    "PYTHON_ENABLE_INIT_INDEXING": 1
  }
}
EOF
fi

echo "🟩 local.settings.json 同步完毕，本地肉搏引信已完全对齐云端变数！"