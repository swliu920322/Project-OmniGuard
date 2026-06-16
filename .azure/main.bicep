targetScope = 'subscription'

param location string = 'japaneast'
param prefix string = 'omni'

// 💡 终极修复：漂移至完全干净的资源组命名空间，100% 闪避上一轮卡在 Accepted 状态的旧大模型实例
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