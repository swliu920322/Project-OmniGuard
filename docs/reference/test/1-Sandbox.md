# 部署完资源列表
omni-aca-env-2ldbii7jgilfq
Container Apps Environment
Southeast Asia
omni-backend
Container App
Southeast Asia
omni-backend-nsg
Network security group
Southeast Asia
omni-frontend
Container App
Southeast Asia
omni-hub-vnet
Virtual network
Southeast Asia
omni-logs-2ldbii7jgilfq
Log Analytics workspace
Southeast Asia
omni-mem-2ldbii7jgilfq
Azure Cosmos DB account
Southeast Asia
omni-spoke-vnet
Virtual network
Southeast Asia
omni-storage-nsg
Network security group
Southeast Asia
omniacr2ldbii7jgilfq
Container registry
Southeast Asia
omnikv2ldbii7jgilfq
Key vault
Southeast Asia
omnist2ldbii7jgilfq
Storage account
Southeast Asia

## 验收脚本
1.  验证步骤与命令行
```
# 0. 声明您在配置台使用的实际前缀（默认是 omni，如果修改了请在此处替换）
PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"
VNET_NAME="${PREFIX}-spoke-vnet"
BACKEND_APP="${PREFIX}-backend"

# 1.查询 VNet 下的所有子网网段及关联 of NSG 状态
az network vnet subnet list \
  -g "$RG" \
  --vnet-name "$VNET_NAME" \
  --query "[].{Subnet:name, Prefix:addressPrefix, NSG:networkSecurityGroup.id}" \
  -o table
  
# 1.返回
BackendSubnet  10.1.4.0/23  /subscriptions/970ded9b-33a0-4745-8240-c8f6e7b73705/resourceGroups/omni-guard-infra-sea-rg/providers/Microsoft.Network/networkSecurityGroups/omni-backend-nsg
StorageSubnet  10.1.2.0/24  /subscriptions/970ded9b-33a0-4745-8240-c8f6e7b73705/resourceGroups/omni-guard-infra-sea-rg/providers/Microsoft.Network/networkSecurityGroups/omni-storage-nsg

```
2. Cosmos DB 公网连接与密钥自愈校验 验证 Cosmos DB 可正常被公网解析并获取明文连接串
```
# 获取 Cosmos DB 的 Primary Connection String
COSMOS_NAME=$(az cosmosdb list -g "$RG" --query "[0].name" -o tsv)
az cosmosdb keys list \
  -g "$RG" \
  -n "$COSMOS_NAME" \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" -o tsv
  
# 返回
AccountEndpoint=https://omni-mem-2ldbii7jgilfq.documents.azure.com:443/;AccountKey=5Yqo1GHhwxS4TKlALPQL1GXoTjK8eAAxNiKyHiDd5uSyUObE7L0iqg7sSX3CZ0t7yoQW8ZF1BUFaACDb94U8UA==;
```
3. 容器应用 (ACA) 运行日志与降级环境变量校验 验证后台容器成功以经典密钥模式启动，且未发生 CrashLoop
```
# 1. 检查容器当前的预配状态与环境变量
az containerapp show \
  -g "$RG" \
  -n "$BACKEND_APP" \
  --query "{State:properties.provisioningState, MI:identity.type, Env:properties.template.containers[0].env}"
  
# 返回
{
  "Env": [
    {
      "name": "USE_MANAGED_IDENTITY",
      "value": "False"
    },
    {
      "name": "COSMOS_ENDPOINT",
      "value": "https://omni-mem-2ldbii7jgilfq.documents.azure.com:443/"
    },
    {
      "name": "COSMOS_KEY",
      "secretRef": "cosmos-key"
    },
    {
      "name": "AZURE_STORAGE_ACCOUNT_NAME",
      "value": "omnist2ldbii7jgilfq"
    },
    {
      "name": "AZURE_STORAGE_ACCOUNT_KEY",
      "secretRef": "storage-key"
    },
    {
      "name": "AzureWebJobsStorage",
      "secretRef": "storage-connection-string"
    },
    {
      "name": "IotHubServiceConnectionString",
      "secretRef": "iothub-service-conn"
    },
    {
      "name": "IotHubEventHubConnectionString",
      "secretRef": "iothub-eventhub-conn"
    },
    {
      "name": "OPENAI_API_KEY",
      "value": "4V6DlFXfah4PxrvwCMTZAuWmtQkoPZKpSHWRSnSkoY8yBTz4EAuXJQQJ99CFACqBBLyXJ3w3AAAAACOGSyLr"
    }
  ],
  "MI": "None",
  "State": "Succeeded"
}


# 2. 查看容器应用启动实时日志，检查有无数据库连接握手报错
az containerapp logs show \
  -g "$RG" \
  -n "$BACKEND_APP" \
  --follow
  
# 返回
Could not find a replica for this app
```

> **📌 诊断说明**：返回 `Could not find a replica for this app` 是因为极简沙箱开启了“自动休眠功能包 (Scale-to-Zero)”且此时没有流量，副本数已缩容到 0 台。
> **唤醒与抓取日志步骤**：
> ```bash
> # 1. 获取公网域名
> FQDN=$(az containerapp show -g "$RG" -n "$BACKEND_APP" --query "properties.configuration.ingress.fqdn" -o tsv)
> # 2. 发起一次 HTTP 心跳唤醒实例
> curl -i "https://$FQDN"
> # 3. 重新获取日志流
> az containerapp logs show -g "$RG" -n "$BACKEND_APP" --follow
> ```