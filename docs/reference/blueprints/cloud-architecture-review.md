# OmniGuard 云架构设计审查报告 (Blueprints 00-12)

> **评级与验证报告** | **架构师**: AI Cloud Architect | **当前时间**: 2026-07-02
> 
> 本报告对 `docs/reference/blueprints/` 目录下的 13 个蓝图文件进行深度代码和架构级审查。我们定位了多个**严重的配置漏洞与语法错误（如 Bicep/SDK 兼容性）**，并在此基础上提供了**补全 90% 顶尖云架构能力**的缺失板块建议。

---

## 目录
1. [第一部分：核心错误诊断与代码级修复 (Critical Fixes)](#1-%E7%AC%AC%E4%B8%80%E9%83%A8%E5%88%86%E6%A0%B8%E5%BF%83%E9%94%99%E8%AF%AF%E8%AF%8A%E6%96%AD%E4%B8%8E%E4%BB%A3%E7%A0%81%E7%BA%A7%E4%BF%AE%E5%A4%8D)
2. [第二部分：补全 90% 优秀架构师核心领域 (Missing Domains)](#2-%E7%AC%AC%E4%BA%8C%E9%83%A8%E5%88%86%E8%A1%A5%E5%85%A8-90-%E4%BC%98%E7%A7%80%E6%9E%B6%E6%9E%84%E5%B8%88%E6%A0%B8%E5%BF%83%E9%A2%86%E5%9F%9F)
3. [第三部分：OmniGuard 项目集成路径建议 (Integration Path)](#3-%E7%AC%AC%E4%B8%96%E9%83%A8%E5%88%86omniguard-%E9%A1%B9%E7%9B%AE%E9%9B%86%E6%88%90%E8%B7%AF%E5%BE%84%E5%BB%BA%E8%AE%AE)

---

## 1. 第一部分：核心错误诊断与代码级修复

这部分审查原始 00-12 蓝图中的硬伤（Syntax & Logic Errors），并提供正确的代码参考。

### 🚨 蓝图 01: 身份基座 (Identity Foundation)
#### 1.1 环境变量中的 Key Vault 引用语法错误
* **原始设计**: 在 ACA 环境中注入 `IOTHUB_CONNECTION_STRING@Microsoft.KeyVault(SecretUri=...)`
* **问题诊断**: `@Microsoft.KeyVault(...)` 语法仅由 **Azure App Service** 和 **Azure Functions** 的底层 Application Settings 原生解析。**Azure Container Apps (ACA)** 不支持此语法。如果在 ACA 环境变量中直接填入该字符串，容器只会将其当做普通明文读取，无法获取真实密钥，导致连接失败。
* **修复方案**: 必须在 ACA 资源声明的 `secrets` 段中定义 Key Vault 秘密，然后使用 `secretRef` 注入环境变量。
* **Bicep 修复代码**:
  ```bicep
  // compute-module.bicep
  resource backendApp 'Microsoft.App/containerApps@2023-05-01' = {
    name: 'omni-backend'
    identity: {
      type: 'UserAssigned'
      userAssignedIdentities: {
        '${backendIdentity.id}': {}
      }
    }
    properties: {
      configuration: {
        secrets: [
          {
            name: 'iot-hub-conn-secret'
            keyVaultUrl: 'https://${kvName}.vault.azure.net/secrets/iot-hub-conn-string'
            identity: backendIdentity.id // 使用托管身份拉取
          }
        ]
      }
      template: {
        containers: [
          {
            name: 'backend'
            image: '${acrName}.azurecr.io/omni-backend:latest'
            env: [
              {
                name: 'IOTHUB_CONNECTION_STRING'
                secretRef: 'iot-hub-conn-secret' // 正确的 ACA 绑定方式
              }
            ]
          }
        ]
      }
    }
  }
  ```

#### 1.2 托管身份缺失 Key Vault 访问策略 (RBAC)
* **原始设计**: 蓝图声明 Managed Identity 读取 Key Vault，但在 Bicep 变更清单中，只为 Cosmos DB 做了角色分配，漏掉了 Key Vault 的角色分配。
* **修复方案**: 必须在 Bicep 中显示为 Managed Identity 分配 `Key Vault Secrets User` 角色（Role ID: `46334586-17cd-430f-b9d3-241547911047`）。
* **Bicep 修复代码**:
  ```bicep
  resource kvSecretsUserRole 'Microsoft.Authorization/roleDefinitions@2022-04-01' existing = {
    scope: subscription()
    name: '46334586-17cd-430f-b9d3-241547911047' // Key Vault Secrets User Role ID
  }

  resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
    name: guid(keyVault.id, backendIdentity.id, kvSecretsUserRole.id)
    scope: keyVault
    properties: {
      principalId: backendIdentity.properties.principalId
      roleDefinitionId: kvSecretsUserRole.id
      principalType: 'ServicePrincipal'
    }
  }
  ```

---

### 🚨 蓝图 02: API 网关与边界 (API Management Gateway)
#### 2.1 Azure Front Door 规格 (SKU) 与 Private Link 冲突
* **原始设计**: 使用 `Standard_AzureFrontDoor`，但声明了使用 Private Link 保护后端私有 origin（`Backend Origin (ACA Private via Private Link)`）。
* **问题诊断**: Azure Front Door **Standard 级别不支持 Private Link 连接 Origin**。只有 **Premium_AzureFrontDoor** 才能通过 Private Link 穿透企业 VNet。如果使用 Standard 级别，ACA 后端必须保持公网暴露，通过 IP 过滤或 Front Door ID (`X-Azure-FDID`) 校验来做防护。
* **修复方案**: 将 Front Door SKU 升级为 `Premium_AzureFrontDoor`（或在标准版中改用 FQDN + 访问限制）。

#### 2.2 APIM Consumption 级别与内网通信失败
* **原始设计**: 部署 `Consumption` 级别的 API Management，并试图访问内网隔离的 ACA 后端（`BACKEND_INTERNAL_URL`）。
* **问题诊断**: APIM **Consumption (无服务器) 级别不支持 VNet 虚拟网络集成**。由于无服务器的物理网络是微软托管的多租户环境，它无法路由进入你的 Hub-Spoke VNet。你的内网 ACA 无法被 Consumption 级别的 APIM 访问，从而导致 API 报 504 错误。
* **修复方案**: 在非生产环境（Staging/Dev）使用 **Developer** 级别 APIM 并启用 `Internal` 模式挂载到子网中；生产环境使用 **Premium** 级别。
* **Bicep 修复代码**:
  ```bicep
  resource apiManagement 'Microsoft.ApiManagement/service@2023-03-01-preview' = {
    name: '${prefix}-apim'
    location: location
    sku: { name: 'Developer', capacity: 1 } // Developer 级别支持 VNet 集成
    properties: {
      publisherEmail: 'admin@omniguard.io'
      publisherName: 'OmniGuard'
      virtualNetworkType: 'Internal' // 隐藏在 VNet 内部
      virtualNetworkConfiguration: {
        subnetResourceId: apimSubnet.id
      }
    }
  }
  ```

#### 2.3 属性引用错误 (Bicep)
* **原始设计**: `address: frontendApp.properties.latestRevisionFqdn`
* **问题诊断**: ACA 的属性中不存在 `properties.latestRevisionFqdn`，该属性位于 `properties.configuration.ingress.fqdn` 中。
* **修复方案**: 修改属性路径为 `frontendApp.properties.configuration.ingress.fqdn`。

---

### 🚨 蓝图 03: 安全态势 (Security Posture)
#### 3.1 资源部署作用域 (Scope) 错误
* **原始设计**: 在包含网络和计算组件的普通模块（RG 级别作用域）中声明 `Microsoft.Security/pricings`（Defender 计划）。
* **问题诊断**: Microsoft Defender for Cloud 的定价和计划资源属于**订阅级别 (Subscription-level)** 资源，如果在默认作用域为资源组 (Resource Group) 的 Bicep 文件中声明，部署将直接报错失败。
* **修复方案**: 将安全配置拆分至单独 Bicep 文件，并声明 `targetScope = 'subscription'`。
* **Bicep 修复代码**:
  ```bicep
  targetScope = 'subscription' // 必须声明为订阅级

  resource defenderStorage 'Microsoft.Security/pricings@2024-01-01' = {
    name: 'StorageAccounts'
    properties: {
      pricingTier: 'Standard'
      subPlan: 'PerStorageAccount'
    }
  }
  ```

---

### 🚨 蓝图 04: 可观测平台 (Observability Platform)
#### 4.1 引入废弃 Python SDK 与错误的 API
* **原始设计**: 使用 OpenTelemetry SDK，但在自定义业务指标时编写了:
  ```python
  from azure.monitor.events.extension import track_event
  track_event("DeviceRegistered", ...)
  ```
* **问题诊断**: `azure.monitor.events.extension` 是微软早期**已废弃且停止维护的旧版 Application Insights Python SDK**。这会与 OpenTelemetry 生态产生严重的类库冲突。在 OpenTelemetry 标准下，自定义事件和指标必须使用标准的 OpenTelemetry APIs，或者使用微软官方推荐的 `azure-monitor-opentelemetry` 包装包。
* **修复方案**: 使用标准的 `azure-monitor-opentelemetry` 和 Python Logging API 传输自定义事件，或利用 OpenTelemetry Metric API 发送自定义指标。
* **Python 修复代码**:
  ```python
  import logging
  from azure.monitor.opentelemetry import configure_azure_monitor
  from opentelemetry import metrics

  # 1. 自动配置 OpenTelemetry 导出到 Azure Monitor
  configure_azure_monitor(
      connection_string="InstrumentationKey=xxxx..."
  )

  logger = logging.getLogger("omniguard")
  logger.setLevel(logging.INFO)

  # 2. 正确记录自定义事件 (通过结构化日志)
  logger.info("DeviceRegistered", extra={"custom_dimensions": {"device_id": "dev-01", "tenant": "t-01"}})

  # 3. 正确定义和调用自定义指标 (Prometheus 风格)
  meter = metrics.get_meter("omniguard.metrics")
  latency_counter = meter.create_histogram(
      name="iot_message_processing_latency",
      description="Processing time of IoT telemetry messages",
      unit="ms"
  )
  latency_counter.record(125, {"device_id": "dev-01"})
  ```

---

### 🚨 蓝图 05: 计算与容器优化 (Compute & Container Optimization)
#### 5.1 KEDA 缩放规则的队列类型不匹配
* **原始设计**: 在 KEDA 缩放规则中使用了 `type: 'azure-queue'`，并配置了 Connection。
* **问题诊断**: `azure-queue` 代表的是 **Azure Storage Queue** 缩放器，但蓝图 07 中定义的架构核心消息层使用的是 **Azure Service Bus**。如果配置 `azure-queue` 却读取 Service Bus 的属性，KEDA 在运行时会报错，无法读取消息积压量。同时，如果后端 ACA 副本数缩容到 0，它将**永远不会自动被新流入的 Service Bus 消息唤醒**。
* **修复方案**: 使用 `type: 'azure-servicebus'` 作为缩放器类型，并使用正确的 Service Bus 元数据。
* **Bicep 修复代码**:
  ```bicep
  scale: {
    minReplicas: 0 // 配合 KEDA，无消息时彻底休眠
    maxReplicas: 10
    rules: [
      {
        name: 'servicebus-scaler'
        custom: {
          type: 'azure-servicebus' // 改为 Service Bus
          metadata: {
            topicName: 'device-telemetry'
            subscriptionName: 'backend-processor'
            messageCount: '10' // 每积压 10 条消息增加一个 Pod
          }
          auth: [
            {
              secretRef: 'service-bus-conn-string'
              triggerParameter: 'connection'
            }
          ]
        }
      }
    ]
  }
  ```

---

### 🚨 蓝图 06: 数据平台深化 (Data Platform Deep Dive)
#### 6.1 成本估算与 Cosmos DB 实例类型的底层冲突
* **原始设计**: 蓝图 06 配置了 Cosmos DB `throughput: 4000` RU/s，并声明了跨区域复制；但蓝图 09 FinOps 估算中认为 Cosmos DB 为 $0 (Free Tier)。
* **问题诊断**: Cosmos DB 免费层（Free Tier）仅支持单区域，并且最大并发上限为 1000 RU/s（或者在指定容器限额 400 RU/s）。如果在 Bicep 中将其配置为 4000 RU/s 并启用了多写入区域 (multi-region writes)，**微软将取消免费层，立刻开始按小时计费**。7000 RU/s 的全局静态配置会产生每月约 $400 - $500 美元的额外账单。
* **修复方案**: 生产环境应当采用 **Autoscale** 吞吐量模型（范围 400 - 4000 RU/s），它支持在空闲时自动降低到 10% 吞吐量（400 RU），并在并发高时弹性扩容，避免静态高昂成本。
* **Bicep 修复代码**:
  ```bicep
  resource deviceTwinsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
    name: 'DeviceTwins'
    properties: {
      resource: {
        id: 'DeviceTwins'
        partitionKey: { paths: ['/tenant_id'], kind: 'Hash' }
      }
      options: {
        autoscaleSettings: {
          maxThroughput: 4000 // 自动缩放上限 4000，闲置时自动下缩至 400 RU
        }
      }
    }
  }
  ```

#### 6.2 Cosmos DB 私有端点连接模式推荐错误
* **原始设计**: "私有端点建议 Gateway 模式连接"
* **问题诊断**: 与常规公网相反，对于部署在私有端点 (Private Endpoint) 后方的 Cosmos DB，**强烈推荐使用 Direct (TCP) 模式**，而不是 Gateway (HTTPS) 模式。因为 Direct 模式在经过内网解析后，可以直接在客户端和 Cosmos DB 的各个分区副本之间建立 TCP 连接，绕过 APIM / Gateway 中介，延迟通常可以降低 5-10ms 并且降低吞吐上限开销。

---

### 🚨 蓝图 07: 事件驱动集成 (Event-Driven Integration)
#### 7.1 Event Grid System Topic 地理位置 (Location) 错误
* **原始设计**: `location: 'global'`
* **问题诊断**: 并非所有 Event Grid 资源都是 Global 的。对于绑定到特定区域资源（例如东南亚的 IoT Hub）的 System Topic，其作用域和部署位置**必须与关联的源资源位置严格一致**（例如 `location: 'southeastasia'`）。使用 `global` 会导致 Bicep 校验抛出 `LocationNotAvailableForResourceType` 错误。
* **修复方案**: 修改 location 属性使其继承资源组或源 IoT Hub 的 location。

---

### 🚨 蓝图 08: CI/CD 与 DevOps 流水线
#### 8.1 GitHub Runner 缺失 CLI 插件导致流水线崩溃
* **原始设计**: 
  ```yaml
  - name: Deploy Backend ACA
    run: |
      az containerapp update --name omni-backend ...
  ```
* **问题诊断**: GitHub Actions 提供的官方托管镜像 `ubuntu-latest` 虽然预装了 Azure CLI，但是**并未预装 `containerapp` 扩展插件**。如果在流水线中不加处理地直接运行 `az containerapp update`，流水线将直接报错中断并提示找不到命令。
* **修复方案**: 在执行 `az containerapp` 命令前，必须显式插入一行安装扩展的指令：
  ```yaml
  - name: Install ACA Extension
    run: |
      az extension add --name containerapp --upgrade
  ```

---

### 🚨 蓝图 10: 高可用与灾备 (HA/DR)
#### 10.1 灾备切换设计反模式 (Anti-Pattern)
* **原始设计**: 设计了手动运行 CLI 脚本去更新 Front Door Endpoint 所绑定的 Origin Group 来完成灾备切换。
* **问题诊断**: 这是一个典型的传统灾备反模式。Azure Front Door 是全球负载均衡器，其核心价值就在于**自动健康探测与零延迟无缝切换**。设计人工执行的脚本不仅拉长了 RTO（恢复时间目标），更在灾难发生时增加了操作员失误的风险。
* **修复方案**: 在 Front Door 中配置一个统一的 Origin Group，把新加坡的主 ACA (Priority: 1) 和日本的灾备 ACA (Priority: 2) 放在一起，并配置健康探针（Health Probe）。当主 ACA 探针连续三次失败，Front Door 会瞬间**自动**将所有全球流量导入灾备区域，无需人工介入。

---

### 🚨 蓝图 11: 合规与治理 (Compliance & Governance)
#### 11.1 Policy 赋值的 Bicep 语法错误
* **原始设计**: 
  ```bicep
  resource policyAssignment 'Microsoft.Authorization/policyAssignments@2023-04-01' = {
    properties: {
      scope: resourceGroup().id // 错误语法
    }
  }
  ```
* **问题诊断**: 在 Bicep 语言中，`scope` 是一个**资源一级的保留关键字**，用于控制资源的部署目标。它不能被写在 `properties` 参数内部。
* **修复方案**: 移除内部 `scope` 并将 policyAssignment 的 scope 指向正确的资源实例。
* **Bicep 修复代码**:
  ```bicep
  resource policyAssignment 'Microsoft.Authorization/policyAssignments@2023-04-01' = {
    name: 'prod-policies'
    scope: resourceGroup() // 正确的声明方式
    properties: {
      policyDefinitionId: allowedLocationsPolicy.id
      displayName: 'OmniGuard Production Policies'
    }
  }
  ```

---

## 2. 第二部分：补全 90% 优秀架构师核心领域

原始蓝图偏向于简单的“服务堆砌”。要达到资深云架构师（**Top 10%** 业界水平）所涉及的 90% 核心功能，必须补全以下 5 个核心架构板块：

### 1️⃣ 企业级网络拓扑与私有 DNS (Networking & DNS Zones)
原始蓝图中略过了私有终结点（Private Endpoint）背后的核心网络路由和 DNS 解析：
* **私有 DNS 集成 (Private DNS Zones)**: 在内网部署 Private Endpoint (Cosmos DB, Storage, Key Vault) 后，必须为每个服务关联私有 DNS 区域，否则容器在内网发出的 `xxx.documents.azure.com` 请求将仍然由公网 DNS 解析至公网 IP，直接导致连接被防火墙拦截。
* **Hub-and-Spoke 网络拓扑**: 架构应该包含一个中心网络 (Hub VNet) 放置公共边界如 Azure Firewall, VPN Gateway，和多个分支网络 (Spoke VNet) 放置业务计算 ACA，它们之间通过 VNet Peering 互联，并利用 UDR (自定义路由表) 强制使所有出站流量流经防火墙。

### 2️⃣ 密钥托管与数据双重加密 (Zero-Trust Key Management & CMK)
为了防范微软云平台内部的特权泄露以及满足金融级合规，架构师必须掌握：
* **客户托管密钥 (CMK / BYOK)**: 使用 Key Vault 中你自创的密钥去加密 Cosmos DB、Azure Storage 硬盘以及容器注册表 (ACR) 的静态数据。
* **Key Vault 证书轮换生命周期**: 实现外部 HTTPS 证书以及自建 CA 证书在 Key Vault 中的自动续期与轮换，避免因证书过期引发的整体服务中断。

### 3️⃣ 物联网大规模零接触安全注册 (IoT Device Provisioning Service)
OmniGuard 是一个典型的 IoT 智能设备管理系统。目前蓝图设计使用静态 IoT Hub 连接字符串，无法应对海量设备：
* **引入 DPS (Device Provisioning Service)**: 设备出厂时只烧录 DPS 终结点。设备首次联网时，通过向 DPS 提交 X.509 证书或者 TPM 硬件芯片证明身份。
* **动态注册与分配**: DPS 校验通过后，自动在后台对应的 IoT Hub 注册设备，并将连接信息安全返回给设备，实现千万级设备“开箱即用”和安全的零信任通道。

### 4️⃣ DevSecOps 安全左移 (Security Left in CI/CD)
单纯的 CI/CD (Ruff/TS Lint) 无法满足云原生安全标准，必须实现安全左移：
* **容器镜像扫描 (Container Vulnerability Scanning)**: 在镜像推送到 ACR 后（或在编译时使用 Trivy）自动扫描基础操作系统镜像漏洞。
* **代码静态密钥检测 (TruffleHog/GitGuardian)**: 阻止开发人员将写有真实凭据、Token 或证书的代码 commit 并 push 到 GitHub。
* **SCA 依赖成分分析**: 自动检测引入的 Python 第三方包（requirements.txt）或 Node.js npm 包是否包含高危 CVE 漏洞。

### 5️⃣ 混沌工程与 SLA 韧性测试 (Chaos Studio & Resilience)
高可用方案（灾备多可用区）不能只停留在纸面上，需要自动化验证：
* **Azure Chaos Studio**: 定期向系统注入人工网络延迟、主动关停新加坡可用区内 ACA 的 Pod、断开 Cosmos DB 主写入区网络，以此验证应用层是否能在 1 分钟内自动漂移、降级且不丢失关键数据。
* **SLA/RTO/RPO 实际校验**: 建立年度灾备演练（DR Drill）的标准化流程，将灾备验证从“技术预想”变为“工程现实”。

---

## 3. 第三部分：OmniGuard 项目集成路径建议

为了将这些功能有效集成到本项目的 Bicep 基础设施中，建议采用三阶段的演进路线：

```
Phase 1: 基础设施语法与逻辑纠错 (修正 BP 01, 02, 04, 05, 08) ────────► 确保 Bicep 与 GitHub Actions 能正常跑通
Phase 2: 架构升级 (Cosmos DB Autoscale, Front Door Premium 引入) ──► 减少不必要的开销，实现真正内网保护
Phase 3: 补全 90% 板块 (引入 DPS、Private DNS Zone、DevSecOps) ───────► 构建工业级零信任 IoT 架构
```

---

## 4. 第四部分：限额订阅（$196 / 20天）极省部署方案

针对您当前订阅仅剩 **$196** 且需维持 **20天左右** 的现状，我们必须将每日预算控制在 **$9.80 以下**（建议目标：**<$2.00/天**，总开销 <$40.00，预留充足的安全缓冲）。

以下是专为开发/验证阶段设计的“白嫖与平替”极省配置清单：

### 📈 每日预算对比与选型建议

| 资源服务 | 资深/生产级配置（原设计） | 极省验证配置（推荐） | 每日费用 (估算) | 月度费用 (估算) | 20天费用 | 降配策略与理由 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Cosmos DB** | 静态 7000 RU + 多写入区 | **Free Tier (1000 RU)** | $0.00 | $0.00 | **$0.00** | 保持单区域 Free Tier。只要在 Bicep 中将 RU 设为自动缩放或限制在单个容器 400 RU 以下，即可完全免费。 |
| **API Management** | Developer / Premium | **无 (Bypass APIM)** | $0.00 | $0.00 | **$0.00** | 验证阶段无需部署 APIM。前端直接通过内网 FQDN 或 ACA 公网暴露调用后端，节省 Developer 级每天 $4.90 的硬性开销。 |
| **Azure Front Door** | Premium SKU (含 WAF + PE) | **无 / 暂时停用** | $0.00 | $0.00 | **$0.00** | 暂时不配置全球网关。如果需要模拟，在前端 ACA 开启 Access Restriction 即可。 |
| **Container Apps (ACA)** | 24/7 运行 (min=1) | **Scale to 0 (自动休眠)** | ~$0.30 | ~$9.00 | **$6.00** | 将前端与后端的 `minReplicas` 均设为 `0`。没访问请求时容器完全不收费，仅在您打开网页测试时按秒计费。 |
| **Redis Cache** | Standard C1 (主备) | **Basic C0 (250MB)** | ~$0.53 | ~$16.00 | **$10.60** | 从 Standard 降级为 Basic C0 单节点（仅用于缓存测试），或者在代码中使用 MemoryCache（内存缓存）替代，开销直接归零。 |
| **Azure AI Search** | Basic SKU | **Free Tier (免费级)** | $0.00 | $0.00 | **$0.00** | AI Search 免费层支持 3 个索引、50MB 存储，对于验证阶段的少量 IoT 遥测和知识库搜索完全够用。 |
| **IoT Hub** | S1 Standard (400K 消息) | **F1 Free (8K 消息)** | $0.00 | $0.00 | **$0.00** | 保持 Free 级别即可，日消息上限 8,000 条，完全能满足您个人或小规模的模拟测试。 |
| **ACR / Storage** | Premium + LRS Storage | **Basic ACR + LRS** | ~$0.18 | ~$5.50 | **$3.60** | 镜像仓库降至 Basic 级别（不支持 Geo 复制，但拉取速度不受限），存储账户维持 LRS。 |
| **总计** | — | — | **~$1.01** | **~$30.50** | **~$20.20** | **预算占比：约 10%**（剩余 $175+ 安全线） |

---

### 🛠️ 关键降配 Bicep 配置修改指引

#### 1. ACA 自动休眠（前后端全设为 0）
```bicep
// compute-module.bicep
resource frontendApp 'Microsoft.App/containerApps@2023-05-01' = {
  properties: {
    template: {
      scale: {
        minReplicas: 0 // 测试阶段前端也可设为 0 以节省开销
        maxReplicas: 2
      }
    }
  }
}
```

#### 2. Redis 降至 Basic C0
```bicep
// nested-infra.bicep
resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: '${prefix}-redis'
  location: location
  properties: {
    sku: {
      name: 'Basic' // 降级为 Basic
      family: 'C'
      capacity: 0   // C0 规格
    }
    enableNonSslPort: false
  }
}
```

#### 3. AI Search 启用 Free Tier
```bicep
// nested-infra.bicep
resource searchService 'Microsoft.Search/searchServices@2023-11-01' = {
  name: '${prefix}-search'
  location: location
  sku: {
    name: 'free' // 免费层，限制：每个订阅只能创建一个免费 Search 服务
  }
}
```

