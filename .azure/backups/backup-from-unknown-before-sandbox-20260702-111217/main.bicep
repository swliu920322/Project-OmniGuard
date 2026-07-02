targetScope = 'subscription'

param location string = 'southeastasia'
param prefix string = 'omni'

@secure()
param openAiKey string = ''
param openAiDeploymentName string = 'gpt-5.4-mini'

// Configurator Parameter Set
param deployStaticWebApp bool = false

var resourceGroupName = '${prefix}-guard-infra-sea-rg'
var hubVNetName = '${prefix}-hub-vnet'
var spokeVNetName = '${prefix}-spoke-vnet'
var networkRules = json(loadTextContent('network-rules.json'))

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: {
    Environment: 'Production-Intake'
    Scenario: 'SecureIoTPipeline'
    FinOpsOwner: 'Shengwei'
  }
}

module infraDeployment './nested-infra.bicep' = {
  name: 'Nested-SecureIoT-Deployment'
  scope: resourceGroup(rg.name)
  params: {
    location: location
    prefix: prefix
    networkRules: networkRules
    hubVNetName: hubVNetName
    spokeVNetName: spokeVNetName
    openAiKey: openAiKey
    openAiDeploymentName: openAiDeploymentName
    deployManagedIdentities: true
    deployStaticWebApp: deployStaticWebApp
  }
}
