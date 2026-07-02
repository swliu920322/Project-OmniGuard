# Project-OmniGuard Bicep 基于场景的配置器开发计划

> **文档性质**: 架构设计与开发计划 | **编写者**: AI Cloud Architect | **当前时间**: 2026-07-02
>
> 传统的云架构设计往往按功能模块（如身份、网络、监控）割裂进行，但在实际架构工作中，**零散的功能组合没有意义，架构必须基于“集成场景”设计**。
> 本计划将配置器重构为**场景驱动 (Scenario-Driven)** 模式，并在 Bicep 层面实现**身份验证配置的一键参数化关闭与降级**（解决到期后学生账号权限不足的问题）。

---

## 1. 目标与设计原则 (Goals & Principles)

1. **场景化一键预设 (Scenario Presets)**：
   不再强制用户在网页上逐个选择 20 几个零散的 SKU，而是提供三个核心业务集成场景的“一键预设”，用户选定场景后，配置器自动推导出一整套互相关联的资源 SKU 与安全拓扑。
2. **身份验证的无缝解耦与参数化移除**：
   学生账号（或到期后的个人账号）通常没有 `User Access Administrator` 权限，无法在订阅或资源组级别创建 Role Assignments（角色指派）和 Managed Identities（托管身份）。
   * **Bicep 层面**：增加参数 `deployManagedIdentities`（布尔值）。若设为 `false`，Bicep 会**完全物理移除**所有 Managed Identity 资源声明、RBAC 角色指派声明，不向 Entra ID 发起任何授权请求。
   * **凭据安全流动**：在非托管身份模式下，Bicep 自动提取 Cosmos DB 和 Storage 的 Master Key，作为环境变量/Secret 注入容器，确保代码不需要任何托管身份凭证即可跑通。

---

## 2. 三大核心集成场景设计 (Scenario Topology)

配置器主页面将提供以下三个场景的滑块选择：

```
┌────────────────────────────────────────────────────────────────────────┐
│                        场景 1: 极简开发沙箱 (Dev Sandbox)               │
│  [ ACA (min=0) ] ──► [ Cosmos DB (Free 400RU) ] (经典 Key 连接)         │
│  * 特点: $0.00/天，ACA 休眠，无 APIM/FrontDoor，无托管身份，完全避开角色指派   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ 升级
┌────────────────────────────────────────────────────────────────────────┐
│                      场景 2: 内网安全物联网 (Secure IoT Pipeline)        │
│  [ ACA ] ──► [ Hub-Spoke VNet (PE + DNS) ] ──► [ DPS (X.509) ]          │
│  * 特点: ~$3.00/天，内网隔离，托管身份授权，通过 DPS 零接触预配设备           │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ 升级
┌────────────────────────────────────────────────────────────────────────┐
│                      场景 3: 全球加速网关门户 (Global API Portal)        │
│  [ Front Door Premium (WAF) ] ──► [ APIM Developer ] ──► [ ACA 内网 ]    │
│  * 特点: ~$16.00/天，全球加速，网关限流与 JWT 校验，防御 OWASP 攻击           │
└────────────────────────────────────────────────────────────────────────┘
```

### 场景配置映射矩阵

| 场景名称 | 适用账号 | 身份验证模式 (`deployManagedIdentities`) | 网络架构 | 核心组件配置 | 预估每日开销 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. 极简开发沙箱**<br>(Dev Sandbox) | 限制权限的学生账号 / 临期订阅 | **False** (不创建任何身份/角色指派) | 扁平公网暴露 | Cosmos DB Free (400 RU), ACA 自动休眠, 传统 Key 认证, 无网关/无 Redis | **~$0.18/天**<br>(近乎免费) |
| **2. 内网隔离物联网**<br>(Secure IoT) | 完整 Contributor/Owner 订阅 | **True** (启用 Managed Identity + RBAC) | Hub-Spoke 内网隔离 | Cosmos DB 自动弹性, 部署 DPS + X.509, 启用 Key Vault PE 与私有 DNS | **~$3.00/天** |
| **3. 全球网关门户**<br>(Global Portal) | 生产环境 / 预算充足的测试账号 | **True** (启用 Managed Identity + RBAC) | 内网隔离 + 全球网关 | 部署 Front Door Premium (WAF) + APIM Developer + Basic Redis | **~$16.00/天** |

