# 蓝图 05: 计算与容器优化 (Compute & Container Optimization)

> **领域**: 计算 | **优先级**: P0 | **复杂度**: 中~高 | **预估工时**: 2~5天

---

## 1. 现状分析

### 当前架构
| 组件 | 服务 | CPU/Mem | 副本 | Ingress |
|------|------|---------|------|---------|
| 前端 (Next.js) | ACA | 0.5 vCPU / 1.0 Gi | 1~2 | Public (external) |
| 后端 (FastAPI) | ACA + Functions | 1.0 vCPU / 2.0 Gi | 1~3 | Internal |
| 容器镜像 | ACR Basic | — | — | — |
| IoT 入口 | IoT Hub F1 | Free Tier | — | — |

### 问题
| 问题 | 影响 |
|------|------|
| Container Apps 无 Dapr 集成 | 缺少状态管理/发布订阅等云原生能力 |
| ACR Basic SKU 无 Geo-replication | 单区域故障风险 |
| IoT Hub F1 (8000 msg/day) | 严重的软限制 |
| 无 HPA 基于自定义指标 | 流量高峰响应延迟 |
| 无 Blue/Green 部署策略 | 更新有停机风险 |
| ACA 无自动休眠 | 非工作时间浪费成本 |

---

## 2. 优化方案

### 2.1 ACR 升级 + Geo-replication (可选)

```bicep
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${prefix}acr${uniqueString(resourceGroup().id)}'
  sku: { name: 'Premium' }
  properties: {
    adminUserEnabled: false  // 用 MI 拉取
    policies: {
      retentionPolicy: { days: 7, status: 'enabled' }
      trustPolicy: { status: 'disabled' }
    }
  }
}

// 如果多区域: Geo-replication
resource geoReplica 'Microsoft.ContainerRegistry/registries/replications@2023-07-01' = {
  name: 'japaneast'
  parent: containerRegistry
  location: 'japaneast'
}
```

### 2.2 ACA Dapr 集成

Dapr sidecar 为后端注入分布式能力:

```bicep
resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
  properties: {
    configuration: {
      dapr: {
        enabled: true
        appId: 'omni-backend'
        appPort: 80
        appProtocol: 'http'
        logLevel: 'info'
      }
    }
  }
}
```

#### 启用 Dapr 后可用的能力

| 场景 | Dapr Building Block | 用途 |
|------|-------------------|------|
| Agent 状态存储 | State Store | 用 Cosmos DB 作为有状态 agent 存储 |
| IoT 事件广播 | Pub/Sub | 设备消息发布到多个 subscriber |
| 服务间调用 | Service Invocation | 后端微服务解耦调用 |
| 密钥读取 | Secrets | 从 Key Vault 读取密钥 (替代蓝图 01) |
| 绑定外部系统 | Bindings | Cron 调度/Kafka 输出 |

#### 示例: Dapr Pub/Sub

```python
# Python 后端订阅 IoT 事件
from dapr.ext.grpc import App

app = App()

@app.subscribe(pubsub_name='omni-pubsub', topic='device-telemetry')
def handle_device_telemetry(event):
    device_id = event.data['device_id']
    temperature = event.data['temperature']
    # 处理遥测数据...
    return {'status': 'success'}
```

### 2.3 ACA 自动缩放策略

```bicep
resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
  properties: {
    template: {
      scale: {
        minReplicas: 1
        maxReplicas: 10
        rules: [
          // HTTP 并发请求数
          {
            name: 'http-scaler'
            http: {
              metadata: { concurrentRequests: '100' }
            }
          }
          // 自定义指标: IoT 消息队列长度
          {
            name: 'iot-queue-scaler'
            custom: {
              type: 'azure-queue'
              metadata: {
                queueName: 'iot-messages'
                queueLength: '10'
                connection: 'STORAGE_QUEUE_CONNECTION'
              }
            }
          }
        ]
      }
    }
  }
}
```

### 2.4 Blue/Green + 流量分割部署

```bicep
// ACA 支持多版本 revision + 流量分配
resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
  properties: {
    configuration: {
      ingress: {
        traffic: [
          { revisionName: 'omni-backend--v1',     weight: 90 }
          { revisionName: 'omni-backend--v2-canary', weight: 10 }
        ]
      }
    }
  }
}
```

CI/CD 部署脚本示例:

```bash
# sh/deploy-aca.sh 增强
# 1. 构建新版本镜像
docker build -t "$ACR_NAME.azurecr.io/omni-backend:${BUILD_ID}" ./src/cloud-orchestrator
docker push "$ACR_NAME.azurecr.io/omni-backend:${BUILD_ID}"

# 2. 创建新 revision (Canary 10%)
az containerapp update \
  --name omni-backend \
  --resource-group "$RG" \
  --image "$ACR_NAME.azurecr.io/omni-backend:${BUILD_ID}" \
  --revision-suffix "canary-${BUILD_ID}"

# 3. 流量分配 (Canary 10%)
az containerapp ingress traffic set \
  --name omni-backend \
  --resource-group "$RG" \
  --label-weight "latest=10,main=90"

# 4. 验证后升级到 100%
# az containerapp ingress traffic set --name omni-backend --resource-group "$RG" --label-weight "latest=100"
```

### 2.5 IoT Hub 扩容 (建议)

```
IoT Hub F1 (Free)      →  8,000 msg/day    ← 当前, 测试够用
IoT Hub S1 (Standard)  →  400,000 msg/day  ← 生产建议
IoT Hub S2 (Standard)  →  6,000,000 msg/day
```

```bicep
resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: '${prefix}-iot-hub-${uniqueString(resourceGroup().id)}'
  sku: { name: 'S1', capacity: 1 }
  properties: {
    eventHubEndpoints: {
      events: {
        retentionTimeInDays: 1
        partitionCount: 4
      }
    }
    cloudToDevice: { maxDeliveryCount: 10 }
  }
}
```

---

## 3. 变更清单

| 资源 | 操作 |
|------|------|
| ACR | SKU 可升级到 Premium (按需) |
| ACA 后端 | 启用 Dapr sidecar |
| ACA 后端 | 修改缩放规则 (HTTP + Queue) |
| ACA 前后端 | 启用多 Revision + 流量分割 |
| ACA 部署脚本 | 增强 `deploy-aca.sh` 支持 Blue/Green |
| IoT Hub | 升级到 S1 (生产准备) |

---

## 4. 验收标准

- [ ] Dapr sidecar 在 ACA 中运行 (`az containerapp show --name omni-backend | grep dapr`)
- [ ] Dapr Pub/Sub 端到端: 后端发布事件 → subscriber 接收
- [ ] HTTP 压力测试触发自动伸缩 (100+ 并发请求 → 副本增加)
- [ ] Blue/Green 部署: 创建新 revision 并分配 10% 流量无宕机
- [ ] IoT Hub S1 可处理 400K msg/day

---

## 5. 参考链接

- [Dapr + ACA](https://learn.microsoft.com/en-us/azure/container-apps/dapr-overview)
- [ACA Scaling](https://learn.microsoft.com/en-us/azure/container-apps/scale-app)
- [ACA Blue-Green](https://learn.microsoft.com/en-us/azure/container-apps/blue-green-deployment)
- [IoT Hub Scaling](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-scaling)
