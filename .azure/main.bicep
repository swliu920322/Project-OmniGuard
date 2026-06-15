targetScope = 'subscription'
param location string = 'southeastasia'
param prefix string = 'omni'

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: '${prefix}-guard-rg'
  location: location
}

module infra './nested-infra.bicep' = {
  name: 'Network-And-Infra'
  scope: resourceGroup(rg.name)
  params: {
    location: location
    prefix: prefix
    networkRules: json(loadTextContent('network-rules.json'))
    hubVNetName: '${prefix}-hub-vnet'
    spokeVNetName: '${prefix}-spoke-vnet'
  }
}

module compute './compute-module.bicep' = {
  name: 'Compute-Brain'
  scope: resourceGroup(rg.name)
  params: {
    location: location
    prefix: prefix
    serverFarmId: infra.outputs.serverFarmId
    storageAccountName: infra.outputs.storageAccountName
  }
  dependsOn: [infra] // 确保网络基建先落地，算力大脑再组装
}