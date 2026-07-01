# 蓝图 01: 身份基座 (Identity Foundation)

> **领域**: 身份与访问管理 | **优先级**: P0 | **复杂度**: 低~中 | **预估工时**: 2天

---

## 1. 现状分析

### 当前做法
- ACA 后端容器通过 `local.settings.json` / 容器环境变量存储连接字符串 (Cosmos DB, Storage, IoT Hub)
- 所有的 Azure 资源依赖连接字符串或密钥进行身份验证
- 无 Azure Key Vault
- 无 Managed Identity 集成
- Cosmos DB 的 `accountEndpoint` 和 `credential` 以明文环境变量传入
- 本地开发使用 `local.settings.json` 真实凭据 (泄露风险)

### 风险
| 风险项 | 严重程度 |
|--------|---------|
| 连接字符串明文存储在容器环境变量 | 高 |
| 凭据轮换需要重新部署容器 | 中 |
| 无集中密钥管理/审计 | 高 |
| 本地设置文件含真实凭据 (已提交 git? 全在 .gitignore) | 中 |

---

## 2. 目标架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                       Entra ID (Azure AD)                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Managed Identity: omni-backend-identity                 │    │
│  │  Managed Identity: omni-frontend-identity                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────┐
│   Key Vault      │    │  Azure Resources  │
│  omni-kv-xxxx    │    │                   │
│                  │    │  ┌─────────────┐  │
│  ├─ CosmosDBKey  │◄───┤  │ Cosmos DB    │  │
│  ├─ StorageKey   │◄───┤  │ Storage      │  │
│  ├─ IoTHubKey    │◄───┤  │ IoT Hub      │  │
│  ├─ AcrPassword  │◄───┤  │ ACR          │  │
│  └─ ...          │    │  └─────────────┘  │
└─────────────────┘    └──────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  ACA Backend (omni-backend)          │
│  ├─ SystemAssigned Managed Identity  │
│  ├─ Key Vault Reference (SecretURI)  │
│  └─ No plaintext secrets             │
└──────────────────────────────────────┘
```

### 2.2 服务映射

| 服务 | 认证方式 (改后) | 所需 RBAC 角色 |
|------|----------------|---------------|
| Cosmos DB | Managed Identity | `Cosmos DB Built-in Data Contributor` |
| Storage Blob | Managed Identity | `Storage Blob Data Contributor` |
| Storage Table | Managed Identity | `Storage Table Data Contributor` |
| Storage Queue | Managed Identity | `Storage Queue Data Contributor` |
| IoT Hub | Key Vault Reference (MI 读取) | Key Vault `Secret User` |
| ACR | Key Vault Reference (MI 读取) | Key Vault `Secret User` |
| OpenAI | Key Vault Reference (MI 读取) | Key Vault `Secret User` |

---

## 3. 实施步骤

### Step 1: 创建 Key Vault

使用 Bicep 新增 Key Vault 模块 (添加到 `nested-infra.bicep`):

```bicep
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${prefix}-kv-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    softDeleteRetentionInDays: 90
    purgeProtectionEnabled: true
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
      virtualNetworkRules: [
        { id: backendSubnet.id, ignoreMissingVnetServiceEndpoint: true }
      ]
    }
  }
}
```

### Step 2: 为 ACA 启用 Managed Identity

在 `compute-module.bicep` 中添加:

```bicep
resource backendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-backend-identity'
  location: location
}

// 附加到 ACA
resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
  identity: {
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '${backendIdentity.id}': {}
    }
  }
}
```

### Step 3: RBAC 角色分配

```bicep
resource cosmosDbRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = {
  name: guid(cosmosDbAccount.id, backendIdentity.id, 'CosmosDBBuiltInDataContributor')
  properties: {
    principalId: backendIdentity.properties.principalId
    roleDefinitionId: '00000000-0000-0000-0000-000000000002' // Built-in Data Contributor
    scope: cosmosDbAccount.id
  }
}
```

### Step 4: 迁移后端代码使用 DefaultAzureCredential

Python 后端改造示例 (`embodied_brain/utils.py`):

```python
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient
from azure.storage.blob import BlobServiceClient

credential = DefaultAzureCredential()

# Cosmos DB 使用 MI
cosmos_client = CosmosClient(
    url=os.environ["COSMOS_ENDPOINT"],
    credential=credential
)

# Storage 使用 MI
blob_client = BlobServiceClient(
    account_url=os.environ["STORAGE_ACCOUNT_URL"],
    credential=credential
)
```

对于不支持 MI 的服务 (IoT Hub), 通过 Key Vault Reference 注入:

```python
# 容器环境变量: IOTHUB_CONNECTION_STRING@Microsoft.KeyVault(SecretUri=...)
import os
# SDK 自动解析 Key Vault Reference
conn_str = os.environ["IOTHUB_CONNECTION_STRING"]
```

### Step 5: 更新部署脚本

修改 `sh/infra-up.sh` 在部署后自动同步密钥到 Key Vault:

```bash
# 创建后将现有密钥导入 KV
az keyvault secret set --vault-name "$KV_NAME" --name "cosmos-primary-key" --value "$COSMOS_KEY"
az keyvault secret set --vault-name "$KV_NAME" --name "storage-primary-key" --value "$STORAGE_KEY"
```

---

## 4. Bicep 变更清单

| 文件 | 变更内容 |
|------|---------|
| `.azure/nested-infra.bicep` | 新增 Key Vault 资源 + RBAC 角色分配 |
| `.azure/compute-module.bicep` | 新增 UserAssigned Identity, 附加到 ACA, 添加 KV 引用环境变量 |
| `.azure/nested-infra.bicep` | 添加 Private Endpoint for Key Vault |

---

## 5. 验收标准

- [ ] `az keyvault secret list --vault-name <kv-name>` 返回所有密钥
- [ ] ACA 容器内 `curl $KEY_VAULT_URI` 验证 MI 可读取密钥
- [ ] 从后端删除所有连接字符串环境变量, 替换为 KV 引用或 MI 认证
- [ ] `az role assignment list --assignee <mi-principal-id>` 显示正确的 RBAC 角色
- [ ] 本地开发使用 `az login` + `DefaultAzureCredential` 无需 .env 文件
- [ ] 删除所有含凭据的 `local.settings.json`, 改用 `local.settings.example.json`

---

## 6. 参考链接

- [Azure Identity SDK](https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme)
- [Key Vault for Containers](https://learn.microsoft.com/en-us/azure/container-apps/key-vault-secrets)
- [Managed Identity in ACA](https://learn.microsoft.com/en-us/azure/container-apps/managed-identity)
- [Cosmos DB RBAC](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-setup-rbac)
