# 蓝图 09: 成本优化与 FinOps (Cost Optimization & FinOps)

> **领域**: 成本管理 | **优先级**: P1 | **复杂度**: 低 | **预估工时**: 1天

---

## 1. 现状分析

### 当前成本估算

| 服务 | SKU | 月估算成本 |
|------|-----|-----------|
| ACA (Frontend) | Consumption, 0.5 vCPU, 1Gi, avg 1 replica | ~$15 |
| ACA (Backend) | Consumption, 1.0 vCPU, 2Gi, avg 2 replicas | ~$40 |
| ACR | Basic | ~$5 |
| Cosmos DB | Free Tier (400 RU) | $0 |
| Storage (LRS) | Standard | ~$1 |
| IoT Hub | F1 Free | $0 |
| Log Analytics | PerGB2018 | ~$5 |
| **总计** | | **~$66/月** |

### 问题

| 问题 | 影响 |
|------|------|
| 无预算/预警 | 成本超标才察觉 |
| ACA 7x24 运行 | 非工作时间完全浪费 |
| 无资源标签 | 无法按维度分析成本 |
| 无 Cost Export | 无法做历史趋势分析 |
| Cosmos DB Free Tier | 若升级, 成本跳升明显 |

---

## 2. 实施步骤

### Step 1: 预算 + 告警

```bicep
resource monthlyBudget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: 'monthly-budget'
  properties: {
    timePeriod: {
      startDate: formatDateTime(utcNow(), 'yyyy-MM-dd')
      endDate: formatDateTime(dateTimeAdd(utcNow(), 'P1Y'), 'yyyy-MM-dd')
    }
    timeGrain: 'Monthly'
    amount: 200  // $200/月上限
    notifications: {
      notification80: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        contactEmails: ['admin@omniguard.io']
      }
      notification100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        contactEmails: ['admin@omniguard.io']
        contactGroups: []
      }
    }
  }
}
```

### Step 2: 标记 (Tagging) 策略

```bicep
// 在 Bicep 部署中添加强制标签
resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
  tags: {
    Environment: 'production'
    Department: 'engineering'
    Project: 'OmniGuard'
    Owner: 'cloud-architect'
    CostCenter: 'CC-001'
    CreatedBy: 'bicep'
  }
}
```

### Step 3: ACA 自动休眠

利用 ACA 的缩容策略和 `inactivityMins` 实现自动休眠:

```bicep
resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
  properties: {
    template: {
      scale: {
        minReplicas: 0   // 无流量时缩到 0
        maxReplicas: 5
        rules: [{
          name: 'http-scaler'
          http: {
            metadata: { concurrentRequests: '10' }
          }
        }]
      }
    }
  }
}
```

> **注意**: 后端设为 `minReplicas: 0` 时, 首次请求有冷启动延迟 (~5-10s)。前端建议保持 `minReplicas: 1`。

### Step 4: Cost Export + 分析

```bash
# 配置成本导出到存储 (后续可用 Power BI 分析)
az costmanagement export create \
  --name "monthly-cost-export" \
  --scope "/subscriptions/$SUBSCRIPTION_ID" \
  --storage-account-id "$STORAGE_ACCOUNT_ID" \
  --storage-container "cost-exports" \
  --type "ActualCost" \
  --recurrence "Monthly" \
  --recurrence-period-from "2026-07-01" \
  --recurrence-period-to "2027-07-01"
```

### Step 5: 推荐优化项

| 优化项 | 预期节省 | 难度 |
|--------|---------|------|
| ACA 后端 minReplicas=0 | ~$15/月 | 低 |
| Cosmos DB 监控 429 → 按需 RU | ~$10/月 (相比预留) | 中 |
| ACR Premium (按需, 目前 Basic 够) | — | 低 |
| 删除未使用的资源 | ~$5/月 | 低 |
| Storage 生命周期管理 | ~$2/月 | 低 |
| 购买 1 年预留 (如长期运行) | ~20% off | 中 |

---

## 3. 变更清单

| 资源 | 操作 |
|------|------|
| Budget | 新增 $200/月, 80%/100% 告警 |
| 所有资源 | 新增 Required Tags |
| ACA Backend | minReplicas: 1 → 0 (可休眠) |
| Cost Export | 配置到 Storage |

---

## 4. 验收标准

- [ ] Azure Portal 显示预算状态, 每日更新
- [ ] 所有资源有 `Environment`, `Project`, `Owner` 标签
- [ ] Cost Export 在 Storage 容器中生成 CSV
- [ ] 非工作时间 ACA 后端缩到 0 (冷启动可接受)
- [ ] 月度成本 < $100 (远低于预算阈值)

---

## 5. 参考链接

- [Azure Cost Management Bicep](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/automate-budget)
- [Resource Tagging](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/tag-resources)
- [ACA Pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/)
