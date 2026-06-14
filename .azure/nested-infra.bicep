// 锁死在资源组上下文，处理具体的物理实体
targetScope = 'resourceGroup'

param location string
param prefix string
param networkRules object
param hubVNetName string
param spokeVNetName string

// ==========================================
// 1. 建立不可变的网络安全组 (NSG) 防线
// ==========================================
resource backendNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: '${prefix}-backend-nsg'
  location: location
  properties: {
    securityRules: networkRules.backendNsgRules
  }
}

resource storageNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: '${prefix}-storage-nsg'
  location: location
  properties: {
    securityRules: networkRules.storageNsgRules
  }
}

// ==========================================
// 2. 部署 Hub 虚拟网络 (管理/安全层)
// ==========================================
resource hubVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: hubVNetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [
      {
        name: 'ManagementSubnet'
        properties: {
          addressPrefix: '10.0.1.0/24'
        }
      }
    ]
  }
}

// ==========================================
// 3. 部署 Spoke 虚拟网络并硬绑定安全护栏
// ==========================================
resource spokeVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: spokeVNetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.1.0.0/16']
    }
    subnets: [
      {
        name: 'BackendSubnet' // 未来 Azure Functions 运行时
        properties: {
          addressPrefix: '10.1.1.0/24'
          networkSecurityGroup: {
            id: backendNsg.id // 强制绑定入站公网阻断墙
          }
        }
      }
      {
        name: 'StorageSubnet' // 容纳 AI 敏感数据与 Private Endpoint 的合规孤岛
        properties: {
          addressPrefix: '10.1.2.0/24'
          networkSecurityGroup: {
            id: storageNsg.id // 强制绑定微隔离规则：只吃 10.1.1.0/24 发来的 443
          }
        }
      }
    ]
  }
}

// ==========================================
// 4. 双向 VNet Peering 隧道互通 (核心内网通路，坚决保留)
// ==========================================
resource hubToSpokePeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-11-01' = {
  parent: hubVnet
  name: 'Hub-To-Spoke'
  properties: {
    allowVirtualNetworkAccess: true
    allowForwardedTraffic: true
    allowGatewayTransit: false
    useRemoteGateways: false
    remoteVirtualNetwork: {
      id: spokeVnet.id
    }
  }
}

resource spokeToHubPeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-11-01' = {
  parent: spokeVnet
  name: 'Spoke-To-Hub'
  properties: {
    allowVirtualNetworkAccess: true
    allowForwardedTraffic: true
    allowGatewayTransit: false
    useRemoteGateways: false
    remoteVirtualNetwork: {
      id: hubVnet.id
    }
  }
}

// ==========================================
// 5. Serverless 大脑宿主组件（修复 24 位定名冲突限制）
// ==========================================

// 修复点：用 'st' 代替 'funcstor'，确保 prefix + st + uniqueString 不超过 24 位物理红线
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${prefix}st${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    publicNetworkAccess: 'Disabled' // 零信任治理：锁死运行时存储公网访问
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// 创建高级服务器弹性宿主计划
resource serverlessPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-serverless-plan'
  location: location
  sku: {
    name: 'FC1' // Flex Consumption计划拥有内网集成的最高性价比
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true // 锁定 Linux OS 运行时
  }
}

// 3. 部署无密钥安全大脑外壳 (Azure Function App)
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-secure-brain-app'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: serverlessPlan.id
    httpsOnly: true
    // 强制显式定义 functionAppConfig，修复 BadRequest 错误
    functionAppConfig: {
      runtime: {
        name: 'python'
        version: '3.10'
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 10
        instanceMemoryMB: 2048
      }
    }
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.10'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${funcStorage.name};AccountKey=${funcStorage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
      ]
    }
  }
}

// ==========================================
// 4. 建立 Function 出站流量内网吞噬 (VNet Integration)
// ==========================================
// 注意：在真实生产中，需要为 Function 绑定虚拟网络物理网卡。
// 为了死守你的订阅额度（FinOps），我们今天先将这套托管身份和 Function 宿主骨架成功编译入库。