# 📑 Project-OmniGuard: Cloud AI Architect Growth Journal

---

### 📅 Day 4: Full-Stack Local Emulation Alignment & BYO AI Cross-Region Federation Day

#### 🛠️ 今日战果总结 (What I Did Today)

1. **破除 SWA 跨区域控制面排期死锁 (Resolved SWA Regional Control Plane Blocks)**
* **痛点**：SWA (Static Web Apps) 平台在微软日本东区 (`japaneast`) 根本没有部署控制面硬件机架，导致 Bicep 编译直接被 `LocationNotAvailableForResourceType` 熔断。
* **执行**：物理拆分控制面与分发面。将 SWA 的管理面落子 **`eastasia` (香港)**，而全盘计算大脑 (Function) 与私网存储死锁 **`japaneast` (日本东区)**。利用 SWA Standard 级别的**跨区域链接后端 (Cross-Region Linked Backends)** 主权协议，通过微软全球高速骨干网直线横向完成亚太底座合拢。


2. **强行剥离配额死锁，切换为 BYO 大模型外部资产挂载 (Stripped Quota Deadlocks to BYO AI Federation)**
* **痛点**：由于旧实例躺在回收站死而不僵 (`FlagMustBeSetForRestore`)，且 Taylor's University 学生订阅被施加了“1 订阅 = 1 OpenAI 实例”的刚性配额铁网，导致 Bicep 无法开辟第二战场。
* **执行**：**强行抹除 (Strip)** Bicep 中关于 OpenAI 资源新建、私网 PE 和 DNS 组的所有废码。将大模型架构升级为 **BYO (Bring Your Own) 模式**。将其定位为外部独立军火库，基础网络与静态页面只做挂载，不伤及原有 Agent 资产。


3. **推行 0 密钥落盘与运行时动态注入 (Enforced Zero-Secret on Disk & Runtime Injection)**
* **痛点**：手工硬编码密码不仅造成严重的 Git 凭证泄露漏洞，更导致换账号迁移时需要多处肉搏修改配置。
* **执行**：全量清洗 Bicep 源码参数。重构 `./infra-up.sh` 脚本，在执行时利用当前 CLI 登录态，越过层层目录，直接从独立资源组 `jpe0387621` 内的活跃母体 `0387621-2410-resource` 中全自动“脱水提取”凭证。密钥仅以**内存态**短暂留存，随后一发直线灌入云端 Function App 的加密 Application Settings 中，闭环零信任架构。


4. **击穿 37ms 语法死锁与存储账户公网铁网 (Smashed 37ms Runtime Crashes & Storage Firewalls)**
* **痛点**：Python 进程入场因缺失 `os` 和 `requests` 导入触发 `NameError` 导致 37ms 猝死；同时存储账户全封闭公网拦截 (`publicNetworkAccess: 'Disabled'`) 斩断了本地 Mac 的公网对账脐带，引发 `AuthorizationFailure` 500 熔断。
* **执行**：在 `function_app.py` 头部刚性补齐依赖；降维下发行政指令 `az storage account update --public-network-access Enabled` 撕开云端存储隔离锁，无条件放行本地开发机心跳，让本地 Host (`func start`) 顺利吞下整行 `AzureWebJobsStorage` 连接字符串。


5. **对齐弹药型号，击碎模型机架错位 (Aligned Deployment Models to Eradicate Target Mismatches)**
* **痛点**：代码中硬编码的部署名称 `gpt-4o-audit-engine` 在云端 Foundry 实例中查无此人，触发 `DeploymentNotFound` 404 熔断。
* **执行**：将大模型部署名称完全参数化。改造 Python 路由，优先读取环境变量 `AZURE_OPENAI_DEPLOYMENT_NAME`，默认回退精准狙击真机截图中的真实模型名 **`gpt-4o`**。至此，全栈本地调试管道（本地前端 `4280` $\rightarrow$ 本地后端 `7071` $\rightarrow$ 跨海直撞日本东区真机大模型）**全量通车**！


6. **精算 Landing Zone 闲置成本并固化一键强拆后手 (Optimized FinOps & Scripted Instant Destruction)**
* **精算**：解耦大模型新建后，云端闲置固定开销被暴砍 80%，B1 专属平面 ($12.41) + SWA Standard ($9.00) + 存储三叉戟 (<$0.50)，月度闲置底盘锁死在 **$22.00 USD/月**（每天约 5.3 元人民币）。
* **执行**：固化 `infra-destroy.sh` 脚本，支持一键物理湮灭整个 `omni-guard-infra-sea-rg`。计费大闸随时可以归零 ($0/M)，且绝对不伤及既有 OpenAI 资产，随时通过 `./infra-up.sh` 原位无损复活。



---
