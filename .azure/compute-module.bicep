targetScope = 'resourceGroup'

param location string
param prefix string
param serverlessPlanId string
param storageAccountName string

resource funcStorage 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

// 💡 核心修复：引入基于当前资源组哈希的动态定名，彻底粉碎全局二级域名 54001 碰撞冲突
var dynamicAppName = '${prefix}-brain-${uniqueString(resourceGroup().id)}'

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: dynamicAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: serverlessPlanId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName'
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

var blobDataContributorId  = 'ba92f5b4-2d11-4010-a4c0-147070102211'
var queueDataContributorId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var tableDataContributorId = '0a9a6454-47a4-4c4d-9710-41598468b660'

resource blobRoleAssign 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(funcStorage.id, functionApp.id, blobDataContributorId)
  scope: funcStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobDataContributorId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource queueRoleAssign 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(funcStorage.id, functionApp.id, queueDataContributorId)
  scope: funcStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', queueDataContributorId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource tableRoleAssign 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(funcStorage.id, functionApp.id, tableDataContributorId)
  scope: funcStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', tableDataContributorId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}