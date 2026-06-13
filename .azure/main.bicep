// 强行将部署范围提升至订阅级别：代码同时接管资源组的生死
targetScope = 'subscription'

// ==========================================
// 1. 全局配置与参数 Schema
// ==========================================
param location string = 'southeastasia' // 锁死新加坡（东南亚）数据中心
param prefix string = 'omni'

var resourceGroupName = '${prefix}-guard-rg'
var hubVNetName = '${prefix}-hub-vnet'
var spokeVNetName = '${prefix}-spoke-vnet'

// 直接读取外部网络规则安全矩阵文件
var networkRules = json(loadTextContent('network-rules.json'))

// ==========================================
// 2. 全自动化拉起合规边界资源组 (RG)
// ==========================================
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: {
    Environment: 'Sandbox-Dev'
    Project: 'Project-OmniGuard'
    FinOpsOwner: 'Shengwei'
  }
}

// ==========================================
// 3. 跨域下沉：投递网络组装细节
// ==========================================
module networkSecurityAndRouting './nested-infra.bicep' = {
  name: 'Nested-Network-Enforcements'
  scope: resourceGroup(rg.name) // 强制进入刚刚创建的资源组上下文
  params: {
    location: location
    prefix: prefix
    networkRules: networkRules
    hubVNetName: hubVNetName
    spokeVNetName: spokeVNetName
  }
}
