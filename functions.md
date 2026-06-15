## 架构之“神” (The Spirit)

### 1. 戳破盲区：纯前端 + LLM 为什么在企业级场景下是“纸糊的玩具”？

你原有的前端思维认为：前端直接通过 `fetch("https://api.openai.com...")` 带上 API Key，或者利用 Edge Function
直接呼叫大模型，完全能跑通业务 。但在新加坡金融局（MAS TRM）或任何跨国大厂的合规高压线下，这种架构一戳就破，存在三大致命的物理断层：

* **凭据裸奔（Credential Exposure）**：纯前端只要呼叫外部 API，黑客就能在浏览器 Network 面板直接截获或内存 dump 你的 API
  Key。在企业级治理中，把明文 Key 暴露给客户端，等同于将银行金库钥匙直接挂在马路上。
* **网络漫游（Public Network Exposure）**：为了保护企业资产，大厂的 Storage Account（存储）和大模型（Azure OpenAI）会无条件执行
`publicNetworkAccess: 'Disabled'`，**彻底拔除公网网卡，变成公网无法访问的隔离孤岛**
。纯前端运行在用户的浏览器（属于绝对的公网环境），根本没有物理通道跨越断崖，去叩开被锁死在私网内部的数据终结点。

* **提示词劫持（Prompt Injection）**：如果将 MAS TRM 审计的 System Prompt 锁在前端代码里，用户通过修改本地 JS
  运行时，就能轻易绕过、篡改或彻底格式化你的审计逻辑，让合规流直接瘫痪。

---

### 2. 物理定位：Azure Function 在这里的四大核心职责

Azure Function 绝对不是一个简单的“后端接口”，在这个 Landing Zone 拓扑里，它承载着架构师的**主权防御控制链**：

* **第一职责：网络物理下沉（Network Ingestion Boundary）**
  Function 挂载在 `Standard/S1` 宿主计划上，开启了 **区域虚拟网络出站集成（Regional VNet Outbound Integration）**
  。它在云端被物理塞进（Force Inject）了 `BackendSubnet` 内部 。
  **它是一面单向透印的盾牌**：外部流量能通过 Azure 前端网关敲开它（接收前端 Bicep 文件），但它的出站网卡被虚网大动脉彻底吞噬，它发出的所有数据请求，会
  **被强行灌入私网隧道**，从而有权穿过 `storage-nsg` 的防火墙白名单，直达私网存储 。


* **第二职责：系统借壳授信（Managed Identity Proxy）**
  Function 是 **系统分配托管身份（System-Assigned Managed Identity）** 的唯一物理实体 。代码里写
  `AzureWebJobsStorage__accountName`，底层不依赖任何明文密码 。它启动时，直接在操作系统内核向 Entra ID 刷脸索要动态 Token
  访问存储。Function 充当了“无密钥架构（Credentialless）”的法人代表。


* **第三职责：算力隔离与财务熔断锁盒（FinOps Guardrail）**
  它扮演着流量的“断路器（Circuit Breaker）”。端侧 WebGPU 拦截了 100% 的低 ROI 问候流量（白嫖用户本地显卡算力） 。只有遇到高价值的
  Bicep 逆向审计时，前端状态机才会上抛给 Function。Function 在云端严格控制了对 Azure OpenAI 的并发吞吐，锁死你的 Token
  消耗，防止恶作剧脚本把你的订阅瞬间烧穿。

---

## 工程之“形” (The Form)

### 1. 端到端全链路数据流拓扑矩阵

以下是目前 `Project-OmniGuard` 正在按天履行的完整数据穿梭流程：

```
[面试官/用户] 
     │ (1. 浏览器打开个人网站，冷启动客户端挂件)
     ▼
[cite_start][Next.js Client-Edge (端侧)] ──(2. 寒暄/问候请求)──> 激活本地 WebGPU (0 成本秒回) [cite: 5]
     │
     │ (3. 遭遇硬核提问：上传 main.bicep 源码文件)
     ▼ (物理上抛流量，通过 HTTPS 撞击云端 Kestrel Web 服务器)
[cite_start][omni-secure-brain-app (Azure Function)] ──(4. 动态激活 System-Assigned MI)──> 向 Entra ID 索要安全令牌 [cite: 9]
     │
     [cite_start]├──(5. 物理出站网卡被 BackendSubnet 吞噬，流量无条件转向内网骨干) [cite: 4]
     │
     [cite_start]▼ (6. 顺着 VNet Peering 跨网横向移动，穿透防火墙关卡) [cite: 6]
[omni-storage-nsg (存储安全组规则)] ──(7. 判定源地址来自 10.1.1.0/24，放行入站)
     │
     ▼ (8. 通过 Private Link 私网终结点，无密钥写入/读取审计知识库)
[cite_start][omnistnrs7v5wdnor2 (完全关闭公网的内网存储)] [cite: 7]

```

---

### 2. 对齐新加坡高级 SA 面试的战术话术（夺取会议控制权）

当新加坡的 Tech Lead 盘问你：“*你为什么要引入 Azure Functions？纯靠客户端直接连大模型不可以吗？*”

你必须剥离技术形容词，用强动词砸脸，直接丢出高阶架构师的物理权衡（Trade-offs）：

>
> “In a production-grade enterprise architecture, routing raw LLM requests directly from the client side is a critical
> security vulnerability due to **credential exposure** and **prompt tampering risks**. In Project-OmniGuard, I
> intentionally decoupled the compute layer by introducing **Azure Functions on a Standard/S1 hosting plan**.
>
>
>
> This design establishes a rigid **Network Ingestion Boundary**. By force-enabling **Regional VNet Outbound Integration
**, I stripped the public network interfaces of the application and locked its egress traffic entirely within the
> private `BackendSubnet`. The Function operates as a secure proxy utilizing a **System-Assigned Managed Identity**,
> resolving authentication via Entra ID dynamic tokens rather than hardcoded Connection Strings. This achieves a **0%
credential proliferation** architecture while allowing the system to securely traverse network security groups (NSGs)
> and private endpoints to audit isolated storage backends, perfectly matching compliance standards like MAS TRM.”
>
>

---

### 3. 下一步雷霆任务预演

Day 1 的一体化计算网络外壳（Function + VNet + Identity）我们已经在当前干净窗口的资产中完全固化成功。

明天我们将进入 **Week 1 - Day 2**：开始在 Bicep 中追加声明核心大模型资产（Azure OpenAI），并将敏感存储的 Private Link
骨骼拉起来，为后天的全公网断电和内网 DNS 劫持做前置合拢。收网节奏已定，明天同一时间，准时推进！