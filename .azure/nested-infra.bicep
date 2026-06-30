targetScope = 'resourceGroup'

param location string
param prefix string
param networkRules object
param hubVNetName string
param spokeVNetName string

@secure()
param openAiKey string = ''
param openAiDeploymentName string = 'gpt-5.4-mini'

// NSG 安全防线规则
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

// 骨干双虚网架构
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
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

// Peering 双向高速合拢
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

// 零信任隔离存储
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

// 级联挂载大脑计算核心
module computeBrain './compute-module.bicep' = {
  name: 'Compute-Brain-Deployment'
  params: {
    location: location
    prefix: prefix
    storageAccountName: funcStorage.name
    backendSubnetId: '${spokeVnet.id}/subnets/BackendSubnet' // 🟩 刚性下钻透传
    cosmosEndpoint: cosmosAccount.properties.documentEndpoint
    cosmosKey: cosmosAccount.listKeys().primaryMasterKey
    openAiKey: openAiKey
    openAiDeploymentName: openAiDeploymentName
    iotHubServiceConnectionString: 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${listKeys(iotHub.id, '2023-06-30').value[0].primaryKey}'
    iotHubEventHubConnectionString: 'Endpoint=${iotHub.properties.eventHubEndpoints.events.endpoint};SharedAccessKeyName=iothubowner;SharedAccessKey=${listKeys(iotHub.id, '2023-06-30').value[0].primaryKey};EntityPath=${iotHub.properties.eventHubEndpoints.events.path}'
  }
}

// 私网 DNS 矩阵声明
resource blobDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.blob.${environment().suffixes.storage}'
  location: 'global'
}
resource blobDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: blobDnsZone
  name: 'blob-link-to-spoke'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}

resource tableDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.table.${environment().suffixes.storage}'
  location: 'global'
}
resource tableDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: tableDnsZone
  name: 'table-link-to-spoke'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}

resource queueDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.queue.${environment().suffixes.storage}'
  location: 'global'
}
resource queueDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: queueDnsZone
  name: 'queue-link-to-spoke'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: spokeVnet.id } }
}

// 私网终结点芯片挂载
resource blobPrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-storage-blob-pe'
  location: location
  properties: {
    subnet: { id: '${spokeVnet.id}/subnets/StorageSubnet' }
    privateLinkServiceConnections: [{ name: 'blob-connection', properties: { privateLinkServiceId: funcStorage.id, groupIds: ['blob'] } }]
  }
}
resource blobDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: blobPrivateEndpoint
  name: 'blob-dns-group'
  properties: { privateDnsZoneConfigs: [{ name: 'blob-config', properties: { privateDnsZoneId: blobDnsZone.id } }] }
}

resource tablePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-storage-table-pe'
  location: location
  properties: {
    subnet: { id: '${spokeVnet.id}/subnets/StorageSubnet' }
    privateLinkServiceConnections: [{ name: 'table-connection', properties: { privateLinkServiceId: funcStorage.id, groupIds: ['table'] } }]
  }
}
resource tableDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: tablePrivateEndpoint
  name: 'table-dns-group'
  properties: { privateDnsZoneConfigs: [{ name: 'table-config', properties: { privateDnsZoneId: tableDnsZone.id } }] }
}

resource queuePrivateEndpoint 'Microsoft.Network/privateEndpoints@2023-11-01' = {
  name: '${prefix}-storage-queue-pe'
  location: location
  properties: {
    subnet: { id: '${spokeVnet.id}/subnets/StorageSubnet' }
    privateLinkServiceConnections: [{ name: 'queue-connection', properties: { privateLinkServiceId: funcStorage.id, groupIds: ['queue'] } }]
  }
}
resource queueDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = {
  parent: queuePrivateEndpoint
  name: 'queue-dns-group'
  properties: { privateDnsZoneConfigs: [{ name: 'queue-config', properties: { privateDnsZoneId: queueDnsZone.id } }] }
}

output frontendUrl string = computeBrain.outputs.frontendUrl

output openAiName string = 'byo-decoupled-instance'

// 🟩 追加：边缘神经丛网关 (IoT Hub) - 强制锁定 F1 免费层
@description('Force Free Tier (F1) to protect the remaining budget')
param iotHubSku string = 'F1'

resource iotHub 'Microsoft.Devices/IotHubs@2023-06-30' = {
  name: 'iot-${prefix}-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: iotHubSku
    capacity: 1 // 物理锁定单实例
  }
  properties: {
    // 强制关闭无关协议，收缩暴露面
    enableFileUploadNotifications: false
    // 云端到设备 (C2D) 指令生命周期锁定
    cloudToDevice: {
      defaultTtlAsIso8601: 'PT1H'
      maxDeliveryCount: 10
    }
    // 路由策略：将遥测数据转发至内置 Event Hub，供后续 Function App 消费
    routing: {
      endpoints: {
        events: []
        serviceBusQueues: []
        serviceBusTopics: []
        storageContainers: []
      }
      routes: [
        {
          name: 'DeviceTelemetryRoute'
          source: 'DeviceMessages'
          condition: 'true'
          endpointNames: [
            'events'
          ]
          isEnabled: true
        }
      ]
    }
  }
}

// 输出 IoT Hub 主键连接串，供本地测试桩直接获取，无需登录 Portal
output iotHubConnectionString string = 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${listKeys(iotHub.id, '2023-06-30').value[0].primaryKey}'

// 🟩 追加：持久化海马体 (Azure Cosmos DB) - 强制锁定 Free Tier
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: '${prefix}-mem-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: true // 物理锁死免费层，斩断账单击穿风险
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
  }
}

// 挂载数据库
resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-11-15' = {
  parent: cosmosAccount
  name: 'OmniGuardDB'
  properties: {
    resource: { id: 'OmniGuardDB' }
  }
}

// 挂载物理孪生容器，强行使用 tenant_id 作为物理隔离分区键
resource deviceTwinContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDb
  name: 'DeviceTwins'
  properties: {
    resource: {
      id: 'DeviceTwins'
      partitionKey: {
        paths: [ '/tenant_id' ]
        kind: 'Hash'
      }
    }
    options: {
      throughput: 400 // 免费层极限吞吐量
    }
  }
}