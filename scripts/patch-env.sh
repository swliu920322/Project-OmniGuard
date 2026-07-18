#!/bin/bash
set -euo pipefail

# =========================================================================
# ⚙️ Project-OmniGuard: Azure Container App (ACA) LLM 环境变量热更新总线
# =========================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARAM_FILE="$SCRIPT_DIR/../.azure/main.parameters.json"
LOCAL_SETTINGS="$SCRIPT_DIR/../src/cloud-orchestrator/local.settings.json"

# 默认租户前缀
PREFIX="omni"
if [ -f "$PARAM_FILE" ]; then
  PREFIX=$(python3 -c "import json; print(json.load(open('$PARAM_FILE'))['parameters'].get('prefix', {}).get('value', 'omni'))" 2>/dev/null || echo "omni")
fi

RG="${PREFIX}-guard-infra-sea-rg"
BACKEND_NAME="${PREFIX}-backend"

echo "======================================================"
echo "🔧 OmniGuard LLM Config Hot-Patcher"
echo "======================================================"
echo "🔍 检索资源组: $RG"
echo "🎯 目标后端容器: $BACKEND_NAME"
echo "======================================================"

if [ ! -f "$LOCAL_SETTINGS" ]; then
  echo "❌ 错误: 未在本地找到 $LOCAL_SETTINGS 配置文件"
  exit 1
fi

# 从 local.settings.json 中独立提取最新 LLM 变量
AZURE_OPENAI_API_KEY=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('AZURE_OPENAI_API_KEY',''))" 2>/dev/null || true)
AZURE_OPENAI_ENDPOINT=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('AZURE_OPENAI_ENDPOINT',''))" 2>/dev/null || true)
AZURE_OPENAI_DEPLOYMENT_NAME=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('AZURE_OPENAI_DEPLOYMENT_NAME',''))" 2>/dev/null || true)

OPENAI_API_KEY=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('OPENAI_API_KEY',''))" 2>/dev/null || true)
OPENAI_BASE_URL=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('OPENAI_BASE_URL',''))" 2>/dev/null || true)
OPENAI_MODEL_NAME=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('OPENAI_MODEL_NAME',''))" 2>/dev/null || true)

LLM_PROVIDER=$(python3 -c "import json; print(json.load(open('$LOCAL_SETTINGS'))['Values'].get('LLM_PROVIDER',''))" 2>/dev/null || true)

# 动态组装更新参数 - 彻底解耦，按需对齐
BACKEND_ENV_VARS="TRIGGER_VERSION=$(date +%s)"
if [ -n "$AZURE_OPENAI_API_KEY" ]; then
  BACKEND_ENV_VARS+=" AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY"
fi
if [ -n "$AZURE_OPENAI_ENDPOINT" ]; then
  BACKEND_ENV_VARS+=" AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT"
fi
if [ -n "$AZURE_OPENAI_DEPLOYMENT_NAME" ]; then
  BACKEND_ENV_VARS+=" AZURE_OPENAI_DEPLOYMENT_NAME=$AZURE_OPENAI_DEPLOYMENT_NAME"
fi
if [ -n "$OPENAI_API_KEY" ]; then
  BACKEND_ENV_VARS+=" OPENAI_API_KEY=$OPENAI_API_KEY"
fi
if [ -n "$OPENAI_BASE_URL" ]; then
  BACKEND_ENV_VARS+=" OPENAI_BASE_URL=$OPENAI_BASE_URL"
fi
if [ -n "$OPENAI_MODEL_NAME" ]; then
  BACKEND_ENV_VARS+=" OPENAI_MODEL_NAME=$OPENAI_MODEL_NAME"
fi
if [ -n "$LLM_PROVIDER" ]; then
  BACKEND_ENV_VARS+=" LLM_PROVIDER=$LLM_PROVIDER"
fi

echo "🚀 正在通过 Azure CLI 进行热更新环境推送..."
echo "📋 已注入的 LLM 变量:"
echo "   - Provider: ${LLM_PROVIDER:-azure}"
echo "   - Model: ${OPENAI_MODEL_NAME:-gpt-4o-mini}"
echo "   - Endpoint: ${OPENAI_BASE_URL:-$AZURE_OPENAI_ENDPOINT}"

# 执行容器热重载升级
az containerapp update \
  --name "$BACKEND_NAME" \
  --resource-group "$RG" \
  --set-env-vars $BACKEND_ENV_VARS \
  --output none

echo -e "\n======================================================"
echo "🎉 热更新成功！云端后端容器实例已重载最新 LLM 凭据配置。"
echo "======================================================"
