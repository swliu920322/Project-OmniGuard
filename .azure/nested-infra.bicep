targetScope = 'resourceGroup'

param location string
param prefix string
param networkRules object
param hubVNetName string
param spokeVNetName string

// 1. 网络安全防线
resource backendNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: '${prefix}-backend-nsg'
  location: location
  properties: { securityRules: networkRules.backendNsgRules }
}

resource storageNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: '${prefix}-storage-nsg'
  location: location
  properties: { securityRules: networkRules.storageNsgRules }
}

// 2. 核心网络拓扑
resource hubVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: hubVNetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    subnets: [{ name: 'ManagementSubnet', properties: { addressPrefix: '10.0.1.0/24' } }]
  }
}

resource spokeVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: spokeVNetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.1.0.0/16'] }
    subnets: [
      { name: 'BackendSubnet', properties: { addressPrefix: '10.1.1.0/24', networkSecurityGroup: { id: backendNsg.id } } }
      { name: 'StorageSubnet', properties: { addressPrefix: '10.1.2.0/24', networkSecurityGroup: { id: storageNsg.id } } }
    ]
  }
}

// 3. 对等互联隧道
resource hubToSpokePeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-11-01' = {
  parent: hubVnet
  name: 'Hub-To-Spoke'
  properties: { allowVirtualNetworkAccess: true, allowForwardedTraffic: true, remoteVirtualNetwork: { id: spokeVnet.id } }
}

resource spokeToHubPeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-11-01' = {
  parent: spokeVnet
  name: 'Spoke-To-Hub'
  properties: { allowVirtualNetworkAccess: true, allowForwardedTraffic: true, remoteVirtualNetwork: { id: hubVnet.id } }
}

// 4. 存储基石
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${replace(prefix, '-', '')}st${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: { publicNetworkAccess: 'Disabled', networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices' } }
}

// 5. 弹性算力计划
resource serverlessPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-serverless-plan'
  location: location
  sku: { name: 'FC1', tier: 'FlexConsumption' }
  properties: { reserved: true }
}

// 导出参数给 compute 模块使用
output serverFarmId string = serverlessPlan.id
output storageAccountName string = funcStorage.name