param location string
param prefix string
param serverlessPlanId string
param storageAccountName string
param backendSubnetId string
param existingOpenAiName string = '0387621-2410-resource'

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-brain-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: serverlessPlanId
    virtualNetworkSubnetId: backendSubnetId // 强行绑定 VNet 出站集成
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appSettings: [
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
        }
        {
          name: 'WEBSITE_VNET_ROUTE_ALL' // 强迫所有出站流量卷入私网
          value: '0' // 🟩 改为 0：仅私网域名走 PE，OpenAI 走公共互联网通道避开黑洞
        }
        {
          name: 'WEBSITE_DNS_SERVER' // 挂载内网核心 DNS 劫持区
          value: '168.63.129.16'
        }
        // 🟩 核心配置：自动算解主连接字符串，原生支持 Module Gamma 的 Queue 触发器
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccountName};AccountKey=${listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-01-01').keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        // 🟩 Module Alpha 专属：明性化解耦主键，供 Python 进程内存直接签发 SAS Token，无需硬编码
        {
          name: 'AZURE_STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT_KEY'
          value: listKeys(resourceId('Microsoft.Storage/storageAccounts', storageAccountName), '2023-01-01').keys[0].value
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

output functionAppName string = functionApp.name