# 蓝图 04: 可观测平台 (Observability Platform)

> **领域**: 监控与可观测性 | **优先级**: P1 | **复杂度**: 中 | **预估工时**: 2~4天

---

## 1. 现状分析

### 当前做法
- `host.json` 配置了 `Microsoft.ApplicationInsights` 采样
- Log Analytics Workspace 已通过 Bicep 部署 (`PerGB2018`, 30天保留)
- ACA 自带基础指标 (CPU, Memory, Requests)
- 无自定义仪表盘
- 无告警规则
- 无分布式追踪 (Distributed Tracing)
- 无日志分析查询 (KQL) 模板
- 无 IoT 设备遥测监控

### 缺失项

| 能力 | 状态 | 重要性 |
|------|------|--------|
| 应用指标 (延迟/错误率/请求量) | 部分 (ACA 基础指标) | 高 |
| 自定义业务指标 | 无 | 高 |
| 分布式追踪 | 无 | 高 |
| 日志集中分析 | 有 (LA) | 中 |
| 告警规则 | 无 | 高 |
| 仪表盘 | 无 | 中 |
| Prometheus/Grafana | 无 | 低 |
| IoT 设备遥测监控 | 无 | 高 (核心场景) |

---

## 2. 目标架构

### 2.1 三层可观测性

```
┌──────────────────────────────────────────────────────────────┐
│                   Azure Monitor Overview                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌───────────────────────┐  │
│  │ Metrics     │  │ Logs       │  │ Traces                │  │
│  │ (Prometheus)│  │ (Log Analytics)│ │ (App Insights)          │  │
│  └─────┬──────┘  └─────┬──────┘  └───────────┬───────────┘  │
│        │               │                     │              │
│        ▼               ▼                     ▼              │
│  ┌──────────────────────────────────────────────────┐       │
│  │          Azure Monitor Workbooks                  │       │
│  │  ┌──────────────┐  ┌──────────────────────────┐  │       │
│  │  │ OmniGuard     │  │ IoT Fleet Status         │  │       │
│  │  │ Application   │  │ (Device Health + Tele)    │  │       │
│  │  └──────────────┘  └──────────────────────────┘  │       │
│  └──────────────────────────────────────────────────┘       │
│                        │                                      │
│                        ▼                                      │
│  ┌──────────────────────────────────────────────────┐       │
│  │  Alerts (Action Groups → Email/SMS/Teams/Webhook) │       │
│  └──────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 实施步骤

### Step 1: Application Insights 深度集成

#### 1.1 Python 后端: OpenTelemetry SDK

```python
# requirements.txt 新增
# opentelemetry-api
# opentelemetry-sdk
# opentelemetry-instrumentation-fastapi
# opentelemetry-exporter-azure-monitor

# function_app.py
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from azure.monitor.opentelemetry.exporter import AzureMonitorTraceExporter
from opentelemetry.sdk.trace.export import BatchSpanProcessor

tracer_provider = TracerProvider()
exporter = AzureMonitorTraceExporter(connection_string=APPLICATIONINSIGHTS_CONNECTION_STRING)
tracer_provider.add_span_processor(BatchSpanProcessor(exporter))
trace.set_tracer_provider(tracer_provider)

FastAPIInstrumentor.instrument_app(app)
```

#### 1.2 自定义业务指标

在关键业务流程中记录自定义指标:

```python
from azure.monitor.events.extension import track_event

# 设备注册事件
track_event("DeviceRegistered", {"device_id": device_id, "tenant": tenant_id})

# IoT 消息处理延迟
track_metric("IoTHubMessageProcessingLatency", latency_ms, dimensions={
    "device_id": device_id,
    "message_type": message_type
})

# Agent 执行耗时
track_metric("AgentPipelineExecutionTime", duration_ms, dimensions={
    "agent": agent_name,
    "status": status
})
```

#### 1.3 前端: 浏览器端遥测

```typescript
// src/client-edge/src/app/layout.tsx 中添加 Application Insights
import { ApplicationInsights } from '@microsoft/applicationinsights-web'

const appInsights = new ApplicationInsights({
  config: {
    connectionString: process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING!,
    enableAutoRouteTracking: true,
  }
})
appInsights.loadAppInsights()

// 记录页面浏览
appInsights.trackPageView()
```

### Step 2: 日志分析与 KQL 查询模板

#### 2.1 环境变量注入

在 ACA 中注入 `APPLICATIONINSIGHTS_CONNECTION_STRING` 环境变量, 使所有容器日志自动关联。

#### 2.2 KQL 查询模板

```kusto
// 1. 后端 API 延迟分布
AppRequests
| where TimeGenerated > ago(1h)
| where AppRoleName == "omni-backend"
| summarize
    P50 = percentile(DurationMs, 50),
    P95 = percentile(DurationMs, 95),
    P99 = percentile(DurationMs, 99),
    Count = count()
  by bin(TimeGenerated, 5m)
