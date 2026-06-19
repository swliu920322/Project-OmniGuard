export interface BicepPresetWorkspace {
  name: string;
  description: string;
  files: Record<string, string>;
}

export const BICEP_ARCH_PRESETS: Record<string, BicepPresetWorkspace> = {
  'hub-spoke-network': {
    name: '🔒 企业级经典星型安全网络 (Hub-Spoke Network)',
    description: '对标 Azure Landing Zone 标准拓扑，强制实施双向虚拟网络对等（Peering）与 NSG 零信任规则。',
    files: {
      'main.bicep': `targetScope = 'subscription'\nresource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = { name: 'omni-hub-spoke-rg', location: 'southeastasia' }\nmodule network './network.bicep' = { name: 'Network-Deployment', scope: resourceGroup(rg.name) }`,
      './network.bicep': `resource hubVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = { name: 'hub-vnet', location: 'southeastasia', properties: { addressSpace: { addressPrefixes: ['10.0.0.0/16'] } } }\nresource spokeVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = { name: 'spoke-vnet', location: 'southeastasia', properties: { addressSpace: { addressPrefixes: ['10.1.0.0/16'] } } }\nresource hubToSpoke 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-11-01' = { parent: hubVnet, name: 'Hub-To-Spoke', properties: { remoteVirtualNetwork: { id: spokeVnet.id } } }`
    }
  },
  'multi-tenant-rag': {
    name: '🧠 InsightFlow 多租户向量隔离算力 (Zero-Trust Storage)',
    description: '核心零信任存储保护，关闭公网入口，完全通过私网专用终结点（Private Endpoint）隐蔽路由。',
    files: {
      'main.bicep': `resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {\n  name: 'insightflowst'\n  location: 'southeastasia'\n  properties: { publicNetworkAccess: 'Disabled' }\n}\nresource blobPE 'Microsoft.Network/privateEndpoints@2023-11-01' = {\n  name: 'storage-blob-pe'\n  location: 'southeastasia'\n  properties: { privateLinkServiceConnections: [{ properties: { privateLinkServiceId: funcStorage.id } }] }\n}`
    }
  },
  'serverless-compute': {
    name: '⚡ Module Gamma 弹性异步计算大脑 (Serverless Elastic)',
    description: '专属计算宿主平面（Basic B1），原生集成出站 VNet 强制绑定，挂载专属 Python 核心。',
    files: {
      'main.bicep': `resource serverlessPlan 'Microsoft.Web/serverfarms@2023-12-01' = { name: 'omni-proto-plan', location: 'southeastasia', sku: { name: 'B1', tier: 'Basic' }, kind: 'linux' }\nmodule computeBrain './compute.bicep' = { name: 'Compute-Brain-Deployment', params: { planId: serverlessPlan.id } }`,
      './compute.bicep': `param planId string\nresource functionApp 'Microsoft.Web/sites@2023-12-01' = { name: 'omni-brain-core', location: 'southeastasia', kind: 'functionapp,linux', properties: { serverFarmId: planId } }`
    }
  }
};