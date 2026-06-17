#!/bin/bash
set -e

# =========================================================================
# 🚀 PROJECT-OMNIGUARD: 后端 Python 代码纯净发布与双态对账脚本
# =========================================================================

RG="omni-guard-infra-sea-rg"
echo "🔍 正在检索东南亚机房内的真机算力节点..."
FUNC_NAME=$(az functionapp list --resource-group "$RG" --query "[0].name" -o tsv)

if [ -z "$FUNC_NAME" ]; then
    echo "❌ 错误：未在资源组 $RG 中寻获任何活的 Function 脑干！"
    exit 1
fi
echo "🎯 成功锁定目标真机：$FUNC_NAME"

# 进入 Python 源码腹地
cd src/cloud-orchestrator/digitalhuman

echo "📦 正在执行本地依赖预检并打包字节流..."
# 🟩 核心自愈：强行使用远端 Oryx 引擎进行清爽合规编译，卸载本地磁盘脏数据
func azure functionapp publish "$FUNC_NAME" --python --no-bundler

echo "--------------------------------------------------------"
echo "🎉 部署发票已吐出！后端源码已安全坠入新加坡真机内存。"
echo "📡 获取真机原生直连终结点 (复制此 URL 替换前端 fetch 指针)："
echo "   https://${FUNC_NAME}.azurewebsites.net/api/chat/stream"
echo "--------------------------------------------------------"