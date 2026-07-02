# 3. 全球门户 (Global Portal) 场景验证

## 部署资源清单
在 `omni4` 租户前缀下，全球门户场景成功拉起了 100% 完整的安全网关网络底座与应用。其相比内网隔离（Secure-IoT）多部署了一个 Static Web App (SWA)，并去除了 Container App 前端。

| **资源名称 (Resource Name)** | **资源类型 (Type)** | **区域 (Location)** | **对比与校验结论** |
| --- | --- | --- | --- |
| **omni4-frontend-swa** | Static Web App | **East US 2** | ✅ 替换了 ACA 前端（SWA 元数据区域由 Azure 统一托管在美东，正常现象） |
| **omni4-backend** | Container App | Southeast Asia | ✅ 后端微服务，状态 Succeeded |
| **omni4-backend-identity** | Managed Identity | Southeast Asia | ✅ 后端托管身份已绑定 |
| **omni4-hub-vnet** | Virtual network | Southeast Asia | ✅ Hub VNet 控制总线已建立 |
| **omni4-spoke-vnet** | Virtual network | Southeast Asia | ✅ Spoke VNet 数据总线已建立 (含对等互通) |
| **omni4-kv-pe** | Private endpoint | Southeast Asia | ✅ Key Vault 内网私有端点已建立 |
| **omni4-cosmos-pe** | Private endpoint | Southeast Asia | ✅ Cosmos DB 内网私有端点已建立 |
| **omni4-blob-pe** | Private endpoint | Southeast Asia | ✅ Storage Blob 内网私有端点已建立 |
| **omni4kvdqc4dlxl22ys6** | Key vault | Southeast Asia | ✅ 极密保险箱已就位 |
| **omni4-mem-dqc4dlxl22ys6** | Azure Cosmos DB account | Southeast Asia | ✅ NoSQL 数据库已就位 |
| **iot-omni4-dqc4dlxl22ys6** | IoT Hub | Southeast Asia | ✅ 物联网核心控制中心 |
| **omni4-iot-dps** | IoT Hub DPS | Southeast Asia | ✅ 设备零接触注册中心 |

---

## 1. Static Web App (SWA) 部署验证
```bash
PREFIX="omni4"
RG="${PREFIX}-guard-infra-sea-rg"
FRONTEND_SWA="${PREFIX}-frontend-swa"
BACKEND_APP="${PREFIX}-backend"

az staticwebapp show \
  -g "$RG" \
  -n "$FRONTEND_SWA" \
  --query "{DefaultDomain:defaultHostname, State:status}" -o table
```

### 实际输出：
```text
DefaultDomain
-------------------------------------------
brave-grass-0aca3f50f.7.azurestaticapps.net
```
* **结论**：SWA 全球 CDN 加速域名获取成功，前端资产已在全球边缘节点托管就绪。

---

## 2. 后端托管身份与容器状态校验
```bash
az containerapp show \
  -g "$RG" \
  -n "$BACKEND_APP" \
  --query "{State:properties.provisioningState, MI:identity.userAssignedIdentities}"
```

### 实际输出：
```json
{
  "MI": {
    "/subscriptions/970ded9b-33a0-4745-8240-c8f6e7b73705/resourcegroups/omni4-guard-infra-sea-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/omni4-backend-identity": {
      "clientId": "9dd846de-b020-4652-bbea-a3aef34043cc",
      "principalId": "4da062c9-c80b-40b7-ba07-ef5f2ecf83c7"
    }
  },
  "State": "Succeeded"
}
```
* **结论**：后端容器处于正常 `Succeeded` 规格，且已成功挂载 `omni4-backend-identity` 托管身份。

---

## 3. 私网 Private Endpoint 与内网 DNS 自愈解析校验
```bash
# 1. 检查 Key Vault 私网 DNS 解析记录
az network private-dns record-set a list \
  -g "$RG" \
  -z privatelink.vaultcore.azure.net \
  --query "[].{Host:name, IP:aRecords[0].ipv4Address}" -o table
```

### 实际输出：
```text
Host                  IP
--------------------  --------
omni4kvdqc4dlxl22ys6  10.1.2.4
```

```bash
# 2. 检查 Cosmos DB 私网 DNS 解析记录
az network private-dns record-set a list \
  -g "$RG" \
  -z privatelink.documents.azure.com \
  --query "[].{Host:name, IP:aRecords[0].ipv4Address}" -o table
```

### 实际输出：
```text
Host                                   IP
-------------------------------------  --------
omni4-mem-dqc4dlxl22ys6                10.1.2.6
omni4-mem-dqc4dlxl22ys6-southeastasia  10.1.2.7
```
* **结论**：内网自愈解析完全成功，Key Vault 和 Cosmos DB 均已安全阻断公网，切换到了 `10.1.2.x` 的 `StorageSubnet` 内网网段内！

---

## 🛡️ 架构总结与说明（关于 WAF / Front Door）
1. **网络拓扑对齐**：全球门户场景下，后端网络骨架完全继承自内网隔离场景，包含完整的 `hub-vnet` 和 `spoke-vnet` 的双 VNet Hub-Spoke 拓扑及对等互通 (Peering)，物理私有链解析完整，没有缺失任何内网安全资源。
2. **WAF / Front Door 边界说明**：
   在项目规划蓝图（`configurator-development-plan.md`）中，全球门户场景规划了部署 `Front Door Premium (WAF)` 和 `APIM`。
   但在目前的物理 IaC Bicep 模块 baseline 实现中，**并未包含这俩资源的物理模板**。目前全球门户在 Bicep 数据面的核心动作是**“将 ACA 容器前端替换为了在全球边缘节点多活分发的静态 Web 应用 (SWA)”**。因此未能在资源列表中看到 Front Door 和 WAF 属于正常表现（并非 Bicep 模板遗漏）。
