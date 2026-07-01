# 蓝图 06: 数据平台深化 (Data Platform Deep Dive)

> **领域**: 数据 | **优先级**: P1 | **复杂度**: 中~高 | **预估工时**: 3~6天

---

## 1. 现状分析

### 当前数据架构

| 服务 | 用途 | SKU/配置 | 问题 |
|------|------|---------|------|
| Cosmos DB | 设备状态, Agent 持久化 | Free Tier, Session 一致性, 400 RU | 低 RU 上限 (400), 无多区域 |
| Storage Blob | 文件/日志 | Standard LRS, 公共访问关闭 | 无分层/生命周期 |
| Storage Table | (未使用) | — | 可存储设备遥测历史 |
| Storage Queue | (未使用) | — | 可做 IoT 消息缓冲 |
| OpenAI | AI 推理 | 第三方账号 | 不在本项目 Azure 订阅中 |

### 问题

| 问题 | 影响 |
|------|------|
| Cosmos DB Free Tier 400 RU 上限 | 单容器并发低, 易被节流 (429) |
| Session 一致性 | 无法多区域写入 |
| 无 Redis 缓存层 | 每次查询直接走 Cosmos DB, 增加 RU |
| 无 AI Search | IoT/KOL 数据全文搜索能力缺失 |
| 无数据生命周期 | Blob/日志无限增长, 成本失控 |
| 无数据备份策略 | 意外删除无法恢复 |

---

## 2. 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Data Platform                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Cosmos DB       │  │ Redis Cache   │  │ AI Search        │ │
│  │ ├ DeviceTwins   │  │ Session Store │  │ IoT Telemetry    │ │
│  │ ├ AgentState    │  │ API Result    │  │ KOL Analysis     │ │
│  │ └ TenantConfig  │  │ Device Cache  │  │ Knowledge Base   │ │
│  └───────┬────────┘  └──────┬───────┘  └────────┬─────────┘ │
│          │                  │                    │          │
│          ▼                  ▼                    ▼          │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Storage Account                                    │      │
│  │  ├ Blob: Telemetry Archive (Hot → Cool → Cold)     │      │
│  │  ├ Table: Historical Device Messages               │      │
│  │  └ Queue: IoT Message Buffer (for ACA scaling)     │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Cosmos DB 优化

### 3.1 SKU 升级

```bicep
resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${prefix}-cosmos-${uniqueString(resourceGroup().id)}'
  properties: {
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [
      { locationName: location, failoverPriority: 0 }
      { locationName: 'japaneast', failoverPriority: 1 }
    ]
    enableMultipleWriteLocations: true  // 多区域写入
  }
}

resource cosmosSqlDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  name: 'OmniGuardDB'
  properties: { resource: { id: 'OmniGuardDB' } }
}

resource deviceTwinsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  name: 'DeviceTwins'
  properties: {
    resource: {
      id: 'DeviceTwins'
      partitionKey: { paths: ['/tenant_id'], kind: 'Hash' }
      indexingPolicy: { indexingMode: 'consistent' }
    }
    options: { throughput: 4000 }  // 从 400 → 4000 RU
  }
}

// 新增容器: Agent 状态持久化
resource agentStateContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  name: 'AgentState'
  properties: {
    resource: {
      id: 'AgentState'
      partitionKey: { paths: ['/agent_id'], kind: 'Hash' }
    }
    options: { throughput: 1000 }
  }
}

// 新增容器: IoT 遥测 (TTL 自动过期)
resource telemetryContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  name: 'Telemetry'
  properties: {
    resource: {
      id: 'Telemetry'
      partitionKey: { paths: ['/device_id'], kind: 'Hash' }
      defaultTtl: 604800  // 7 天自动过期
    }
    options: { throughput: 2000 }
  }
}
```

### 3.2 SDK 优化

```python
# Cosmos DB SDK 配置最佳实践
from azure.cosmos import CosmosClient, PartitionKey
from azure.cosmos.http_constants import HttpHeaders

client = CosmosClient(
    url=os.environ["COSMOS_ENDPOINT"],
    credential=credential,
    consistency_level="Session",
    connection_mode="Gateway",  # 私有端点建议 Gateway
    retry_total=3,
    retry_backoff_max=30
)

# 批量操作 (减少 RU)
container = client.get_database_client("OmniGuardDB").get_container_client("Telemetry")
batch = [
    ("create", ({"id": "msg1", "device_id": "dev1", "temp": 25.5},)),
    ("create", ({"id": "msg2", "device_id": "dev1", "temp": 26.0},)),
]
container.execute_item_batch(batch, partition_key="dev1")
```

---

## 4. Azure Redis Cache

### 4.1 部署