| render timechart

// 2. 错误跟踪
AppExceptions
| where TimeGenerated > ago(24h)
| summarize Count = count() by Type, bin(TimeGenerated, 1h)
| render timechart

// 3. IoT 设备消息量
IoTHubMessages
| where TimeGenerated > ago(7d)
| summarize MessageCount = count() by DeviceId, bin(TimeGenerated, 1h)
| render columnchart

// 4. Cosmos DB RU 消耗
CDBMetricRequests
| where TimeGenerated > ago(1h)
| summarize AvgRU = avg(RequestCharge), MaxRU = max(RequestCharge) by DatabaseName, CollectionName
| render barchart
```

### Step 3: Azure Monitor Workbooks

创建两个核心仪表盘:

#### 3.1 Application Dashboard

```json
{
  "version": "AzureMonitor",
  "name": "OmniGuard Application Overview",
  "items": [
    {
      "type": 3,  // Metrics
      "name": "Request Rate",
      "settings": { "metrics": [...] }
    },
    {
      "type": 3,  // Metrics
      "name": "Error Rate (5xx)"
    },
    {
      "type": 2,  // Query
      "name": "Slowest Endpoints (P95 > 1s)"
    },
    {
      "type": 2,  // Query
      "name": "Active Devices (last 5min)"
    }
  ]
}
```

#### 3.2 IoT Fleet Dashboard

- 总设备数 / 在线设备数 / 离线设备数
- 设备消息吞吐量 (msg/min)
- 遥测异常 (温度/湿度超阈值)
- 固件版本分布

### Step 4: 告警规则

#### 4.1 关键告警

```bicep
resource highErrorRateAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'high-error-rate'
  location: 'global'
  properties: {
    displayName: '[OmniGuard] High Backend Error Rate > 5%'
    severity: 2  // Error
    enabled: true
    scopes: [ law.id ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [{
        query: '''
          AppRequests
          | where TimeGenerated > ago(15m)
          | where AppRoleName == "omni-backend"
          | summarize Total = count(), Failed = countif(Success == false)
          | extend ErrorRate = (toreal(Failed) / toreal(Total)) * 100
          | where ErrorRate > 5
        '''
        timeAggregation: 'Count'
        threshold: 0
        operator: 'GreaterThan'
      }]
    }
    actions: {
      actionGroups: [ actionGroup.id ]
    }
  }
}

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: 'omni-urgent-alerts'
  location: 'global'
  properties: {
    groupShortName: 'OmniGuardAlert'
    enabled: true
    emailReceivers: [{
      name: 'Admin Email'
      emailAddress: 'admin@omniguard.io'
    }]
  }
}
```

#### 4.2 告警清单

| 告警名 | 条件 | 严重度 | 响应 |
|--------|------|--------|------|
| 高错误率 | 5xx > 5% in 15min | Sev 2 | 邮件 + Webhook |
| 高延迟 | P95 > 3s in 5min | Sev 2 | 邮件 |
| 设备大规模离线 | 在线设备 < 50% | Sev 1 | 邮件 + 短信 |
| Cosmos DB RU 超限 | RU > 80% in 5min | Sev 3 | 邮件 |
| ACA 容器重启 | RestartCount > 3 in 1h | Sev 2 | 邮件 |

---

## 4. 变更清单

| 资源 | 操作 |
|------|------|
| Application Insights | 确认已关联 (host.json) |
| Python 后端 | 新增 OpenTelemetry SDK 集成 |
| Python 后端 | 新增自定义业务指标 |
| 前端 | 新增 Application Insights JS SDK |
| Log Analytics | 新增 KQL 查询模板 (保存为 Functions) |
| Monitor Workbooks | 新增 2 个工作簿 |
| Scheduled Query Rules | 新增 5+ 告警规则 |
| Action Groups | 新增 2 个 (紧急/常规) |

---

## 5. 验收标准

- [ ] Application Insights 接收后端请求/异常/依赖数据
- [ ] 自定义业务指标 (设备注册, Agent 执行) 可查询
- [ ] 前端页面浏览/加载性能已上报
- [ ] KQL 查询板已保存可复用
- [ ] 工作簿仪表盘可展示实时/历史数据
- [ ] 配置了至少 3 条告警规则并测试触发

---

## 6. 参考链接

- [Azure Monitor OpenTelemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable)
- [Application Insights Python](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opencensus-python)
- [Monitor Workbooks](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-overview)
- [KQL Reference](https://learn.microsoft.com/en-us/azure/data-explorer/kusto/query/)
