targetScope = 'resourceGroup'

param location string
param prefix string
param networkRules object
param hubVNetName string
param spokeVNetName string

// 1. 网络安全组
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

// 2. 虚拟网络拓扑 (Hub & Spoke)
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

// 3. 持久化安全存储 (纯净确定性哈希)
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

// 4. 计算宿主计划
resource serverlessPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-proto-plan'
  location: location
  sku: { name: 'B1', tier: 'Basic' }
  kind: 'linux'
  properties: { reserved: true }
}

// 5. 计算大脑
module computeBrain './compute-module.bicep' = {
  name: 'Compute-Brain-Deployment'
  params: {
    location: location
    prefix: prefix
    serverlessPlanId: serverlessPlan.id
    storageAccountName: funcStorage.name
  }
}

// 6. Azure OpenAI 实例 (标准版，开放顺产公网)
var openAiAccountName = '${prefix}-openai-${uniqueString(resourceGroup().id)}'
var modelDeploymentName = 'gpt-4o-audit-engine'

resource openAiAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: openAiAccountName
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    publicNetworkAccess: 'Enabled'
    customSubDomainName: openAiAccountName
  }
}

resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAiAccount
  name: modelDeploymentName
  sku: { name: 'GlobalStandard', capacity: 10 }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-4o', version: '2024-11-20' }
  }
}

// 7. 大模型私网 DNS
resource openAiDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.openai.azure.com'
  location: 'global'
}

resource openAiDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: openAiDnsZone
  name: 'openai-link-to-spoke'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}

// 8. 大模型私网终结点 (刚性阻断，保证时序)
resource openAiPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-openai-pe'
  location: location
  properties: {
    subnet: { id: '${spokeVnet.id}/subnets/StorageSubnet' }
    privateLinkServiceConnections: [
      {
        name: 'openai-connection'
        properties: {
          privateLinkServiceId: openAiAccount.id
          groupIds: ['account']
        }
      }
    ]
  }
  dependsOn: [
    gpt4oDeployment // 👈 刚性断层：必须死等 gpt-4o 模型在云端就绪，彻底粉碎并发冲突
  ]
}

resource openAiDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: openAiPrivateEndpoint
  name: 'default-dns-group'
  properties: {
    privateDnsZoneConfigs: [{ name: 'openai-config', properties: { privateDnsZoneId: openAiDnsZone.id } }]
  }
}

// 9. 存储三叉戟 DNS 矩阵
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

// 10. 存储三叉戟私网终结点
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

output openAiName string = openAiAccount.name