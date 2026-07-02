targetScope = 'resourceGroup'

param location string
param prefix string
param hubVNetName string
param spokeVNetName string
param deployManagedIdentities bool = true
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

// Network Setup
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
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource hubToSpokePeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-11-01' = {
  parent: hubVnet
  name: 'Hub-To-Spoke'
  properties: { allowVirtualNetworkAccess: true, allowForwardedTraffic: true, remoteVirtualNetwork: { id: spokeVnet.id } }
}

resource spokeToHubPeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-11-01' = {
  parent: spokeVnet
  name: 'Spoke-To-Hub'
  properties: { allowVirtualNetworkAccess: true, allowForwardedTraffic: true, remoteVirtualNetwork: { id: hubVnet.id } }
}

// Managed Identity
resource backendIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (deployManagedIdentities) {
  name: '${prefix}-backend-identity'
  location: location
}

// Key Vault with public access disabled (secure-iot)
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take('${prefix}kv${uniqueString(resourceGroup().id)}', 24)
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    publicNetworkAccess: 'Disabled'
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
    principalId: backendIdentity.?properties.principalId ?? ''
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '46334581-17ef-401a-b113-35a0419c4b5e')
    principalType: 'ServicePrincipal'
  }
}

// Key Vault Private Endpoint & DNS (secure-iot only)
resource kvDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
}

resource kvDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: kvDnsZone
  name: 'kv-link'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}

resource kvPE 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-kv-pe'
  location: location
  properties: {
    subnet: { id: '${spokeVnet.id}/subnets/StorageSubnet' }
    privateLinkServiceConnections: [{ name: 'kv-conn', properties: { privateLinkServiceId: keyVault.id, groupIds: ['vault'] } }]
  }
}

resource kvDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: kvPE
  name: 'kv-dns-group'
  properties: { privateDnsZoneConfigs: [{ name: 'kv-config', properties: { privateDnsZoneId: kvDnsZone.id } }] }
}

// Isolated Storage
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${prefix}st${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    publicNetworkAccess: 'Disabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices' }
  }
}

// Private DNS for Storage
resource blobDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.blob.${environment().suffixes.storage}'
  location: 'global'
}
resource blobDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: blobDnsZone
  name: 'blob-link'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}
resource blobPE 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-blob-pe'
  location: location
  properties: {
    subnet: { id: '${spokeVnet.id}/subnets/StorageSubnet' }
    privateLinkServiceConnections: [{ name: 'blob-conn', properties: { privateLinkServiceId: funcStorage.id, groupIds: ['blob'] } }]
  }
}
resource blobDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: blobPE
  name: 'blob-dns-group'
  properties: { privateDnsZoneConfigs: [{ name: 'blob-config', properties: { privateDnsZoneId: blobDnsZone.id } }] }
}

// Cosmos DB Autoscale
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: '${prefix}-mem-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    publicNetworkAccess: 'Disabled'
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [{ locationName: location, failoverPriority: 0 }]
  }
}
resource cosmosDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.documents.azure.com'
  location: 'global'
}
resource cosmosDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: cosmosDnsZone
  name: 'cosmos-link'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}
resource cosmosPE 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-cosmos-pe'
  location: location
  properties: {
    subnet: { id: '${spokeVnet.id}/subnets/StorageSubnet' }
    privateLinkServiceConnections: [{ name: 'cosmos-conn', properties: { privateLinkServiceId: cosmosAccount.id, groupIds: ['Sql'] } }]
  }
}
resource cosmosDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: cosmosPE
  name: 'cosmos-dns-group'
  properties: { privateDnsZoneConfigs: [{ name: 'cosmos-config', properties: { privateDnsZoneId: cosmosDnsZone.id } }] }
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
    options: {
      autoscaleSettings: { maxThroughput: 4000 }
    }
  }
}

// RBAC Role Assignment for Managed Identity
resource cosmosDbRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2023-04-15' = if (deployManagedIdentities) {
  name: guid(cosmosAccount.id, backendIdentity.id, 'CosmosDBBuiltInDataContributor')
  parent: cosmosAccount
  properties: {
    principalId: backendIdentity.?properties.principalId ?? '00000000-0000-0000-0000-000000000000'
    roleDefinitionId: '/${subscription().id}/providers/Microsoft.DocumentDB/databaseAccounts/${cosmosAccount.name}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    scope: cosmosAccount.id
  }
}

// IoT Hub Standard + DPS
resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: 'iot-${prefix}-${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'S1', capacity: 1 }
  properties: {
    routing: {
      endpoints: { eventHubs: [] }
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

resource dps 'Microsoft.Devices/provisioningServices@2022-12-15' = {
  name: '${prefix}-iot-dps'
  location: location
  sku: { name: 'S1', capacity: 1 }
  properties: {
    iotHubs: [
      {
        connectionString: 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${iotHub.listKeys().value[0].primaryKey}'
        location: location
      }
    ]
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
    iotHubServiceConnectionString: 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${iotHub.listKeys().value[0].primaryKey}'
    iotHubEventHubConnectionString: 'Endpoint=${iotHub.properties.eventHubEndpoints.events.endpoint};SharedAccessKeyName=iothubowner;SharedAccessKey=${iotHub.listKeys().value[0].primaryKey};EntityPath=${iotHub.properties.eventHubEndpoints.events.path}'
    deployManagedIdentities: deployManagedIdentities
    backendIdentityId: deployManagedIdentities ? backendIdentity.id : ''
    keyVaultUri: keyVault.properties.vaultUri
    deployStaticWebApp: deployStaticWebApp
  }
}

output frontendUrl string = computeBrain.outputs.frontendUrl
