# Architectural Decision Record (ADR 031)
# 架构决策记录 (ADR 031)

## Title / 标题
ADR 031: Shadow Environment E2E Test Suite — Isolated Deployment & Self-Healing Teardown
ADR 031: 影子环境端到端测试套件 — 隔离部署与自愈销毁

## Status / 状态
**Approved / 已批准**

## Context / 背景
The scenario-configurator produces Azure infrastructure templates (Bicep + parameters) that involve complex network topology (VNet, subnets, Private Endpoints, DNS zones) and Managed Identity RBAC. Manual validation is error-prone and time-consuming. There was no automated way to verify that a full deployment actually works end-to-end — including Private Endpoint DNS resolution and container app health — without risking production resource leakage and cost overruns.

配置台生成的 Azure 基础架构模板涉及复杂网络拓扑（VNet、子网、Private Endpoint、DNS Zone）和托管身份 RBAC。手动验证容易出错且耗时。缺少自动化端到端验证手段来确认部署是否真正可用（含 Private Endpoint DNS 解析和容器应用健康状态），同时还要避免生产资源泄露和费用超支。

## Decision Drivers / 决策驱动因素
- Must validate real Azure deployment, not just Bicep syntax
- 必须验证真实 Azure 部署，而非仅 Bicep 语法
- Must run in complete isolation — never touch production resources
- 必须在完全隔离的环境中运行，绝不触碰生产资源
- Must guarantee teardown even on failure or Ctrl+C
- 即使失败或 Ctrl+C 中断也必须保证资源清理
- Must verify Private Endpoint DNS A records point to correct subnet
- 必须验证 Private Endpoint DNS A 记录指向正确的子网
- Must verify ACA container provisioning state after deployment
- 必须验证部署后 ACA 容器的预配状态
- Quick feedback loop for developers iterating on Bicep templates
- 为开发者迭代 Bicep 模板提供快速反馈

## Decision / 决策
Implement `sh/shadow-e2e-test.py` as a self-contained Python script that:
在 `sh/shadow-e2e-test.py` 中实现自包含的 Python 脚本：

1. **Prefix Overwrite Isolation**: Reads `.azure/main.parameters.json`, overwrites `prefix` to `"omnitest"` and `customResourceGroupName` to `"omnitest-guard-infra-sea-rg"` — ensuring zero collision with real deployments
2. **隔离前缀重写**: 读取参数文件，将 `prefix` 强制改写为 `omnitest`，`customResourceGroupName` 改写为隔离资源组名
3. **Shadow Deployment**: Runs `az deployment sub create` with the mutated parameters
4. **影子部署**: 使用改写后的参数执行 `az deployment sub create`
5. **Network Audit**: On success, asserts three conditions via Azure CLI:
   - Cosmos DB Private DNS A records resolve to `10.1.2.x` (StorageSubnet)
   - Key Vault Private DNS A records resolve to `10.1.2.x`
   - ACA `omnitest-backend` provisioning state is `Succeeded`
6. **网络审计**: 部署成功后断言三项：Cosmos DB / Key Vault 的私有 DNS A 记录指向 `10.1.2.x`，ACA 预配状态为 `Succeeded`
7. **Guaranteed Teardown**: `az group delete --yes --no-wait` runs in a `finally` block — always executes regardless of success/failure, and a `SIGINT` handler forces cleanup before exit
8. **自愈销毁**: 在 `finally` 块中执行 `az group delete --yes --no-wait`，无论成败都清理；`SIGINT` 信号处理也强制销毁

## Consequences / 后果

### Positive / 正向
- Zero-cost risk: resources live only minutes; `--no-wait` returns immediately and Azure cleans up asynchronously
- 零费用风险：资源仅存活数分钟；`--no-wait` 立即返回，Azure 异步清理
- Catches network misconfiguration that Bicep syntax validation cannot: Private Endpoint DNS registration, subnet IP allocation, ACA identity binding
- 捕获 Bicep 语法校验无法发现的网络配置问题：PE DNS 注册、子网 IP 分配、ACA 身份绑定
- No production blast radius: `omnitest-*` prefix and dedicated RG prevent any collision
- 无生产影响范围：专用的 `omnitest-*` 前缀和资源组防止任何碰撞
- Ctrl+C safe: signal handler guarantees teardown even on manual interruption
- Ctrl+C 安全：信号处理保证即使手动中断也执行清理

### Negative / 负向
- Requires active Azure subscription with contributor rights; cannot run offline
- 需要活跃的 Azure 订阅和 Contributor 权限，无法离线运行
- Script execution takes 3–10 minutes (deployment + DNS propagation)
- 脚本执行需要 3–10 分钟（部署 + DNS 传播）
- DNS audit queries may return empty if `--no-wait` cleanup is too aggressive; script may report false negatives if RG is deleted before queries complete
- DNS 审计查询可能在资源组被快速清理后返回空，导致误报
- Hardcoded `omnitest-backend` container name assumes the template's naming convention
- 硬编码的 `omnitest-backend` 容器名依赖模板的命名约定
