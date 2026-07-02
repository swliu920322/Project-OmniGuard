# 蓝图 13: 企业级网络拓扑与私有 DNS (Enterprise Networking & Private DNS)

> **领域**: 网络与安全 | **优先级**: P1 | **复杂度**: 高 | **预估工时**: 3~5天
> 
> 本蓝图阐述如何设计企业级 Hub-Spoke (中心与分支) 网络拓扑，并实现私有终结点 (Private Endpoint) 的 Private DNS Zones 自动解析。这是将项目从“公网模型”改造为“内网安全模型”的必经之路。

---

## 1. 现状与痛点

### 当前网络状态
- 虽有 VNet 与子网，但缺乏清晰的 **Hub-Spoke** 边界隔离。
- 引入 Private Endpoint 后，没有配置 **Private DNS Zone**。
- **DNS 致命盲区**：容器内部对 `omni-cosmos.documents.azure.com` 的解析仍然会返回公网 IP，而不是 Private Endpoint 的内网 IP（如 `10.0.2.4`）。因为没有私有 DNS，流量依然试图走公网连接数据库，被防火墙策略拒绝，从而引发 `Network connection failed` 报错。

---

## 2. 目标拓扑 (Hub-Spoke & Private Link)

```
                       ┌────────────────────────┐
                       │       Hub VNet         │
                       │   (中心控制/边界网络)    │
                       │                        │
                       │   ┌────────────────┐   │
                       │   │ Azure Bastion  │   │
                       │   └────────────────┘   │
                       └───────────┬────────────┘
                                   │
                              VNet Peering
                                   │
                       ┌───────────▼────────────┐
                       │      Spoke VNet        │
                       │      (应用与数据)       │
                       │                        │
                       │   ┌────────────────┐   │
                       │   │ ACA Subnet     │   │
                       │   │ (omni-backend) │   │
                       │   └────────┬───────┘   │
                       │            │           │
                       │   ┌────────▼───────┐   │
                       │   │ Data Subnet    │   │
                       │   │ ├─ Cosmos PE   │◄──┼─── privatelink.documents.azure.com
                       │   │ └─ KeyVault PE │◄──┼─── privatelink.vaultcore.azure.com
                       │   └────────────────┘   │
                       └────────────────────────┘
```

---

## 3. Bicep 实施步骤

### Step 1: 声明私有 DNS 区域 (Private DNS Zones)

在虚拟网络中，Azure 默认的 DNS 服务器 (`168.63.129.16`) 需要知道如何解析私有终结点的私有 IP。我们必须声明对应的 Private DNS Zone。

```bicep
// 1. Cosmos DB 私有 DNS 区域
resource cosmosDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.documents.azure.com'
  location: 'global' // DNS 区域为全局资源
}

// 2. Key Vault 私有 DNS 区域
resource kvDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.vaultcore.azure.com'
  location: 'global'
}
```

### Step 2: 将 DNS 区域链接至虚拟网络 (VNet Links)

DNS Zone 必须与 VNet 关联，该 VNet 内部的资源（如 ACA 容器）才能使用这个 DNS 区域。

```bicep
// 将 Cosmos DNS 关联到 Spoke VNet
resource cosmosDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  name: '${cosmosDnsZone.name}-link'
  parent: cosmosDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: spokeVnet.id // Spoke VNet 资源 ID
    }
  }
}

// 将 Key Vault DNS 关联到 Spoke VNet
resource kvDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  name: '${kvDnsZone.name}-link'
  parent: kvDnsZone
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: spokeVnet.id
    }
  }
}
```

### Step 3: 配置 Private Endpoint 的 DNS Zone Group

部署 Private Endpoint 时，必须添加 `privateDnsZoneGroups`。它会自动将 Private Endpoint 分配到的内网 IP（例如 `10.1.2.4`）以 A 记录形式注册到对应的 Private DNS Zone 中。

```bicep
// Cosmos DB Private Endpoint 声明
resource cosmosPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-09-01' = {
  name: '${prefix}-cosmos-pe'
  location: location
  properties: {
    subnet: { id: dataSubnet.id }
    privateLinkServiceConnections: [
      {
        name: '${prefix}-cosmos-connection'
        properties: {
          privateLinkServiceId: cosmosDbAccount.id
          groupIds: [ 'Sql' ] // Cosmos DB 的 Sub-resource ID
        }
      }
    ]
  }
}

// 核心：DNS 组自动注册
resource cosmosDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = {
  name: 'default'
  parent: cosmosPrivateEndpoint
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'cosmos-config'
        properties: {
          privateDnsZoneId: cosmosDnsZone.id // 关联的 DNS Zone ID
        }
      }
    ]
  }
}
```

---

## 4. 架构师学习重点 (90% 功能掌握)

1. **内网 DNS 解析流程 (168.63.129.16)**:
   - 当 ACA 容器发起对 `my-cosmos.documents.azure.com` 的请求。
   - 默认 DNS 拦截，发现该 VNet 链接了 `privatelink.documents.azure.com` 区域。
   - DNS 服务器返回 A 记录中的私有 IP（例如 `10.1.2.4`）而不是公网。
   - 流量通过 VNet 路由表，直接打入 Data Subnet 的 Private Endpoint，全程不经过公网。

2. **跨 VNet (Hub-Spoke) 的 DNS 转发**:
   - 如果测试用的 VM 部署在 Hub VNet 中，而 Cosmos PE 在 Spoke VNet。
   - 必须确保 Hub VNet 也建立了与 `privatelink.documents.azure.com` 的 **Virtual Network Link**，否则 Hub 中的 VM 无法解析 PE 的内网地址。

---

## 5. 验收标准与命令

- [ ] 进入 ACA 容器内部，运行 `nslookup <your-cosmos-name>.documents.azure.com`
- [ ] 验证返回的 IP 为内网私有 IP（形如 `10.x.x.x`），而不是公网 IP。
- [ ] 验证 `az network private-dns record-set a list -g <rg-name> -z privatelink.documents.azure.com` 中已自动生成对应的 A 记录。
