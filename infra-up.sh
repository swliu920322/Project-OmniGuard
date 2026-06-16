#!/bin/bash
set -e

# =========================================================================
# 🚀 Project-OmniGuard: 幂等合拢与环境唤醒脚本
# =========================================================================

PREFIX="omni"
RG="${PREFIX}-guard-infra-rg"
LOCATION="japaneast"
DEPLOYMENT_NAME="omni-permanent-base"

echo "========================================================="
echo "🔒 [Step 1/4] 正在执行控制面登录态与订阅审计..."
echo "========================================================="
CURRENT_SUB=$(az account show --query "name" -o tsv 2>/dev/null || true)
if [ -z "$CURRENT_SUB" ]; then
    echo "❌ 错误: 未检测到 Azure CLI 登录凭证，请先执行 'az login'！"
    exit 1
fi
echo "🎯 当前锁定的活动订阅: $CURRENT_SUB"

echo -e "\n========================================================="
echo "🔄 [Step 2/4] 正在发射 Bicep 增量状态收敛树 (Idempotent Deploy)..."
echo "========================================================="
az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file .azure/main.bicep \
  --parameters location="$LOCATION" prefix="$PREFIX" \
  --output table

echo -e "\n========================================================="
echo "⚡ [Step 3/4] 正在强制唤醒 BackendSubnet 计算大脑 (Function App)..."
echo "========================================================="
APP_NAME=$(az webapp list --resource-group "$RG" --query "[?kind=='functionapp,linux'].name" -o tsv)
if [ -z "$APP_NAME" ]; then
    echo "❌ 错误: 未在资源组 $RG 中检索到 Linux Function App 实体！"
    exit 1
fi
az webapp start --name "$APP_NAME" --resource-group "$RG"
echo "🟩 计算平面状态已成功复位为: Running"

echo -e "\n========================================================="
echo "🔑 [Step 4/4] 正在动态解密内网大模型专属握手凭证..."
echo "========================================================="
OPENAI_NAME=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query "properties.outputs.openAiName.value" -o tsv)
ENDPOINT=$(az cognitiveservices account show --name "$OPENAI_NAME" --resource-group "$RG" --query "properties.endpoint" -o tsv)
API_KEY=$(az cognitiveservices account keys list --name "$OPENAI_NAME" --resource-group "$RG" --query "key1" -o tsv)

echo "---------------------------------------------------------"
echo "🔗 永久节点 Endpoint: $ENDPOINT"
echo "🔑 永久节点 API_KEY : $API_KEY"
echo "---------------------------------------------------------"
echo "🎉 恭喜！黄金开发基准线已全面就绪。资产已合拢，开工！"
echo "========================================================="