targetScope = 'resourceGroup'

param location string
param prefix string
param serverlessPlanId string
param storageAccountName string

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-secure-brain-app'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned' // 强行激活系统分配托管身份
  }
  properties: {
    serverFarmId: serverlessPlanId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11' // 锁定 Python 3.11 运行时，抹除 3.10 EOL 风险
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName' // 0% 凭据暴露：走全托管身份授信连接
          value: storageAccountName
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
          value: '1' // 锁定企业级包部署模式，缩短冷启动
        }
				{
			    name: 'AZURE_OPENAI_ENDPOINT'
			    value: 'https://omni-openai-instance.privatelink.openai.azure.com/' // 预锁定的私网终结点域名
			  }
			  {
			    name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
			    value: 'gpt-4o-audit-engine'
			  }
      ]
    }
  }
}