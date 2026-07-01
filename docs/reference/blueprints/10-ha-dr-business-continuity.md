# 蓝图 10: 高可用与灾备 (HA/DR & Business Continuity)

> **领域**: 高可用 | **优先级**: P2 | **复杂度**: 中 | **预估工时**: 2~3天

---

## 1. 现状分析

### 当前可靠性状态

| 维度 | 现状 | 风险 |
|------|------|------|
| 可用区 (AZ) | ACA 单区域部署 | 区域故障 = 服务中断 |
| Cosmos DB | Free Tier 单区域 | 区域故障 = 数据丢失 |
| ACR | Basic SKU 单区域 | 区域故障 = 无法拉取镜像 |
| 数据备份 | 无 | 人为删除 = 永久丢失 |
| 前端 | 单副本 (minReplicas=1) | 单个 Pod 故障 = 短暂中断 |
| 后端 | 多副本 (minReplicas=1, max=3) | 部分冗余 |

### SLA 估算

| 服务 | 当前可用性 | 目标可用性 |
|------|-----------|-----------|
| 前端 ACA (单区域) | 99.95% | 99.99% |
| 后端 ACA (单区域) | 99.95% | 99.99% |
| Cosmos DB (单区域) | 99.99% | 99.999% |
| **复合 SLA** | **~99.9%** | **~99.99%** |

---

## 2. 目标架构

### 2.1 多可用区 (AZ)

> ACA 支持 AZ (可用区) 部署, 需要 Azure 区域支持 (southeastasia 不支持, 但 japaneast 支持)

```
推荐: 主区域 Singapore (southeastasia), 灾备区域 Japan East (japaneast)
```

### 2.2 多区域部署架构

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  Primary: Southeast Asia │     │  DR: Japan East         │
│                          │     │                          │
│  ACA Frontend (active)   │     │  ACA Frontend (standby)  │
│  ACA Backend (active)    │     │  ACA Backend (standby)   │
│  Cosmos DB (write)       │◄────┤  Cosmos DB (read)        │
│  Storage (LRS/GRS)       │────►│  Storage (secondary)     │
│  ACR (primary)           │◄────│  ACR (geo-replication)   │
│  IoT Hub (primary)       │     │  IoT Hub (standby)*      │
│                          │     │                          │
│  Front Door (active)     │◄───►│  Front Door (origin)     │
└─────────────────────────┘     └──────────────────────────┘
```

*IoT Hub 不支持跨区域故障转移, 需要应用层逻辑

### 2.3 Cosmos DB 多区域

```bicep
resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${prefix}-cosmos-${uniqueString(resourceGroup().id)}'
  properties: {
    locations: [
      { locationName: 'southeastasia', failoverPriority: 0 }
      { locationName: 'japaneast', failoverPriority: 1 }
    ]
    enableMultipleWriteLocations: false  // 主写从读, 简化 DR
  }
}
```

### 2.4 数据备份

```bicep
// Cosmos DB 备份 (Periodic)
resource backupPolicy 'Microsoft.DocumentDB/databaseAccounts/backupPolicies@2023-04-15' = {
  name: 'default'
  properties: {
    type: 'Periodic'
    periodicModeProperties: {
      backupIntervalInMinutes: 240   // 4 小时
      backupRetentionIntervalInHours: 168  // 7 天
    }
  }
}
```

### 2.5 存储 GRS

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${prefix}storage${uniqueString(resourceGroup().id)}'
  kind: 'StorageV2'
  sku: { name: 'Standard_GRS' }  // 从 Standard_LRS 升级
  properties: {
    // ...
  }
}
```

---

## 3. Bicep: 多区域部署策略

由于 OmniGuard 目前使用单区域 Bicep, 多区域需要:

### Option A: 主备 Bicep 参数化 (推荐起步)

```bicep
// main.bicep 参数添加
@allowed(['southeastasia', 'japaneast'])
param primaryLocation string = 'southeastasia'

@allowed(['southeastasia', 'japaneast'])
param drLocation string = 'japaneast'

param isDrDeployment bool = false  // 是否部署 DR 区域

// 根据区域决定 Cosmos DB 的角色
resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${prefix}-cosmos-${uniqueString(resourceGroup().id)}'
  location: isDrDeployment ? drLocation : primaryLocation
}
```

### Option B: 两个独立部署文件

```
.azure/
├── main.bicep                 # Primary region
├── main.dr.bicep              # DR region (复用 modules)
├── nested-infra.bicep         # 共享模块
└── compute-module.bicep       # 共享模块
```

---

## 4. 故障转移流程

### 手动故障转移 (Runbook)

```bash
# 1. 切换 Front Door 流量到 DR
az afd endpoint update \
  --resource-group "$RG" \
  --profile-name "$AFD_PROFILE" \
  --endpoint-name "$AFD_ENDPOINT" \
  --origin-groups "dr-origin-group"

# 2. Cosmos DB 故障转移
az cosmosdb failover-priority-change \
  --name "$COSMOS_DB_NAME" \
  --resource-group "$RG" \
  --failover-policies "japaneast=0" "southeastasia=1"

# 3. 更新后端连接字符串 (如需要)
az containerapp update --name omni-backend --set-env-vars "PRIMARY_REGION=japaneast"
```

---

## 5. 变更清单

| 资源 | 操作 |
|------|------|
| Cosmos DB | 增加 japaneast 读取副本 |
| Storage | LRS → GRS |
| ACR | Premium + Geo-replication (可选) |
| Front Door | 增加 DR 区域 Origin |
| ACA DR 部署 | 新增 DR Bicep 或参数化 |

---

## 6. 验收标准

- [ ] Cosmos DB 在 japaneast 有读取副本, 数据同步 < 5s
- [ ] Storage GRS 在配对区域存在副本
- [ ] Front Door 健康探测检测到主区域故障时自动切换
- [ ] 备份策略: Cosmos DB 每 4h 自动备份, 保留 7 天
- [ ] 故障转移 Runbook 已验证 (DR 演练)

---

## 7. 参考链接

- [Azure Front Door HA](https://learn.microsoft.com/en-us/azure/architecture/framework/resiliency/design-checklists)
- [Cosmos DB Multi-Region](https://learn.microsoft.com/en-us/azure/cosmos-db/high-availability)
- [Storage GRS](https://learn.microsoft.com/en-us/azure/storage/common/storage-redundancy)
- [ACA Multi-Region](https://learn.microsoft.com/en-us/azure/container-apps/disaster-recovery)
