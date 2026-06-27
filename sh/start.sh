#!/bin/bash
set -euo pipefail

# =========================================================================
# 🚀 Project-OmniGuard: 启动前后端本地开发环境
# =========================================================================

echo "======================================================"
echo "🎯 启动前后端本地开发环境"
echo "======================================================"

# 检查前置条件
if ! command -v func &> /dev/null; then
  echo "❌ 错误: Azure Functions Core Tools (func) 未安装"
  echo "请参考: https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "❌ 错误: npm 未安装"
  exit 1
fi

# 启动后端 (Function App)
echo -e "\n🔧 [1/2] 启动后端 Azure Functions (端口 7071)..."
cd "$(dirname "$0")/../src/cloud-orchestrator/digitalhuman"

# 确保 local.settings.json 存在
if [ ! -f "local.settings.json" ]; then
  echo "⚠️  local.settings.json 未找到，请先复制 local.settings.example.json 并填入 OpenAI 凭证"
  exit 1
fi

# 启动 Functions（后台运行）
func start &
FUNC_PID=$!
echo "✅ Functions 已启动 (PID: $FUNC_PID)"

sleep 3

# 启动前端 (Next.js)
echo -e "\n🎨 [2/2] 启动前端 Next.js 开发服务器..."
cd "$(dirname "$0")/../src/client-edge"

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
  echo "📦 npm 依赖不存在，正在安装..."
  npm install
fi

# 启动 Next.js 开发服务器
npm run dev &
NEXT_PID=$!
echo "✅ Next.js 已启动 (PID: $NEXT_PID)"

echo -e "\n======================================================"
echo "🎉 前后端已启动！"
echo "======================================================"
echo "📺 前端访问: http://localhost:3000"
echo "⚡ 后端 API: http://localhost:7071/api"
echo -e "\nℹ️  按 Ctrl+C 停止所有服务\n"

# 等待用户中断
wait

