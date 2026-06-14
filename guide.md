# 🛑 闪电战最高重组协议：3周倒排并行流水线（截标：7月3日）

### 🦾 轨道一：硬核工程落地（Bicep & Serverless 闭环）

* **Week 1-2 (6月15日 - 6月25日)：交付“一体化安全中台外壳”**
* **核心动作**：不再单跑网络。我们必须在现有的 `main.bicep` 和 `nested-infra.bicep` 基础之上，**一步到位强行织入 Azure Function App（高级弹性计划）与系统分配托管身份（Managed Identity）**。
* **终极指标**：Function 部署在 Spoke VNet 内，通过 Private Link 闭环访问 Storage，且代码中**彻底拔除所有 Key**，100% 靠 RBAC 授信握手。


* **Week 3 (6月26日 - 7月3日)：注入“Generative IaC 大模型审计中台”**
* **核心动作**：放弃自己写语法解析的幼稚想法。直接在 Function 内部使用 Python 挂载 Azure OpenAI SDK。用你上面提供的**极简透传代码**，通过 System Prompt 强行约束大模型对前端上传的 Bicep 源码进行合规跑分，并**透传纯净化 JSON 到前端**。



### 🎨 轨道二：极简用户体验与变现（Next.js & 简历挂件）

* **并行穿插（利用 Week 1-2 晚间 20% 时间）**：
* **速通数字人简历挂件**：不要去写什么 WebGPU 状态机了，那需要耗费大量的 debug 内存。直接用现成的 Next.js 模板，利用 Vercel AI SDK 或现成的客户端 3D 挂件，把你的杀手锏简历文本**硬性硬编码（Hardcode）进前端 Context**。它只需要在网页角落实现一个能用你 10 年资深老兵语气进行普通寒暄的视觉效果（Vibe Coding），立刻封版。
* **IaC 治理仪表盘**：Week 3 配合云端 Function 吐出的合规 JSON，用 Next.js 渲染一个极具震撼力的“安全治理跑分 Dashboard”。



---


> 原计划
# 🗺️ Project-OmniGuard：核心战区重组通关路线图（截标：7月20日）

## 🎯 5周闪电战的核心可交付 Hard Metrics (胜任度自证硬指标)

1. **100% 物理内网数据流**：切断云端 OpenAI/存储的所有公网终结点，走 Private Link。
2. **0% 凭据暴露**：整个系统无任何 Connection String 或 API Key，全量托管身份 (Managed Identity)。
3. **自动化财务熔断 (FinOps)**：绑定云端 Budget 与 Action Group，账单超额时通过代码实现自动化财务停机。
4. **MAS TRM 级别的数字足迹**：Prompt 吞吐与处理链路实现 100% 日志诊断与 KQL 可视化追溯。

---

## 📅 5周倒排时序执行计划 (Sprint Timetable)

### 🛡️ Week 1: 物理网络与边界阻断战区 (Networking & Isolation) —— 权重：40%

* **目标**：彻底解决新加坡金融市场最看重的“公网高压线”问题，完成 Landing Zone 隔离。
* **物理落地动作**：
* **Day 1 & Day 2（已完成）**：跨订阅级作用域双虚网（Hub-Spoke）及 Peering 互通路由，实现 JSON 驱动的 NSG 网络规则微隔离（Backend 隔离与 Storage 锁死）。
* **Day 3 - Day 5（接下来的任务）**：在 `StorageSubnet` 中创建 **Azure Storage Account** 和 **Azure OpenAI 实例**，**彻底关停其所有公网入站**。为它们分别建立 **Private Endpoint（私网终结点）**，挂载并 Link 对应的 **Private DNS Zone**，在内网环境跑通域名解析闭环。


* **对齐 SA 求职话术**：
> *“在新加坡金融机构（MAS TRM）或政府 G-Cloud 的合规大局中，公网 IP 就是高压线。在 Project-OmniGuard 中，我设计并落地了严格的 Hub-Spoke 网络微隔离拓扑。我通过 Bicep 基础设施即代码（IaC）拉起私网隔离带，将大模型（Azure OpenAI）和敏感存储的数据资产全部锁死在私网终结点（Private Endpoint）之后。流量绝不绕行公网，在物理上杜绝了中间人攻击和数据外泄。”*



### 🔑 Week 2: 身份安全与托管控制战区 (Identity & Access Control) —— 权重：20%

