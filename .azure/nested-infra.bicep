targetScope = 'resourceGroup'

param location string
param prefix string
param networkRules object
param hubVNetName string
param spokeVNetName string
param deployManagedIdentities bool = false
param deployStaticWebApp bool = false

@secure()
param openAiKey string = ''
param openAiDeploymentName string = 'gpt-5.4-mini'

// Network Subnets
resource backendNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: '${prefix}-backend-nsg'
  location: location
  properties: { securityRules: networkRules.backendNsgRules }
}

resource storageNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: '${prefix}-storage-nsg'
  location: location
  properties: { securityRules: networkRules.storageNsgRules }
}

resource hubVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: hubVNetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    subnets: [{ name: 'ManagementSubnet', properties: { addressPrefix: '10.0.1.0/24' } }]
  }
}

resource spokeVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: spokeVNetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.1.0.0/16'] }
    subnets: [
      {
        name: 'BackendSubnet'
        properties: {
          addressPrefix: '10.1.4.0/23'
          networkSecurityGroup: { id: backendNsg.id }
          delegations: [{ name: 'containerAppDelegation', properties: { serviceName: 'Microsoft.App/environments' } }]
        }
      }
      {
        name: 'StorageSubnet'
        properties: {
          addressPrefix: '10.1.2.0/24'
          networkSecurityGroup: { id: storageNsg.id }
        }
      }
    ]
  }
}

// Storage for Sandbox (Classic connection keys)
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${prefix}st${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    publicNetworkAccess: 'Enabled' // Sandbox Mode: keep simple
  }
}

// Cosmos DB Free Tier
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: '${prefix}-mem-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: true // Free tier locked
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [{ locationName: location, failoverPriority: 0 }]
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-11-15' = {
  parent: cosmosAccount
  name: 'OmniGuardDB'
  properties: { resource: { id: 'OmniGuardDB' } }
}

resource deviceTwinContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDb
  name: 'DeviceTwins'
  properties: {
    resource: {
      id: 'DeviceTwins'
      partitionKey: { paths: [ '/tenant_id' ], kind: 'Hash' }
    }
    options: { throughput: 400 } // Free Tier limit
  }
}

// IoT Hub Free Tier
resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: 'iot-${prefix}-${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'F1', capacity: 1 }
  properties: {
    routing: {
      endpoints: { events: [] }
      routes: [
        {
          name: 'DeviceTelemetryRoute'
          source: 'DeviceMessages'
          condition: 'true'
          endpointNames: [ 'events' ]
          isEnabled: true
        }
      ]
    }
  }
}

module computeBrain './compute-module.bicep' = {
  name: 'Compute-Brain-Deployment'
  params: {
    location: location
    prefix: prefix
    storageAccountName: funcStorage.name
    backendSubnetId: '${spokeVnet.id}/subnets/BackendSubnet'
    cosmosEndpoint: cosmosAccount.properties.documentEndpoint
    cosmosKey: cosmosAccount.listKeys().primaryMasterKey
    openAiKey: openAiKey
    openAiDeploymentName: openAiDeploymentName
    iotHubServiceConnectionString: 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${listKeys(iotHub.id, '2023-06-30').value[0].primaryKey}'
    iotHubEventHubConnectionString: 'Endpoint=${iotHub.properties.eventHubEndpoints.events.endpoint};SharedAccessKeyName=iothubowner;SharedAccessKey=${listKeys(iotHub.id, '2023-06-30').value[0].primaryKey};EntityPath=${iotHub.properties.eventHubEndpoints.events.path}'
    deployManagedIdentities: deployManagedIdentities
    deployStaticWebApp: deployStaticWebApp
  }
}

output frontendUrl string = computeBrain.outputs.frontendUrl
