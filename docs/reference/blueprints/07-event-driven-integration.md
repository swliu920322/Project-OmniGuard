# 蓝图 07: 事件驱动集成 (Event-Driven Integration)

> **领域**: 集成与消息 | **优先级**: P2 | **复杂度**: 中~高 | **预估工时**: 3~6天

---

## 1. 现状分析

### 当前做法
- IoT Hub 路由: `telemetry` → Event Hub 兼容端点
- 后端通过 IoT Hub SDK 接收设备消息
- 无事件持久化/死信
- 无事件订阅者模式
- 无编排工作流
- 无跨服务解耦

### 问题
| 问题 | 影响 |
|------|------|
| IoT Hub F1 (8000 msg/day) 顶不住 | 生产不可用 |
| 后端直接消费 Event Hub | 后端异常时消息丢失 |
| 无事件重试/死信 | 故障事件永久丢失 |
| 无事件存根 (Event Sourcing) | 无法回溯设备状态变化 |
| 人工流程多 | 固件更新/告警需要手动触发 |

---

## 2. 目标架构

```
IoT Device ──MQTT──► IoT Hub
                        │
                    Event Router
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
      Event Grid (实时)        Event Hub/Storage (持久)
            │                       │
     ┌──────┴──────┐               │
     ▼              ▼               ▼
  Function      Service Bus     Data Lake
  (实时处理)      (可靠队列)      (分析用)
                    │
                    ├──► ACA Backend (Agent 决策)
                    ├──► Logic Apps (通知/工单)
                    └──► Webhook (外部系统)
```

### 2.1 事件流设计

```
Event Types:
├── device.telemetry       # 设备遥测 (高频)
├── device.connected       # 设备上线
├── device.disconnected    # 设备下线
├── device.error           # 设备错误
├── device.command.ack     # 命令确认
├── device.firmware.status # 固件升级状态
├── agent.status           # Agent 状态变更
└── security.alert         # 安全告警
```

---

## 3. 实施步骤

### Step 1: 事件网格 (Event Grid) 系统主题

Event Grid 托管 IoT Hub 事件:

```bicep
// 系统主题 (IoT Hub)
resource systemTopic 'Microsoft.EventGrid/systemTopics@2022-06-15' = {
  name: '${prefix}-iot-events'
  location: 'global'
  properties: {
    source: iotHub.id
    topicType: 'Microsoft.Devices.IotHubs'
  }
}
```

### Step 2: Service Bus 做可靠消息队列

```bicep
resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: '${prefix}-sb-${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard' }
  properties: {}
}

// Topic: 设备遥测 (多订阅者)
resource telemetryTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = {
  name: 'device-telemetry'
  parent: serviceBusNamespace
  properties: {
    defaultMessageTimeToLive: 'P7D'
    maxDeliveryCount: 10
    enablePartitioning: true
  }
}

// 订阅: 后端处理
resource backendSubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  name: 'backend-processor'
  parent: telemetryTopic
  properties: {
    maxDeliveryCount: 3
    deadLetteringOnMessageExpiration: true
    forwardDeadLetteredMessagesTo: deadLetterQueue.name
  }
}

// 死信队列
resource deadLetterQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  name: 'dead-letter'
  parent: serviceBusNamespace
  properties: {
    defaultMessageTimeToLive: 'P30D'
  }
}

// 通知订阅 (Logic Apps)
resource notifySubscription 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = {
  name: 'notification'
  parent: telemetryTopic
  properties: { maxDeliveryCount: 3 }
}

// 队列: 设备命令 (点对点)
resource commandQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  name: 'device-commands'
  parent: serviceBusNamespace
  properties: {
    defaultMessageTimeToLive: 'P1D'
    maxDeliveryCount: 5
  }
}
```

### Step 3: Event Grid 订阅 → Service Bus

```bicep
resource eventSubscription 'Microsoft.EventGrid/systemTopics/eventSubscriptions@2022-06-15' = {
  name: 'iot-to-servicebus'
  parent: systemTopic
  properties: {
    destination: {
      endpointType: 'ServiceBusTopic'
      properties: {
        resourceId: serviceBusNamespace.id
      }
    }
    filter: {
      includedEventTypes: [
        'Microsoft.Devices.DeviceConnected'
        'Microsoft.Devices.DeviceDisconnected'
        'Microsoft.Devices.DeviceTelemetry'
      ]
    }
    eventDeliverySchema: 'CloudEventSchemaV1_0'  // CNCF 兼容
  }
}
```

### Step 4: 后端订阅 Service Bus

```python
# Python: Service Bus 接收器
from azure.servicebus.aio import ServiceBusClient

servicebus_client = ServiceBusClient(
    fully_qualified_namespace=os.environ["SERVICE_BUS_HOST"],
    credential=credential
)

async def process_device_events():
    receiver = servicebus_client.get_subscription_receiver(
        topic_name="device-telemetry",
        subscription_name="backend-processor",
        max_wait_time=5
    )
    async with receiver:
        async for message in receiver:
            try:
                # 交由 Agent 处理
                await brain.process_device_event(message.body)
                await message.complete()
            except Exception as e:
                logger.error(f"Processing failed: {e}")
                await message.dead_letter(reason="processing_error")
```

