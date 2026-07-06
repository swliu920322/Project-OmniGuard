targetScope = 'subscription'

param location string = 'southeastasia'
param prefix string = 'omni'

@secure()
param openAiKey string = ''
param openAiEndpoint string = 'https://southeastaisa-0322-resource.openai.azure.com'
param openAiDeploymentName string = 'gpt-5.4-mini'

// Configurator Parameter Set
param deployStaticWebApp bool = false
param customResourceGroupName string = ''
param vnetAddressPrefix string = '10.1.0.0/16'
param backendSubnetPrefix string = '10.1.4.0/23'
param storageSubnetPrefix string = '10.1.2.0/24'

// Enterprise Tag Governance
param costCenter string = 'IT-Dept'
param finOpsOwner string = 'Shengwei'

var resourceGroupName = !empty(customResourceGroupName) ? customResourceGroupName : '${prefix}-guard-infra-sea-rg'
var hubVNetName = '${prefix}-hub-vnet'
var spokeVNetName = '${prefix}-spoke-vnet'

var defaultTags = {
  Environment: 'Production-Intake'
  Scenario: 'SecureIoTPipeline'
  FinOpsOwner: finOpsOwner
  CostCenter: costCenter
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: union(defaultTags, {})
}

module infraDeployment './nested-infra.bicep' = {
  name: 'Nested-SecureIoT-Deployment'
  scope: resourceGroup(rg.name)
  params: {
    location: location
    prefix: prefix
    vnetAddressPrefix: vnetAddressPrefix
    backendSubnetPrefix: backendSubnetPrefix
    storageSubnetPrefix: storageSubnetPrefix
    hubVNetName: hubVNetName
    spokeVNetName: spokeVNetName
    openAiKey: openAiKey
    openAiEndpoint: openAiEndpoint
    openAiDeploymentName: openAiDeploymentName
    deployManagedIdentities: true
    deployStaticWebApp: deployStaticWebApp
  }
}
