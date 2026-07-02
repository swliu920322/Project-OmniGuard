# Architectural Decision Record (ADR 032)
# 架构决策记录 (ADR 032)

## Title / 标题
Dual-Track Identity Decoupling, Bicep Parameter Filtering, and Preset Fallback Governance
双轨制身份解耦、Bicep参数过滤与预设降级拦截治理

## Status / 状态
**Approved / 已批准**

## Context / 背景
During E2E integration testing of the IaC Configurator sandbox and enterprise secure-iot scenarios, we encountered three core architectural alignment issues:
1. **Double-Track Identity Collision**: When deploying the Sandbox scenario, the lack of User-Assigned Managed Identity and Key Vault network paths caused compilation errors in templates expecting those resources. Conversely, in the Secure-IoT scenario, using strict Managed Identity Key Vault references `@Microsoft.KeyVault(...)` requires all secrets to be loaded dynamically from the vault, preventing any direct fallback to plain-text settings.
2. **Subscription-Level Parameter Validation Failures**: The React configurator UI exposes multiple SKU settings (such as APIM, Redis, Front Door, and Search). When writing `.azure/main.parameters.json`, all related parameter values were serialized. However, the subscription orchestrator template `main.bicep` only declares 11 core parameters, causing Azure Resource Manager (ARM) preflight check to reject the deployment with `InvalidTemplate` parameter mismatch errors.
3. **Custom Tweak Fallback Downgrades**: In the React configurator page, modifying any basic parameter (like `openAiKey` or `prefix`) automatically transitions the `activeScenario` to `"custom"`. In the backend routing, any `"custom"` scenario defaulted back to `"sandbox"` for Bicep compilation. This caused customized enterprise configurations to be silent-downgraded to public sandbox templates without zero-trust identity assets.

在对 IaC 配置器的沙箱极简与企业内网隔离场景进行端到端集成测试期间，我们遇到了三个核心的架构一致性问题：
1. **双轨身份碰撞**：在沙箱场景下，不具备用户指派托管身份（Managed Identity）和 Key Vault 私网路径，导致依赖这些资源的模板编译失败。而在内网隔离场景下，采用严格的 Managed Identity Key Vault 密文引用 `@Microsoft.KeyVault(...)` 则必须动态装载，不支持任何明文退避。
2. **订阅级参数校验失败**：React 配置台暴露了多个组件的 SKU 调优参数（APIM、Redis、Front Door 等），保存时全部写入了 `main.parameters.json`。但由于主编排模板 `main.bicep` 只声明了 11 个全局参数，Azure ARM 预检判定为“提供未声明的参数”，抛出 `InvalidTemplate` 参数不匹配错误强行拦截。
3. **自定义微调退避降级**：网页端只要微调任何表单字段，系统状态就会切换到 `"custom"` 自定义模式。而在后端 API 路由中，对 `"custom"` 场景简单粗暴地降级为了 `"sandbox"` 进行 Bicep 组装，导致微调后的企业级配置退化为了无安全凭证的公网沙箱。

## Decision Drivers / 决策驱动因素
* **Strict Compiler Alignment**: Bicep and Azure Resource Manager require 100% parameter declaration symmetry at the subscription deployment scope.
* **Granular Network/Identity Isolation**: Decoupling Key Vault RBAC role assignments, private endpoints, and fallback credential chains dynamically based on the active preset context.
* **Reliable UI State Governance**: Ensuring form parameter changes do not trigger layout-level scenario downgrades.
* **Linter and Warning Cleansing**: Eradicating BCP318 (null-dereference of conditional resources) and `use-resource-symbol-reference` (linter violations in listKeys) warnings.

* **严格的编译器对齐**：订阅级部署范围内的参数定义必须与参数输入 JSON 做到 100% 对称。
* **精细化网络/身份隔离**：基于场景预设上下文，动态解耦 Key Vault RBAC 授权、私网 PE 以及退避凭证链。
* **可靠的 UI 状态治理**：确保纯表单变量的修改不会错误触发架构布局级的预设降级。
* **消除编译器警告**：根除 BCP318（条件资源空属性访问）与 `use-resource-symbol-reference`（Linter 函数调用违规）等编译警告。

## Decision / 决策
We implemented a multi-layer architectural alignment across Bicep templates, backend routing, and React configurator state:
1. **Strict 11-Parameter Output Filter**: We refactored `generateParametersObj` in the frontend configurator to filter out all component-level SKU options. The serialized parameters JSON now exclusively contains the 11 variables declared in `main.bicep`, keeping advanced SKU selections purely in the React state for FinOps cost calculations.
2. **Safe Dereferencing & Symbol References**:
   * Replaced raw properties access on conditional resources (like `backendIdentity`) with safe navigation `.?` and null-coalescing `??` operators (`backendIdentity.?properties.principalId ?? ''`), resolving BCP318.
   * Replaced old `listKeys(iotHub.id, ...)` calls with modern, Bicep-native resource references `iotHub.listKeys()`.
   * Corrected the built-in "Key Vault Secrets User" Role ID to the official Azure GUID `4633458b-17de-408a-b874-0445c86b69e6`.
