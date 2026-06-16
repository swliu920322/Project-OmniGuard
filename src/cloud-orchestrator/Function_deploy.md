# 🧑‍🔧 Azure Static Web Apps 内嵌函数物理蒸发方案
---

## 🚀 4步冷启动标准操作程序 (SOP Runbook)

一旦运行物理蒸发脚本，严格按照以下流水线进行冷启动：

```bash
# 执行冷启动前置对齐（按需物理对齐泰莱大学学术订阅）
az login --tenant "sd.taylors.edu.my"

# Step 1: 基础设施硬件就位 (Bicep 编译)
az deployment sub create \
  --name omni-permanent-base \
  --location japaneast \
  --template-file .azure/main.bicep \
  --parameters location=japaneast prefix=omni

```

* 
**断言检查**：等待终端返回 `Succeeded`。此时，SWA 代理管道与带有 VNet 集成的独立 Function 机架已在物理层闭环锁死 。



```bash
# Step 2: 前端静态视图投放 (GitHub Actions)
git add .
git commit -m "feat(infra): enforce vnet outbound integration for routing plane"
git push origin main

```

* **断言检查**：死守 GitHub Actions 转绿。此时，SWA 内部真空，仅接收静态资产。

```bash
# Step 3: 独立大脑 Python 代码定向重击
cd src/cloud-orchestrator
source .venv/bin/activate
# 定向轰击日本东区计算平面
func azure functionapp publish $(az functionapp list --query "[?contains(name, 'omni-brain')].name" -o tsv) --python

```

```bash
# Step 4: 运行时行政级绝密变量单向盲灌 (去密钥安全形态)
VAR_APP_NAME=$(az functionapp list --query "[?contains(name, 'omni-brain')].name" -o tsv)
VAR_ST_NAME=$(az storage account list --query "[?contains(name, 'omnist')].name" -o tsv)

az functionapp config appsettings set \
  --name $VAR_APP_NAME \
  --resource-group "omni-guard-infra-rg" \
  --settings \
    LOCAL_MOCK_MODE="false" \
    AZURE_STORAGE_ACCOUNT_NAME=$VAR_ST_NAME \
    AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o" \
    AZURE_OPENAI_ENDPOINT="https://0387621-2410-resource.openai.azure.com/" \
    AZURE_OPENAI_API_KEY="<YOUR_AZURE_OPENAI_API_KEY>" \
  --output table

# 强行触发冷启动，逼迫机架容器带着全新的网络拓扑与密钥重生
az functionapp restart --name $VAR_APP_NAME --resource-group "omni-guard-infra-rg"

```

这套方案修复了网络侧的“出站黑洞” ，锁定此版本落盘，随时可以一键物理复活！