```bicep
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: '${prefix}-redis-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    sku: { name: 'Standard', family: 'C', capacity: 1 }
    enableNonSslPort: false
    redisConfiguration: {
      maxmemory-policy: 'allkeys-lru'
    }
  }
}
```

### 4.2 使用场景

```python
# 后端: 设备状态缓存
import redis.asyncio as redis

redis_client = redis.Redis(
    host=os.environ["REDIS_HOST"],
    port=6380,
    password=os.environ["REDIS_KEY"],
    ssl=True
)

# 缓存设备最后在线时间 (高速读取)
await redis_client.setex(
    f"device:{device_id}:last_seen",
    ttl=3600,
    value=last_seen.isoformat()
)

# 缓存 API 响应 (减少 Cosmos DB RU)
await redis_client.setex(
    f"api:device-list",
    ttl=300,  # 5 分钟缓存
    value=json.dumps(device_list)
)
```

---

## 5. Azure AI Search

### 5.1 部署

```bicep
resource searchService 'Microsoft.Search/searchServices@2023-11-01' = {
  name: '${prefix}-search-${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'basic' }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
  }
}
```

### 5.2 使用场景

| 场景 | 索引内容 | 用户 |
|------|---------|------|
| IoT 设备快速查找 | Device ID, 标签, 位置 | 运维 |
| KOL 推文全文搜索 | 推文内容, 作者, 时间 | 分析 |
| 知识库/Agent 历史 | Agent 执行日志, 决策 | 调试 |
| 日志全文检索 | ACA 容器日志 | 排障 |

```python
# 索引 IoT 设备遥测
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.core.credentials import AzureKeyCredential

search_client = SearchClient(
    endpoint=os.environ["SEARCH_ENDPOINT"],
    index_name="iot-telemetry",
    credential=AzureKeyCredential(os.environ["SEARCH_KEY"])
)

documents = [
    {
        "id": "msg-12345",
        "device_id": "device-001",
        "temperature": 25.5,
        "humidity": 60,
        "timestamp": "2026-07-02T10:00:00Z"
    }
]
search_client.upload_documents(documents)
```

### 5.3 前端集成

前端 IaC Hub 页面可使用 AI Search 做资源/日志搜索功能。

---

## 6. 存储生命周期管理

```bicep
resource lifecycleRule 'Microsoft.Storage/storageAccounts/managementPolicies@2023-01-01' = {
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'telemetry-lifecycle'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: { blobTypes: ['blockBlob'], prefixMatch: ['telemetry/'] }
            actions: {
              baseBlob: {
                tierToCool:   { daysAfterModificationGreaterThan: 30 }
                tierToCold:   { daysAfterModificationGreaterThan: 90 }
                tierToArchive: { daysAfterModificationGreaterThan: 365 }
                delete:        { daysAfterModificationGreaterThan: 730 }
              }
            }
          }
        }
        {
          name: 'log-lifecycle'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: { blobTypes: ['blockBlob'], prefixMatch: ['logs/'] }
            actions: {
              baseBlob: {
                tierToCool: { daysAfterModificationGreaterThan: 7 }
                delete:     { daysAfterModificationGreaterThan: 90 }
              }
            }
          }
        }
      ]
    }
  }
}
```

---

## 7. 变更清单

| 资源 | 操作 |
|------|------|
| Cosmos DB | RU 扩容, 增加 AgentState 容器, 增加 Telemetry 容器 (带 TTL) |
| Cosmos DB | 启用多区域 (japaneast) |
| Redis Cache | 新增 Standard C1 |
| AI Search | 新增 Basic SKU |
| Storage | 新增生命周期管理策略 |
| Python 后端 | 新增 Redis 缓存逻辑 |
| Python 后端 | 新增 AI Search 索引/查询 |
| Python 后端 | Cosmos DB SDK 使用批量操作 |

---

## 8. 验收标准

- [ ] Cosmos DB: `DeviceTwins` 容器 RU 从 400 → 4000, 无 429
- [ ] Cosmos DB: `Telemetry` 容器 7 天后数据自动清除
- [ ] Cosmos DB: 多区域复制延迟 < 1s (同区域)
- [ ] Redis: 设备状态读取 < 5ms
- [ ] Redis: API 缓存命中率 > 60%
- [ ] AI Search: IoT 遥测数据可在 Portal 搜索到
- [ ] Storage: 30 天前的遥测自动降为 Cool, 90 天 Cold

---

## 9. 参考链接

- [Cosmos DB Performance Tips](https://learn.microsoft.com/en-us/azure/cosmos-db/performance-tips-python)
- [Azure Redis Cache](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-overview)
- [Azure AI Search](https://learn.microsoft.com/en-us/azure/search/search-what-is-azure-search)
- [Blob Lifecycle Management](https://learn.microsoft.com/en-us/azure/storage/blobs/lifecycle-management-overview)