* **目标**：消灭代码内硬编码的“内鬼风险”和凭据裸奔，实现零信任安全调用。
* **物理落地动作**：
* **Day 6 - Day 8**：在 `BackendSubnet` 中创建 **Azure Function App (高级消费计划/Premium，确保支持 VNet 集成以吞噬出站流量)**。
* **Day 9 - Day 10**：**100% 物理拔除代码中的所有 API Key 与连接字符串**。开启 Azure Function 的 **系统分配托管身份 (System-Assigned Managed Identity)**，编写 Bicep 脚本，使用 Azure RBAC 显式授予该身份对存储的 `Storage Blob Data Contributor` 权限以及对大模型的 `Cognitive Services User` 权限。


* **对齐 SA 求职话术**：
> *“应用层代码或口头协议无法阻断‘内鬼风险’，安全必须作为物理防线置前硬编码。我的架构通过系统分配托管身份（Managed Identity）切断了所有明文凭据，应用（Azure Functions）访问大模型和存储时走底层 Entra ID 动态颁发的令牌，实现真正的无密钥调用（Credentialless Architecture），从根本上消灭了凭据泄漏可能造成的安全灾难。”*



### 📊 Week 3: 数据安全与可溯源战区 (Data Sovereignty & Audit Trace) —— 权重：20%

* **目标**：解决大模型落地企业时，高管最担心的“安全黑盒、违规胡言乱语、责任人追溯”痛点。
* **物理落地动作**：
* **Day 11 - Day 13**：编写 Azure Function 的业务中台逻辑（基于 Python/FastAPI 或 Nodejs）。引入 **Semantic Kernel / LangGraph 编排层**（用于实现业务想法落地）。
* **Day 14 - Day 15**：在 Function 中注入自定义的**全局拦截中间件 (Auditing Middleware)**。当 Prompt 进站和 Response 出站时，将完整的数据流异步投递至隔离的 **Azure Log Analytics 工作区**。编写 **KQL (Kusto Query Language)** 查询脚本，自测对越界、政治/暴力或敏感财务词汇的合规性捕捉。


* **对齐 SA 求职话术**：
> *“大模型黑盒在企业级场景中最大的风险在于黑产提示词注入与非合规输出。我设计的异步审计流水线（Auditing Pipeline），通过无服务器拦截机制将所有请求载荷（Payload）旁路投递至隔离的 Log Analytics 降落场。我们利用 KQL（Kusto 查询语言）建立了全链路数字足迹追溯。这确保了系统在面对外部审计或安全事件时，具备完备的防篡改溯源能力。”*



### 💰 Week 4: 成本杠杆与合规防御战区 (FinOps & Circuit Breaker) —— 权重：20%

* **目标**：技术手段实现自动化财务熔断，防止盲目调用产生资源黑洞，守住你的 90 美金和企业的钱包。
* **物理落地动作**：
* **Day 16 - Day 18**：进入 Azure Cost Management，针对整个 `omni-guard-rg` 资源组配置强硬的 **Budgets（预算控制线）**。
* **Day 19 - Day 20**：配置预警阈值。当成本达到 80% 或 100% 时，触发绑定的 **Action Group（操作组）**。该操作组异步激活一个 **Azure Automation Runbook 脚本**，在财务耗尽、账单触顶时，通过云控制台 API **强行降级、关停或挂起**该环境下的高耗能组件（如模拟停止算力或关停 Function），实现自动化技术控机。


* **对齐 SA 求职话术**：
> *“不懂云财务算账的架构师不是优秀的商业伙伴。我设计了双层动态成本控制网：除了多租户层面的 Token 限制，核心是在云治理层面通过 Azure Budgets 绑定 Action Group 与自动化 Runbook 脚本。当测试环境账单出现异常波动并触及红线时，系统会自动关停非核心测试实例，用技术隔离手段实现自动化财务熔断，保障企业算力开销可控。”*



### 💻 Week 5: 端侧同构进化、作品集变现与成长总结 (Portfolio & Final Polish)

* **目标**：发挥 10 年前端复杂应用经验与商业直觉，将项目进行降降维打击包装，准备面试。
* **物理落地动作**：
* **Day 21 - Day 22**：编写极简的 Next.js 前端（`src/client-edge/`），利用 `transformers.js` 引入微型本地大模型，在端侧（WebGPU）直接拦截敏感 PII 信息和简单的提示词注入，通过端云同构状态机将处理后的安全流量卸载（Offload）到云端私网。
* **Day 23 - Day 25**：编写完整的 **ADR (架构决策记录)**，重构 GitHub profile。将 5 周内写下的所有**中英双语成长记录文件**进行润色。7月20日正式带着这一套包含 4 大硬核战区的云作品集杀入面试网！

