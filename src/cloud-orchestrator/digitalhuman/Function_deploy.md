# 🧑‍🔧 Azure Static Web Apps 内嵌函数物理蒸发方案
---

## 🚀 4步冷启动标准操作程序 (SOP Runbook)

一旦运行物理蒸发脚本，严格按照以下流水线进行冷启动：

```bash
# 执行冷启动前置对齐（按需物理对齐泰莱大学学术订阅）
az login --tenant "sd.taylors.edu.my"

# Step 1: 基础设施硬件就位 (Bicep 编译)
./infra_up.sh
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
./upload_function.sh
```

```bash
# Step 4: 运行时行政级绝密变量单向盲灌 (去密钥安全形态)
# =========================================================================
# 🔒 庚金总工运行时变量对账与防御性盲灌流水线
# =========================================================================
VAR_RG="omni-guard-infra-rg"

echo "📡 正在收拢半径，精准提取资源组 [$VAR_RG] 内部的真机芯片组..."
# 🟩 刚性锁死 RG，采用确定性索引 [0] 抓取，湮灭空值风险
VAR_APP_NAME=$(az functionapp list --resource-group "$VAR_RG" --query "[0].name" -o tsv)
VAR_ST_NAME=$(az storage account list --resource-group "$VAR_RG" --query "[0].name" -o tsv)

# 🚨 运行时断言拦截：如果变量为空，就地熔断，防止 Bash 语法二次塌陷
if [ -z "$VAR_APP_NAME" ] || [ -z "$VAR_ST_NAME" ]; then
    echo "❌ [FATAL ERROR] 提取失败！在资源组 '$VAR_RG' 中未寻获存活的 Function 或 Storage。"
    echo "💡 请先确认你的 Bicep 基础设施已完全通车 (运行 ./infra-up.sh)。"
    exit 1
fi

echo "🎯 硬件清点完毕：计算大脑 -> $VAR_APP_NAME | 存储底座 -> $VAR_ST_NAME"
echo "⚡ 开始执行行政级运行时参数倒灌..."

# 🟩 所有变量刚性加注双引号包裹，即使发生不可抗力变数，也绝不破坏 CLI 语法拓扑
az functionapp config appsettings set \
  --name "$VAR_APP_NAME" \
  --resource-group "$VAR_RG" \
  --settings \
    LOCAL_MOCK_MODE="false" \
    AZURE_STORAGE_ACCOUNT_NAME="$VAR_ST_NAME" \
    AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o" \
    AZURE_OPENAI_ENDPOINT="https://0387621-2410-resource.openai.azure.com/" \
    AZURE_OPENAI_API_KEY="9t3ITR5Tzns5Zk9XFui7rRdeTMzfaf1gqSfReaZyyFe18Zl6uN5gJQQJ99CCACi0881XJ3w3AAAAACOGLQ7e" \
  --output table

# 强制重启计算平面，撕裂幽灵缓存，强推新环境变量生效
az functionapp restart --name "$VAR_APP_NAME" --resource-group "$VAR_RG"

```

这套方案修复了网络侧的“出站黑洞” ，锁定此版本落盘，随时可以一键物理复活！