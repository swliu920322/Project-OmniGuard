# Architecture Decision Record (ADR-004)
# 架构决策记录 (ADR-004)

## Context & Problem Statement / 上下文与问题

Preflight validation hard-failed again with `SubscriptionIsOverQuotaForSku` in `southeastasia`. Cloud subscription governance enforces a zero-quota (`0`) policy on both `ElasticPremium` and `PremiumV3` families, deadlocking the infrastructure orchestration.

预检验证再次在 `southeastasia` 区域硬失败，错误为 `SubscriptionIsOverQuotaForSku`。云订阅治理对 `ElasticPremium` 和 `PremiumV3` 系列均强制执行零配额（`0`）策略，导致基础设施编排死锁。

## Decision Drivers / 决策驱动因素

* Retain mandatory Regional VNet Outbound Integration for Private Link traversal.
* Bypass the explicit multi-tenant Premium VM quota barrier immediately.

* 保留必需的 Regional VNet Outbound Integration 以支持 Private Link 穿越。
* 立即绕过显式的多租户 Premium VM 配额壁垒。

## Considered Options / 考虑方案

1. **Option 1**: Switch to basic Consumption (`Y1`). (Rejected: Breaks network isolation boundary).
   **方案一**：切换到基本 Consumption（`Y1`）。（已拒绝：破坏网络隔离边界）
2. **Option 2**: Down-scale to Dedicated Standard (`S1`) App Service Plan. (Selected).
   **方案二**：降级到专用 Standard（`S1`）App Service Plan。（已选）

## Decision Outcome / 决策结果

Selected Option 2. Mutated compute tier to `Standard/S1`.

选择方案二。将计算层变更为 `Standard/S1`。

### Security & Financial Impact / 安全与财务影响

* **Security Balance / 安全平衡**: No degradation. Standard tier preserves 100% network isolation capabilities within `BackendSubnet`. 无降级。Standard 层在 `BackendSubnet` 中保留了 100% 的网络隔离能力。
* **FinOps / 财务运营**: Consumes standard dedicated compute tokens. Fits safely within the remaining $90 sandboxed allocation. 消耗标准专用计算资源，安全适配剩余 $90 沙盒预算。
