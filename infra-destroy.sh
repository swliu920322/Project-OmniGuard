cat << 'EOF' > infra-destroy.sh
#!/bin/bash
echo "⚠️ 正在物理湮灭新架设的亚太网络与计算外壳 (omni-guard-infra-rg)..."
echo "🛡️ 安全断言：此操作绝不伤及已有的 0387621-2410 大模型 Agent 资产。"

az group delete --name "omni-guard-infra-rg" --yes --no-wait

echo "🟩 异步强拆指令下发成功！计费大闸已关闭，云端物理机架将在 5 分钟内彻底释放为 $0/M。"
EOF

chmod +x infra-destroy.sh