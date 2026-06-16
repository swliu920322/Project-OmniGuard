声威，切入终极交付沙盘。既然物理底座（Landing Zone）已经通过全域清理和永久脚本完成合拢，我们立刻进行全量业务流与系统设计的深度设计。

为了在新加坡高级云架构师面试中形成技术降维打击，我们彻底剥离所有练习生标签（如待办列表、通用聊天），将这三大模块重构为**高并发、零服务器算力损耗、强数据隔离**的工业级生产线。

---

## 一、 Module Alpha：WebGPU 数字人个人门户 (边缘算力侧翼战)

### 1. 业务流 (Business Flow)

* **访问解析**：用户请求静态门户 $\rightarrow$ Azure Static Web Apps 毫秒级分发经过 Vite 压缩的前端单页应用（SPA）。
* **凭证鉴权**：前端向内网 Function App 发起 `POST /api/assets/auth` 请求 $\rightarrow$ 后端验证通过，就地签发一枚**时效 60 秒、只读权限**的存储账户 SAS（安全共享签名）令牌。
* **物理加载**：前端持 SAS 令牌，跨过外网直接撞击 `StorageSubnet` 的 Blob 私网芯片 $\rightarrow$ 极其流畅地并行拉取高精数字人三维网格（`.glb`）与动态权重矩阵。
* **边缘计算**：浏览器调用 WebGPU 驱动，将骨骼动画与网格变形的顶点着色器运算 **100% 压入客户端本地 GPU 显存** $\rightarrow$ 服务端 CPU 负载归零。

### 2. 系统设计与物理安全边界

* **解耦协议**：前端通过 WebGPU Shading Language (WGSL) 自研轻量级渲染管线。服务端不参与任何 3D 渲染，彻底阻断高昂的云端 GPU 实例账单。
* **数据防刷边界**：Blob 存储账户的公网访问硬编码为 `Disabled`。任何静态资产的获取必须通过 Function App 动态签发的短效 SAS 令牌进行拦截。严禁任何人跨域盗刷数字人资产。

---

## 二、 Module Beta：Bicep 智能可视化画布 (智能 IaC 语义生成线)

### 1. 业务流 (Business Flow)

* **拓扑拖拽**：用户在前端画布（React Flow）拖拽组件（如 VNet、Subnet、VM），生成有向无环图（DAG）。
* **架构序列化**：前端将组件依赖树刚性序列化为标准拓扑 JSON $\rightarrow$ `POST /api/bicep/generate` 轰向后端。
* **LLM 结构化约束**：后端 Function 拦截请求，将其封装进严格的 System Prompt 中，强制调用私网内的 GPT-4o 引擎。大模型通过 `json_object` 模式，直接吐出符合 Bicep AST（抽象语法树）规范的结构化源码。
* **WASM 编译拦截**：后端接收到源码字符串，不直接返回，而是将其灌入就地加载的 **Bicep-WASM 编译器**中，执行 `bicep build` 静态语法审计。
* **双向对齐**：若审计成功，将 Bicep 源码与可视化 DAG 拓扑双向吐回前端；若报错，自动将编译错误作为 FeedBack 触发 GPT-4o 自愈重试。

### 2. 系统设计与物理安全边界

```
[React Flow Canvas] ──(DAG JSON)──> [Azure Function API]
                                            │ (Pipes through WASM local compiler)
                                            ├──> [GPT-4o Private Endpoint] (Strict JSON Output)
                                            └──> [Bicep WASM Validator] (Preflight Verification)

```

* **状态管理**：前端采用 Zustand 固化 DAG 拓扑节点状态，通过唯一的 `id` 符号绑定关联 Bicep 资源声明。
* **隐时序闭环**：利用 Bicep 符号引用的特性，在生成网络组（`subnets`）时，强制依赖上级虚网（`virtualNetwork`）的符号变量，通过编译器自动解算时序，达成 **0 警告（Zero-Warning）**。

---

## 三、 Module Gamma：OmniAgent Flow 异步编排引擎 (战略对齐)

### 1. 业务流 (Business Flow) —— 图序列化与队列削峰

* **图式编排**：用户在前端拖拽节点（算命 Agent $\rightarrow$ 改论文 Skill $\rightarrow$ 知识库 RAG $\rightarrow$ 查天气 MCP），连线定义数据流向（Data Flow DAG） $\rightarrow$ Zustand 状态机实时将画布序列化为一张**拓扑图 JSON**。
* **异步入队（Anti-Timeout）**：由于 Agent 链式调用（多步推理、三方接口等待）耗时极长，前端发起执行时，流量直撞 `POST /api/agent/run` $\rightarrow$ 后端 Function **不当场计算**，而是将图 JSON 与当前 Session 上下文作为 Payload，一发强行打入 **Azure Queue Storage（任务队列）**，立放 HTTP 202 释放前端连接，彻底粉碎网关超时熔断。
* **节点算力解算（Worker execution）**：后台 Flex Consumption Function 监听队列触发器（Queue Trigger），顺序出队图 JSON，启动有向无环图解算器（DAG Solver）：
* **Agent 节点**：提着编排好的提示词（Prompt Template），通过私网 PE 撞击 GPT-4o 吞吐 Token。
* **RAG 节点**：截断上游输出，化为向量，去 Azure Table Storage（多租户隔离表）毫秒级提取 PDF 坐标切片与文本。
* **MCP 节点**：Function 扮演 **MCP Client** 角色，通过标准标准协议握手内网里的 MCP Server，动态榨取本地文件系统或数据库的控制主权。


