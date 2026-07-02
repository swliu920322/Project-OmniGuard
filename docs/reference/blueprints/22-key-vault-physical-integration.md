# DeepSeek V4 开发任务规范：Bicep 物理整合 Key Vault 与零信任双轨身份闭环

> **任务目标**: 在 Bicep 模板中真正部署 Key Vault、User-Assigned Identity 以及 RBAC 授权；在 `secure-iot` 场景中为其建立 Private Endpoint 与 DNS 解析自愈；最后在 Container App 层面实现 Key Vault Reference 动态注入与退避。
> **目标分支**: `feat/scenario-configurator`

---

## 🛠️ 任务 1：Bicep 模板新增 Key Vault 资源与托管身份定义

### 1.1 待修改文件
* 👉 `.azure/templates/sandbox/nested-infra.bicep`
* 👉 `.azure/templates/secure-iot/nested-infra.bicep`

### 1.2 实现细节
在两套场景的 `nested-infra.bicep` 中执行以下修改：

1. **声明 User-Assigned Managed Identity**:
   * 条件触发：仅当 `deployManagedIdentities` 参数为 `true` 时部署。
   ```bicep
   resource backendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (deployManagedIdentities) {
     name: '${prefix}-backend-identity'
     location: location
   }
   ```
2. **声明 Key Vault 资源**:
   * 资源命名：由于 Key Vault 名称必须全球唯一，且限制在 3-24 个字符，使用：`${prefix}-kv-${uniqueString(resourceGroup().id)}`（截断保证长度安全）。
   * 开启 RBAC：`enableRbacAuthorization: true`。
   * **仅在 `secure-iot` 场景中**：设置 `publicNetworkAccess: 'Disabled'` 锁死公网。
   * **在 `sandbox` 场景中**：保留 `publicNetworkAccess: 'Enabled'`（方便极简沙箱测试）。
   ```bicep
   resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
     name: take('${prefix}kv${uniqueString(resourceGroup().id)}', 24)
     location: location
     properties: {
       sku: { family: 'A', name: 'standard' }
       tenantId: subscription().tenantId
       enableRbacAuthorization: true
       publicNetworkAccess: activeScenarioPublicAccess // sandbox 为 Enabled，secure-iot 为 Disabled
     }
   }
   ```
3. **初始化 OpenAI Key 密文**:
   * 将界面传入的 `openAiKey` 作为一个 secret 存入 Key Vault，密命名为 `openAiKey`。
   ```bicep
   resource openAiSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(openAiKey)) {
     parent: keyVault
     name: 'openAiKey'
     properties: {
       value: openAiKey
     }
   }
   ```
4. **进行 Key Vault 权限分配 (RBAC)**:
   * 仅在 `deployManagedIdentities` 为 `true` 时，向 `backendIdentity` 分配 `Key Vault Secrets User`（角色 ID: `46334581-17ef-401a-b113-35a0419c4b5e`）角色。
   ```bicep
   resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployManagedIdentities) {
     name: guid(keyVault.id, backendIdentity.id, '46334581-17ef-401a-b113-35a0419c4b5e')
     scope: keyVault
     properties: {
       principalId: backendIdentity.properties.principalId
       roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '46334581-17ef-401a-b113-35a0419c4b5e')
       principalType: 'ServicePrincipal'
     }
   }
   ```

---

## 🛠️ 任务 2：为 Key Vault 建立 Private Endpoint 与 DNS 自愈 (仅限 `secure-iot`)

### 2.1 待修改文件
* 👉 `.azure/templates/secure-iot/nested-infra.bicep`

### 2.2 实现细节
在 `secure-iot/nested-infra.bicep` 下增加以下网络锁代码：
1. **创建 Key Vault Private Endpoint**:
   * 放置在 `spokeVnet` 的 `StorageSubnet`。
   * 连接类型 `groupIds: [ 'vault' ]`。
2. **创建私有 DNS Zone (`privatelink.vaultcore.azure.net`)**:
   * 建立 VNet Link 关联 spoke 虚拟网络。
   * 建立 `privateDnsZoneGroups` 将 Private Endpoint 网卡 IP 自动注册进私有 DNS Zone。
   *(实现细节可完全参考文件中已有的 cosmosDnsZone 和 blobDnsZone 的写法，保持高度的模块命名一致性。)*

---

## 🛠️ 任务 3：后端容器 (ACA) 双轨自愈挂载

### 3.1 待修改文件
* 👉 `.azure/templates/sandbox/nested-infra.bicep`
* 👉 `.azure/templates/secure-iot/nested-infra.bicep`
* 👉 以及关联的 `compute-module.bicep` (如果在外部定义了容器)

### 3.2 实现细节
1. 在创建容器应用 (`Microsoft.App/containerApps`) 时，**仅在 `deployManagedIdentities` 为 `true` 时**，向容器注入 Managed Identity 绑定：
   ```bicep
   identity: deployManagedIdentities ? {
     type: 'UserAssigned'
     userAssignedIdentities: {
       '${backendIdentity.id}': {}
     }
   } : null
   ```
2. **环境变量退避注入**:
   将注入容器的 `OPENAI_API_KEY` 环境变量改写为双轨制逻辑：
   * 若 `deployManagedIdentities` 为 `true`，使用 Key Vault Reference 语法引用刚刚写入的 Secret：
     `value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/openAiKey)'`
   * 若为 `false`，则直接注入明文模板参数 `openAiKey`。
