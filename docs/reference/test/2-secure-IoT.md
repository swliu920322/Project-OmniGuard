# 2: 内网隔离 (Secure-IoT) 验收文档

## 生成资源组omni3-guard-infra-sea-rg
| **资源名称 (Resource Name)** | **资源类型 (Type)** | **区域 (Location)** |
| --- | --- | --- |
| **iot-omni3-vjq2hppd3wpeu** | IoT Hub | Southeast Asia |
| **omni3-aca-env-vjq2hppd3wpeu** | Container Apps Environment | Southeast Asia |
| **omni3-backend** | Container App | Southeast Asia |
| **omni3-backend-identity** | Managed Identity | Southeast Asia |
| **omni3-backend-nsg** | Network security group | Southeast Asia |
| **omni3-blob-pe** | Private endpoint | Southeast Asia |
| **omni3-blob-pe.nic.2a3530ec-bbf3-4266-aa0a-cc71ca31b49d** | Network Interface | Southeast Asia |
| **omni3-cosmos-pe** | Private endpoint | Southeast Asia |
| **omni3-cosmos-pe.nic.e70afc39-d97c-4cfa-ae31-d85015158d6d** | Network Interface | Southeast Asia |
| **omni3-frontend** | Container App | Southeast Asia |
| **omni3-hub-vnet** | Virtual network | Southeast Asia |
| **omni3-iot-dps** | Azure IoT Hub Device Provisioning Service (DPS) | Southeast Asia |
| **omni3-kv-pe** | Private endpoint | Southeast Asia |
| **omni3-kv-pe.nic.4ed3a5d3-2853-4049-8b88-b953d414bf35** | Network Interface | Southeast Asia |
| **omni3-logs-vjq2hppd3wpeu** | Log Analytics workspace | Southeast Asia |
| **omni3-mem-vjq2hppd3wpeu** | Azure Cosmos DB account | Southeast Asia |
| **omni3-spoke-vnet** | Virtual network | Southeast Asia |
| **omni3-storage-nsg** | Network security group | Southeast Asia |
| **omni3acrvjq2hppd3wpeu** | Container registry | Southeast Asia |
| **omni3kvvjq2hppd3wpeu** | Key vault | Southeast Asia |
| **omni3stvjq2hppd3wpeu** | Storage account | Southeast Asia |
| **privatelink.blob.core.windows.net** | Private DNS zone | Global |
| **privatelink.documents.azure.com** | Private DNS zone | Global |
| **privatelink.vaultcore.azure.net** | Private DNS zone | Global |

## 1. 托管身份验证
```bash
PREFIX="omni3"
RG="${PREFIX}-guard-infra-sea-rg"
BACKEND_APP="${PREFIX}-backend"

az identity list \
  -g "$RG" \
  --query "[].{Name:name, Principal:principalId}" -o table

# 输出
最开始没有输出，调整之后

Name                    Principal
----------------------  ------------------------------------
omni3-backend-identity  01ab878d-41ca-4242-af60-13557cb2e8e5
```

## 2. Key Vault 安全网络锁及 RBAC 只读权限校验
```bash

### 🔐 阶段一：默认态（未授权身份，双重锁定）
```bash
# 1. 自动提取 Key Vault 实例名
KV_NAME=$(az keyvault list -g "$RG" --query "[0].name" -o tsv)

# 2. 尝试列出 Secrets 列表
az keyvault secret list --vault-name "$KV_NAME"

# 返回（安全拦截：未授权身份拦截）
Code: Forbidden                                                                                                                                                   
Message: Caller is not authorized to perform action on resource.                                                                                                  
Inner error: {
    "code": "ForbiddenByRbac"
}   
```
* **结论**：身份锁（RBAC）拦截生效，外部未授权账号被成功拒之门外。

---

### 🌐 阶段二：临时授权态（测试物理网络隔离锁）
为了测试 Key Vault 防火墙是否物理隔离了公网，我们用命令行临时给当前登录的用户授予 `Key Vault Secrets Reader` 角色：

```bash
# 1. 获取当前登录 Azure CLI 的用户 Principal ID
MY_USER_ID=$(az ad signed-in-user show --query id -o tsv)

