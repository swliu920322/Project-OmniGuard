targetScope = 'resourceGroup'

param location string
param prefix string
param serverlessPlanId string
param storageAccountName string

// 1. 获取基础存储的密钥（以便无缝挂载给 FunctionApp 运行时）
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

// 2. 部署无密钥安全大脑外壳 (Azure Function App - Premium 稳定版)
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-secure-brain-app'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned' // 物理激活系统分配托管身份！
  }
  properties: {
    serverFarmId: serverlessPlanId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.10'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${funcStorage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1' // 锁定企业级包部署模式，极大缩短冷启动
        }
      ]
    }
  }
}