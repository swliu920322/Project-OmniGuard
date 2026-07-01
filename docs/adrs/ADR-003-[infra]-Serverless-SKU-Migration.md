# Architecture Decision Record (ADR-003)
# 架构决策记录 (ADR-003)

## Context & Problem Statement / 上下文与问题

During Week 1-2 pipeline implementation, updating the App Service Plan from `FlexConsumption` to `ElasticPremium` failed with a terminal provisioning state (`BadRequest`). Azure Resource Manager (ARM) restricts in-place SKU mutation across non-homologous serverless tiers.

在 Week 1-2 流水线实施期间，将 App Service Plan 从 `FlexConsumption` 更新为 `ElasticPremium` 时遇到终止预配状态 (`BadRequest`)。Azure Resource Manager (ARM) 禁止在非同源的无服务器层级之间进行原地 SKU 变更。

## Decision Drivers / 决策驱动因素

* Eliminate manual state deletion via Azure Portal.
* Force greenfield infrastructure provisioning using immutable naming conventions.
* Minimize disruption to the enterprise RAG backend network profile.

* 消除通过 Azure Portal 手动删除状态的操作。
* 使用不可变命名约定强制绿地基础设施预配。
* 最小化对企业 RAG 后端网络配置的干扰。

## Considered Options / 考虑方案

1. **Option 1**: Manually delete the `omni-serverless-plan` and redeploy. (High operational friction).
   **方案一**：手动删除 `omni-serverless-plan` 并重新部署。（操作摩擦高）
2. **Option 2**: Ephemeral instance fork by changing the resource name token in Bicep. (Selected).
   **方案二**：通过在 Bicep 中更改资源名称令牌来分叉临时实例。（已选）

## Decision Outcome / 决策结果

Selected Option 2. Appended `-v2` suffix to the `Microsoft.Web/serverfarms` name property.

选择方案二。为 `Microsoft.Web/serverfarms` 的 name 属性追加了 `-v2` 后缀。

### Performance & Security Impact / 性能与安全影响

* **Latency / 延迟**: Fixed the deployment schema bottleneck. 修复了部署架构的瓶颈。
* **Blast Radius / 爆炸半径**: Isolated to compute tier provisioning. Subnet delegation for `Microsoft.Web/serverFarms` remains untouched. 隔离到计算层预配，子网委托保持不变。
