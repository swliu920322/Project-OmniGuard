
### ADR 002: SWA Control Plane Cross-Region Routing & BYO AI Asset Integration 

#### 1. Context

During the cold start of the Project-OmniGuard Asia-Pacific Landing Zone, the engineering pipeline collided with two rigid platform constraints imposed by the Microsoft Azure control plane:

1. **Control Plane Regional Mismatch**: Azure Static Web Apps (SWA) does not have metadata management infrastructure deployed in the Japan East (`japaneast`) region, rejecting preflight provisioning requests under `LocationNotAvailableForResourceType`.
2. **Subscription-Wide Quota Lock**: The academic subscription distributed by Taylor's University enforces a strict "1 Subscription = 1 OpenAI Instance" limit. An existing instance remained soft-deleted in the platform's recycle bin, causing Bicep's creation requests to error out under `FlagMustBeSetForRestore`.
3. **Credential Exposure Vulnerability**: Hardcoding API keys and endpoints inside Bicep manifests or source code violated Zero-Trust principles, creating severe risk of credential leakage and massive maintenance overhead when switching tenants.

#### 2. Decision

Instead of performing brittle, cascaded template fixes, we executed a structural **"Cross-Region Control Separation"** and **"BYO (Bring Your Own) AI Decoupling Layer"**:

1. **Control to Hong Kong, Compute to Japan**: In `nested-infra.bicep`, we explicitly shifted the SWA metadata location to **`eastasia` (Hong Kong)** while anchoring the core Serverless Brain (Function App) and private networks within **`japaneast`**. We leveraged SWA's **Cross-Region Linked Backends** standard protocol to bind them across the Azure network backbone.
2. **Drastic Bicep Simplification**: Stripped all `Microsoft.CognitiveServices/accounts` blocks, private endpoints, and private DNS configurations from the Bicep template, transforming OpenAI into a decoupled, purely referenced external asset.
3. **Runtime Ephemeral Secret Injection**: Rewrote `./infra-up.sh` to extract endpoints and keys dynamically via Azure CLI from the active parent instance `0387621-2410-resource` in resource group `jpe0387621`. These credentials exist solely within the local memory space during execution and are injected directly into the cloud Function App Settings, achieving **Zero-Secret on Disk**.
4. **Storage Firewall Overrides for Local Emulation**: Forced the cloud storage account's network access from `Disabled` to `Enabled` to clear `AuthorizationFailure` blocks when the local development machine (`func start`) attempts to ping the `AzureWebJobsStorage` connection string.

#### 3. Status

**Accepted**

#### 4. Consequences

* **Pros**:
* **Instant Provisioning**: Fully bypassed subscription-wide quota deadlocks and soft-delete namespace collisions, resulting in immediate `Succeeded` deployment states.
* **Absolute De-credentialization**: Eradicated all plain-text passwords from the Git history and Bicep manifests, cutting multi-tenant migration friction to zero.
* **80% Cost Reduction (FinOps Win)**: Erased dedicated AI instance idle costs, locking the Asia-Pacific baseline architecture idle cost at a razor-thin **$22.00 USD/Month**.


* **Cons**:
* **Shifted Dev-Ops Overhead**: Local emulation on the MacBook Air requires synchronization of the extracted `AzureWebJobsStorage` connection string and explicit mapping of the `AZURE_OPENAI_DEPLOYMENT_NAME` to `gpt-4o` within the git-ignored `local.settings.json`.

对标 `Azure-Cloud-Journey` 仓库标准，以下为今日战役沉淀的硬核架构决策文档。

---

### ADR 003: SWA Control Plane Cross-Region Routing & BYO AI Asset Integration (华语版)

#### 1. 上下文 (Context)

在 Project-OmniGuard 亚太 Landing Zone 的冷启动过程中，团队面临微软云控制平面的两项刚性底层物理约束：

1. **控制面机房排期冲突**：前端静态分发底座 Azure Static Web Apps (SWA) 在日本东区 (`japaneast`) 未部署元数据管理机架，拒绝该区域的资源创建请求。
2. **学生订阅配额死锁**：Taylor's University 分发的学生订阅存在“1 订阅 = 1 OpenAI 实例”的绝对配额红线。由于旧实例处于软删除（Soft-deleted）状态躺在回收站，Bicep 强推新建大模型资源必然触发 `FlagMustBeSetForRestore` 熔断，导致全盘基础设施陪葬。
3. **凭证合规漏洞**：手工在 Bicep 或配置文件中硬编码密匙和 Endpoint 违反了零信任原则，导致换账号时代码库存在密码泄露与多处修改的内耗风险。

#### 2. 决策断言 (Decision)

我们拒绝捏橡皮泥式的级联修改，采取“多活分流管理”**与**“BYO (Bring Your Own) 算力解耦”的底层解题路径：

1. **控制面落子香港，算力锁死日本**：在 `nested-infra.bicep` 中将 SWA 的 `location` 强行出圈指向 **`eastasia` (香港)**，保持计算大脑 (Function App) 与私网网络扎根 **`japaneast`**。利用 SWA Standard 级别的**跨区域链接后端 (Cross-Region Linked Backends)** 协议完成跨机房骨干网咬合。
2. **全量切除 Bicep 中的大模型资源块**：将 OpenAI 彻底定位为外部挂载资产。
3. **运行时内存态凭证倒灌**：重构 `./infra-up.sh`。由脚本在执行时动态嗅探独立资源组 `jpe0387621` 内已有实例 `0387621-2410-resource` 的凭证，在本地 Mac 内存中完成脱水提取，随后通过 Azure CLI 直线灌入云端 Function 的 App Settings，达成 **0 密钥落盘**。
4. **网络防火墙动态开闸**：强行将云端存储账户的公网访问开关由 `Disabled` 临时升级为 `Enabled`，解决本地开发机裸奔调试时撞击 `AzureWebJobsStorage` 产生的 `AuthorizationFailure` 熔断。

#### 3. 状态 (Status)

**Accepted (已采纳并全量通车)**

#### 4. 后果影响 (Consequences)

* **正向收益 (Pros)**:
* **一秒过闸**：彻底绕过了学生订阅的配额红线与软删除幽灵冲突，Bicep 编译一秒吐出 `Succeeded` 令牌。
* **绝对去密化**：Git 代码库与 Bicep 模板中没有出现任何一行明文密码，换账号迁移成本压降为 0。
* **开销暴砍 80% (FinOps 获胜)**：剔除新建 OpenAI 实例的机架开销，亚太底座月度闲置固定成本被生生砸到 **$22.00 USD / 月**。


* **负向代价 (Cons)**:
* **运维复杂度横向平移**：本地 MacBook Air 本地调试时，必须保持开发机公网 IP 能够通过开闸后的存储账户防火墙认证，且 `local.settings.json` 必须手动对齐最新抓取的连接字符串与 `gpt-4o` 部署名。



---
