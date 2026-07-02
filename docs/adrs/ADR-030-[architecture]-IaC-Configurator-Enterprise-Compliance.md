# Architectural Decision Record (ADR 030)
# 架构决策记录 (ADR 030)

## Title / 标题
ADR 030: IaC Configurator — Enterprise Compliance, Key Vault Integration & GitOps Pipeline
ADR 030: IaC 配置台 — 企业合规校验、Key Vault 物理集成与 GitOps 流水线导出

## Status / 状态
**Approved / 已批准**

## Context / 背景
The scenario-configurator dashboard allows users to configure Azure infrastructure topology (VNet, subnets, SKUs, feature packs) through a Web UI and save/export IaC artifacts. The initial implementation relied solely on frontend validation, which is bypassable by malicious or misconfigured clients. There was no server-side CIDR safety check, no cloud preflight validation, no enterprise tag governance, no Key Vault integration for secrets management, and no GitOps pipeline packaging for CI/CD handoff.

配置台允许用户通过 Web UI 配置 Azure 基础架构拓扑（VNet、子网、SKU、功能包）并保存/导出 IaC 产物。初始实现仅依赖前端校验，存在被绕过风险。缺少服务端 CIDR 安全校验、云端预飞行验证、企业标签治理、Key Vault 密钥管理集成以及 GitOps 流水线打包能力。

## Decision Drivers / 决策驱动因素
- Frontend validation is not a security boundary — server-side must be the second line of defense
- 前端校验不可作为安全边界，服务端必须作为第二道防线
- Enterprise governance requires Cost Center / FinOps Owner tags on all resources
- 企业治理要求所有资源携带成本中心/负责人标签
- Secrets (OpenAI Key) must be stored in Key Vault with Managed Identity access, not plaintext
- 密钥必须存入 Key Vault 并通过托管身份访问，而非明文注入
- Users need a one-click GitOps-ready package for CI/CD handoff
- 用户需要一键导出 GitOps 就绪的部署包用于 CI/CD 交接
- Two deployment modes must be supported: OIDC passwordless (enterprise) and SP secret (testing/restricted)
- 必须支持双部署模式：OIDC 无密（企业级）和 SP 密钥（测试/受限账号）

## Decision / 决策

### 1. Server-Side CIDR Validation & Dry-Run (Blueprints 17-18)
1. 服务端 CIDR 校验与 Dry-Run（蓝图 17-18）
- Added `parseCidr()` in `route.ts` using multiplication arithmetic to avoid JS 32-bit signed shift overflow
- 在 route.ts 中实现 parseCidr()，使用乘法运算避免 JS 32 位有符号位移溢出
- Three validation rules enforced: backend subnet mask <= 23, subnets within VNet range, no overlap between backend and storage subnets
- 三条校验规则：容器子网掩码 <= 23、子网在 VNet 范围内、容器与存储子网不重叠
- Prefix must match `^[a-z0-9]{2,8}$` for Azure resource naming compliance
- 前缀必须符合 `^[a-z0-9]{2,8}$` 规范
- Dry-run mode (`action: 'preflight'`) bypasses file write, returns compilation result only
- Dry-Run 模式跳过文件写入，仅返回编译结果
- Cloud preflight via `sh/preflight-validate.py` executes `az deployment sub validate` with error classification
- 云端预检脚本执行 `az deployment sub validate` 并分类错误类型

### 2. Enterprise Tag Governance (Blueprint 19)
2. 企业标签治理（蓝图 19）
- Added `costCenter` and `finOpsOwner` params to Bicep templates, with `union()` merging of default and dynamic tags
- Bicep 模板新增 `costCenter` 和 `finOpsOwner` 参数，使用 `union()` 合并默认标签与动态输入
- Frontend `GlobalParamsPanel` provides input fields persisted to `main.parameters.json`
- 前端 GlobalParamsPanel 提供输入框并持久化到参数文件

### 3. IaC Package Download & GitOps Pipeline (Blueprints 20-21)
3. IaC 打包下载与 GitOps 流水线（蓝图 20-21）
- `/api/download-iac/route.ts` builds a complete file tree in `/tmp/omni-guard-export/`, then zips via system `zip -r`
- 下载 API 在临时目录构建完整文件树后通过系统 `zip -r` 打包
- Two GitHub Actions workflow files generated: `deploy-iac-oidc.yml` (passwordless OIDC) and `deploy-iac-secret.yml` (SP secret)
- 生成双流水线文件：OIDC 无密模式和 SP 密钥模式
- README.md provides three-track deployment guide (A: Enterprise OIDC, B: Personal SP+MI, C: Restricted classic key fallback)
- README 提供三轨部署指南（A: 企业 OIDC, B: 个人 SP+MI, C: 受限经典密钥退避）

### 4. Key Vault Physical Integration (Blueprint 22)
4. Key Vault 物理集成（蓝图 22）
- Dynamically create Key Vault with `enableRbacAuthorization: true` in all scenarios
- 所有场景动态创建 Key Vault，启用 RBAC 授权
- Sandbox: `publicNetworkAccess: 'Enabled'`; Secure-IoT: `'Disabled'` with Private Endpoint + `privatelink.vaultcore.azure.net` DNS zone
- Sandbox 允许公网访问；Secure-IoT 禁用公网 + 部署 Private Endpoint 和私有 DNS Zone
- Store `openAiKey` as Key Vault secret; grant `Key Vault Secrets User` RBAC to User-Assigned Managed Identity
- 将 OpenAI 密钥存入 Key Vault，授予托管身份 `Key Vault Secrets User` 角色
- Container App `backendApp` gets dual-track `OPENAI_API_KEY` env var: Key Vault reference `@Microsoft.KeyVault(...)` when MI enabled, plaintext fallback when disabled
- 容器应用双轨注入：启用 MI 时使用 Key Vault Reference 语法，否则退避明文注入

## Consequences / 后果

### Positive / 正向
- Defense-in-depth: server-side validation catches what frontend misses
- 纵深防御：服务端校验捕获前端遗漏的越界配置
- Secrets never in plaintext: Key Vault with RBAC + Private Endpoint for production scenarios
- 密钥不明文存储：生产场景使用 Key Vault + RBAC + Private Endpoint
- GitOps-ready: exported zip contains everything needed for CI/CD, reducing onboarding friction
- GitOps 就绪：导出包包含 CI/CD 所需全部文件，降低接入摩擦
- Dual-track architecture serves both enterprise (OIDC) and restricted (SP secret) users
- 双轨架构同时服务企业级（OIDC）和受限（SP 密钥）用户
- Three-track README guides users to the correct authentication mode based on their Azure permissions
- 三轨 README 根据用户权限引导至正确认证模式

### Negative / 负向
- Increased Bicep template complexity: conditional resources (MI, KV, PE) make templates harder to read
- Bicep 模板复杂度增加：条件资源使模板可读性下降
- Key Vault RBAC introduces dependency on `Microsoft.Authorization/roleAssignments` at resource scope, which may fail in constrained subscriptions
- Key Vault RBAC 依赖资源级角色分配，在受限订阅中可能失败（通过轨道 C 退避解决）
- `zip` command depends on system availability; not portable to Windows-based dev environments without WSL
- `zip` 命令依赖系统可用性，Windows 环境需 WSL 支持
- KV name collision risk: `take('${prefix}kv${uniqueString(...)}', 24)` truncation may produce non-obvious names
- Key Vault 名称截断可能产生不易识别的名称
