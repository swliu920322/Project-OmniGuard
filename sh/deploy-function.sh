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

# 使用 Python 提取 local.settings.json 中的所有 Values，并安全同步到 Azure App Settings
# 这样可以自动同步包括 OPENAI_BASE_URL, OPENAI_API_KEY, SMTP_SERVER 等在内的所有配置，且避免 shell 转义/特殊字符截断问题
python3 -c '
import json, subprocess, sys
try:
    with open("src/cloud-orchestrator/local.settings.json") as f:
        data = json.load(f)
    values = data.get("Values", {})
    
    # 过滤掉不需要覆盖或云端托管的 key
    exclude_keys = {"AzureWebJobsStorage", "FUNCTIONS_WORKER_RUNTIME"}
    settings = []
    for k, v in values.items():
        if k not in exclude_keys:
            settings.append(f"{k}={v}")
            
    # 强制注入生产所需的环境变量默认值
    for k, v in [("LOCAL_MOCK_MODE", "false"), ("PYTHON_ENABLE_INIT_INDEXING", "1"), ("FUNCTIONS_WORKER_PROCESS_COUNT", "4"), ("SCM_DO_BUILD_DURING_DEPLOYMENT", "true")]:
        if k == "LOCAL_MOCK_MODE":
            settings = [s for s in settings if not s.startswith("LOCAL_MOCK_MODE=")]
            settings.append("LOCAL_MOCK_MODE=false")
        elif not any(s.startswith(f"{k}=") for s in settings):
            settings.append(f"{k}={v}")

    # 调用 az cli 写入配置
    cmd = [
        "az", "functionapp", "config", "appsettings", "set",
        "--name", "'"$FUNC_NAME"'",
        "--resource-group", "'"$RG"'",
        "--settings"
    ] + settings + ["--output", "none"]
    
    print("⏳ 正在同步本地 local.settings.json 中的环境变量到云端...")
    subprocess.run(cmd, check=True)
    print("✅ 环境变量同步成功！")
except Exception as e:
    print(f"❌ 同步环境变量失败: {e}", file=sys.stderr)
    sys.exit(1)
'

# 部署 Python 代码
echo -e "\n✅ [4/4] 部署 Function 代码..."
cd src/cloud-orchestrator

func azure functionapp publish "$FUNC_NAME" --build remote

echo -e "\n======================================================"
echo "🎉 部署完成！"
echo "======================================================"
echo "📡 函数应用终结点: https://${FUNC_NAME}.azurewebsites.net/api/chat/stream"
echo "======================================================"

