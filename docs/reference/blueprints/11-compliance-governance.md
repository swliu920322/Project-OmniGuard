# 蓝图 11: 合规与治理 (Compliance & Governance)

> **领域**: 治理 | **优先级**: P2 | **复杂度**: 中~高 | **预估工时**: 2~5天

---

## 1. 现状分析

### 当前做法
- 无 Azure Policy 应用
- 无管理组 (Management Group) 结构
- 无合规审计
- 基础设施在单个资源组中
- 无订阅分级 (开发/生产分离)

### 风险

| 风险 | 说明 |
|------|------|
| 无资源命名规范 | 资源名称不一致 |
| 无区域限制 | 可能在非授权区域创建资源 |
| 无 SKU 限制 | 可能部署超预算 SKU |
| 无数据合规 | 个人数据 (如设备 ID) 可能未加密 |
| 单订阅无隔离 | 开发/生产混合 |

---

## 2. 目标架构

### 2.1 管理组结构

```
Tenant Root Group
├── Platform (Identity, Security, Management)
├── Landing Zones
│   ├── OmniGuard-Prod
│   │   ├── Subscription A (生产)
│   │   │   ├── rg-omni-network-sea
│   │   │   ├── rg-omni-compute-sea
│   │   │   └── rg-omni-data-sea
│   │   └── Subscription B (灾备)
│   │       └── ...
│   └── OmniGuard-Dev
│       └── Subscription C (开发)
└── Sandbox (个人测试)
```

### 2.2 OmniGuard Azure Policy 集合

| 策略 | 效果 | 作用范围 |
|------|------|---------|
| 强制资源标签 | Deny | 所有资源 |
| 限制区域 (仅 southeastasia, japaneast) | Deny | 所有资源 |
| 禁止公共 IP 关联 | Deny | 防止资源直接暴露 |
| Cosmos DB 强制 PE | Deny | Cosmos DB |
| Storage 强制 PE | Deny | Storage |
| 审计诊断日志启用 | AuditIfNotExists | 所有服务 |
| ACA 强制 Internal Ingress | Deny | ACA |

---

## 3. 实施步骤

### Step 1: Azure Policy 定义

```bicep
// 1. 强制区域策略
resource allowedLocationsPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'allowed-locations-for-resources'
  properties: {
    displayName: 'Allow only southeastasia and japaneast'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        not: {
          field: 'location'
          in: ['southeastasia', 'japaneast']
        }
      }
      then: { effect: 'Deny' }
    }
  }
}

// 2. 强制标签
resource requireTagsPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'require-tags'
  properties: {
    displayName: 'Require Environment, Project, Owner tags'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        not: {
          allOf: [
            { field: 'tags.Environment', exists: 'true' }
            { field: 'tags.Project', exists: 'true' }
            { field: 'tags.Owner', exists: 'true' }
          ]
        }
      }
      then: { effect: 'Deny' }
    }
  }
}

// 3. 审计诊断日志
resource auditDiagnosticsPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'audit-diagnostics' 
  properties: {
    displayName: 'Audit diagnostic setting'
    policyType: 'Custom'
    mode: 'All'
    policyRule: {
      if: {
        field: 'type'
        in: [
          'Microsoft.DocumentDB/databaseAccounts'
          'Microsoft.KeyVault/vaults'
          'Microsoft.Network/networkSecurityGroups'
        ]
      }
      then: {
        effect: 'AuditIfNotExists'
        details: {
          type: 'Microsoft.Insights/diagnosticSettings'
          existenceCondition: {
            field: 'Microsoft.Insights/diagnosticSettings/logs[*].enabled'
            equals: 'true'
          }
        }
      }
    }
  }
}
```

### Step 2: Policy 分配

```bicep
// 分配给资源组
resource policyAssignment 'Microsoft.Authorization/policyAssignments@2023-04-01' = {
  name: 'prod-policies'
  properties: {
    displayName: 'OmniGuard Production Policies'
    policyDefinitionId: allowedLocationsPolicy.id
    scope: resourceGroup().id
    parameters: {}
  }
}
```

### Step 3: 命名规范 Bicep

```bicep
// 命名规范 helper
var resourceNaming = {
  storage: 'st${prefix}${uniqueString(resourceGroup().id)}'       // stomniguard123
  cosmos: 'cdb-${prefix}-${uniqueString(resourceGroup().id)}'      // cdb-omni-123
  acr: '${prefix}acr${uniqueString(resourceGroup().id)}'           // omniacr123
  kv: 'kv-${prefix}-${uniqueString(resourceGroup().id)}'           // kv-omni-123
  app: (name) => '${prefix}-${name}'                                // omni-backend
  nsg: (name) => 'nsg-${name}'                                      // nsg-backend
}
```

### Step 4: Azure 蓝图 (Azure Blueprints / 管理组)

> 如果有多订阅需求, 可以创建 Azure Blueprint 实现:
> - 订阅级别 Policy 分配
> - 必选 RBAC 角色
> - 基线资源组结构
> - Resource Provider 注册

---

## 4. 变更清单

| 资源 | 操作 |
|------|------|
| Policy Definitions | 新增 3+ 自定义策略 |
| Policy Assignments | 分配给资源组/订阅 |
| 管理组 (可选) | 按租户创建管理组结构 |
| Azure Blueprints (可选) | 创建合规蓝图定义 |

---

## 5. 验收标准

- [ ] 在 southeastasia/japaneast 之外的区域创建资源被拒绝
- [ ] 缺少 Environment/Project/Owner 标签的部署被拒绝
- [ ] Cosmos DB / Storage 无 PE 时触发审计警报
- [ ] 命名规范已记录并在 Bicep 中实施
- [ ] (可选) 管理组结构和订阅隔离已实施

---

## 6. 参考链接

- [Azure Policy Built-in Definitions](https://learn.microsoft.com/en-us/azure/governance/policy/samples/built-in-policies)
- [Azure Blueprints](https://learn.microsoft.com/en-us/azure/governance/blueprints/overview)
- [Enterprise Cloud Framework](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/)
