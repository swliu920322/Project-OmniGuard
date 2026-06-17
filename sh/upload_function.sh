
echo "========================================================="
echo "🚀 正在部署 Azure Functions 应用..."
echo "--------------------------------------------------------"
cd src/cloud-orchestrator
source .venv/bin/activate
func azure functionapp publish $(az functionapp list --resource-group "omni-guard-infra-sea-rg" --query "[0].name" -o tsv) --python --build remote
echo "--------------------------------------------------------"
echo "✅ 函数应用部署完成！请前往 Azure 门户验证部署状态。"