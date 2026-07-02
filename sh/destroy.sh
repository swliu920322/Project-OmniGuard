#!/bin/bash
set -euo pipefail

# =========================================================================
# 💣 Project-OmniGuard: 销毁所有 Azure 云端资源
# =========================================================================

RG_NAME="omni2-guard-infra-sea-rg"

echo "================================================================="
echo "🚨 [CRITICAL WARNING] 即将删除所有 Azure 云资源"
echo "================================================================="
echo "🔥 目标资源组  : ${RG_NAME}"
echo "🔥 受影响组件  : Function App, Storage Account, VNets, etc."
echo "================================================================="
echo "⚠️  此操作不可恢复！"
read -p "确实要删除吗？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 已取消删除操作"
    exit 0
fi

# 检查登录
if ! az account show > /dev/null 2>&1; then
  echo "❌ 错误: 未登录 Azure，请先执行 'az login'"
  exit 1
fi

echo -e "\n⏳ 正在删除资源组: ${RG_NAME}..."

if az group exists --name "$RG_NAME" > /dev/null 2>&1; then
    az group delete --name "$RG_NAME" --yes
    echo "✅ 资源组 ${RG_NAME} 已删除"
else
    echo "ℹ️  资源组 ${RG_NAME} 不存在，无需删除"
fi

echo -e "\n================================================================="
echo "🎉 清理完成！所有 Azure 资源已删除"
echo "================================================================="

