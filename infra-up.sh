#!/bin/bash
set -e

# =========================================================================
# 🔒 Project-OmniGuard: 专属雷达换装与凭证安全倒灌脚本
# =========================================================================

PREFIX="omni"
RG="${PREFIX}-guard-infra-rg"
LOCATION="japaneast"
DEPLOYMENT_NAME="omni-permanent-base"

# 💡 刚性校准：死锁已有大模型的真实物理坐标
TARGET_COG_RG="jpe0387621"
REAL_OPENAI_NAME="0387621-2410-resource"

echo "========================================================="
echo "🔒 [Step 1/4] 正在执行控制面登录态与订阅审计..."
echo "========================================================="
CURRENT_SUB=$(az account show --query "name" -o tsv 2>/dev/null || true)
if [ -z "$CURRENT_SUB" ]; then
    echo "❌ 错误: 未检测到 Azure CLI 登录凭证，请先执行 'az login'！"
    exit 1
fi
echo "🎯 当前活跃订阅: $CURRENT_SUB"

echo -e "\n========================================================="
echo "🔄 [Step 2/4] 正在验证纯净版 Bicep 拓扑树 (状态幂等对账)..."
echo "========================================================="
az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file .azure/main.bicep \
  --parameters location="$LOCATION" prefix="$PREFIX" \
  --output table

echo -e "\n========================================================="
echo "📡 [Step 3/4] 正在定向突袭跨资源组资产凭证 (Cross-RG Harvest)..."
echo "========================================================="
echo "🎯 正在锁定目标资源组: $TARGET_COG_RG -> 实例: $REAL_OPENAI_NAME"

REAL_ENDPOINT="https://0387621-2410-resource.services.ai.azure.com/"
REAL_KEY=$(az cognitiveservices account keys list --name "$REAL_OPENAI_NAME" --resource-group "$TARGET_COG_RG" --query "key1" -o tsv)

if [ -z "$REAL_KEY" ]; then
    echo "❌ 错误: 提取密匙失败！请确保你的 CLI 有权访问资源组 '$TARGET_COG_RG'。"
    exit 1
fi
echo "🟩 大模型凭证定向解密成功，内存护航就绪。"

echo -e "\n========================================================="
echo "⚡ [Step 4/4] 动态解算新计算平面并执行密匙安全倒灌..."
echo "========================================================="
# 💡 绝杀：直接换用专属命令，强制剔除 kind 匹配带来的随机性盲区
REAL_FUNC_NAME=$(az functionapp list --resource-group "$RG" --query "[0].name" -o tsv)

if [ -z "$REAL_FUNC_NAME" ]; then
    echo "❌ 错误: 未在新资源组 $RG 中寻获到 Function 计算节点！"
    exit 1
fi

echo "🎯 成功锁定真机计算大脑: $REAL_FUNC_NAME"

# 唤醒云端物理节点并强行灌入加密环境变量
az webapp start --name "$REAL_FUNC_NAME" --resource-group "$RG"

az webapp config appsettings set \
  --name "$REAL_FUNC_NAME" \
  --resource-group "$RG" \
  --settings \
    AZURE_OPENAI_ENDPOINT="$REAL_ENDPOINT" \
    AZURE_OPENAI_API_KEY="$REAL_KEY" \
    LOCAL_MOCK_MODE="false" \
  --output none

echo "--------------------------------------------------------"
echo "🎉 全线大捷！云端多活分流底座已完全与旧大模型合拢通车！"
echo "🛡️ 云端 Function 已合法接管你的 Foundry 军火库。"
echo "🔗 复制下方实弹变量到本地 local.settings.json 开启真机本地肉搏："
echo "   AZURE_OPENAI_ENDPOINT: $REAL_ENDPOINT"
echo "   AZURE_OPENAI_API_KEY : $REAL_KEY"
echo "--------------------------------------------------------"