---

## 🚀 构想一：数字人专属“端云同构”知识库 (OmniAvatar Broker)

你想用自己的数据（你的简历、你的云安全直觉）训练一个“数字人声威”替你回答一切提问。我们将它的运行逻辑与我们的网络、FinOps 护栏进行硬核挂钩：

### 1. 极致省钱的物理选型（FinOps 闭环）

* **如果是传统的玩具做法**：用外部闭源昂贵的数字人 API（如 HeyGen 或 D-ID），每一秒视频都在疯狂烧钱。**不选，直接否决。**
* **我们的架构师高杠杆做法**：
* **视觉与表现层（前端 WebGPU 纯白嫖）**：利用用户浏览器的 WebGPU，采用 **Three.js / WebGL 加载你的 3D 虚拟人头像（GLTF 格式）**。嘴型同步（Lip-Sync）使用前端开源轻量级的 Wasm 库（如基于 Web Audio API 的基础动画变形器）。这样，**渲染（Rendering）产生的算力消耗 100% 被卸载（Offload）到用户的电脑上，企业的云端服务器开销为 0**。
* **认知与数据层（端云混合同构调度）**：用户提问时，前端状态机先用 WebGPU 本地的小模型判定：如果是普通寒暄，本地模型直接回答，驱动 3D 嘴型；如果是关于“声威在 Scania 见解、Azure 云安全设计、新加坡 MAS TRM 审计”的尖锐专业提问，状态机立刻将请求打包，**通过私网链接（Private Link）路由给云端的 Azure Functions。云端读取你脱敏后的知识库（Blob），用大模型生成高信噪比答案再返回。**


---

## 🛠️ 构想二：Generative IAC 治理应用 (Bicep Form Visualizer)

你提到纯 Bicep / Terraform 模板对高管来说可读性差、解释性低。我们要做一个高产出的工具：**“配置驱动型 IaC 逆向审计与生成引擎”**。

### 1. 它是如何映射你手里的《工作指南》的？

这直接对齐了你工作指南里的 **“Standardize（工程确定性）与 Secure 物理防线前置”**。

### 2. 核心运行逻辑：

* 我们在 `src/cloud-orchestrator/`（Azure Functions）里编写一个逆向解析核心。
* 前端（你 10 年功底的 Next.js 应用）提供一个上传视窗（也可以直接调用 Azure 控制台的凭据读取当前配置）。
* 用户把他们写的 Bicep 或者是我们前天写的 `main.bicep` 丢进去。
* **AI 审计大脑（LLM App）接管**：AI 逐行扫描这个 Bicep 文件的配置，根据新加坡金融合规矩阵（NSG、Private Link）进行安全打分。
* **用户体验落地**：前端页面瞬间吐出一个极具 Vibe 的“企业级安全合规治理仪表盘（Governance Dashboard）”。
* 网页上会亮出大红灯警告：“*Warning: Detected publicNetworkAccess: 'Enabled' on Storage Account. High exfiltration risk!*”
* 同时，系统会自动附带一个 **“一键自动化修复按钮（Bicep Remediator）”**，点击即可下载默认关闭公网的合规代码。


---

## 📅 5周战区对齐升级：这两项任务在哪里合流？

我们不需要改变前两周死磕网络和托管身份的纪律。这两大新构想，将完美作为 **Week 3（数据安全与中台编排）** 和 **Week 4（端侧同构进化）** 的**具体功能承载（Feature Payload）**。

* **Week 1 (网络底座)**：跑通 Hub-Spoke 网络、NSG 微隔离与存储/AI 的 Private Link（基础网络准备）。
* **Week 2 (身份托管)**：打通 Azure Functions 与 Managed Identity 的 RBAC 授信（安全大脑外壳）。
* **Week 3 (数据与中台 - 融入 Generative IAC)**：在 Azure Functions 内部通过大模型实现读取 Bicep 并输出安全打分 JSON 的中台逻辑。
* **Week 4 (端侧同构 - 融入数字人简历网站)**：在 Next.js 前端集成 WebGPU 算力。把你重构后的“杀手锏简历”固化在本地知识库，跑通普通的寒暄和脱敏，让 3D 数字人在前端用你的直觉向面试官对轰话术。

---
