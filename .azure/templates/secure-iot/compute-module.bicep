param location string
param prefix string
param storageAccountName string
param backendSubnetId string
param cosmosEndpoint string
@secure()
param cosmosKey string
param deployManagedIdentities bool = true
param backendIdentityId string = ''
param keyVaultUri string = ''
param deployStaticWebApp bool = false

@secure()
param openAiKey string
param openAiEndpoint string = 'https://southeastaisa-0322-resource.openai.azure.com'
param openAiDeploymentName string = 'gpt-5.4-mini'
@secure()
param iotHubServiceConnectionString string
@secure()
param iotHubEventHubConnectionString string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${prefix}acr${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: true }
}

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${prefix}-logs-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource acaEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-aca-env-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: backendSubnetId
      internal: false
    }
  }
}

resource backendApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-backend'
  location: location
  identity: deployManagedIdentities ? {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${backendIdentityId}': {}
    }
  } : null
  properties: {
    managedEnvironmentId: acaEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 80
        transport: 'auto'
        allowInsecure: true
      }
      registries: [{ server: acr.properties.loginServer, username: acr.listCredentials().username, passwordSecretRef: 'acr-password' }]
      secrets: [
        { name: 'acr-password', value: acr.listCredentials().passwords[0].value }
        { name: 'cosmos-key', value: cosmosKey }
        { name: 'openai-key', value: openAiKey }
        { name: 'storage-key', value: listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-01-01').keys[0].value }
        { name: 'storage-connection-string', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-01-01').keys[0].value};EndpointSuffix=${environment().suffixes.storage}' }
        { name: 'iothub-service-conn', value: iotHubServiceConnectionString }
        { name: 'iothub-eventhub-conn', value: iotHubEventHubConnectionString }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: 'mcr.microsoft.com/azuredocs/aci-helloworld:latest'
          resources: { cpu: json('1.0'), memory: '2.0Gi' }
          env: [
            { name: 'USE_MANAGED_IDENTITY', value: string(deployManagedIdentities) }
            { name: 'COSMOS_ENDPOINT', value: cosmosEndpoint }
            { name: 'COSMOS_KEY', secretRef: 'cosmos-key' }
            { name: 'AZURE_STORAGE_ACCOUNT_NAME', value: storageAccountName }
            { name: 'AZURE_STORAGE_ACCOUNT_KEY', secretRef: 'storage-key' }
            { name: 'AzureWebJobsStorage', secretRef: 'storage-connection-string' }
            { name: 'IotHubServiceConnectionString', secretRef: 'iothub-service-conn' }
            { name: 'IotHubEventHubConnectionString', secretRef: 'iothub-eventhub-conn' }
            { name: 'OPENAI_API_KEY', value: deployManagedIdentities ? '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/openAiKey)' : openAiKey }
            { name: 'OPENAI_DEPLOYMENT_NAME', value: openAiDeploymentName }
            { name: 'OPENAI_API_DEPLOYMENT_NAME', value: openAiDeploymentName }
            { name: 'AZURE_OPENAI_API_KEY', value: deployManagedIdentities ? '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/openAiKey)' : openAiKey }
            { name: 'AZURE_OPENAI_ENDPOINT', value: openAiEndpoint }
            { name: 'AZURE_OPENAI_DEPLOYMENT_NAME', value: openAiDeploymentName }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

// Option 1: Azure Container Apps Frontend
resource frontendApp 'Microsoft.App/containerApps@2024-03-01' = if (!deployStaticWebApp) {
  name: '${prefix}-frontend'
  location: location
  properties: {
    managedEnvironmentId: acaEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 80, transport: 'auto' }
      registries: [{ server: acr.properties.loginServer, username: acr.listCredentials().username, passwordSecretRef: 'acr-password' }]
      secrets: [{ name: 'acr-password', value: acr.listCredentials().passwords[0].value }]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: 'mcr.microsoft.com/azuredocs/aci-helloworld:latest'
          resources: { cpu: json('0.5'), memory: '1.0Gi' }
          env: [{ name: 'BACKEND_API_URL', value: 'http://${backendApp.name}.internal.${acaEnvironment.properties.defaultDomain}' }]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 2 }
    }
  }
}

// Option 2: Azure Static Web App (SWA)
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = if (deployStaticWebApp) {
  name: '${prefix}-frontend-swa'
  location: 'eastus2'
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

output frontendUrl string = deployStaticWebApp ? 'https://${staticWebApp.?properties.defaultHostname ?? ''}' : 'https://${frontendApp.?properties.configuration.ingress.fqdn ?? ''}'