### Step 5: Durable Functions IoT 编排

IoT 固件升级工作流:

```python
# 蓝图: 固件升级编排
import azure.durable_functions as df

def orchestrator_function(context: df.DurableOrchestrationContext):
    # Step 1: 广播固件更新命令
    device_ids = yield context.call_activity("GetTargetDevices", "v2.1.0")
    
    # Step 2: 并行下发
    tasks = []
    for device_id in device_ids:
        task = context.call_activity("SendFirmwareCommand", device_id)
        tasks.append(task)
    
    results = yield context.task_all(tasks)
    
    # Step 3: 等待确认 (超时 1h)
    timeout = context.current_utc_datetime + timedelta(hours=1)
    
    while context.current_utc_datetime < timeout:
        acks = yield context.call_activity("CheckFirmwareAcks", device_ids)
        if all(ack["status"] == "success" for ack in acks):
            # 全部成功
            yield context.call_activity("LogFirmwareSuccess", acks)
            return "all_succeeded"
        yield context.create_timer(context.current_utc_datetime + timedelta(minutes=5))
    
    # 超时: 上报失败设备
    failed = [ack for ack in acks if ack["status"] != "success"]
    yield context.call_activity("EscalateFailure", failed)
    return "partial_failure"
```

### Step 6: Logic Apps 低代码事件响应

```bicep
resource logicApp 'Microsoft.Logic/workflows@2019-05-01' = {
  name: '${prefix}-device-alert-responder'
  location: location
  properties: {
    state: 'Enabled'
    definition: {
      // Service Bus 触发 → 判断严重度 → 通知 Teams / 发邮件
      "triggers": {
        "When_message_is_received_in_topic": {
          "type": "ApiConnection",
          "inputs": {
            "host": {
              "connection": { "name": "@parameters('$connections')['servicebus']['connectionId']" }
            },
            "method": "GET",
            "path": "/@{encodeURIComponent('device-telemetry')}/subscriptions/@{encodeURIComponent('notification')}/messages/head"
          }
        }
      },
      "actions": {
        "Send_Teams_Message": {
          "type": "ApiConnection",
          "inputs": {
            "host": { "connection": { "name": "@parameters('$connections')['teams']['connectionId']" } },
            "method": "POST",
            "body": {
              "messageType": "Html",
              "title": "⚠️ 设备异常告警",
              "body": "@{triggerBody()?['ContentData']}"
            }
          },
          "runAfter": {}
        },
        "Send_Email": {
          "type": "ApiConnection",
          "inputs": {
            "host": { "connection": { "name": "@parameters('$connections')['office365']['connectionId']" } },
            "method": "POST",
            "body": {
              "to": "admin@omniguard.io",
              "subject": "[OmniGuard] 设备告警通知",
              "body": "@{triggerBody()?['ContentData']}"
            }
          }
        }
      }
    }
  }
}
```

---

## 4. 事件类型 & 处理映射

| 事件 | 源 | 处理方式 | 目标 |
|------|-----|---------|------|
| 设备遥测 (温度/湿度) | IoT Hub → SB Topic | Agent 分析 | Cosmos DB + Dashboard |
| 设备连接/断开 | Event Grid → Function | 更新设备状态 | Redis + Dashboard |
| 设备错误 | IoT Hub → SB Topic | Logic App 通知 | Teams + 邮件 |
| Agent 状态变更 | ACA Backend → SB | 持久化 | Cosmos DB AgentState |
| 安全告警 | Defender → Sentinel | Playbook | 自动隔离 + 通知 |

---

## 5. 变更清单

| 资源 | 操作 |
|------|------|
| Event Grid System Topic | 新增 (IoT Hub 事件源) |
| Service Bus Namespace Standard | 新增 |
| Service Bus Topic: device-telemetry | 新增 |
| Service Bus Queue: device-commands | 新增 |
| Service Bus Queue: dead-letter | 新增 |
| Event Subscription: IoT → SB | 新增 |
| Python 后端 | 新增 Service Bus SDK 消费逻辑 |
| Durable Functions | 新增 Firmware Update 编排 |
| Logic Apps | 新增 设备告警通知 |

---

## 6. 验收标准

- [ ] IoT Hub 设备消息 → Event Grid → Service Bus 端到端延迟 < 5s
- [ ] 后端正确处理 Service Bus 消息并更新 Cosmos DB
- [ ] 消息处理失败自动进入死信队列, 30 天后清除
- [ ] Durable Functions 编排固件升级, 成功/超时/失败三种路径
- [ ] Logic Apps 在收到设备错误事件时发送 Teams 通知

---

## 7. 参考链接

- [Event Grid IoT Hub Integration](https://learn.microsoft.com/en-us/azure/event-grid/overview)
- [Service Bus Topics](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-queues-topics-subscriptions)
- [Durable Functions Overview](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview)
- [Logic Apps Connectors](https://learn.microsoft.com/en-us/connectors/connector-reference/)
