#!/bin/bash
set -euo pipefail

# =========================================================================
# 🏗️  Project-OmniGuard: Azure 基础设施 Dry-run (What-If)
# =========================================================================

# 默认开发规格参数
PREFIX="omni"
LOCATION="southeastasia"
PARAM_FILE=".azure/main.parameters.json"

# 如果参数文件存在，动态从中提取真实的前缀和区域，保证后续 What-If 预检的准确性
if [ -f "$PARAM_FILE" ]; then
  PREFIX=$(python3 -c "import json; print(json.load(open('$PARAM_FILE'))['parameters'].get('prefix', {}).get('value', 'omni'))" 2>/dev/null || echo "omni")
  LOCATION=$(python3 -c "import json; print(json.load(open('$PARAM_FILE'))['parameters'].get('location', {}).get('value', 'southeastasia'))" 2>/dev/null || echo "southeastasia")
fi

RG="${PREFIX}-guard-infra-sea-rg"
DEPLOYMENT_NAME="omni-permanent-base"

echo "======================================================"
echo "🔍  Azure 基础设施 Dry-run (What-If) 预检"
echo "======================================================"

# 检查 Azure CLI 登录
echo -e "\n✅ [1/2] 检查 Azure 登录状态..."
if ! az account show > /dev/null 2>&1; then
  echo "❌ 错误: 未登录 Azure，请先执行 'az login'"
  exit 1
fi

CURRENT_SUB=$(az account show --query "name" -o tsv)
echo "📌 当前订阅: $CURRENT_SUB"

# 提取 local.settings.json 中的 OpenAI 凭证，防止 ACA 密钥为空报错
OPENAI_KEY=""
OPENAI_ENDPOINT=""
OPENAI_DEPLOYMENT="gpt-5.4-mini"
SETTINGS_FILE="src/cloud-orchestrator/local.settings.json"

if [ -f "$SETTINGS_FILE" ]; then
  OPENAI_KEY=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['Values'].get('AZURE_OPENAI_API_KEY','') or json.load(open('$SETTINGS_FILE'))['Values'].get('OPENAI_API_KEY',''))" 2>/dev/null || echo "")
  OPENAI_ENDPOINT=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['Values'].get('AZURE_OPENAI_ENDPOINT','') or json.load(open('$SETTINGS_FILE'))['Values'].get('OPENAI_BASE_URL',''))" 2>/dev/null || echo "")
  OPENAI_DEPLOYMENT=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['Values'].get('AZURE_OPENAI_DEPLOYMENT_NAME','') or json.load(open('$SETTINGS_FILE'))['Values'].get('OPENAI_API_DEPLOYMENT_NAME','') or json.load(open('$SETTINGS_FILE'))['Values'].get('OPENAI_DEPLOYMENT_NAME','gpt-5.4-mini'))" 2>/dev/null || echo "")
fi

if [ -z "$OPENAI_KEY" ]; then
  echo "⚠️  警告: 未能在 $SETTINGS_FILE 中找到 OpenAI API Key，将使用临时占位密钥进行 What-If 预检..."
  OPENAI_KEY="dummy-openai-key-replace-me"
fi

# 运行 Bicep What-If
echo -e "\n✅ [2/2] 运行 Bicep What-If 预览..."

if [ -f "$PARAM_FILE" ]; then
  echo "📌 检测到配置台生成的本地参数文件 ($PARAM_FILE)，正在执行自定义规格 Dry-run..."
  az deployment sub what-if \
    --location "$LOCATION" \
    --template-file .azure/main.bicep \
    --parameters "@$PARAM_FILE"
else
  echo "📌 未检测到参数文件，回退到默认开发规格进行 Dry-run..."
  az deployment sub what-if \
    --location "$LOCATION" \
    --template-file .azure/main.bicep \
    --parameters location="$LOCATION" prefix="$PREFIX" openAiKey="$OPENAI_KEY" openAiEndpoint="$OPENAI_ENDPOINT" openAiDeploymentName="$OPENAI_DEPLOYMENT"
fi

echo -e "\n======================================================"
echo "🔍  What-If 干跑预检完成！"
echo "======================================================"
