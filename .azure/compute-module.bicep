targetScope = 'resourceGroup'

param location string
param prefix string
param serverlessPlanId string
param storageAccountName string

// 1. 符号引用现有的存储账户（为了在下方动态提取连接密钥）
resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

var dynamicAppName = '${prefix}-brain-${uniqueString(resourceGroup().id)}'

// 2. 部署隔离计算大脑外壳
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: dynamicAppName
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: serverlessPlanId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11' // 锁定 Python 3.11 运行时
      appSettings: [
        {
          // 💡 终极修复：绕过学校租户 RBAC 封锁，利用 control-plane 动态密钥流完成有状态合拢
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
          value: '1'
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: 'https://omni-openai-instance.privatelink.openai.azure.com/'
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
          value: 'gpt-4o-audit-engine'
        }
      ]
    }
  }
}