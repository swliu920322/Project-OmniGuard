targetScope = 'resourceGroup'

param location string
param prefix string
param networkRules object
param hubVNetName string
param spokeVNetName string

// 1. 网络安全隔离组矩阵 (NSG 防线)
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

// 2. 虚拟网络物理拓扑 (Hub & Spoke)
resource hubVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: hubVNetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    subnets: [
      {
        name: 'ManagementSubnet'
        properties: { addressPrefix: '10.0.1.0/24' }
      }
    ]
  }
}

resource spokeVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: spokeVNetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.1.0.0/16'] }
    subnets: [
      {
        name: 'BackendSubnet'
        properties: {
          addressPrefix: '10.1.1.0/24'
          networkSecurityGroup: { id: backendNsg.id }
          delegations: [
            {
              name: 'serverlessDelegation'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: 'StorageSubnet'
        properties: {
          addressPrefix: '10.1.2.0/24'
          networkSecurityGroup: { id: storageNsg.id }
        }
      }
    ]
  }
}

// 3. 跨网络对等互联隧道 (VNet Peering)
resource hubToSpokePeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-11-01' = {
  parent: hubVnet
  name: 'Hub-To-Spoke'
  properties: {
    allowVirtualNetworkAccess: true
    allowForwardedTraffic: true
    remoteVirtualNetwork: { id: spokeVnet.id }
  }
}

resource spokeToHubPeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-11-01' = {
  parent: spokeVnet
  name: 'Spoke-To-Hub'
  properties: {
    allowVirtualNetworkAccess: true
    allowForwardedTraffic: true
    remoteVirtualNetwork: { id: hubVnet.id }
  }
}

// 4. FinOps 敏感持久化安全存储 (名称总长度 19 位，阻断全球命名碰撞)
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${prefix}st${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    publicNetworkAccess: 'Disabled' // 物理拔除公网网卡
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

// 5. 基础专用虚拟机宿主计划 (平替为 Standard S1，击穿 Premium 零配额死锁)
resource serverlessPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-standard-plan'
  location: location
  sku: {
    name: 'S1'
    tier: 'Standard'
  }
  properties: {
    reserved: true // 锁定 Linux 物理平台
  }
}

// 6. 级联调度：投递解耦后的纯净计算大脑
module computeBrain './compute-module.bicep' = {
  name: 'Compute-Brain-Deployment'
  params: {
    location: location
    prefix: prefix
    serverlessPlanId: serverlessPlan.id
    storageAccountName: funcStorage.name
  }
}