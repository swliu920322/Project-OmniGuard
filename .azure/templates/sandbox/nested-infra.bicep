targetScope = 'resourceGroup'

param location string
param prefix string
param hubVNetName string
param spokeVNetName string
param deployManagedIdentities bool = false
param deployStaticWebApp bool = false

param vnetAddressPrefix string = '10.1.0.0/16'
param backendSubnetPrefix string = '10.1.4.0/23'
param storageSubnetPrefix string = '10.1.2.0/24'

@secure()
param openAiKey string = ''
param openAiDeploymentName string = 'gpt-5.4-mini'

var backendNsgRules = [
  {
    name: 'Deny-Direct-Internet-Inbound'
    properties: {
      priority: 1000
      access: 'Deny'
      direction: 'Inbound'
      protocol: '*'
      sourceAddressPrefix: 'Internet'
      sourcePortRange: '*'
      destinationAddressPrefix: '*'
      destinationPortRange: '*'
    }
  }
]

var storageNsgRules = [
  {
    name: 'Allow-Backend-Only-Inbound'
    properties: {
      priority: 100
      access: 'Allow'
      direction: 'Inbound'
      protocol: 'Tcp'
      sourceAddressPrefix: backendSubnetPrefix
      sourcePortRange: '*'
      destinationAddressPrefix: storageSubnetPrefix
      destinationPortRange: '443'
    }
  }
  {
    name: 'Deny-All-Other-Inbound-To-Storage'
    properties: {
      priority: 1000
      access: 'Deny'
      direction: 'Inbound'
      protocol: '*'
      sourceAddressPrefix: '*'
      sourcePortRange: '*'
      destinationAddressPrefix: '*'
      destinationPortRange: '*'
    }
  }
]

// Network Subnets
resource backendNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: '${prefix}-backend-nsg'
  location: location
  properties: { securityRules: backendNsgRules }
}

resource storageNsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: '${prefix}-storage-nsg'
  location: location
  properties: { securityRules: storageNsgRules }
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
    addressSpace: { addressPrefixes: [vnetAddressPrefix] }
    subnets: [
      {
        name: 'BackendSubnet'
        properties: {
          addressPrefix: backendSubnetPrefix
          networkSecurityGroup: { id: backendNsg.id }
          delegations: [{ name: 'containerAppDelegation', properties: { serviceName: 'Microsoft.App/environments' } }]
        }
      }
      {
        name: 'StorageSubnet'
        properties: {
          addressPrefix: storageSubnetPrefix
          networkSecurityGroup: { id: storageNsg.id }
        }
      }
    ]
  }
}

// User-Assigned Identity (conditional)
resource backendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (deployManagedIdentities) {
  name: '${prefix}-backend-identity'
  location: location
}

// Key Vault with public access (sandbox-allow)
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take('${prefix}kv${uniqueString(resourceGroup().id)}', 24)
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    publicNetworkAccess: 'Enabled'
  }
}

// OpenAI Key Secret
resource openAiSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(openAiKey)) {
  parent: keyVault
  name: 'openAiKey'
  properties: {
    value: openAiKey
  }
}

// Key Vault RBAC: grant backendIdentity Key Vault Secrets User
resource kvRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployManagedIdentities) {
  name: guid(keyVault.id, backendIdentity.id, '46334581-17ef-401a-b113-35a0419c4b5e')
  scope: keyVault
  properties: {
    principalId: backendIdentity.properties.principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '46334581-17ef-401a-b113-35a0419c4b5e')
    principalType: 'ServicePrincipal'
  }
}

// Storage for Sandbox (Classic connection keys)
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${prefix}st${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    publicNetworkAccess: 'Enabled'
  }
}

// Cosmos DB Free Tier
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: '${prefix}-mem-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: true
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
    options: { throughput: 400 }
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
    backendIdentityId: deployManagedIdentities ? backendIdentity.id : ''
    keyVaultUri: keyVault.properties.vaultUri
    deployStaticWebApp: deployStaticWebApp
  }
}

output frontendUrl string = computeBrain.outputs.frontendUrl
