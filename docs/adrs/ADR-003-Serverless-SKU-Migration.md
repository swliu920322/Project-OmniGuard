# Architecture Decision Record (ADR-003)

## Context & Problem Statement
During Week 1-2 pipeline implementation, updating the App Service Plan from `FlexConsumption` to `ElasticPremium` failed with a terminal provisioning state (`BadRequest`). Azure Resource Manager (ARM) restricts in-place SKU mutation across non-homologous serverless tiers.

## Decision Drivers
* Eliminate manual state deletion via Azure Portal.
* Force greenfield infrastructure provisioning using immutable naming conventions.
* Minimize disruption to the enterprise RAG backend network profile.

## Considered Options
1. **Option 1**: Manually delete the `omni-serverless-plan` and redeploy. (High operational friction).
2. **Option 2**: Ephemeral instance fork by changing the resource name token in Bicep. (Selected).

## Decision Outcome
Selected Option 2. Appended `-v2` suffix to the `Microsoft.Web/serverfarms` name property. 

### Performance & Security Impact
* **Latency**: Fixed the deployment schema bottleneck.
* **Blast Radius**: Isolated to compute tier provisioning. Subnet delegation for `Microsoft.Web/serverFarms` remains untouched.