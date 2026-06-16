targetScope = 'subscription'

param location string = 'japaneast'
param prefix string = 'omni'

// 锁定当前完全干净、无状态死锁残留的黄金验证资源组
var resourceGroupName = '${prefix}-guard-isolated-rg'
var hubVNetName = '${prefix}-hub-vnet'
var spokeVNetName = '${prefix}-spoke-vnet'

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