# 部署完资源列表
| **资源名称 (Resource Name)** | **资源类型 (Type)** | **区域 (Location)** |
| --- | --- | --- |
| **omni-aca-env-2ldbii7jgilfq** | Container Apps Environment | Southeast Asia |
| **omni-backend** | Container App | Southeast Asia |
| **omni-backend-nsg** | Network security group | Southeast Asia |
| **omni-frontend** | Container App | Southeast Asia |
| **omni-hub-vnet** | Virtual network | Southeast Asia |
| **omni-logs-2ldbii7jgilfq** | Log Analytics workspace | Southeast Asia |
| **omni-mem-2ldbii7jgilfq** | Azure Cosmos DB account | Southeast Asia |
| **omni-spoke-vnet** | Virtual network | Southeast Asia |
| **omni-storage-nsg** | Network security group | Southeast Asia |
| **omniacr2ldbii7jgilfq** | Container registry | Southeast Asia |
| **omnikv2ldbii7jgilfq** | Key vault | Southeast Asia |
| **omnist2ldbii7jgilfq** | Storage account | Southeast Asia |

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

> **📌 诊断说明**：
> 1. 后端应用 `omni-backend` 配置为**仅限内网访问 (`external: false`)**，以保障 API 安全。所以在外部公网直接 `curl` 后端会返回 `404 Stopped or does not exist`。
> 2. 由于开启了“自动休眠 (Scale-to-Zero)”，无流量时后端副本数已缩容到 0 台，所以提示 `Could not find a replica`。
>
> **🛠️ 自愈唤醒与调试日志抓取步骤**：
> 
> * **方案 A：通过公网前端连锁唤醒**
>   ```bash
>   # 1. 获取公网暴露的前端 FQDN 域名
>   FE_FQDN=$(az containerapp show -g "$RG" -n "omni-frontend" --query "properties.configuration.ingress.fqdn" -o tsv)
>   # 2. 发起心跳请求，前端容器将通过 VNet 私网唤醒后端
>   curl -i "https://$FE_FQDN"
>   # 3. 重新获取后端日志
>   az containerapp logs show -g "$RG" -n "$BACKEND_APP" --follow
>   ```
> 
> * **方案 B：临时将后端扩容为常驻 1 台实例（推荐本地直接调试）**
>   ```bash
>   # 1. 强制将后端最小副本数设为 1 
>   az containerapp update -g "$RG" -n "$BACKEND_APP" --min-replicas 1
>   # 2. 此时实例常驻在线，直接抓取运行日志
>   az containerapp logs show -g "$RG" -n "$BACKEND_APP" --follow
>   # 3. 调试结束后，恢复自动休眠（重置为 0）
>   az containerapp update -g "$RG" -n "$BACKEND_APP" --min-replicas 0
>   ```

```
# 方案 A 验收 
# curl -i "https://$FE_FQDN" 时间很久

# 修改了默认端口
PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"

# 1. 动态更新云端前端 Ingress 的 targetPort 端口为 80 
az containerapp ingress enable \
  -g "$RG" \
  -n "${PREFIX}-frontend" \
  --target-port 80 \
  --type external \
  --transport auto

# 返回
Ingress enabled. Access your app at https://omni-frontend.thankfulgrass-ca6dbee4.southeastasia.azurecontainerapps.io/

{
  "additionalPortMappings": null,
  "allowInsecure": false,
  "clientCertificateMode": null,
  "corsPolicy": null,
  "customDomains": null,
  "exposedPort": 0,
  "external": true,
  "fqdn": "omni-frontend.thankfulgrass-ca6dbee4.southeastasia.azurecontainerapps.io",
  "ipSecurityRestrictions": null,
  "stickySessions": null,
  "targetPort": 80,
  "traffic": [
    {
      "latestRevision": true,
      "weight": 100
    }
  ],
  "transport": "Auto"
}

# 再次执行方案 A 秒回
HTTP/2 404 
content-type: text/html; charset=utf-8
content-length: 1946
date: Thu, 02 Jul 2026 09:29:47 GMT

<!DOCTYPE html>
...
<//html>
# 继续验收
az containerapp logs show -g "$RG" -n "$BACKEND_APP" --follow
Could not find a replica for this app


# 测试方案 B

{"TimeStamp": "2026-07-02T09:40:33.59982", "Log": "Connecting to the container 'backend'..."}
{"TimeStamp": "2026-07-02T09:40:33.64349", "Log": "Successfully Connected to container: 'backend' [Revision: 'omni-backend--0000001', Replica: 'omni-backend--0000001-75fc795ff7-kjb86']"}
{"TimeStamp": "2026-07-02T09:40:04.535543+00:00", "Log": "F listening on port 80"}

```