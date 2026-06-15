targetScope = 'subscription'

param location string = 'southeastasia'
param prefix string = 'omni'

var resourceGroupName = '${prefix}-guard-rg'
var hubVNetName = '${prefix}-hub-vnet'
var spokeVNetName = '${prefix}-spoke-vnet'

// 动态加载零信任网络规则矩阵
var networkRules = json(loadTextContent('network-rules.json'))

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: {
    Environment: 'Sandbox-Dev'
    Project: 'Project-OmniGuard'
    FinOpsOwner: 'Shengwei'
  }
}

// 调用网络与基础存储底座
module infraDeployment './nested-infra.bicep' = {
  name: 'Nested-Network-Enforcements'
  scope: resourceGroup(rg.name)
  params: {
    location: location
    prefix: prefix
    networkRules: networkRules
    hubVNetName: hubVNetName
    spokeVNetName: spokeVNetName
  }
}