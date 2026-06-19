export interface BicepPresetWorkspace {
  name: string;
  description: string;
  files: Record<string, string>;
}

export const BICEP_ARCH_PRESETS: Record<string, BicepPresetWorkspace> = {
  'enterprise-landing-zone': {
    name: '🛡️ 微软官方标准安全 Landing Zone (Multi-Stage Enterprise)',
    description: '企业级顶级安全防御骨干网。包含订阅层级网关、网络隔离、安全组防护以及分布式计算大脑的 4 级联动调用。',
    files: {
      'main.bicep': `targetScope = 'subscription'
param location string = 'southeastasia'

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'omni-enterprise-infra-rg'
  location: location
}

module secDef './modules/security.bicep' = {
  name: 'Security-Enforcements-Deployment'
  scope: resourceGroup(rg.name)
}

module networkDef './modules/network.bicep' = {
  name: 'Network-HubSpoke-Deployment'
  scope: resourceGroup(rg.name)
  params: {
    nsgId: secDef.outputs.backendNsgId
  }
}`,
      './modules/security.bicep': `resource backendNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: 'enterprise-backend-nsg'
  location: 'southeastasia'
}
output backendNsgId string = backendNsg.id`,
      './modules/network.bicep': `param nsgId string
resource hubVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'enterprise-hub-vnet'
  location: 'southeastasia'
}
resource spokeVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'enterprise-spoke-vnet'
  location: 'southeastasia'
  properties: {
    subnets: [{
      name: 'BackendSubnet'
      properties: { networkSecurityGroup: { id: nsgId } }
    }]
  }
}
module appCompute './compute.bicep' = {
  name: 'Core-Compute-Injected'
  params: {
    targetVnetId: spokeVnet.id
  }
}`,
      './modules/compute.bicep': `param targetVnetId string
resource serverlessPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'enterprise-b1-plan'
  location: 'southeastasia'
  sku: { name: 'B1', tier: 'Basic' }
}
resource funcApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'enterprise-brain-app'
  location: 'southeastasia'
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: serverlessPlan.id
  }
}`
    }
  },

  'insightflow-production': {
    name: '🧠 InsightFlow 生产级多租户 RAG 算力矩阵 (Production RAG Sandbox)',
    description: '刘胜伟核心资产武器库。跑通了企业级高并发向量隔离、私网零信任终结点（Private Endpoint）与全套私有 DNS 劫持矩阵。',
    files: {
      'main.bicep': `resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = { name: 'insightflow-prod-rg', location: 'southeastasia' }
module storageVfs './storage/isolated-storage.bicep' = { name: 'Secure-Storage-VFS' }
module computeAgi './compute/functions.bicep' = {
  name: 'ASGI-Brain-Compute'
  params: {
    storageName: storageVfs.outputs.stName
  }
}`,
      './storage/isolated-storage.bicep': `resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'insightflowprodst'
  location: 'southeastasia'
  properties: { publicNetworkAccess: 'Disabled' }
}
resource blobPe 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: 'storage-blob-pe'
  location: 'southeastasia'
  properties: { privateLinkServiceConnections: [{ properties: { privateLinkServiceId: funcStorage.id } }] }
}
output stName string = funcStorage.name`,
      './compute/functions.bicep': `param storageName string
resource openAiReference 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = { name: 'southeastasia-0322-resource' }
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'insightflow-asgi-brain'
  location: 'southeastasia'
  kind: 'functionapp,linux'
  properties: {
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage', value: storageName }
        { name: 'AZURE_OPENAI_ENDPOINT', value: openAiReference.properties.endpoint }
      ]
    }
  }
}`
    }
  }
};