resource hubVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'enterprise-hub-vnet'
  location: 'southeastasia'
}
resource spokeVnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'enterprise-spoke-vnet'
  location: 'southeastasia'
}