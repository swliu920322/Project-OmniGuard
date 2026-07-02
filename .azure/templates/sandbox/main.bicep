targetScope = 'subscription'

param location string = 'southeastasia'
param prefix string = 'omni'

@secure()
param openAiKey string = ''
param openAiDeploymentName string = 'gpt-5.4-mini'

// Configurator Parameter Set
param deployStaticWebApp bool = false
param customResourceGroupName string = ''
param vnetAddressPrefix string = '10.1.0.0/16'
param backendSubnetPrefix string = '10.1.4.0/23'
param storageSubnetPrefix string = '10.1.2.0/24'

var resourceGroupName = !empty(customResourceGroupName) ? customResourceGroupName : '${prefix}-guard-infra-sea-rg'
var hubVNetName = '${prefix}-hub-vnet'
var spokeVNetName = '${prefix}-spoke-vnet'

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: {
    Environment: 'Sandbox'
    Scenario: 'DevSandbox'
    FinOpsOwner: 'Shengwei'
  }
}

module infraDeployment './nested-infra.bicep' = {
  name: 'Nested-Sandbox-Deployment'
  scope: resourceGroup(rg.name)
  params: {
    location: location
    prefix: prefix
    vnetAddressPrefix: vnetAddressPrefix
    backendSubnetPrefix: backendSubnetPrefix
    storageSubnetPrefix: storageSubnetPrefix
    hubVNetName: hubVNetName
    spokeVNetName: spokeVNetName
    openAiKey: openAiKey
    openAiDeploymentName: openAiDeploymentName
    deployManagedIdentities: false
    deployStaticWebApp: deployStaticWebApp
  }
}
