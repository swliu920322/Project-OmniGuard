targetScope = 'resourceGroup'

param location string
param prefix string
param serverFarmId string
param storageAccountName string

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-secure-brain-app'
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: serverFarmId
    httpsOnly: true
    functionAppConfig: {
      runtime: { name: 'python', version: '3.10' }
      scaleAndConcurrency: { maximumInstanceCount: 10, instanceMemoryMB: 2048 }
      deployment: { type: 'None' }
    }
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.10'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-01-01').keys[0].value};EndpointSuffix=${environment().suffixes.storage}' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
      ]
    }
  }
}