---

## 3. Bicep 身份验证参数化解耦方案 (Bicep Auth Parameterization)

为了实现身份验证配置的一键移除，我们需要在 Bicep 模块中加入条件分支：

### 3.1 声明控制参数
在 [main.bicep](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/.azure/main.bicep) 中声明：
```bicep
@description('是否部署托管身份与 RBAC 角色指派。如果为 false，将退回经典连接串/Key认证，适合学生账号')
param deployManagedIdentities bool = false
```

### 3.2 角色指派条件分支 (Conditional Role Assignment)
在 `nested-infra.bicep` 中，托管身份和角色指派资源的创建都依赖于该布尔值：
```bicep
// 只有在 deployManagedIdentities 为 true 时才创建身份
resource backendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (deployManagedIdentities) {
  name: '${prefix}-backend-identity'
  location: location
}

// 只有在 deployManagedIdentities 为 true 时才进行 Cosmos DB 的角色指派
resource cosmosDbRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = if (deployManagedIdentities) {
  name: guid(cosmosAccount.id, deployManagedIdentities ? backendIdentity.id : 'placeholder', 'CosmosDBBuiltInDataContributor')
  parent: cosmosAccount
  properties: {
    principalId: deployManagedIdentities ? backendIdentity.properties.principalId : '00000000-0000-0000-0000-000000000000'
    roleDefinitionId: '/${subscription().id}/providers/Microsoft.DocumentDB/databaseAccounts/${cosmosAccount.name}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002' // Built-in Contributor
    scope: cosmosAccount.id
  }
}
```

### 3.3 容器环境的自适应装载 (Conditional Container Env)
在 `compute-module.bicep` 中，容器拉取拉取环境变量时，如果 `deployManagedIdentities` 为 `false`，则不填入身份，而是直接将 `cosmosKey` 或 `storageKey` 作为凭据注入容器：
```bicep
resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-backend'
  identity: deployManagedIdentities ? {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${backendIdentityId}': {}
    }
  } : null // 如果不启用，ACA 就不挂载任何 UserAssigned 身份
  properties: {
    configuration: {
      secrets: [
        // 始终保留经典 Key 的 secret，作为 fallback 备用
        {
          name: 'cosmos-key'
          value: cosmosKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          env: [
            {
              name: 'COSMOS_ENDPOINT'
              value: cosmosEndpoint
            }
            // 代码层自适应：告知应用是否使用托管身份
            {
              name: 'USE_MANAGED_IDENTITY'
              value: string(deployManagedIdentities)
            }
            {
              name: 'COSMOS_KEY'
              secretRef: 'cosmos-key' // 即使不用托管身份，代码也可以读取这个 Secret Key
            }
          ]
        }
      ]
    }
  }
}
```

---

## 4. 测试与验证方案 (Test & Validation)

为了证明“身份验证配置是可以参数化安全移除的”，我们需要以下两组测试方案：

### 测试 1：经典降级模式编译与部署校验（学生账号模拟）
1. 在配置台中选择 **“场景 1：极简开发沙箱”**（`deployManagedIdentities` 设为 `false`）。
2. 保存配置并生成 `.azure/main.parameters.json`。
3. 执行校验命令：
   ```bash
   az deployment sub validate \
     --location southeastasia \
     --template-file .azure/main.bicep \
     --parameters .azure/main.parameters.json
   ```
4. **验证项**：
   - 终端不输出任何关于“找不到授权权限”、“RoleAssignment 失败”的警告。
   - Bicep 输出的资源清单中，**完全没有** `Microsoft.Authorization/roleAssignments` 资源。
   - 成功部署后，ACA 容器内代码正常运行，通过明文 Key 连接 Cosmos DB。

### 测试 2：企业级托管身份模式校验（高体验模拟）
1. 选择 **“场景 2：内网安全物联网”**（`deployManagedIdentities` 设为 `true`）。
2. 保存配置并生成 `.azure/main.parameters.json`。
3. 执行 `az deployment sub what-if` 校验。
4. **验证项**：
   - 验证资源变更列表中包含 `roleAssignments` 与 `userAssignedIdentities`。
   - ACA 环境变量中 `USE_MANAGED_IDENTITY` 值为 `true`。
