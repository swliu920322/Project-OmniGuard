targetScope = 'subscription'

param location string = 'southeastasia'
param prefix string = 'omni'

@secure()
param openAiKey string = ''
param openAiDeploymentName string = 'gpt-5.4-mini'

var resourceGroupName = '${prefix}-guard-infra-sea-rg'
var hubVNetName = '${prefix}-hub-vnet'
var spokeVNetName = '${prefix}-spoke-vnet'

var networkRules = json(loadTextContent('network-rules.json'))

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: {
    Environment: 'Persistent-Sandbox'
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
    openAiKey: openAiKey
    openAiDeploymentName: openAiDeploymentName
  }
}