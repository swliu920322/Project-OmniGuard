# Architecture Decision Record (ADR-004)

## Context & Problem Statement
Preflight validation hard-failed again with `SubscriptionIsOverQuotaForSku` in `southeastasia`. Cloud subscription governance enforces a zero-quota (`0`) policy on both `ElasticPremium` and `PremiumV3` families, deadlocking the infrastructure orchestration.

## Decision Drivers
* Retain mandatory Regional VNet Outbound Integration for Private Link traversal.
* Bypass the explicit multi-tenant Premium VM quota barrier immediately.

## Considered Options
1. **Option 1**: Switch to basic Consumption (`Y1`). (Rejected: Breaks network isolation boundary).
2. **Option 2**: Down-scale to Dedicated Standard (`S1`) App Service Plan. (Selected).

## Decision Outcome
Selected Option 2. Mutated compute tier to `Standard/S1`. 

### Security & Financial Impact
* **Security Balance**: No degradation. Standard tier preserves 100% network isolation capabilities within `BackendSubnet`.
* **FinOps**: Consumes standard dedicated compute tokens. Fits safely within the remaining $90 sandboxed allocation.