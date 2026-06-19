targetScope = 'resourceGroup'

param location string
param prefix string
param networkRules object
param hubVNetName string
param spokeVNetName string

var swaControlPlaneLocation = 'eastasia'

// NSG 安全防线规则
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

// 骨干双虚网架构
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
      {
        name: 'BackendSubnet'
        properties: {
          addressPrefix: '10.1.1.0/24'
          networkSecurityGroup: { id: backendNsg.id }
          delegations: [{ name: 'serverlessDelegation', properties: { serviceName: 'Microsoft.Web/serverFarms' } }]
        }
      }
      {
        name: 'StorageSubnet'
        properties: {
          addressPrefix: '10.1.2.0/24'
          networkSecurityGroup: { id: storageNsg.id }
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

// Peering 双向高速合拢
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

// 零信任隔离存储
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${prefix}st${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices' }
  }
}

// 专属计算宿主平面 (Basic B1 支持区域 VNet 强制集成)
resource serverlessPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-proto-plan'
  location: location
  sku: { name: 'B2', tier: 'Basic' }
  kind: 'linux'
  properties: { reserved: true }
}

// 级联挂载大脑计算核心
module computeBrain './compute-module.bicep' = {
  name: 'Compute-Brain-Deployment'
  params: {
    location: location
    prefix: prefix
    serverlessPlanId: serverlessPlan.id
    storageAccountName: funcStorage.name
    backendSubnetId: '${spokeVnet.id}/subnets/BackendSubnet' // 🟩 刚性下钻透传
  }
}

// 私网 DNS 矩阵声明
resource blobDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.blob.${environment().suffixes.storage}'
  location: 'global'
}
resource blobDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: blobDnsZone
  name: 'blob-link-to-spoke'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}

resource tableDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.table.${environment().suffixes.storage}'
  location: 'global'
}
resource tableDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: tableDnsZone
  name: 'table-link-to-spoke'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}

resource queueDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.queue.${environment().suffixes.storage}'
  location: 'global'
}
resource queueDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: queueDnsZone
  name: 'queue-link-to-spoke'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}

// 私网终结点芯片挂载
resource blobPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-storage-blob-pe'
  location: location
  properties: {
    subnet: { id: '${spokeVnet.id}/subnets/StorageSubnet' }
    privateLinkServiceConnections: [{ name: 'blob-connection', properties: { privateLinkServiceId: funcStorage.id, groupIds: ['blob'] } }]
  }
}
resource blobDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: blobPrivateEndpoint
  name: 'blob-dns-group'
  properties: { privateDnsZoneConfigs: [{ name: 'blob-config', properties: { privateDnsZoneId: blobDnsZone.id } }] }
}

resource tablePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-storage-table-pe'
  location: location
  properties: {
    subnet: { id: '${spokeVnet.id}/subnets/StorageSubnet' }
    privateLinkServiceConnections: [{ name: 'table-connection', properties: { privateLinkServiceId: funcStorage.id, groupIds: ['table'] } }]
  }
}
resource tableDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: tablePrivateEndpoint
  name: 'table-dns-group'
  properties: { privateDnsZoneConfigs: [{ name: 'table-config', properties: { privateDnsZoneId: tableDnsZone.id } }] }
}

resource queuePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-storage-queue-pe'
  location: location
  properties: {
    subnet: { id: '${spokeVnet.id}/subnets/StorageSubnet' }
    privateLinkServiceConnections: [{ name: 'queue-connection', properties: { privateLinkServiceId: funcStorage.id, groupIds: ['queue'] } }]
  }
}
resource queueDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: queuePrivateEndpoint
  name: 'queue-dns-group'
  properties: { privateDnsZoneConfigs: [{ name: 'queue-config', properties: { privateDnsZoneId: queueDnsZone.id } }] }
}

// 前端 Static Web App 绑定
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${prefix}-digitalhuman-portal'
  location: swaControlPlaneLocation
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {}
}

resource swaApiLink 'Microsoft.Web/staticSites/linkedBackends@2023-12-01' = {
  parent: staticWebApp
  name: 'backendApi'
  properties: {
    backendResourceId: resourceId('Microsoft.Web/sites', computeBrain.outputs.functionAppName)
    region: location
  }
}

output openAiName string = 'byo-decoupled-instance'