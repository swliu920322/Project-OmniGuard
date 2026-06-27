#!/bin/bash
set -euo pipefail

# =========================================================================
# 🔄 Project-OmniGuard: 触发 GitHub CI/CD 流水线
# =========================================================================

echo "======================================================"
echo "🔄 触发 GitHub CI/CD 流水线"
echo "======================================================"

# 检查 git 是否安装
if ! command -v git &> /dev/null; then
  echo "❌ 错误: git 未安装"
  exit 1
fi

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ 错误: 当前目录不是 git 仓库"
  exit 1
fi

# 检查远程是否是 GitHub
echo "✅ 检查仓库配置..."
REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null || echo "")
if [[ ! "$REMOTE_URL" =~ "github.com" ]]; then
  echo "⚠️  警告: 这个仓库可能不是 GitHub 仓库"
fi

# 获取当前分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📌 当前分支: $CURRENT_BRANCH"

# 确认要提交
read -p "要推送一个空提交来触发 CI 流程吗？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消"
    exit 0
fi

# 检查是否有未提交的更改
UNCOMMITTED=$(git status --porcelain | wc -l)
if [ "$UNCOMMITTED" -gt 0 ]; then
  echo "⚠️  检测到未提交的文件变更"
  git status --short
  echo ""
  read -p "继续推送并忽略这些变更吗？(y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "❌ 已取消"
      exit 0
  fi
fi

# 制作空提交
echo "📤 创建空提交..."
git commit --allow-empty -m "chore: trigger CI/CD pipeline"

# 推送到远程
echo "📤 推送到远程仓库..."
git push origin "$CURRENT_BRANCH"

echo -e "\n======================================================"
echo "✅ CI/CD 流水线已触发！"
echo "======================================================"
echo "访问 GitHub Actions 查看流程状态:"
echo "$REMOTE_URL/actions"
echo "======================================================"

