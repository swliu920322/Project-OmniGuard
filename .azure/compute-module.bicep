// 📥 覆盖更新 .azure/compute-module.bicep
param location string
param prefix string
param serverlessPlanId string
param storageAccountName string  // 🟩 关键修复：补齐此参数，彻底湮灭 BCP037 报错
param existingOpenAiName string = '0387621-2410-resource'

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-brain-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned' // 开启硬件级刷脸引信
  }
  properties: {
    serverFarmId: serverlessPlanId
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appSettings: [
        // 💡 绝杀修复：重新焊死第 4 代宿主引擎钢印，彻底击碎 Functions version is not supported 阻断
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
        }
        // 💡 工业级闭环：利用 listKeys 在控制面动态生成私网存储凭证，研发期无需感知明文
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-01-01').keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: 'https://${existingOpenAiName}.openai.azure.com/'
        }
        {
          name: 'LOCAL_MOCK_MODE'
          value: 'false'
        }
      ]
   }
  }
}

// 刚性合拢输出链指针
output functionAppName string = functionApp.name
output functionAppPrincipalId string = functionApp.identity.principalId