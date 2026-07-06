#!/bin/bash
set -euo pipefail

# =========================================================================
# 🚀 Project-OmniGuard: 启动后端 (Azure Functions)
# =========================================================================

echo "======================================================"
echo "🔧 启动后端 Azure Functions (端口 7071)"
echo "======================================================"

if ! command -v func &> /dev/null; then
  echo "❌ 错误: Azure Functions Core Tools (func) 未安装"
  echo "请参考: https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../src/cloud-orchestrator"

if [ ! -f "local.settings.json" ]; then
  echo "⚠️  local.settings.json 未找到，请先复制 local.settings.example.json 并填入 OpenAI 凭证"
  exit 1
fi

echo "✅ 启动 Functions 后端..."
echo "📡 API: http://localhost:7071/api"
echo -e "\nℹ️  按 Ctrl+C 停止\n"

func start
