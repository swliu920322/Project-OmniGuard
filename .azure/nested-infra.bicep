targetScope = 'resourceGroup'

param location string
param prefix string
param networkRules object
param hubVNetName string
param spokeVNetName string

// 1. 网络安全组防线
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

// 2. 虚拟网络物理拓扑 (Hub & Spoke)
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
        properties: { addressPrefix: '10.1.2.0/24', networkSecurityGroup: { id: storageNsg.id } }
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

// 3. 持久化独立持久存储 account
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${prefix}st${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    publicNetworkAccess: 'Disabled' // 锁死存储私网边界
    networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices' }
  }
}

// 4. 计算宿主计划 (B1 档位保活)
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

// =========================================================================
// 6. 🧠 终极收网：对齐 2026 活跃内核，强行迎回 gpt-4o 审计大脑
// =========================================================================
var openAiAccountName = '${prefix}-openai-${uniqueString(resourceGroup().id)}'
var modelDeploymentName = 'gpt-4o-audit-engine'

resource openAiAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: openAiAccountName
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    publicNetworkAccess: 'Enabled' // 保持公网开启用于今日 Baseline 验证，明日断线
    customSubDomainName: openAiAccountName
  }
}

resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAiAccount
  name: modelDeploymentName
  sku: {
    name: 'GlobalStandard' // 走全球标准按量计费，无请求 0 扣费
    capacity: 10          // 分配 10k TPM 基础吞吐
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-11-20' // 💡 最终修复：升级为 2026 年依然强力活跃的旗舰稳定版内核
    }
  }
}

output openAiEndpoint string = openAiAccount.properties.endpoint
output openAiName string = openAiAccount.name