3. **Decoupled Parameter Tweak UX from Scenario Tweak**:
   * Removed scenario-state customization triggers when tweaking basic variable inputs (e.g. OpenAI Keys, prefixes), keeping the preset selection tab intact.
   * Refactored the backend route (`route.ts`) to dynamically evaluate `"custom"` scenario Bicep assembly based on `deployManagedIdentities` (mapping to `secure-iot` if enabled, and `sandbox` otherwise), avoiding silent layout downgrades.
4. **Validation Standard for "Dual Identity-and-Network Lock"**:
   * Formulated and documented a standard E2E validation procedure to verify zero-trust boundaries: verifying that unauthorized users get `ForbiddenByRbac` (identity block) first, and when temporarily granted a reader role, their request is blocked by `ForbiddenByConnection` / `PublicAccessDisabled` (network firewall block) when originating from the public network.

我们在 Bicep 模板、后端 API 路由和 React 配置台状态管理中实施了多层架构对齐：
1. **严格的 11 参数输出过滤**：在前端重构了 `generateParametersObj` 过滤逻辑，剥离了所有底层组件的 SKU 细节参数，向本地写入的 `main.parameters.json` 仅包含 `main.bicep` 所声明的 11 个核心主控变量，使 SKU 选择仅在 React 状态中用于 FinOps 成本估算。
2. **安全空解包与符号引用重构**：
   * 将条件资源（如 `backendIdentity`）的属性引用全部改用安全解包 `.?` 和空合并 `??` 运算符，彻底自愈了 `BCP318` 编译警告。
   * 将所有的 `listKeys(iotHub.id, ...)` 重构为符合 Bicep 代码规范的资源符号方法调用 `iotHub.listKeys()`。
   * 修正了内置角色“Key Vault Secrets User”的 Role ID 为 Azure 官方标准 GUID `4633458b-17de-408a-b874-0445c86b69e6`。
3. **解耦表单修改与架构修改**：
   * 在前端限制了只有勾选 Feature Packs 或变动 SKU 规格才触发 `setActiveScenario('custom')`，普通表单填写不改变当前选定的预设 Tab。
   * 在后端 `route.ts` 路由中，若收到 `"custom"` 场景，则通过检查是否激活 `deployManagedIdentities` 来决定调用 `secure-iot` 还是 `sandbox` 物理模块，杜绝了静默退化。
4. **“身网双锁 (Dual Identity-and-Network Lock)”验证标准**：
   * 制定并归档了规范的 E2E 零信任防线验证规程：即外部访问者默认会受到**第一重身份锁**拦截 (返回 `ForbiddenByRbac`)；即便通过 CLI 临时被赋予只读角色后，若从公网发起连接，仍会触发**第二重网络隔离锁**拦截 (返回 `ForbiddenByConnection` / `PublicAccessDisabled`)。

## Consequences / 后果
- **Positive / 正向**:
  - Cleared all Bicep warnings and linter errors during `az bicep build` preflight validation.
  - Eliminated `InvalidTemplate` parameter mismatch errors during ARM sub deployment.
  - Enabled flawless user-tweak experience: users can customize secrets and subnets without silent downgrades of zero-trust architecture assets.
  - Successfully verified E2E provisioning and private network link DNS resolution (`.com` suffix) on Azure cloud.
  - Physically validated the Dual Identity-and-Network Lock security posture on Key Vault, proving that neither identity alone nor public network path alone can bypass zero-trust policies.
- **Negative / 负向**:
  - The Bicep template structure is slightly more verbose due to BCP318 null-coalescing guards (`?? ''`).

- **正向**:
  - 彻底清空了 `az bicep build` 预编译时的所有 Bicep 警告和 linter 校验错误。
  - 消除了 ARM 订阅级部署时的 `InvalidTemplate` 参数不匹配错误，实现了部署预检一通到底。
  - 提升了用户配置体验：用户可以自由修改密钥 and 前缀，而不会导致零信任身份和安全组网被静默裁剪。
  - 在云端顺利跑通了内网隔离（Secure-IoT）场景下的托管身份及私网 DNS 解析（`.com` 后缀）端到端物理验证。
  - 成功在 Key Vault 实例上物理证明并通过了“身网双锁”的实战连通性测试，验证了无专门授权或非私网路径下数据的绝对不可读性。
- **负向**:
  - 由于添加了对条件资源的 `.?` 和 `?? ''` 空安全保护，Bicep 模板中部分资源引用的代码复杂度略微上升。
