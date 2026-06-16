// 📥 覆盖修改 .azure/compute-module.bicep 相关块

param location string
param prefix string
// 💡 显式引入已有大模型的物理坐标变量
param existingOpenAiName string = '0387621-2410-resource'
param existingOpenAiRg string = 'jpe0387621'

// 1. 引用外部存活的大模型（existing 关键字确保不触发新建和软删除幽灵）
resource bstOpenAi 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = {
  name: existingOpenAiName
  scope: resourceGroup(existingOpenAiRg) // 刚性跨越资源组边界定位
}

// 2. 升级计算大脑，赋予其物理“身份证”
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-brain-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned' // 👈 核心：强行命令微软在 Entra ID 中为该硬件注册独立法人身份
  }
  properties: {
    serverFarmId: serverFarm.id
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appSettings: [
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
        }
        // 💡 绝杀：在这里彻底拿掉 API_KEY 变量，只保留终结点寻址路径
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

// 3. 在控制面直接为计算大脑指派大模型算力使用权 (RBAC 权限合拢)
resource openAiRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(bstOpenAi.id, functionApp.id, 'Cognitive Services OpenAI User')
  scope: bstOpenAi // 锁定在已有大模型的作用域上
  properties: {
    // 微软官方硬编码的 'Cognitive Services OpenAI User' 角色定义 ID
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0c59e6-11cd-4f3f-96c3-d065b97c3133')
    principalId: functionApp.identity.principalId // 👈 将 Function 的硬件法人 ID 钉入大模型白名单
    principalType: 'ServicePrincipal'
  }
}