* **流式推流 (SSE)**：执行完毕后的节点状态与 Token 碎片，通过 Azure Web PubSub 或 Server-Sent Events (SSE) 强行管道式推回前端画布，高亮激活当前正在跑号的 Agent 节点。

### 2. 系统设计与物理安全边界

* **解耦协议（MCP Integration）**：
将 Anthropic 开源的 **Model Context Protocol (MCP)** 作为算力下沉的标准接口。Function 内部封装统一的 MCP 传输协议层，将外部三方不可控的 API（如各种算命、排盘接口、改论文查重接口）全部抽象为标准 MCP 工具集（Tools/Resources）。
* **物理隔离边界**：
所有的 Agent 节点和 MCP 桥接器死死封锁在 `BackendSubnet` 内部。针对算命等外部三方非标接口，NSG（网络安全组）执行**严格的出站白名单刚性限制**（仅放行特定域名端口），严禁 Agent 在推理过程中发生内网数据外泄（Data Exfiltration）。

---

## 二、 三大前后端项目全景大合拢矩阵 (The Master Architecture)

现在，你 2026 新加坡大战役的**三大武器库资产**已全面合拢，物理拓扑完全闭环：

明白，执行彻底去 HTML 标签清洗。

直接砸出没有任何 `<br>` 污染、纯文本流对齐的**标准 Markdown 全景合拢矩阵**。单行直接装配进你的 README 资产库：

---

## 📊 Project-OmniGuard 三大核心前后端资产全景矩阵

| 模块标识 | 模块名称 (Module Name) | 前端核心技术 (Front-End) | 后端 Azure 算力底座 (Backend-Plane) | 核心技术 Insight / 护城河 |
| --- | --- | --- | --- | --- |
| **Module Alpha** | WebGPU 数字人个人门户 | Vite + TS + WGSL 驱动本地 GPU 运算 | Azure Static Web Apps + Storage Blob (PE 隔离) | 剥离服务器算力损耗；用短效 SAS 令牌刚性拦截 Blob 跨域盗刷。 |
| **Module Beta** | Bicep 智能可视化画布 | React Flow + Zustand 固化 DAG 节点连线 | Azure Functions + Bicep-WASM 本地编译器 | 拦截 IaC 语法错误；在 Function 内存用 WASM 静态审计，0 警告放行。 |
| **Module Gamma** | OmniAgent 异步编排引擎 | React Flow + SSE 管道流式推流 | Azure Functions + Queue 缓冲 + MCP 协议桥 | 切断多 Agent 调用超时；用 Queue 削峰，用 MCP 协议格式化非标接口。 |

---

## 三、 庚金总工对账：Day 2 落地工程路线图

既然你希望“先把基础搞完，以后就不用动了”，那我们的 Bicep 必须在代码层面为 Module Gamma 的 **MCP 路由** 与 **异步队列** 提前预留好全部的计算平面参数。

不用担心，上一轮我们固化的标准确定性命名代码（`v5` 序列与唯一资源组 `omni-guard-infra-rg`）**已经完美包含了这些底座**。因为：

1. 我们的存储账户是三叉戟模式（Blob、Table、**Queue**），**Queue 已经原位在私网内拉起**，Module Gamma 随时可以直接把任务砸进队列。
2. 我们的虚网已经拉通了 `BackendSubnet`，Function 随时拥有完整的内网握手权限去访问大模型和存储。

--- 

目前你新部署在微软日本东区（japaneast）和香港（eastasia）的物理底座，按月计费明细如下：

App Service Plan (B1 Linux 专属平面)：约 $12.41 USD / 月（折合约 $0.017/小时）。

Azure Static Web Apps (Standard 标准层)：约 $9.00 USD / 月（为了自带内网计算大脑链接，刚性升级至标准层）。

Azure Storage Account (高并发三叉戟存储)：按量计费，无流量时闲置成本 <$0.50 USD / 月。

Azure OpenAI (0387621-2410-resource)：$0 固定成本。因为它属于你已有的存活资产，不产生额外机架费，仅在发起 chat 撞击时按 Token 计费。

🔥 当前底座闲置总成本：约 $22.00 USD / 月（每天约 $0.73 USD，按当前汇率约 5.3 元人民币/天）