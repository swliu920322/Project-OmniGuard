// ==========================================
// 1. 全局配置与参数 Schema (定规矩)
// ==========================================
param location string = 'southeastasia' // 锁死新加坡（东南亚）数据中心
param prefix string = 'omni'

var hubVNetName = '${prefix}-hub-vnet'
var spokeVNetName = '${prefix}-spoke-vnet'

// ==========================================
// 2. 部署 Hub 虚拟网络 (管理与安全中心)
// ==========================================
resource hubVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: hubVNetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.0.0.0/16' // Hub 区网络范围
      ]
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
// 3. 部署 Spoke 虚拟网络 (业务与 AI 运行时环境)
// ==========================================
resource spokeVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: spokeVNetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.1.0.0/16' // Spoke 区网络范围，与 Hub 完美错开，防止路由冲突
      ]
    }
    subnets: [
      {
        name: 'BackendSubnet' // 未来我们的 Azure Functions 降落场
        properties: {
          addressPrefix: '10.1.1.0/24'
        }
      }
    ]
  }
}

// ==========================================
// 4. 双向 VNet Peering 隧道互通 (打通内网)
// ==========================================

// Hub -> Spoke 隧道
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

// Spoke -> Hub 隧道
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
