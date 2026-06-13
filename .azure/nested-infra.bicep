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
// 4. 双向 VNet Peering 隧道互通 (数据面打通)
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
