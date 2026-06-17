#!/bin/bash
set -e

# =========================================================================
# 🔒 Project-OmniGuard: 专属雷达换装与凭证安全倒灌脚本 (庚金总工保固版)
# =========================================================================

PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"
LOCATION="southeastasia"
DEPLOYMENT_NAME="omni-permanent-base-sea"

# 💡 刚性校准：死锁已有大模型的真实物理坐标
TARGET_COG_RG="eastSouthAsiaForAI"
REAL_OPENAI_NAME="southeastaisa-0322-resource"

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
echo "📡 [Step 3/4] 正在跨订阅突袭东南亚资产凭证 (Cross-Subscription Harvest)..."
echo "========================================================="
# 🟩 核心自愈：暂时强行切换当前 CLI 上下文至新账号的学生订阅，打通越境收割通道

echo "🎯 正在锁定目标东南亚资源组: $TARGET_COG_RG -> 实例: $REAL_OPENAI_NAME"
REAL_ENDPOINT="https://${REAL_OPENAI_NAME}.openai.azure.com/"
REAL_KEY=$(az cognitiveservices account keys list --name "$REAL_OPENAI_NAME" --resource-group "$TARGET_COG_RG" --query "key1" -o tsv)

if [ -z "$REAL_KEY" ]; then
    echo "❌ 错误: 跨订阅提取新大模型密匙失败！请确保你已用新账号在本地执行过 az login。"
    exit 1
fi
echo "🟩 东南亚大模型凭证定向解密成功。"

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

# 🟩 核心修复：用标准的 functionapp 专属控制权取代 webapp，并顺手注入存储账户上下文
REAL_ST_NAME=$(az storage account list --resource-group "$RG" --query "[0].name" -o tsv)

az functionapp config appsettings set \
  --name "$REAL_FUNC_NAME" \
  --resource-group "$RG" \
  --settings \
    AZURE_OPENAI_ENDPOINT="$REAL_ENDPOINT" \
    AZURE_OPENAI_API_KEY="$REAL_KEY" \
    AZURE_STORAGE_ACCOUNT_NAME="$REAL_ST_NAME" \
    LOCAL_MOCK_MODE="false" \
    WEBSITE_VNET_ROUTE_ALL="0" \
    FUNCTIONS_WORKER_PROCESS_COUNT=4 \
    PYTHON_THREADPOOL_THREAD_COUNT=32 \
    PYTHON_ENABLE_INIT_INDEXING=1 \
  --output none

# 强制执行机架容器冷启动，压入全新环境变量
az functionapp restart --name "$REAL_FUNC_NAME" --resource-group "$RG"

echo "--------------------------------------------------------"
echo "🎉 全线大捷！云端多活分流底座已完全与旧大模型合拢通车！"
echo "🛡️ 云端 Function 已合法接管你的 Foundry 军火库。"
echo "🔗 复制下方实弹变量到本地 local.settings.json 开启真机本地肉搏："
echo "   AZURE_OPENAI_ENDPOINT: $REAL_ENDPOINT"
echo "   AZURE_OPENAI_API_KEY : $REAL_KEY"
echo "--------------------------------------------------------"


# 💡 追加至 infra-up.sh 尾部：自动同步本地调试密匙账本
echo "📥 正在同步本地实弹调试账本 local.settings.json ..."
VAR_RG="omni-guard-infra-rg"
VAR_ST_NAME=$(az storage account list --resource-group "$VAR_RG" --query "[0].name" -o tsv)
VAR_ST_KEY=$(az storage account keys list --account-name "$VAR_ST_NAME" --resource-group "$VAR_RG" --query "[0].value" -o tsv)
VAR_OPENAI_NAME="gpt-5.4-mini"

cat <<EOF > src/cloud-orchestrator/digitalhuman/local.settings.json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "LOCAL_MOCK_MODE": "false",
    "AZURE_STORAGE_ACCOUNT_NAME": "${VAR_ST_NAME}",
    "AZURE_STORAGE_ACCOUNT_KEY": "${VAR_ST_KEY}",
    "AZURE_OPENAI_ENDPOINT": "${REAL_ENDPOINT}",
    "AZURE_OPENAI_API_KEY": "${REAL_KEY}",
    "AZURE_OPENAI_DEPLOYMENT_NAME": "${VAR_OPENAI_NAME}",
    "PYTHON_ENABLE_INIT_INDEXING": 1
  }
}
EOF
echo "🟩 local.settings.json 同步完毕，本地肉搏引信已完全对齐云端变数！"