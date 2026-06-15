targetScope = 'subscription'

param location string = 'japaneast'
param prefix string = 'omni'

// 锁定干净的终选资源组命名空间
var resourceGroupName = '${prefix}-guard-blitz-rg'
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