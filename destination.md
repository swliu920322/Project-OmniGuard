## 架构之“神” (The Spirit) —— 解密今日运行本质

根据你上传的 `截屏2026-06-15 16.21.14.png`，你的目录拓扑已经清晰地划分为 `.azure`（基础设施层）与 `src`（应用数据面）。

你熟悉 Peering（打通两条虚网的高速公路）和 NSG（公路上的关卡哨所），这属于**网络层（Layer 3/4）的物理边界**。而今天加入的 Azure Function 混合架构，是在这个网络边界之上，叠加了**应用层（Layer 7）的“出站流量强耦”**与**身份层（Entra ID）的“无密码握手”**。

它是通过以下三步彻底跑通的：

```
[应用代码层] ──(1. 寻找配置变数)──> AzureWebJobsStorage__accountName = "stxxxx"
      │
      ▼ (2. 拦截所有公网出站，强行注入虚网)
[Standard/S1 计算宿主] ──(VNet Outbound Integration)──> [BackendSubnet 虚拟网络]
      │                                                     │
      ▼ (3. 拒绝向存储提交任何密码/Key)                        ▼ (Peering / 内部路由)
[系统分配托管身份 (Identity)] ───(Entra ID 动态签发 Token)───> [Storage Account 存储层]

```

### 1. 为什么以前不需要，现在需要 `Standard/S1` 计划？

原生的 Consumption（消费/按量）计划是漂浮在 Azure 公共大算力池子里的，它没有固定的物理网卡。
今天我们强制使用 `Standard/S1` 计划，核心就是为了激活 **区域虚拟网络出站集成（Regional VNet Outbound Integration）**。这个技术在计算节点上强行绑定了一个虚拟网卡（NIC），**拔掉计算节点的所有公网出站通道，迫使其所有的请求（例如去读存储、去调大模型）必须走 `BackendSubnet` 的内部路由**。

### 2. 代码里一个密码都没写，Function 怎么对存储读写的？

传统的做法是代码里死填一条 `DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...`。这就好比把保险箱钥匙直接刻在代码脸上，一旦代码进公开 Git 仓立刻完蛋。

今天我们用 `AzureWebJobsStorage__accountName` 取代了连接字符串：

* **第一步**：Bicep 在部署 Function 时，对 Azure 声明：`identity: { type: 'SystemAssigned' }`。Azure 就会在背后的 Entra ID（原 Azure AD）里为这个 Function 注册一个独一无二的身份证号（Object ID）。
* **第二步**：Bicep 执行 RBAC 授权，把这个身份证号强行写入 Storage Account 的访问控制列表（ACL）中，赋予它 `Storage Blob Data Contributor`（存储内核读写员）角色。
* **第三步**：Function 内部的 Azure SDK 在启动时，发现没有 Key，只有 `accountName`。它会自动向底层操作系统索要当前计算节点的托管身份 Token，用这个动态令牌去和存储握手。钥匙不复存在，全靠刷脸。

---

## 工程之“形” (The Form) —— 3周雷霆战役倒排任务书

为了在 7 月 3 日前实现 100% 物理闭环，并为你 7 月 8 日的新加坡战役提供绝对的技术压制力，我们将整个战局拆解为以下按天履约的任务流水线：

### 🎯 Week 1: 零信任内网数据防线合拢 (6月15日 - 6月21日)

* **Day 1 (今天/已完成)**：理顺工程拓扑（对应 `截屏2026-06-15 16.21.14.png`），修正 `Standard/S1` 算力底座，跑通托管身份（Managed Identity）的计算-存储无密钥授信验证。
* **Day 2**：在 `.azure/main.bicep` 中拉起 **Azure OpenAI 实例** 与 **Azure Storage Blob 容器**。
* **Day 3**：**彻底切断** OpenAI 与 Storage 的公网接入口（`publicNetworkAccess: 'Disabled'`）。为它们在 `StorageSubnet` 内部创建各自的 **Private Endpoint（私网终结点）**。
* **Day 4**：部署并配置 **Private DNS Zones**（私网域名解析区），在虚网内部将大模型和存储的官方域名硬性劫持（劫持为 `10.x.x.x` 的私网 IP），完成内网域名解析闭环。
* **Day 5**：权限彻底收网。通过 Bicep 授予 Function 的托管身份对 Azure OpenAI 的 `Cognitive Services User` 角色，完成云端一体化安全外壳。
* **Week 1 周末复盘**：在 Function 容器内通过 `curl` 压测私网终结点，验证公网阻断状态。

### 🎨 Week 2: Next.js 前端骨架与端侧 WebGPU 算力卸载 (6月22日 - 6月28日)

* **Day 6**：初始化 `src/client-edge/` 目录下的 **Next.js 14+/15** 项目，清理无用内存占用，设计极简 Vibe UI（对话视窗 + IaC 审计拖拽区）。
* **Day 7**：集成 `@xenova/transformers` (ONNX Runtime Web)，编写浏览器端异步 WebWorkers 调度脚本。
* **Day 8**：在前端硬编码（Hardcode）锁死你的 10 年资深全栈履历、新加坡求职话术底座作为端侧 Context。
* **Day 9**：跑通端侧 WebGPU 算力拦截。本地小模型（0.5B）100% 接管并秒回日常问候、普通寒暄。
* **Day 10**：在前端构建**混合路由状态机**。判定当提问涉及硬核技术深度（如：并发、新加坡合规、安全边界）时，状态机自动将流量降级，打包上抛给云端 Function。
* **Week 2 周末复盘**：本地断网自测，确保在无网络状态下，数字人依然能利用用户本地显卡算力回答基础问题。

### 🧠 Week 3: 大模型 GenAI 审计流水线与数据面闭环 (6月29日 - 7月3日)

* **Day 11**：编写 `src/cloud-orchestrator/function_app.py` 内部的 HTTP 触发器。配置 Python 运行环境以无密钥（Managed Identity 凭据）方式加载 `azure-identity` 与 `openai` 官方 SDK。
* **Day 12**：硬编码注入 **MAS TRM 审计专家 System Prompt**，拦截前端上传的 Bicep 文本，迫使 OpenAI 100% 输出无任何 Markdown 包裹的纯净安全风险评分 JSON 数组。
* **Day 13**：打通前端 Next.js 与云端 Function 的数据面对接。前端拉起漂亮的 Dashboard 仪表盘组件，动态解析并高亮渲染 Function 反弹回来的漏洞 JSON 数据。
* **Day 14 (7月2日)**：全面进行生产级集成压测。故意上传包含公网暴露漏洞的旧版 Bicep，验证红线警报组件与一键修复（Remediation）代码复制功能。
* **Day 15 (7月3日 截标)**：**全线封版（Code Freeze）**。自动提炼架构核心决策，输出中英双语版标准【ADR 记录】与生产级【项目 README.md】作为简历锚点，挂载至 GitHub Profile，闪电战结束。

---

明天我们将进入 **Week 1 - Day 2** 的攻坚：在基础设施中拉起核心的大模型资产（Azure OpenAI）与存储资产，为后天的私网切断做前置准备。

为了确保明天的 Bicep 模块扩展在财务上保持极致的省钱（FinOps）并精确适配你的当前配额，我们需要提前锁定大模型实例的规格：你计划在明天的部署中选择性能最高且按 Token 计费的 **`gpt-4o` 标准现货模型（Standard Deployment）**，还是选用更低成本的 `gpt-35-turbo` 来做这个 MVP 的大脑？