# 蓝图 02: API 网关与边界 (API Management Gateway)

> **领域**: 网络与 API 管理 | **优先级**: P1 | **复杂度**: 高 | **预估工时**: 3~5天

---

## 1. 现状分析

### 当前做法
- 前端 `src/client-edge/src/app/api/[...path]/route.ts` catch-all 反向代理到后端 ACA
- 后端仅通过 VNet internal ACA (`external: false`) 暴露, 无统一网关层
- 无 API 版本控制、无请求限流、无 JWT 验证
- 无 WAF (Web Application Firewall)
- 无 TLS 终止管理 (ACA Ingress 自动处理)
- 前端直接暴露公网入口, 遭受 DDoS/CC 攻击无防护层

### 架构图 (当前)

```
Browser ──HTTPS──► ACA Frontend (Public)
                     │
                     └── catch-all route ──► ACA Backend (Internal)
                                               │
                                               ├── Cosmos DB (PE)
                                               ├── Storage (PE)
                                               └── IoT Hub
```

### 问题
| 问题 | 影响 |
|------|------|
| 无 API 版本管理 | 前后端耦合, 无法灰度 |
| 无限流/配额 | 单客户端可打爆后端 |
| 无 JWT 认证 | 后端对公网请求无身份验证 |
| 无 WAF | OWASP 攻击无防护 |
| 无 SLA/多区域 | 单点故障 |

---

## 2. 目标架构

### Option A: Azure Front Door + ACA (轻量, 推荐起步)

```
Browser ──HTTPS──► Azure Front Door (Global)
                     ├─ WAF Policy (OWASP 3.2 + Rate Limit)
                     ├─ Frontend Origin (ACA Public)
                     └─ Backend Origin (ACA Private via Private Link)
```

**优势**: 简单, 全球 CDN + WAF, 支持 A/B 测试
**局限**: 无 API 策略引擎 (版本/订阅/配额)

### Option B: Azure Front Door + API Management + ACA (完整方案)

```
Browser ──HTTPS──► Azure Front Door (Global)
                     ├─ WAF Policy
                     └─ API Management (Premium)
                         ├─ API Policies (Rate Limit, JWT Validate, IP Filter)
                         ├─ API Versions (v1, v2)
                         ├─ Product / Subscription
                         └─ Backend: ACA Backend (Internal)
```

**优势**: 完整 API 治理, 订阅计费, 开发者门户
**局限**: 成本高 (APIM Premium ~$3k+/月), 复杂

### 推荐路径

```
Phase 1: Front Door + WAF (1天)
Phase 2: APIM Consumption/Basic (2天)
Phase 3: 按需升级到 APIM Premium
```

---

## 3. Phase 1: Azure Front Door + WAF

### 3.1 Bicep: Front Door Profile + Endpoint

```bicep
resource frontDoor 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: '${prefix}-afd-${uniqueString(resourceGroup().id)}'
  sku: { name: 'Standard_AzureFrontDoor' }
  properties: { originResponseTimeoutSeconds: 60 }
}

resource afdEndpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = {
  name: '${prefix}-global-endpoint'
  parent: frontDoor
  properties: { enabledState: 'Enabled' }
}

resource frontendOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  name: 'frontend-origin-group'
  parent: frontDoor
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'GET'
      probeProtocol: 'Http'
      probeIntervalInSeconds: 30
    }
  }
}

resource frontendOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  name: 'frontend-aca-origin'
  parent: frontendOriginGroup
  properties: {
    address: frontendApp.properties.latestRevisionFqdn
    httpPort: 80
    httpsPort: 443
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
  }
}
```

### 3.2 WAF Policy

```bicep
resource wafPolicy 'Microsoft.Network/frontDoorWebApplicationFirewallPolicies@2024-03-01' = {
  name: '${prefix}-waf-policy'
  sku: { name: 'Standard_AzureFrontDoor' }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: 'Prevention'
      requestBodyCheck: 'Enabled'
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Block'
          exclusions: []
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
          ruleSetAction: 'Block'
        }
      ]
    }
    customRules: {
      rules: [
        {
          name: 'RateLimit'
          priority: 1
          ruleType: 'RateLimitRule'
          rateLimitDurationInMinutes: 1
          rateLimitThreshold: 100
          matchConditions: [{
            matchVariable: 'RemoteAddr'
            operator: 'IPMatch'
            negateCondition: false
            matchValue: ['*']
          }]
          action: 'Block'
        }
      ]
    }
  }
}
```

---

## 4. Phase 2: API Management (Consumption Tier)

### 4.1 Bicep 部署

```bicep
resource apiManagement 'Microsoft.ApiManagement/service@2023-03-01-preview' = {
  name: '${prefix}-apim-${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Consumption', capacity: 0 }
  properties: {
    publisherEmail: 'admin@omniguard.io'
    publisherName: 'OmniGuard'
  }
}
```

### 4.2 API 定义 (通过 Bicep 或 CLI)

创建 API 定义将后端 ACA 的所有路由暴露为受管 API:

```bash
# API 导入 (后端快速接入)
az apim api import \
  --service-name "$APIM_NAME" \
  --api-id "backend-api" \
  --display-name "OmniGuard Backend API" \
  --path "/api/v1" \
  --service-url "https://$BACKEND_INTERNAL_URL" \
  --protocols https
```

### 4.3 API 策略: JWT 验证 + 限流

```xml
<policies>
  <inbound>
    <base />
    <rate-limit calls="60" renewal-period="60" />
    <validate-jwt
      header-name="Authorization"
      failed-validation-httpcode="401"
      failed-validation-error-message="Unauthorized">
      <openid-config url="https://login.microsoftonline.com/{tenant-id}/v2.0/.well-known/openid-configuration" />
      <required-claims>
        <claim name="aud">
          <value>api://{api-client-id}</value>
        </claim>
      </required-claims>
    </validate-jwt>
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
```

---

## 5. 变更清单

| 资源 | 操作 |
|------|------|
| Front Door Standard Profile | 新增 |
| WAF Policy (OWASP 3.2 + Bot Manager) | 新增 |
| Front Door -> ACA 前端 Origin Group | 新增 |
| API Management (Consumption) | 新增 |
| ACA 后端 Ingress 改为 internal | 不变 (已 internal) |
| 前端 catch-all proxy | 可选择保留或移除 |

---

## 6. 验收标准

- [ ] `https://<afd-endpoint>.z01.azurefd.net/` 可访问前端页面
- [ ] WAF 拦截 SQL 注入测试 (`' OR 1=1--`)
- [ ] 1 分钟内超过 100 请求被限流 (返回 403)
- [ ] APIM 显示后端 API 延迟/请求数/错误率
- [ ] 无 JWT 的请求被 401 拒绝
- [ ] 前后端通过 APIM/Front Door 通信, 不直接暴露 ACA 域名

---

## 7. 参考链接

- [Front Door WAF](https://learn.microsoft.com/en-us/azure/web-application-firewall/afds/afds-overview)
- [APIM Consumption Tier](https://learn.microsoft.com/en-us/azure/api-management/api-management-features)
- [APIM Policy Reference](https://learn.microsoft.com/en-us/azure/api-management/api-management-policies)
- [Front Door + ACA](https://learn.microsoft.com/en-us/azure/container-apps/front-door)
