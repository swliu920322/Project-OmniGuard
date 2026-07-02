# 蓝图 01: 身份基座 (Identity Foundation)

> **领域**: 身份与访问管理 | **优先级**: P0 | **复杂度**: 中 | **预估工时**: 2天
> **核心机制**: 双轨制身份退避 (Fallback) & 零信任“身网双锁”

---

## 1. 现状与痛点

### 当前做法
* 后端容器 (ACA) 与 Functions 以明文环境变量（`local.settings.json` / 容器 App Settings）存储高危连接字符串 (Cosmos DB, Storage, OpenAI Key)。
* 资源间的通信均依赖静态密钥，无轮转机制，泄露风险极高。
* 缺乏集中式凭据审计与准入控制。

---

## 2. 架构设计：双轨制与“身网双锁”

为了兼顾**企业极端安全合规（零信任）**与**受限环境（如学生账号、沙箱订阅）的兼容性**，我们设计了以下身份基座架构：

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Entra ID (Azure AD) 身份控制                     │
 │  ┌──────────────────────────────────────────────────────────────┐     │
 │  │ User-Assigned Managed Identity: omni-backend-identity         ├─┐   │
 │  └──────────────────────────────┬───────────────────────────────┘ │   │
 └─────────────────────────────────┼─────────────────────────────────┼───┘
                                   │ (RBAC: Secrets User)            │ (RBAC: DB Contributor)
                                   ▼                                 ▼
 ┌─────────────────────────────────┴──┐                      ┌───────┴──────┐
 │   Azure Key Vault (omni-kv)        │                      │  Cosmos DB   │
 │   * publicNetworkAccess: Disabled  │                      │  (No Key)    │
 └─────────────────┬──────────────────┘                      └──────────────┘
                   │
                   ▼ (Private Endpoint Network Flow)
 ┌─────────────────┴────────────────────────────────────────────────────────┐
 │  Spoke Virtual Network (VNet) - StorageSubnet                           │
 │  ├─ Private Endpoint: omni-kv-pe (Private IP: 10.1.2.5)                  │
 │  └─ Private DNS Zone: privatelink.vaultcore.azure.net                    │
 └─────────────────────────────────▲────────────────────────────────────────┘
                                   │ (VNet Inbound Route)
 ┌─────────────────────────────────┴────────────────────────────────────────┐
 │  Backend Container App (ACA) - BackendSubnet (10.1.4.0/23)              │
 │  ├─ Attached User-Assigned Managed Identity                             │
 │  └─ Secret Reference: @Microsoft.KeyVault(SecretUri=...)                 │
 └──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 双轨制退避设计 (Dual-Track Fallback)
由于非订阅管理员（Restricted Accounts）无法执行 `Microsoft.Authorization/roleAssignments/write`，强行部署 RBAC 会导致部署中断。我们通过 `deployManagedIdentities` 状态参数实现无缝退避：

| 运行环境 | `deployManagedIdentities: true` (托管身份轨) | `deployManagedIdentities: false` (经典密钥轨) |
| :--- | :--- | :--- |
| **适用账号** | 订阅 Owner、企业 Landing Zone 部署主体 | 学生账号、受限开发沙箱、无授权测试账号 |
| **凭据存储** | 100% 托管于 Azure Key Vault，零明文密钥 | 存储于 Web App Settings 密文区 |
| **通信机制** | **无密钥通信**：通过 Azure SDK 凭据访问资源 | **密钥通信**：通过连接字符串/对称密钥访问 |
| **依赖资源** | 创建 `roleAssignments` 授权记录 | 不创建任何授权资源，Bicep 一键裁剪授权逻辑 |
| **部署成功率**| 极高（需特权） | 100%（仅需普通资源创建权） |

### 2.2 系统分配 vs 用户分配托管身份
在企业模板中，我们统一选用 **用户分配托管身份 (User-Assigned Managed Identity)**：
1. **解除 Bicep 循环依赖**：系统分配身份必须在容器创建后生成，无法在容器拉起前完成 Key Vault 的授权指派。用户分配身份可以被先创建、先授权，最后绑定到容器，解除编译依赖锁。
2. **免重建授权延迟**：容器若因更新或故障重建，其绑定的用户分配身份及其 RBAC 授权不会丢失，消除了系统分配身份每次重建都要等待 Entra ID 5-10 分钟同步延迟的问题。
3. **细粒度微服务复用**：多个关联的后台 ACA 容器可共享同一身份上下文，降低授权审计复杂度。

### 2.3 零信任“身网双锁”架构 (Identity & Network Lock)
* **身份锁 (Identity Lock)**：
  容器仅挂载 `User-Assigned Managed Identity`。针对 Key Vault 仅授予 `Key Vault Secrets User`（无写权、无管理权），容器通过应用原生的 Key Vault Reference 在运行时动态注入环境变量，防止明文凭据落盘或暴露在 Console。
* **网络锁 (Network Lock)**：
  将 Key Vault 关闭公网访问 (`publicNetworkAccess: 'Disabled'`)。在其所在的 `StorageSubnet` 内打通 **Private Endpoint**，并在虚拟网络中绑定 `privatelink.vaultcore.azure.net` 私有 DNS 区域，容器读取密钥的流量 100% 走虚拟网络内网，实现物理级网络防脱水。

---

## 3. 实施步骤 (Bicep 最佳实践)

### Step 1: 声明 User-Assigned Identity
在 `compute-module.bicep` 中预先定义身份，确保其先于容器被创建：
```bicep
resource backendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (deployManagedIdentities) {
  name: '${prefix}-backend-identity'
  location: location
}
```

### Step 2: 为 Key Vault 分配只读角色 (RBAC)
```bicep
var keyVaultSecretsUserRole = '46334581-17ef-401a-b113-35a0419c4b5e' // Built-in Secrets User Role ID

resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployManagedIdentities) {
  name: guid(keyVault.id, backendIdentity.id, keyVaultSecretsUserRole)
  scope: keyVault
  properties: {
    principalId: backendIdentity.properties.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRole)
    principalType: 'ServicePrincipal'
  }
}
```

### Step 3: 建立网络私有锁 (Private Endpoint)
```bicep
resource kvPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-kv-pe'
  location: location
  properties: {
    subnet: { id: storageSubnetId }
    privateLinkServiceConnections: [
      {
        name: '${prefix}-kv-connection'
        properties: {
          privateLinkServiceId: keyVault.id
          groupIds: [ 'vault' ]
        }
      }
    ]
  }
}
```

### Step 4: 双轨制降级自愈逻辑 (Bicep Mapping)
在后端容器的环境变量定义中，根据 `deployManagedIdentities` 决定注入托管身份引用还是明文密钥：
```bicep
env: [
  {
    name: 'OPENAI_API_KEY'
    value: deployManagedIdentities ? '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/openAiKey)' : fallbackOpenAiKey
  }
]
```

---

## 4. 验收与合规审计清单
- [ ] 容器内 `nslookup <vault-name>.vault.azure.net` 必须解析为 VNet 私有 IP（如 `10.1.2.x`），而非公网 IP。
- [ ] 外部浏览器尝试直连 `<vault-name>.vault.azure.net` 必须返回 `403 PublicAccessDisabled`。
- [ ] 在 `deployManagedIdentities: false` 模式下，受限账号执行 `preflight-validate.py` 必须绿灯通过。
