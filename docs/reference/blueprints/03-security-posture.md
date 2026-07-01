# 蓝图 03: 安全态势 (Security Posture)

> **领域**: 安全 | **优先级**: P1 | **复杂度**: 低~高 | **预估工时**: 0.5~5天

---

## 1. 现状分析

### 当前做法
- 无 Microsoft Defender for Cloud 配置
- 无 Microsoft Sentinel
- 无安全基线审计
- VNet / NSG / Private Link 已提供基础网络隔离
- 密钥/凭据无集中管理 (详见蓝图 01)
- 无安全告警/事件响应流程

### 安全评分 (预估)

| 安全控制 | 当前得分 | 满分 |
|---------|---------|------|
| 网络隔离 | 80% | 100% |
| 身份与访问 | 10% | 100% |
| 数据保护 | 30% | 100% |
| 端点安全 | 0% | 100% |
| 漏洞管理 | 0% | 100% |
| **总分** | **~24%** | **100%** |

---

## 2. 目标架构

### 2.1 分层防御

```
Layer 1: WAF + Front Door (蓝图 02)    ← 边界防御
Layer 2: Defender for Cloud             ← 云安全态势管理 (CSPM)
Layer 3: Key Vault + Managed Identity   ← 身份安全 (蓝图 01)
Layer 4: Network Security (NSG/FW/PE)   ← 网络隔离 (已实施)
Layer 5: Sentinel SIEM                  ← 安全事件响应 (SOC)
```

### 2.2 实施路径

```
Phase 1: 开启 Defender for Cloud (30min, 低投入高回报)
Phase 2: 修复安全建议 (持续)
Phase 3: 部署 Sentinel (可选, 大规模才需要)
```

---

## 3. Phase 1: Defender for Cloud

### 3.1 启用 Defender for Cloud

```bash
# 开启基础 CSPM (免费, 自动开启)
az security pricing show --name "VirtualMachines"

# 开启增强安全 (付费, 按月计费)
az security pricing create --name "CloudPosture" --pricing-tier "Standard"
az security pricing create --name "StorageAccounts" --pricing-tier "Standard"
az security pricing create --name "CosmosDbs" --pricing-tier "Standard"
az security pricing create --name "ContainerRegistry" --pricing-tier "Standard"
az security pricing create --name "KeyVaults" --pricing-tier "Standard"
```

### 3.2 Bicep: 启用 Defender 计划

```bicep
resource defenderStorage 'Microsoft.Security/pricings@2024-01-01' = {
  name: 'StorageAccounts'
  properties: {
    pricingTier: 'Standard'
    subPlan: 'PerStorageAccount'
  }
}

resource defenderCosmos 'Microsoft.Security/pricings@2024-01-01' = {
  name: 'CosmosDbs'
  properties: { pricingTier: 'Standard' }
}

resource defenderContainerRegistry 'Microsoft.Security/pricings@2024-01-01' = {
  name: 'ContainerRegistry'
  properties: { pricingTier: 'Standard' }
}

resource defenderKeyVault 'Microsoft.Security/pricings@2024-01-01' = {
  name: 'KeyVaults'
  properties: { pricingTier: 'Standard' }
}

resource defenderArm 'Microsoft.Security/pricings@2024-01-01' = {
  name: 'Arm'
  properties: { pricingTier: 'Standard' }
}
```

### 3.3 安全建议处理

部署后, 在 Azure Portal 中查看安全评分, 优先修复:

| 优先级 | 常见建议 | 对应操作 |
|--------|---------|---------|
| 高 | Cosmos DB 应启用网络隔离 | ✅ 已实现 (PE) |
| 高 | Storage 应禁用公共访问 | ✅ 已实现 |
| 高 | Key Vault 应启用 Purge Protection | 蓝图 01 |
| 中 | ACA 应启用 Managed Identity | 蓝图 01 |
| 中 | 应启用日志记录 | 蓝图 04 |
| 低 | 资源应添加标签 | FinOps 蓝图 |

---

## 4. Phase 2: 安全基线自动化

### 4.1 Azure Policy 强制执行

```bicep
resource denyPublicStorage 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'deny-public-storage'
  properties: {
    displayName: 'Deny Storage Account public network access'
    policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/...'
    parameters: {}
  }
}
```

### 4.2 安全自动化响应

使用 Defender for Cloud Workflow Automation:

```bash
# 当高风险告警产生时, 自动发送到 Teams/Slack
az security workflow-automation create \
  --name "HighSeverityAlert" \
  --resource-group "$RG" \
  --display-name "High Severity Alert Response" \
  --triggers "[{conditions: [{property: 'Severity', value: 'High', operator: 'Equals'}]}]" \
  --actions "[{type: 'EventHub', eventHubResourceId: '$EH_ID', connectionString: '$EH_CONN'}]"
```

---

## 5. Phase 3: Microsoft Sentinel (可选)

### 5.1 何时需要

- 有合规需求 (ISO 27001, SOC 2, PCI DSS)
- 需要跨云/混合环境统一 SIEM
- 需要高级威胁狩猎 (UEBA, 行为分析)
- 月均日志量 > 10GB

### 5.2 部署架构

```
OmniGuard Resources
    ├── ACA Logs ──► Log Analytics
    ├── Cosmos DB ──► Diagnostic Settings
    ├── Front Door ──► WAF Logs
    └── Key Vault ──► Audit Logs
                            │
                    ┌───────▼───────┐
                    │   Sentinel     │
                    │  (LA Workspace)│
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  SOC Playbooks │
                    │  (Logic Apps)  │
                    └───────────────┘
```

### 5.3 Bicep 概览 (Sentinel)

```bicep
resource sentinel 'Microsoft.OperationsManagement/solutions@2015-11-01-preview' = {
  name: 'SecurityInsights(${law.name})'
  location: location
  plan: {
    name: 'SecurityInsights'
    product: 'OMSGallery/SecurityInsights'
    publisher: 'Microsoft'
    promotionCode: ''
  }
}
```

### 5.4 连接器激活

OmniGuard 场景下推荐激活的数据连接器:

| 连接器 | 用途 |
|--------|------|
| Azure Activity Log | 审计订阅级别操作 |
| Azure Key Vault | 密钥访问审计 |
| Azure Front Door | WAF 日志分析 |
| Azure Storage | 数据平面访问审计 |
| IoT Hub | 设备安全事件 |
| Microsoft Entra ID | 登录/权限异常 |

---

## 6. 验收标准

- [ ] Azure Portal 安全评分 > 80% (当前预估 ~24%)
- [ ] 所有高风险建议已修复或制定修复计划
- [ ] Key Vault 密钥访问有审计日志
- [ ] 网络隔离策略通过 Policy 强制执行
- [ ] (可选) Sentinel 接收所有 OmniGuard 资源日志
- [ ] (可选) 安全告警自动通知到 Teams/邮箱

---

## 7. 参考链接

- [Defender for Cloud Overview](https://learn.microsoft.com/en-us/azure/defender-for-cloud/)
- [Microsoft Sentinel](https://learn.microsoft.com/en-us/azure/sentinel/)
- [Azure Security Benchmark](https://learn.microsoft.com/en-us/security/benchmark/azure/)
- [CIS Microsoft Azure Foundations Benchmark](https://www.cisecurity.org/benchmark/azure/)
