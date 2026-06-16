targetScope = 'resourceGroup'

param location string
param prefix string
param networkRules object
param hubVNetName string
param spokeVNetName string

var swaControlPlaneLocation = 'eastasia'

// =========================================================================
// 1. 安全防线配置 (Network Security Boundaries)
// =========================================================================
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

// =========================================================================
// 2. 双虚网物理 Peering 骨干网络 (Spoke-Hub Network Topology)
// =========================================================================
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

// =========================================================================
// 3. 存储底座 (Trident Private Data Plane)
// =========================================================================
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

// =========================================================================
// 4. 计算平面计划 (App Service Plan)
// =========================================================================
resource serverlessPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-proto-plan'
  location: location
  sku: { name: 'B1', tier: 'Basic' }
  kind: 'linux'
  properties: { reserved: true }
}

// =========================================================================
// 5. 纯净版单轨计算大脑级联挂载 (Single-Core Brain Engine Deployment)
// =========================================================================
module computeBrain './compute-module.bicep' = {
  name: 'Compute-Brain-Deployment'
  params: {
    location: location
    prefix: prefix
    serverlessPlanId: serverlessPlan.id
    storageAccountName: funcStorage.name // 🟩 刚性对齐真正存活的存储变量名
  }
}

// =========================================================================
// 7. 存储三叉戟 DNS 矩阵 (Private DNS Infrastructures)
// =========================================================================
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

// =========================================================================
// 8. 存储三叉戟私网芯片挂载 (Private Endpoints Provisioning)
// =========================================================================
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

// =========================================================================
// 9. Module Alpha: 统一域主权与跨区域后端绑定 (Edge Gateway Gateway Routing)
// =========================================================================
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${prefix}-digitalhuman-portal'
  location: swaControlPlaneLocation
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}

resource swaApiLink 'Microsoft.Web/staticSites/linkedBackends@2023-12-01' = {
  parent: staticWebApp
  name: 'backendApi'
  properties: {
    // 🟩 完美对齐：提着单轨 computeBrain 导出的真实真机计算平面名称动态生成绝对 ID
    backendResourceId: resourceId('Microsoft.Web/sites', computeBrain.outputs.functionAppName)
    region: location
  }
}

output openAiName string = 'byo-decoupled-instance'