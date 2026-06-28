#!/bin/bash
set -euo pipefail

# =========================================================================
# 🚀 Project-OmniGuard: 启动前端 (Next.js)
# =========================================================================

echo "======================================================"
echo "🎨 启动前端 Next.js 开发服务器 (端口 3000)"
echo "======================================================"

if ! command -v npm &> /dev/null; then
  echo "❌ 错误: npm 未安装"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../src/client-edge"

if [ ! -d "node_modules" ]; then
  echo "📦 npm 依赖不存在，正在安装..."
  npm install
fi

echo "✅ 启动 Next.js 前端..."
echo "📺 访问: http://localhost:3000"
echo -e "\nℹ️  按 Ctrl+C 停止\n"

npm run dev