# 2. 临时授予该用户 Key Vault Secrets Reader (只读) 角色
az role assignment create \
  --assignee "$MY_USER_ID" \
  --role "Key Vault Secrets Reader" \
  --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KV_NAME"

# 3. 角色指派通常需要 10-30 秒在全球同步。稍等片刻后，再次尝试公网列出 Secrets：
az keyvault secret list --vault-name "$KV_NAME"

# 返回（安全拦截：公网防火墙网络拦截）
(PublicAccessDisabled) Public network access is not permitted on this site. To connect to this site, use the private endpoint from inside your virtual network or associated networks.
Code: Forbidden
Message: Public network access is not permitted on this site.
```
* **结论**：公网防火墙拦截生效！即便拥有了读取身份，由于从外部公网发起连接，依然被物理网络锁硬拦截，证明私网隔离 100% 成立！

---

### 🧹 阶段三：清理临时角色指派（符合 Zero-Trust 权限回收）
验证完毕后，回收刚才的临时只读权限，恢复双锁锁定状态：

```bash
# 删除刚才指派给自己的只读角色
az role assignment delete \
  --assignee "$MY_USER_ID" \
  --role "Key Vault Secrets Reader" \
  --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KV_NAME"
```

---

## 3. 私网 Private Endpoint 与内网 DNS 自愈解析校验
请运行以下命令，验证 Key Vault 与 Cosmos DB 在内网中是否已被分配私有 IP 并注册了 A 记录：

```bash
# 1. 检查 Key Vault 私网 DNS 解析记录
az network private-dns record-set a list \
  -g "$RG" \
  -z privatelink.vaultcore.azure.net \
  --query "[].{Host:name, IP:aRecords[0].ipv4Address}" -o table

# 输出
--------------------  --------
omni3kvvjq2hppd3wpeu  10.1.2.4

# 2. 检查 Cosmos DB 私网 DNS 解析记录
az network private-dns record-set a list \
  -g "$RG" \
  -z privatelink.documents.azure.net \
  --query "[].{Host:name, IP:aRecords[0].ipv4Address}" -o table
```
*期望输出*：返回的解析 IP 地址均应处于内网 `10.1.2.x`（StorageSubnet）网段内，证明内网私路解析已成功自愈建立！

*实际输出*:
ParentResourceNotFound) Failed to perform 'read' on resource(s) of type 'privateDnsZones/A', because the parent resource '/subscriptions/970ded9b-33a0-4745-8240-c8f6e7b73705/resourceGroups/omni3-guard-infra-sea-rg/providers/Microsoft.Network/privateDnsZones/privatelink.documents.azure.net' could not be found.             
Code: ParentResourceNotFound                                                                                                                                      
Message: Failed to perform 'read' on resource(s) of type 'privateDnsZones/A', because the parent resource '/subscriptions/970ded9b-33a0-4745-8240-c8f6e7b73705/resourceGroups/omni3-guard-infra-sea-rg/providers/Microsoft.Network/privateDnsZones/privatelink.documents.azure.net' could not be found. 
---

## 4. 容器运行状态与 Key Vault 秘密挂载校验
验证容器应用在 `always-on` 常驻规格下是否启动成功，并以托管身份拉取了 Key Vault 密文：

```bash
# 1. 检查容器当前的预配状态与托管身份挂载
az containerapp show \
  -g "$RG" \
  -n "$BACKEND_APP" \
  --query "{State:properties.provisioningState, MI:identity.userAssignedIdentities}"

# 2. 查看容器应用实时日志，确认无数据库或 Key Vault 握手报错
az containerapp logs show \
  -g "$RG" \
  -n "$BACKEND_APP" \
  --follow
```
*期望输出*：
* 状态为 `Succeeded`，且挂载了 `omni3-backend-identity` 托管身份；
* 运行日志流中无数据库报错，能成功与内网隔离的 Cosmos DB 完成通信。