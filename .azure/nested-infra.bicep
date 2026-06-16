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

// 2. 虚拟网络 (Hub & Spoke)
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
          privateEndpointNetworkPolicies: 'Disabled' // 允许私网终结点挂载
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

// 3. 持久化安全存储 (完全阻断公网)
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

// 5. 级联调度业务 Function 计算大脑
module computeBrain './compute-module.bicep' = {
  name: 'Compute-Brain-Deployment'
  params: {
    location: location
    prefix: prefix
    serverlessPlanId: serverlessPlan.id
    storageAccountName: funcStorage.name
  }
}

// 6. Azure OpenAI 实例 (物理断电)
var openAiAccountName = '${prefix}-openai-${uniqueString(resourceGroup().id)}'
var modelDeploymentName = 'gpt-4o-audit-engine'

resource openAiAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: openAiAccountName
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    publicNetworkAccess: 'Disabled' // 拔除大模型公网网卡
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

// =========================================================================
// 7. 🛡️ 终极纠偏：对齐 2020-06-01 刚性 DNS 规范，终结 NoRegisteredProviderFound
// =========================================================================
resource openAiDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.openai.azure.com'
  location: 'global'
}

resource openAiDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: openAiDnsZone
  name: 'link-to-spoke-vnet'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}

// =========================================================================
// 8. 拉起大模型私网终结点 (Private Endpoint)
// =========================================================================
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
}

resource openAiDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: openAiPrivateEndpoint
  name: 'default-dns-group'
  properties: {
    privateDnsZoneConfigs: [{ name: 'openai-config', properties: { privateDnsZoneId: openAiDnsZone.id } }]
  }
}

output openAiName string = openAiAccount.name