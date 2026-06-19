targetScope = 'subscription'
param location string = 'southeastasia'

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'omni-enterprise-infra-rg'
  location: location
}

module networkDef './modules/network.bicep' = {
  name: 'Network-HubSpoke-Deployment'
  scope: resourceGroup(rg.name)
}