# 2: 内网隔离 (Secure-IoT) 验收文档

## 1. 托管身份验证
```
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
# 网络锁验证：确认 Key Vault 阻断了公网流量：
KV_NAME=$(az keyvault list -g "$RG" --query "[0].name" -o tsv)
az keyvault secret list --vault-name "$KV_NAME"

# 返回
Code: Forbidden                                                                                                                                                   
Message: Caller is not authorized to perform action on resource.                                                                                                  
Inner error: {                                                                                                                                                    
    "code": "ForbiddenByRbac"                                                                                                                                     
}   
```

> **📌 诊断说明**：
> 返回 `ForbiddenByRbac` 证明 **身份锁 (RBAC) 已成功实施拦截**。
> 因为当前 Azure CLI 登录账户虽然是订阅 Owner，但未被显式授予该 Key Vault 的 Secrets 读取权限。
> **验证网络隔离锁 (PublicAccessDisabled)**：若需专门测试物理网络拦截，可先在 Azure Portal 上给您的个人账号在 Key Vault 级别授予 `Key Vault Secrets Reader` 权限，之后在公网运行该命令，即可看见 `PublicAccessDisabled` 物理网络阻断报错。

---

## 3. 私网 Private Endpoint 与内网 DNS 自愈解析校验
请运行以下命令，验证 Key Vault 与 Cosmos DB 在内网中是否已被分配私有 IP 并注册了 A 记录：

```bash
# 1. 检查 Key Vault 私网 DNS 解析记录
az network private-dns record-set a list \
  -g "$RG" \
  -z privatelink.vaultcore.azure.net \
  --query "[].{Host:name, IP:aRecords[0].ipv4Address}" -o table

# 2. 检查 Cosmos DB 私网 DNS 解析记录
az network private-dns record-set a list \
  -g "$RG" \
  -z privatelink.documents.azure.net \
  --query "[].{Host:name, IP:aRecords[0].ipv4Address}" -o table
```
*期望输出*：返回的解析 IP 地址均应处于内网 `10.1.2.x`（StorageSubnet）网段内，证明内网私路解析已成功自愈建立！

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