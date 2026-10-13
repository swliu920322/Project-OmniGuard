# Project-OmniGuard 完整架构说明书

> **一份从零理解云边协同安全编排器的架构、技术选型与设计权衡的指南**

---

## 目录

1. [项目全景](#1-项目全景)
2. [系统架构概览](#2-系统架构概览)
3. [前端技术栈详解](#3-前端技术栈详解)
4. [后端技术栈详解](#4-后端技术栈详解)
5. [基础设施与云服务详解](#5-基础设施与云服务详解)
6. [AI/ML 管线详解](#6-aiml-管线详解)
7. [安全模型](#7-安全模型)
8. [CI/CD 与 IaC](#8-cicd-与-iac)
9. [关键架构权衡 (Trade-offs)](#9-关键架构权衡-trade-offs)
10. [面试高频问答](#10-面试高频问答)
11. [补充遗漏的重要内容](#11-补充遗漏的重要内容)
    - [11.1 运动学-Token 定理形式化定义](#111-运动学-token-定理kinematic-token-theorem形式化定义)
    - [11.2 Benchmark 评估系统](#112-benchmark-评估系统)
    - [11.3 语义路由器设计](#113-语义路由器semantic-router设计)
    - [11.4 启动配置 (Launch Profiles)](#114-启动配置-launch-profiles)
    - [11.5 KOL 投研分析流水线](#115-kol-投研分析流水线补充细节)
    - [11.6 双轨制身份退避](#116-双轨制身份退避dual-track-identity-fallback)
    - [11.7 AGY 开发治理协议](#117-agy-反重力-ide-执行契约)
    - [11.8 系统集成双模式](#118-系统集成双模式物理闭环-vs-数字孪生)
    - [11.9 24+ 架构蓝图目录](#119-24-架构蓝图目录)
    - [11.10 外部代码质量审计](#1110-外部代码质量审计发现)
    - [11.11 完整 34 份 ADR 索引](#1111-完整-34-份-adr-索引全部读完后的总结)
12. [最终面试速查表](#12-最终面试速查表)

---

## 1. 项目全景

### 1.1 项目定位

**Project-OmniGuard** 是一个企业级**云边协同安全决策平台**，核心研究命题是**运动学-Token 定理**：

> 在具身智能 AGV（自动导引车）机队实时控制场景中，纯云端大模型推理延迟（T_cloud = T_network + T_prompt + T_generation）必然造成物理安全死锁——因为云端响应时间超出 AGV 在运营速度下的制动距离时间窗。

平台通过三层防线证明并解决此问题：
- **零信任网络隔离** — 后端在公网完全不可见
- **多智能体 AI 编排** — 三级流水线 + 早期熔断短路
- **WebGPU 边缘推理** — 浏览器端 GPU 直接跑小模型

### 1.2 九大核心功能

| # | 功能 | 说明 |
|---|------|------|
| 1 | 零信任网络安全纵深 | VNet 隔离 + Private Endpoints + Managed Identity + NSG 微分段 |
| 2 | 多智能体 AI 编排引擎 | 三级 Agent 流水线（Router → Safety → Compiler）+ 物理短路层 |
| 3 | IoT 全双工数据管线 | IoT Hub 上行遥测 → EventHubTrigger → Agent 流水线 → C2D 下行指令 |
| 4 | 运动学-Token 定理验证 | 4 模态 Dashboard 交互式证明 |
| 5 | 混合边缘-云端认知管线 | WebGPU + Qwen2.5 本地推理 vs Azure OpenAI 云端推理，语义路由器切换 |
| 6 | IaC 可视化配置器 | 浏览器内拖拽配置 VNet/SKU/区域，动态生成 Bicep |
| 7 | 影子环境 E2E 测试套件 | 自动创建/审计/销毁完整的 Azure 基础设施 |
| 8 | KOL 投研预测 | Twitter 大 V 推文采集 + AI 分析供应链情报 |
| 9 | 数字人 AI 助手 | 路由感知人格切换 + SAS 认证资产 + SSE 流式响应 |

### 1.3 技术栈总览

```
┌──────────────────────────────────────────────────────────┐
│                    用户浏览器 / Edge                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Next.js 14 (App Router) + TypeScript               │  │
│  │  WebGPU + Qwen2.5-0.5B (边缘推理)                    │  │
│  │  Zustand (状态管理) + React Flow (拓扑图)              │  │
│  │  Tailwind CSS (样式) + Lucide (图标)                  │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │ BFF Proxy                        │
│                         ▼                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Next.js API Route ( [...path]/route.ts )           │  │
│  │  捕获性路由 → 透明代理到后端 ACA                       │  │
│  └──────────────────────┬──────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────┘
                          │ VNet Internal (external: false)
                          ▼
┌──────────────────────────────────────────────────────────┐
│               Azure Container Apps (ACA)                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  FastAPI (ASGI) on Azure Functions  Python 3.11      │  │
│  │                                                       │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │  Multi-Agent │  │ Digital Human│  │  KOL Analysis│ │  │
│  │  │  Pipeline    │  │  Chat/SSE    │  │  Prediction  │ │  │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘ │  │
│  └─────────┼────────────────┼──────────────────┼────────┘  │
└────────────┼────────────────┼──────────────────┼────────────┘
             │                │                  │
       ┌─────▼────┐    ┌─────▼─────┐    ┌───────▼──────┐
       │ Azure    │    │ Azure     │    │ Azure        │
       │ IoT Hub  │    │ OpenAI    │    │ Storage Blob │
       │ + DPS    │    │ (GPT-5.4) │    │ (SAS Assets) │
       └────┬─────┘    └───────────┘    └──────────────┘
            │
       ┌────▼────┐
       │ Cosmos  │
       │ DB      │
       │(Twins)  │
       └─────────┘
```

---

## 2. 系统架构概览

### 2.1 分层架构

| 层 | 技术 | 职责 |
|----|------|------|
| **表现层 (Presentation)** | Next.js 14 + Tailwind | 4 模态 Dashboard、IaC 配置器、数字人聊天、简历页 |
| **API 网关层 (BFF)** | Next.js Catch-All Route | 消除 CORS、混淆后端路径、透明代理到内网 ACA |
| **应用层 (Application)** | FastAPI on Azure Functions | 多 Agent 编排、数字人流式聊天、KOL 分析、SAS 签发 |
| **数据层 (Data)** | Cosmos DB + Storage Blob | 设备孪生持久化、资产存储 |
| **AI 层 (AI/ML)** | Azure OpenAI + WebGPU | 云端 GPT 推理 + 边缘 Qwen2.5 推理 |
| **网络层 (Network)** | VNet + Private Endpoints + NSG | 零信任网络隔离 |
| **身份层 (Identity)** | Managed Identity + Key Vault RBAC | 无密码认证，零硬编码密钥 |
| **基础设施层 (IaC)** | Bicep + Shell Scripts | 幂等部署、影子测试、自动销毁 |

### 2.2 核心数据流

```
AGV 设备 → IoT Hub (遥测) → Event Hub 兼容端点
    → Azure Functions EventHubTrigger
    → Multi-Agent Pipeline (Router → Safety → Compiler)
    → Cosmos DB upsert (数字孪生)
    → C2D Message (动作指令) → AGV 设备
```

### 2.3 双模式架构（关键设计决策）

系统同时存在**两种 Dashboard 模式**，共享物理内核但不共享组件：

| 维度 | 仿真模式 (/dashboard) | 真实模式 (/dashboard/live) |
|------|----------------------|--------------------------|
| 数据源 | 前端本地数学计算 | 真实 Azure Functions API |
| 控制流 | 同步 rAF (requestAnimationFrame) | 异步 fetch + 轮询 |
| 确定性 | 确定、可重复 | 非确定，依赖网络 |
| 离线能力 | 完全离线 | 需要后端 |
| 适用场景 | 论文答辩、演示 | 技术审计、性能验证 |
| 状态管理 | useRef + useFleetSimulation2 | useState + useFleetSimulation |
| 代码量 | ~5000 行 | ~1900 行 |

**为什么不做统一抽象**（ADR-021）：
两种模式的控制流（同步 rAF vs 异步 fetch）、数据来源（本地 vs API）、更新粒度（每帧 vs 每秒轮询）完全不同。创建一个覆盖两者的接口要么太模糊（无用），要么太详细（泄漏实现）。独立模式允许各自演化。

---

## 3. 前端技术栈详解

### 3.1 Next.js 14 (App Router)

| 项目 | 内容 |
|------|------|
| **背景** | Next.js 是 Vercel 维护的 React 全栈框架。14 引入 App Router（基于 React Server Components）。 |
| **优点** | 服务端渲染 (SSR)、静态生成 (SSG)、API Routes、文件系统路由、自动代码分割、流式渲染 |
| **为什么用** | 需要同时作为简历站（SSR SEO）和 Dashboard SPA（CSR），Next.js 可以混合模式；Catch-All API Route 天然适合 BFF 代理模式 |
| **场景** | SEO 敏感的落地页 + 需要复杂交互的 Dashboard 并存 |
| **怎么用** | App Router 下 `page.tsx` 是页面入口，`layout.tsx` 是布局，`api/[...path]/route.ts` 是 API 代理 |
| **最佳实践** | 使用 `dynamic = 'force-dynamic'` 确保 API Route 不走缓存；`next.config.mjs` 中配置 Webpack fallback 处理 onnxruntime |

```typescript
// 关键配置: api/[...path]/route.ts 作为 BFF
export const dynamic = 'force-dynamic';
// 透明代理到后端 ACA (VNet 内部)
const targetUrl = `${backendUrl}/api/${path}${search}`;
```

### 3.2 Tailwind CSS

| 项目 | 内容 |
|------|------|
| **背景** | 原子化 CSS 框架，通过组合 utility class 构建 UI |
| **优点** | 零运行时、文件极小、设计一致性、响应式内置、JIT 编译 |
| **为什么用** | 快速原型 + 最终产品级的样式系统，无需离开 HTML |
| **最佳实践** | 配合 `clsx` 和 `tailwind-merge` 做条件样式合并；使用 `@apply` 提取重复组合 |

### 3.3 Zustand

| 项目 | 内容 |
|------|------|
| **背景** | 轻量级 React 状态管理库（~1KB），基于 hooks |
| **优点** | 极简 API（`create()` + `set()`）、无 boilerplate、无 Provider、TypeScript 友好、中间件支持 |
| **为什么用** | 相比 Redux 更轻、比 Context + useReducer 更高效；不需要 Redux 的 action/reducer 模式 |
| **场景** | 多 Agent 流水线 trace 追踪、Dashboard 状态同步 |
| **最佳实践** | 分割 store 避免不必要的 re-render；使用 `shallow` 比较；持久化中间件存储偏好的场景配置 |

### 3.4 React Flow (@xyflow/react)

| 项目 | 内容 |
|------|------|
| **背景** | 基于 React 的节点式图编辑器库 |
| **优点** | 拖拽节点、自定义节点/边、缩放平移、性能好、支持大型图 |
| **为什么用** | 需要可视化 Bicep 拓扑依赖图（VNet → Subnet → Private Endpoint → 资源） |
| **场景** | IaC 拓扑查看器、资源依赖关系可视化 |
| **最佳实践** | 自定义节点组件用于不同资源类型（计算/网络/存储）；使用 React.memo 优化大图性能 |

### 3.5 Lucide React

| 项目 | 内容 |
|------|------|
| **背景** | 开源图标库，提供 1000+ SVG 图标 |
| **优点** | 树摇优化、按需加载、一致性设计、React 原生组件 |
| **场景** | 按钮、导航、状态指示器 |
| **最佳实践** | 只导入用到的图标保持 bundle 最小 |

### 3.6 WebGPU + WebLLM + HuggingFace Transformers

| 项目 | 内容 |
|------|------|
| **背景** | WebGPU 是浏览器 GPU API（W3C 标准）；WebLLM (@mlc-ai/web-llm) 在浏览器内跑 LLM；@huggingface/transformers 在浏览器跑 embedding |
| **优点** | 零服务端成本、隐私数据不出浏览器、离线可用、毫秒级响应 |
| **为什么用** | 验证边缘推理能否替代云端推理；消除网络延迟；降低 Azure OpenAI Token 费用 |
| **场景** | 高频寒暄、本地 RAG（简历问答）、语义路由 |
| **怎么用** | `CreateMLCEngine("Qwen2.5-0.5B")` 加载模型；`pipeline('feature-extraction')` 加载 MiniLM 做 embedding；余弦相似度 ≥ 0.72 走本地 |
| **最佳实践** | 单例加载引擎（`globalLLMEngine`）；`initProgressCallback` 显示加载进度；fast-pass 缓存常用问候语跳过 embedding；设备检测 `navigator.gpu` |

```typescript
// 边缘管线 A: 本地 GPU
async function bootEdgeComputeKernel(onProgress) {
  const webLLM = await import('@mlc-ai/web-llm');
  const engine = await webLLM.CreateMLCEngine("Qwen2.5-0.5B-Instruct-q4f16_1-MLC", {
    initProgressCallback: (report) => onProgress(report.progress * 100)
  });
}
```

**架构权衡**：
- 边缘管线 A 成本 $0，但模型能力有限（0.5B）
- 云端管线 B 按 Token 付费，但使用 GPT-5.4 级别模型
- 语义路由器通过余弦相似度阈值 0.72 做智能分流

---

## 4. 后端技术栈详解

### 4.1 FastAPI

| 项目 | 内容 |
|------|------|
| **背景** | 现代 Python Web 框架，基于 Starlette 和 Pydantic，原生异步 |
| **优点** | 自动 API 文档（Swagger/ReDoc）、类型校验、异步原生、极高性能、Pydantic 数据验证 |
| **为什么用** | 需要 SSE 流式响应（数字人聊天）、异步 LLM 调用、严格请求/响应模型 |
| **场景** | RESTful API、SSE 流式端点、多 Agent HTTP API |
| **怎么用** | 在 `function_app.py` 中创建 FastAPI 实例，挂载 CORS 中间件、日志中间件、子路由器 |
| **最佳实践** | 模块化路由（`include_router`）；日志中间件记录 Method/Path/Status；CORS 在生产环境限制域名 |

### 4.2 Azure Functions (Python ASGI)

| 项目 | 内容 |
|------|------|
| **背景** | Azure 的无服务器计算服务。支持多种语言和触发器。Python 3.11 支持 ASGI（异步 WSGI）。 |
| **优点** | 无服务器（按使用付费）、自动缩放、事件驱动、与 Azure 生态深度集成 |
| **为什么用** | 需要 IoT Hub EventHubTrigger 自动触发 Agent 流水线；与 ACA 组合实现 HTTP + 事件双模式 |
| **怎么用** | `func.AsgiFunctionApp(app=fastapi_app)` 包裹 FastAPI；`func.Blueprint` 注册 EventHub 触发器 |
| **关键配置** | `host.json` 中 Extension Bundle v4 + route prefix 设为空字符串 |
| **最佳实践** | 区分 HTTP 路径（FastAPI）和触发路径（Blueprint）；`AuthLevel.ANONYMOUS` 但网络层已隔离 |

```python
# 双模式注册:
app = func.AsgiFunctionApp(app=fastapi_app)  # HTTP 走 FastAPI
app.register_blueprint(brain_bp)              # EventHub 走 Blueprint
```

**为什么 FastAPI on Functions 而不是独立的 ACA 容器**：
选择 Functions 是因为需要 IoT Hub EventHubTrigger 的无服务器集成。FastAPI 作为 ASGI 框架可以无缝嵌入 Functions 运行时。

### 4.3 LLM Provider 层

| 项目 | 内容 |
|------|------|
| **背景** | 统一 LLM 客户端工厂，支持 Azure OpenAI 和 OpenAI 兼容服务（DeepSeek） |
| **优点** | 多 Provider 切换、服务级配置（BRAIN/DIGITAL_HUMAN/KOL 各自独立）、环境变量驱动的配置解析 |
| **为什么用** | 不绑定单一 LLM 供应商；可按服务分别配置模型（Agent 用轻量模型，数字人用强模型） |
| **怎么用** | 环境变量 `{SERVICE}_LLM_PROVIDER` 控制 Provider；`resolve_llm_config("BRAIN")` 获取配置；`create_llm_client(config)` 创建客户端 |
| **最佳实践** | 客户端单例（避免重复创建）；`local.settings.json` 自动加载；fallback 链式解析 |

### 4.4 多 Agent 编排引擎

| 项目 | 内容 |
|------|------|
| **架构** | 配置驱动的 3-Agent 流水线，无需 LangChain/AutoGen，纯原生 Python |
| **路由 Agent (≤20 tokens)** | 意图分类（CRITICAL_OBSTACLE / NORMAL_NAV / SENSOR_ERROR） |
| **安全 Agent (≤50 tokens)** | 合规审计（PASS / BLOCK:reason） |
| **动作 Agent (≤100 tokens)** | JSON 动作序列编译 |
| **物理短路层** | HP ≤ 0 → offline_lock（跳过全部 Agent）；Battery < 5% → emergency_halt；SENSOR_ERROR → STOP |
| **为什么不用 LangChain** | LangChain 的抽象层对于三类 Agent 流水线过于复杂；原生 Python 的实现更可控、延迟更低、调试更容易 |
| **缓存** | 5 秒 TTL 的 LRU 缓存（`OrderedDict` + `threading.Lock`），最大 128 条 |
| **多租户** | `scenario_registry.json` 中每个 tenant 配置独立 Prompt/Rules/Schema |
| **数字孪生** | 每次遥测事件 upsert 到 Cosmos DB，按 `tenant_id` 分区 |
| **延迟追踪** | 逐 Agent 毫秒级追踪 (`agent_1_latency_ms`, `agent_2_latency_ms`, `agent_3_latency_ms`) |

```python
# 配置驱动的多租户
scenario_registry.json:
  "Tenant-Alpha": { "scenario": "Data Center Patrol", ... }
  "Tenant-Beta":  { "scenario": "Hospital Delivery", ... }
# 新租户 = 新 JSON 条目，零代码变更
```

**架构权衡**：
- 三个顺序 LLM 调用增加总延迟，但短路机制在 80%+ 情况下跳过部分 Agent
- 不使用 Agent 框架（LangChain/AutoGen）避免不必要的抽象开销

---

## 5. 基础设施与云服务详解

### 5.1 Azure Container Apps (ACA)

| 项目 | 内容 |
|------|------|
| **背景** | 微软的托管 Kubernetes 服务（基于 K3s），比 AKS 更容易管理，比 Functions 更灵活 |
| **优点** | 无 K8s 运维负担、Kubernetes 原生 API、支持自定义容器、Dapr 集成、KEDA 自动缩放、VNet 集成、Revision 管理 |
| **为什么用** | 需要运行自定义 Docker 镜像（前端 Next.js + 后端 FastAPI）；需要 VNet 内部部署（`external: false`）；需要比 Functions 更灵活的计算 |
| **SKU** | Consumption + Dedicated（本项目使用 Consumption，支持缩零） |
| **怎么用** | `.azure/compute-module.bicep` 中定义 `Microsoft.App/containerApps`；后端设置 `external: false` 实现网络隐身 |
| **最佳实践** | 前端 external: true + 后端 external: false；使用 Revision 实现蓝绿部署；`minReplicas: 1` 避免冷启动；secret 通过 `secrets` 注入 |

**关键架构决策**：
后端 ACA 设为 `external: false`，意味着：
- 没有公共 IP/域名
- 只能从 VNet 内部访问
- 前端 ACA 通过 VNet 内部的 `.internal.` 域名调用后端
- 公网完全不可见——"物理隐身"

### 5.2 Azure IoT Hub + DPS

| 项目 | 内容 |
|------|------|
| **背景** | IoT Hub 是托管 IoT 消息代理，支持双向通信（设备→云、云→设备）。DPS 是零接触设备预配服务。 |
| **优点** | 十亿级设备规模、标准 MQTT/AMQP/HTTPS 协议、设备身份注册表、C2D 消息、文件上传监控 |
| **为什么用** | AGV 机队需要双向通信：遥测上行（设备→云）+ 指令下行（云→设备）；DPS 实现产线自动注册 |
| **SKU** | S1（标准）或 F1（免费，本项目影子测试用） |
| **怎么用** | 遥测通过 Event Hub 兼容端点路由到 Functions；C2D 通过 HTTP REST API + HMAC-SHA256 手签 SAS Token |
| **最佳实践** | C2D 使用手签 SAS Token 而非 SDK（避免 SDK 依赖）；路由规则 `DeviceTelemetryRoute` + `true` 条件；模块身份用于区分不同传感器 |

```python
# 手签 SAS Token 发送 C2D 消息
def send_c2d_message(device_id, message_body):
    sas_token = generate_sas_token(resource_uri, shared_access_key, policy_name)
    url = f"https://{hostname}/devices/{device_id}/messages/devicebound"
    requests.post(url, data=message_body, headers={"Authorization": sas_token})
```

### 5.3 Azure Cosmos DB

| 项目 | 内容 |
|------|------|
| **背景** | 微软的全球分布式 NoSQL 数据库，多模型支持（SQL/MongoDB/Cassandra/Gremlin/Table） |
| **优点** | 毫秒级延迟、自动缩放（RU/s）、多主写入、五个一致性级别、SLA 99.999% |
| **为什么用** | 设备孪生需要高频 upsert + 按 tenant_id 分区（IoT 工作负载的经典模式） |
| **一致性** | Session（Session 一致性），适合设备状态读自己的写入 |
| **分区** | `/tenant_id` 分区键，Hash 分布 |
| **缩放** | Autoscale 400-4000 RU/s（免费层 400 RU/s） |
| **怎么用** | `OmniGuardDB` 数据库 → `DeviceTwins` 容器；`CosmosClient` + `upsert_item()` 每次遥测更新孪生 |
| **最佳实践** | 使用 Managed Identity + 角色分配（`CosmosDBBuiltInDataContributor`）代替 key 认证；读当前状态用于安全 Agent 的上下文；`last_request_charge` 监控 RU 消耗 |

### 5.4 Azure OpenAI

| 项目 | 内容 |
|------|------|
| **背景** | 微软托管的 OpenAI 模型 API 服务，企业级安全、合规、内容过滤 |
| **优点** | 与 Azure 完全集成（Private Endpoint、Managed Identity、VNet）、合规认证、内容安全过滤 |
| **为什么用** | 需要企业级合规的 LLM 推理；需要 Private Endpoint 确保数据不出 VNet |
| **模型** | `gpt-5.4-mini`（未来将迁移到 GPT-4o-mini） |
| **怎么用** | 通过 `AzureOpenAI` SDK + Managed Identity / API Key 调用；服务级部署名配置 |
| **最佳实践** | Key Vault 存储 API Key；Private Endpoint 连接；`AzureServices` bypass 确保 Azure 平台服务可访问 |

### 5.5 Azure Key Vault

| 项目 | 内容 |
|------|------|
| **背景** | 托管密钥/机密/证书管理服务 |
| **优点** | 硬件安全模块 (HSM) 支持、访问策略/RBAC 双重控制、自动轮转、审计日志 |
| **为什么用** | 存储 OpenAI API Key，实现零硬编码凭据 |
| **SKU** | Standard |
| **怎么用** | `publicNetworkAccess: Disabled` + `enableRbacAuthorization: true`；Managed Identity 通过 RBAC 角色 `Key Vault Secrets User` 读取机密 |
| **最佳实践** | 启用 RBAC 授权（禁用旧的访问策略）；Private Endpoint + Private DNS；Managed Identity 认证而非 API Key |

### 5.6 Azure Storage (Blob)

| 项目 | 内容 |
|------|------|
| **背景** | 微软的托管对象存储，支持 Blob/File/Table/Queue |
| **优点** | 高持久性（99.9999999999%）、分层存储（Hot/Cool/Cold/Archive）、SAS 令牌 |
| **场景** | 前端资源存储、函数触发器的后端存储、SAS 认证私密资产管理 |
| **怎么用** | 前端通过 `get_sas_token()` 获取 60 秒过期 SAS Token → 访问 Blob 资源 |
| **最佳实践** | `publicNetworkAccess: Disabled` + Private Endpoint；短时 SAS Token（60 秒）；只授权最小权限（read, object） |

### 5.7 Azure Virtual Network + Private Endpoints + NSG

| 项目 | 内容 |
|------|------|
| **网络拓扑** | Hub-Spoke 模型：Hub VNet (10.0.0.0/16) + Spoke VNet (10.1.0.0/16) |
| **子网** | BackendSubnet (10.1.4.0/23) — ACA 工作负载、StorageSubnet (10.1.2.0/24) — Private Endpoint |
| **Private Endpoints** | 4 个独立端点：Cosmos DB、Key Vault、Storage Blob、Azure OpenAI |
| **Private DNS Zones** | `privatelink.documents.azure.net`、`privatelink.vaultcore.azure.net`、`privatelink.blob.core.windows.net` |
| **NSG 规则** | BackendSubnet: Deny Internet Inbound；StorageSubnet: Allow Backend Only (TCP 443)、Deny All Other |
| **VNet Peering** | Hub ↔ Spoke 双向对等，`allowForwardedTraffic: true` |
| **为什么用** | 零信任网络隔离；所有数据面服务通过 Private Endpoint 在 VNet 内部通信；公网完全不可达 |

**完整零信任链路**：
```
用户 → Next.js ACA (external: true) → API Route (BFF)
  → VNet 内部 → FastAPI ACA (external: false)
    → Private Endpoint → Cosmos DB
    → Private Endpoint → Key Vault
    → Private Endpoint → OpenAI
    → Private Endpoint → Storage Blob
```

### 5.8 Azure Container Registry (ACR)

| 项目 | 内容 |
|------|------|
| **背景** | 托管的 Docker 镜像仓库 |
| **优点** | 与 ACA/AKS 原生集成、地理复制、安全扫描 |
| **SKU** | Basic |
| **怎么用** | `deploy-aca.sh` 中 `docker build → docker push → az containerapp update` |
| **最佳实践** | 使用 `uniqueString()` 生成唯一名称；`adminUserEnabled: true` 配合 ACA 的 registry secret |

### 5.9 Azure Log Analytics

| 项目 | 内容 |
|------|------|
| **背景** | 日志收集、查询和分析服务（KQL） |
| **优点** | 与 ACA 集成自动收集容器日志、KQL 查询、告警 |
| **SKU** | PerGB2018，30 天保留 |
| **怎么用** | ACA 环境配置 `appLogsConfiguration` 指向 Log Analytics Workspace |
| **最佳实践** | 使用 KQL 监控请求延迟和错误率；配合 Azure Monitor 配置告警 |

### 5.10 Managed Identity

| 项目 | 内容 |
|------|------|
| **背景** | Azure AD 自动管理的服务身份 |
| **优点** | 无密码、无凭据泄露风险、自动轮转、细粒度 RBAC |
| **类型** | User-Assigned Managed Identity |
| **为什么用** | 后端 ACA 运行时无需管理任何密钥——所有 Azure 服务都通过 RBAC 授权 |
| **怎么用** | Bicep 中创建 `userAssignedIdentities`；分配给 ACA 的 `identity` 属性；为各资源创建 `roleAssignments` |
| **最佳实践** | 每个服务使用独立的 Managed Identity（最小权限原则）；ACA 的 `identity.type: 'UserAssigned'` |

---

## 6. AI/ML 管线详解

### 6.1 混合边缘-云端认知管线

```
用户输入
    │
    ▼
┌────────────────────────────────────┐
│ 语义路由器 (余弦相似度)             │
│  1. 输入 embedding (MiniLM-L6-v2)  │
│  2. 与知识库向量比较                │
│  3. 阈值 ≥ 0.72 → 本地 / < 0.72 → 云端 │
└────────┬──────────────┬────────────┘
         │              │
    ← 本地回答    ← 转发到云端
    WebGPU Qwen2.5    Azure OpenAI SSE
         │              │
         ▼              ▼
    $0 成本         按 Token 计费
    毫秒级响应      新加坡区域 Azure
```

**语义路由逻辑**：
```typescript
// 快速通道：常见寒暄直接匹配
const fastPassTokens = ["你好", "hello", "hi"];
if (fastPassTokens.some(token => prompt === token || prompt.startsWith(token))) {
  return { hasKnowledge: true, localContext: cachedReply };
}
// 语义匹配：cosine similarity ≥ 0.72
const similarity = computeCosineSimilarity(promptVector, knowledgeNode.vector);
return { hasKnowledge: similarity >= 0.72, localContext: matchedAsset };
```

### 6.2 多 Agent 编排流水线拓扑

```
IoT 遥测 (obstacle=10cm, velocity=1.5m/s, hp=80, battery=70)
    │
    ▼
┌───────────────────────────────────────────────┐
│ 1. 物理短路层                                  │
│    HP ≤ 0? → offline_lock (跳过所有 Agent)     │
│    Battery < 5%? → emergency_halt              │
│    └─ 通过 → 进入 Agent 流水线                  │
└───────────────────┬───────────────────────────┘
                    ▼
┌───────────────────────────────────────────────┐
│ 2. 数字孪生持久化 (Cosmos DB upsert)           │
│    每次遥测 → 写入 DeviceTwins 容器            │
└───────────────────┬───────────────────────────┘
                    ▼
┌───────────────────────────────────────────────┐
│ 3. Agent 1: Intent Router (≤20 tokens)        │
│    "Classify: CRITICAL_OBSTACLE / NORMAL_NAV  │
│     / SENSOR_ERROR"                           │
│    └─ SENSOR_ERROR? → STOP (短路)             │
└───────────────────┬───────────────────────────┘
                    ▼
┌───────────────────────────────────────────────┐
│ 4. Agent 2: Safety Firewall (≤50 tokens)      │
│    "PASS 或 BLOCK: reason"                    │
│    └─ BLOCK? → STOP (安全覆盖)                │
└───────────────────┬───────────────────────────┘
                    ▼
┌───────────────────────────────────────────────┐
│ 5. Agent 3: Action Compiler (≤100 tokens)     │
│    → [{"action":"turn","degree":90,"speed":20}]│
└───────────────────┬───────────────────────────┘
                    ▼
              C2D Message → AGV 电机
```

### 6.3 KOL 投研预测管线

```
X/Twitter GraphQL API (翻页采集)
    → AI 双语翻译 (LLM)
    → 供应链瓶颈分析
    → 信念观察清单
    → PDF 报告导出 (fpdf2)
```

---

## 7. 安全模型

Project-OmniGuard 的安全架构遵循**纵深防御**原则，共 7 层防线：

### 7.1 网络层安全

| 措施 | 说明 |
|------|------|
| **VNet 隔离** | 所有后端资源在 Spoke VNet 内 |
| **Private Endpoints** | 4 个独立 PE 切断所有数据面服务的公网访问 |
| **NSG 微分段** | BackendSubnet 拒绝来自 Internet 的入站流量；StorageSubnet 只允许 BackendSubnet |
| **后端物理隐身** | ACA 后端容器 `external: false` —— 公网完全不可见 |

### 7.2 身份与访问控制

| 措施 | 说明 |
|------|------|
| **Managed Identity** | 后端运行时无需管理任何凭据 |
| **Key Vault RBAC** | 凭据存储在 Key Vault，Managed Identity 通过 RBAC 读取 |
| **零硬编码密钥** | 没有 `.env` 文件提交到仓库；所有密钥通过 IaC 安全注入 |
| **CORS 限制** | 虽然开发时使用 `*`，生产应限制特定域名 |

### 7.3 API 安全

| 措施 | 说明 |
|------|------|
| **BFF 代理** | 后端路径被 Next.js 代理隐藏；前端不直接暴露 API |
| **速率限制** | Agent 模拟 API 每 IP 每 5 秒 1 次 |
| **SAS 令牌** | 资产访问使用 60 秒过期 SAS Token，无法永久使用 |

### 7.4 IoT 安全

| 措施 | 说明 |
|------|------|
| **C2D 认证** | 手签 HMAC-SHA256 SAS Token 确保设备端验证来源 |
| **DPS 零接触预配** | 设备首次启动自动注册，无需人工干预 |

### 7.5 影子测试安全

| 措施 | 说明 |
|------|------|
| **隔离资源组** | 前缀 `omnitest`，与生产完全隔离 |
| **自动销毁** | 测试完毕自动删除资源组（含 Ctrl+C 信号处理） |
| **中断保护** | `signal.signal(SIGINT, teardown)` 确保即使中断也清理资源 |

### 7.6 零信任数据流完整链路

```
[用户]                                    [公网]
  │
  ▼ HTTPS
[Next.js ACA Frontend]                   [公网可达]
  │
  ▼ VNet Internal HTTP (http://*.internal.*)
[FastAPI ACA Backend]                    [VNet 内部, external: false]
  │
  ├──▼ Private Endpoint (10.1.2.x) ──► [Cosmos DB]       [公网: Disabled]
  ├──▼ Private Endpoint (10.1.2.x) ──► [Key Vault]        [公网: Disabled]
  ├──▼ Private Endpoint (10.1.2.x) ──► [Storage Blob]     [公网: Disabled]
  └──▼ Private Endpoint (10.1.2.x) ──► [Azure OpenAI]     [公网: Disabled]
```

---

## 8. CI/CD 与 IaC

### 8.1 配置驱动 IaC 架构

```
订阅级部署：
main.bicep
  │
  ├── 创建 Resource Group
  │
  ├── nested-infra.bicep (资源组级别)
  │     ├── VNet + Subnet + NSG + Peering
  │     ├── Managed Identity
  │     ├── Key Vault + Private Endpoint
  │     ├── Storage Account + Private Endpoint
  │     ├── Cosmos DB + Container + Private Endpoint
  │     ├── IoT Hub + DPS
  │     └── Azure OpenAI + Private Endpoint
  │
  └── compute-module.bicep (子模块)
        ├── ACR (Container Registry)
        ├── Log Analytics Workspace
        └── ACA Environment
              ├── Backend Container App (external: false)
              └── Frontend Container App (external: true)
```

### 8.2 IaC 工具链

| 工具 | 用途 |
|------|------|
| **Bicep** | 领域特定语言（DSL），编译为 ARM 模板，比 ARM 更简洁 |
| **iac-assembler.py** | 场景编译器：从预设（sandbox/secure-iot）动态组装 Bicep 模板 |
| **preflight-validate.py** | Azure 端预校验：验证权限、资源注册 |
| **provision-whatif.sh** | 干跑预览（`az deployment sub what-if`） |
| **provision.sh** | 正式部署（`az deployment sub create`） |
| **destroy.sh** | 资源组删除 |
| **deploy-aca.sh** | 零缓存 Docker 编译 → ACR 推送 → ACA 滚动更新 |

### 8.3 自动化脚本

| 脚本 | 说明 |
|------|------|
| `start-backend.sh` | 本地启动 Azure Functions (端口 7071) |
| `start-frontend.sh` | 本地启动 Next.js (端口 3000) |
| `patch-env.sh` | 热更新 ACA 容器环境变量 |
| `add-device.sh` | 向 IoT Hub 注册新设备 |
| `trigger-ci.sh` | 推送触发 GitHub Actions |

### 8.4 Makefile 命令总线

```bash
make provision      # 部署 Azure 基础设施
make whatif         # 预检基础设施变更
make start-backend  # 本地启动后端
make start-frontend # 本地启动前端
make test           # 运行 pytest 单元测试
make test-all       # 运行单元测试 + 影子 E2E 测试
make deploy-aca     # Docker 编译→ACR→ACA 滚动更新
make destroy        # 销毁所有 Azure 资源
make patch-env      # 热更新环境变量
make research       # 启动 KOL 分析
```

### 8.5 CI/CD 流程（GitHub Actions）

```
代码推送 → GitHub Actions
  → Bicep 编译验证
  → Docker 镜像编译
  → ACR 推送
  → ACA 滚动更新
```

---

## 9. 关键架构权衡 (Trade-offs)

这是面试中最重要的部分，展示架构决策能力。

### 9.1 双模式 Dashboard vs 统一模式

| 权衡 | 选择 (双模式) | 为什么 |
|------|-------------|--------|
| 代码复用 | ❌ 约 5000 行仿真 + 1900 行真实，大量重复 | 控制流不同（同步 rAF vs 异步 fetch），硬抽象弊大于利 |
| 维护成本 | ❌ 双倍代码，两个心智模型 | 但各自独立演进，互不影响 |
| 用户体验 | ✅ 仿真确定可重复，真实数据丰富 | 各自针对不同受众优化 |
| 可信度 | ✅ 清晰边界，观众不会混淆 | "仿真"和"真实"一目了然 |

**关键洞察**：不是所有重复都该被 DRY 化。当两个模块的控制流和渲染粒度根本不同时，独立比统一更好。

### 9.2 Agent 框架选择：原生 Python vs LangChain/AutoGen

| 权衡 | 选择 (原生 Python) | 为什么 |
|------|------------------|--------|
| 开发效率 | ❌ 需要手动实现缓存、重试、解析 | 但三类 Agent 的逻辑简单（分类/审计/编译），框架引入的开销 > 收益 |
| 灵活性 | ✅ 完全控制 prompt 格式、token 计数、异常处理 | LangChain 的抽象泄漏会使调试复杂化 |
| 延迟 | ✅ 更少抽象层 → 更快的执行路径 | 每个 Agent 只需一次 API 调用 |
| 面试叙事 | ✅ "配置驱动的 3-Agent 流水线"是清晰简洁的架构描述 | 面试官可以立即理解 |

**关键洞察**：LangChain/AutoGen 适合复杂 Agent 图，而这里的流水线是线性且简单的。有时候"少即是多"。

### 9.3 计算选择：ACA vs AKS vs Functions

| 权衡 | 选择 (ACA + Functions 混合) | 为什么 |
|------|--------------------------|--------|
| 运维复杂度 | ✅ 无 K8s 运维（比 AKS 简单） | 不需要完整的 K8s 团队 |
| 事件驱动 | ✅ Functions 提供原生 EventHubTrigger | Agent 流水线需要 IoT Hub 事件触发 |
| 自定义容器 | ✅ ACA 支持自定义 Docker 镜像 | Next.js + FastAPI 都可以容器化 |
| 成本 | ✅ Consumption 模式支持缩零 | 开发期间零成本 |
| 灵活性 | ⚠️ 比 AKS 少 | 但当前需求 ACA 完全满足 |

**关键洞察**：混合模式——HTTP 走 ACA（Docker 灵活性）+ 事件触发走 Functions（无服务器集成），各取所长。

### 9.4 网络隔离：Private Endpoints vs 服务内建防火墙

| 权衡 | 选择 (Private Endpoints) | 为什么 |
|------|------------------------|--------|
| 安全级别 | ✅ 最高：资源在公网完全不可见 | 防火墙规则可能配置错误；Private Endpoint 在网络层面切断公网 |
| 复杂度 | ❌ 增加 VNet/PE/DNS Zone 配置 | 但 Bicep 模板化后是一次性投入 |
| 成本 | ⚠️ Private Endpoint 有少量费用 | 安全投资的合理开销 |
| 延迟 | ✅ 略低（不走公网网关） | 数据在 Azure 骨干网传输 |

### 9.5 边缘推理选择：WebGPU vs WebAssembly vs 原生 SDK

| 权衡 | 选择 (WebGPU + WebLLM) | 为什么 |
|------|----------------------|--------|
| 性能 | ✅ GPU 加速，比 WASM 快 10-100x | Qwen2.5-0.5B 在浏览器 GPU 上实时运行 |
| 覆盖 | ❌ 需要 Chrome/Edge，不支持 Safari | 但目标用户是技术受众，Chrome 为主 |
| 离线能力 | ✅ 首次加载后完全离线 | Demo 场景无需网络 |
| 隐私 | ✅ 数据不出浏览器 | 高频寒暄无需发送到云端 |

### 9.6 Bicep vs Terraform

| 权衡 | 选择 (Bicep) | 为什么 |
|------|------------|--------|
| Azure 集成 | ✅ 原生，零状态管理 | Terraform 需要状态存储（Storage Account） |
| 学习曲线 | ✅ 语法简洁，比 ARM 模板好得多 | Terraform 的 HCL 需要额外学习 |
| 多云 | ❌ 仅 Azure | 当前项目是 Azure-only |
| 生态系统 | ⚠️ 比 Terraform 小 | 但 Azure 资源超过 99% 被覆盖 |

**关键洞察**：对于 Azure-only 项目，Bicep 是比 Terraform 更自然的选择。Terraform 的多云能力在这个项目中不被需要。

### 9.7 Cosmos DB 一致性级别选择

| 级别 | 本项目使用 (Session) | 为什么 |
|------|-------------------|--------|
| Strong | ✅ 最强一致性 ❌ 延迟最高、可用性降低 | 不需要——设备状态读取自己的写入即可 |
| **Session** | ✅ **默认选择，适合 IoT 孪生模式** | 每个设备读自己写入的状态；写自己的 Session token |
| Consistent Prefix | ✅ 较低延迟 ❌ 可能读到非最新 | 安全性场景不能接受 |
| Eventual | ✅ 最低延迟 ❌ 可能读到过期数据 | Agent 流水线需要准确数据做决策 |

**关键洞察**：Session 一致性对 IoT 设备孪生是"恰好正确"的选择——设备总是读自己的写入，不需要全局一致。

---

## 10. 面试高频问答

### Q1: 这个项目解决什么问题？
**A**: 形式化证明并解决"运动学-Token 定理"——纯云端 LLM 延迟超出 AGV 制动距离时间窗。通过混合边缘-云端认知管线（WebGPU 本地推理 + 云端 GPT）和 3-Agent 安全流水线，实现企业级 AGV 机队安全决策。

### Q2: 为什么用 Azure 而不是 AWS/GCP？
**A**: (1) IoT Hub 的 C2D 消息和 Event Hub 兼容端点是 AGV 场景的最佳匹配；(2) 作者持有 5 项 Azure 认证；(3) 项目是学术研究 + 实验性质，不需要多云部署。

### Q3: 最大的架构挑战是什么？
**A**: 双模式 Dashboard（仿真 vs 真实）的状态管理分歧。仿真用 rAF + useRef（同步、每帧更新），真实用 fetch + useState（异步、每秒轮询）。我们选择独立实现而非统一抽象，因为强行抽象会同时降低两者的质量。

### Q4: BFF 模式在这里的价值？
**A**: (1) 消除 CORS —— 前端和后端同域；(2) 隐蔽后端路径——公网看不到 ACA 后端配置；(3) 单点控制——可以在代理层添加缓存/日志/认证。

### Q5: 安全方面最得意的设计？
**A**: 后端 ACA 的 `external: false` —— 后端容器在公网完全不可见。加上 4 个独立 Private Endpoint 切断所有数据面服务的公网访问，实现真正的零信任网络隔离。Managed Identity 确保即使容器被攻破，攻击者也提取不到任何长期凭据。

### Q6: 为什么不用 LangChain/AutoGen？
**A**: 这是一个 3-Agent 线性流水线，不是复杂 Agent 图。原生 Python 的 `ask_agent()` 函数 + 配置驱动的方式 (scenario_registry.json) 更轻量、延迟更低、调试更容易。新租户只需添加 JSON 条目，零代码变更。

### Q7: 项目的性能瓶颈在哪？
**A**: 三个顺序 Agent 调用的总延迟（LLM 推理 + 网络）。缓解方案：(1) 物理短路层跳过大部分场景的 Agent 调用；(2) 语义缓存（5 秒 TTL 的 LRU）；(3) Agent 使用小模型（≤100 tokens）减少推理时间。

### Q8: Bicep vs Terraform 怎么选？
**A**: Azure-only 项目选 Bicep——原生集成、零状态管理、语法简洁。多云项目选 Terraform。这里 100% Azure 且无多云需求。

### Q9: 影子 E2E 测试的意义？
**A**: 验证零信任基础设施的每个环节——从 Bicep 编译到 Private DNS A 记录指向正确的子网 IP。自动部署 → 审计 → 销毁，确保基础设施代码的幂等性和正确性，同时通过 Ctrl+C 信号处理确保不产生费用泄露。

### Q10: 如果重新设计，你会改变什么？
**A**: (1) 状态管理从 useRef + rAF 迁移到状态机模式（XState），让仿真模式的状态转换更可预测；(2) 引入 WebSocket 替代轮询，让真实模式的延迟数据更实时；(3) 引入 API Gateway（Azure API Management）替代简单的 BFF 代理，获得流量管理和版本控制能力；(4) 考虑 KEDA + Dapr 增强 ACA 的事件驱动能力。

---

## 附录

### A. 32+ ADR 索引

项目文档 `docs/adrs/` 包含 33 份架构决策记录，涵盖基础设施、后端、前端和跨域设计。关键 ADR：

| ADR | 主题 | 决策 |
|-----|------|------|
| 021 | 双模式架构 | 仿真和真实模式独立实现，仅共享物理内核 |
| 028 | 多 Agent 编排 | 3-Agent 流水线，配置驱动，无框架 |
| 031 | 影子 E2E 测试 | 自愈式测试套件，自动创建/审计/销毁 |
| 022 | ACA IaC 重构 | 三层 Bicep 模板分离 |
| 034 | OpenAI 凭据统一 | 环境变量驱动的 LLM Provider 配置 |

### B. Azure 认证映射

| 认证 | 覆盖范围 | 本项目中体现 |
|------|---------|-----------|
| AZ-305 (Solutions Architect) | 架构设计 | Hub-Spoke VNet、Private Endpoints、Bicep IaC |
| AZ-104 (Administrator) | 运维管理 | 自动部署脚本、ACA 配置 |
| AI-102 (AI Engineer) | AI 服务 | Azure OpenAI 集成、Cosmos DB 向量、语义路由 |
| SC-300 (Identity) | 身份安全 | Managed Identity、Key Vault RBAC |
| AB-100 (Agentic AI) | Agent 架构 | 多 Agent 编排、配置驱动流水线 |

### C. 推荐学习路径

1. **Azure 基础**: AZ-900 → AZ-104 → AZ-305
2. **Azure AI**: AI-900 → AI-102 → 本项目实现
3. **Azure 安全**: SC-900 → SC-300 → 本项目的安全模型
4. **IaC**: Bicep 入门 → 本项目 IaC 模板分析
5. **前端**: Next.js 教程 → 本项目 BFF 代理 → WebGPU 推理

---

## 11. 补充遗漏的重要内容

### 11.1 运动学-Token 定理（Kinematic-Token Theorem）形式化定义

这是项目的**核心学术贡献**，必须深入理解才能在面试中讲清楚。

**定理陈述**：
> 在具身智能 AGV 机队的云端控制场景中，纯云端 LLM 推理的往返延迟必然超出 AGV 在运营速度下的物理制动距离，造成可证明的安全死锁。

**形式化数学表达**：

```
参数:
  v = AGV 速度 (m/s)
  d_brake = AGV 物理制动距离 (m) — 决定于地面摩擦、制动系统
  T_cloud = 云端推理总延迟 (s)
  T_network = 网络往返延迟 (RTT)
  T_prompt = 提示词编码 + 传输时间
  T_generation = LLM Token 生成时间

核心等式:
  T_cloud = T_network + T_prompt + T_generation
  d_travel = v × T_cloud       ← 云端推理期间 AGV 行驶距离
  d_brake = 物理制动距离

安全条件:
  d_travel ≤ d_brake          ← AGV 在收到指令前不能超过制动点

安全间隙:
  g_s = d_travel - d_brake = v × T_cloud - d_brake

碰撞条件:
  g_s > 0 → 碰撞不可避免

临界速度:
  v_crit = d_brake / T_cloud  ← 超过此速度，云端控制必然失败
```

**数值示例**（来自实测数据）：
```
T_cloud ≈ 6,174 ms (3-Agent 云端流水线)
d_brake ≈ 2.0 m (AGV 制动距离 @ 1.5 m/s)
v_crit = 2.0 / 6.174 ≈ 0.32 m/s
→ AGV 最低运营速度 1.5 m/s >> 0.32 m/s → 碰撞不可避免 ✓
```

**解决方案 — 边缘推理闭锁**：
```
边缘 WebGPU 推理 T_edge ≈ 60 ms
v_crit_edge = 2.0 / 0.060 ≈ 33.3 m/s
→ 1.5 m/s << 33.3 m/s → 安全 ✓
```

**实现位置**：`src/client-edge/src/app/shared/physics/kinematic-token.ts`

```typescript
export function computeCloudLatencyMs(b: LLMBreakdownParams): number {
  return b.networkRttMs + ((b.promptTokens + b.completionTokens) / b.tokenRateTokS) * 1000;
}
export function vMaxMps(clearanceM: number, loopLatencyS: number): number {
  if (loopLatencyS <= 0) return Infinity;
  return clearanceM / loopLatencyS;
}
export function isSafe(speedMps, clearanceM, detectionLatencyS, brakeLatencyS): boolean {
  return speedMps <= vMaxMps(clearanceM, totalLoopLatencyS(detectionLatencyS, brakeLatencyS));
}
```

---

### 11.2 Benchmark 评估系统

> 数据口径以 [`benchmark_results/README.md`](src/cloud-orchestrator/embodied_brain/benchmark_results/README.md)
> 为唯一入口。下列 6.174 秒、39.5% 和 4,613 ms 均属于
> `2026-07-16-thesis-200` 历史 v2 跑次，不代表后续 60 条诊断跑次或尚未执行的 v3 协议。

| 项目 | 内容 |
|------|------|
| **文件** | `src/cloud-orchestrator/embodied_brain/benchmark.py` |
| **场景数** | 当前 v3 协议固定 200 个分层场景（随机种子 42，temperature=0.0） |
| **分类** | NORMAL_NAV (50%) / CRITICAL_OBSTACLE (25%) / SENSOR_ERROR (25%) |
| **指标** | 完整混淆矩阵、Bootstrap 95% 置信区间、延迟统计、熔断节省计算 |
| **消融实验** | `benchmark_baseline.py`: 单体 Agent 无流水线；`benchmark_no_safety.py`: 无安全防火墙 |

**AB 测试架构**：

| 版本 | 描述 | 预期延迟 | 预期准确率 |
|------|------|---------|-----------|
| **Full Pipeline** | Router → Safety → Compiler | ~6s (完整) | 高 (Safety 兜底) |
| **No Safety** | Router → Compiler | ~4s (少 1 Agent) | 中 (无合规审计) |
| **Monolithic** | 单一大模型 | ~3s (1 次调用) | 低 (无意图分类) |

**历史 v2 跑次发现**：
- Early Circuit-Breaking 在 39.5% 的事件中跳过了下游 Agent
- 按 PASS 样本的阶段均值反事实估算，每次提前退出少等待约 4,613 ms；这不是直接观测到的节省时长
- Router Agent 仅用 ≤20 tokens，Safety ≤50 tokens，Compiler ≤100 tokens

---

### 11.3 语义路由器（Semantic Router）设计

这是混合边缘-云端认知管线的**核心决策单元**。

| 项目 | 内容 |
|------|------|
| **位置** | `src/client-edge/src/lib/digital-human/semanticRouter.ts` |
| **模型** | `Xenova/all-MiniLM-L6-v2` — 仅 23MB，浏览器内运行 |
| **维度** | 384 维浮点向量 |
| **阈值** | **0.72** — 余弦相似度 ≥ 0.72 走本地边缘推理，< 0.72 走云端 |
| **快速通道** | 常见寒暄词（"你好"、"hello"、"hi"）直接匹配，跳过 embedding |

**路由逻辑**：
```
用户输入
   ↓
[快速通道匹配] → 命中 → 直接返回本地缓存回答（0 Token 成本）
   ↓ 未命中
[embedding 向量化] → MiniLM → 384 维向量
   ↓
[余弦相似度计算] → 与本地知识库向量逐一对比
   ↓
[≥ 0.72?]
   ├── Yes → 本地 WebGPU Qwen2.5 推理（~60ms, $0）
   └── No  → 云端 Azure OpenAI SSE 推理（~2-6s, 按 Token 计费）
```

**知识库设计**：
```typescript
export const LOCAL_KNOWLEDGE_BASE = [
  { tags: "你好, 打招呼, hello, hi, greeting", text: "..." },
  { tags: "刘胜伟学历, Taylor, Master, Computing AI", text: "..." },
  { tags: "工作履历, Accenture, Scania, 经验", text: "..." },
  { tags: "证书, AZ305, AZ104, AI102, 微软认证", text: "..." },
];
```

**面试要点**：为什么阈值设 0.72？这是通过实验调优的——在 200+ 测试样本上平衡准确率和召回率，确保不将需要云端复杂推理的问题错误路由到本地（如果置信度不够，宁可花钱走云端，也不给出错误回答）。

---

### 11.4 启动配置（Launch Profiles）

| 项目 | 内容 |
|------|------|
| **位置** | `src/client-edge/src/lib/launchProfile.ts` |
| **目的** | 支持 3 种部署模式切换，通过 localStorage 持久化用户选择 |

**三种 Profile**：

| Profile | 订阅范围 | AI Provider | 场景 |
|---------|---------|-------------|------|
| `local-sub-thirdparty-openai` | 本地订阅 | OpenAI 兼容 (DeepSeek) | 解耦模式，推荐 |
| `local-sub-azure-openai` | 本地订阅 | Azure OpenAI | 保留 Azure 链路 |
| `cloud-sub-azure-openai` | 云端订阅 | Azure OpenAI | 全托管生产治理 |

**为什么需要 Profile**：
- 开发者可能使用不同的 AI Provider（Azure vs DeepSeek）
- 部署脚本需要不同的参数化方式
- 通过 localStorage 在会话间保持选择

---

### 11.5 KOL 投研分析流水线（补充细节）

**整体流程**：
```
make research
  → 读取 TARGET_USER_ID 和 RANGE_DAYS 环境变量
  → X/Twitter GraphQL API 翻页抓取推文（智能增量：命中缓存即停止）
  → AI 批量翻译（15 条/批的 chunk 翻译，含 JSON 解析和 markdown code fence 清理）
  → 合并到时序归档（去重、排序、保留全部历史）
  → 生成 5 个时间窗口分析报告（7d / 30d / 90d / 180d / 365d）
    每个报告含：Hot Topics, Industry Proportions, Conviction Watchlist,
    Supply Chain Bottlenecks, Value Chain Mapping, Bilingual Tweet Timeline
  → 0 Token 复用优化：如果大窗口和小窗口推文集合相同，跳过重复分析
  → FastAPI 提供 GET /api/kol/list, GET /api/kol/report, GET /api/kol/pdf
  → PDF 导出使用 fpdf2 + 中文字体（PingFang / Songti）
```

**关键面试点**：
- **智能增量抓取**：检测到已缓存的推文即停止翻页，节省 API 配额和时间
- **0 Token 复用优化**：大时间窗口的推文集合如果与更小窗口一致，直接复用分析结果
- **双重缓存降级**：如果指定天数的报告不存在，尝试 fallback 到 30d → 7d → 90d
- **中文 PDF 渲染**：支持 macOS (PingFang) 和 Linux (DroidSansFallback) 字体路径

---

### 11.6 双轨制身份退避（Dual-Track Identity Fallback）

这是重要的企业架构设计，在 ADR-032 中记录。

| 项目 | 内容 |
|------|------|
| **Bicep 参数** | `deployManagedIdentities` (bool) |

| 运行环境 | `deployManagedIdentities: true` | `deployManagedIdentities: false` |
|---------|-------------------------------|--------------------------------|
| **适用账号** | 订阅 Owner、企业 Landing Zone | 学生账号、受限沙箱 |
| **凭据存储** | 100% Key Vault，零明文 | Web App Settings 密文区 |
| **通信机制** | 无密钥通信 (Managed Identity + RBAC) | 密钥通信（连接字符串） |
| **Bicep 资源** | 创建 roleAssignments | 不创建授权资源 |

**为什么用 User-Assigned Managed Identity 而非 System-Assigned**：

| 特性 | User-Assigned | System-Assigned |
|------|--------------|-----------------|
| 生命周期 | 独立于容器，容器重建不影响 | 随容器创建/销毁 |
| RBAC 授权时序 | 可先创建身份再授权，最后绑定容器 | 容器创建后才能分配，有循环依赖 |
| 重建延迟 | 无额外延迟 | 每次重建等待 Entra ID 5-10 分钟同步 |
| 复用 | 多个 ACA 容器可共享 | 每个容器独立 |

---

### 11.7 AGY 反重力 IDE 执行契约

这不是传统技术，而是一个**开发工作流治理协议**，定义了 AI 编码助手的行为边界。

| 项目 | 内容 |
|------|------|
| **位置** | `docs/reference/agy-protocol.md` |
| **核心目的** | 剥夺 AI 的系统架构主权，让 AI 成为纯粹的"高级工程熟练工"——只执行，不决策 |

**四条铁律**：
1. **架构只读**：严禁修改 `.azure/` 下的 Bicep 模块拓扑，遇报错仅输出分析，不生成 Patch
2. **依赖锁死**：严禁引入未经声明的第三方 SDK
3. **动词驱动**：所有代码注释、函数命名、Git Commit 必须以强动词开头（Strip / Force / Bind / Route / Fix）
4. **失败熔断**：连续 2 次相同 Runtime Error → 强制停止，输出标准熔断报文

**四步验证状态机**：
1. **物理长连贯通**：模拟器 1msg/sec × 100 条，掉线率 0%
2. **零信任越权阻断**：伪造设备 ID，拦截率 100% (403)
3. **大脑指令降维**：Function → Azure OpenAI，Action JSON Schema 匹配率 100%
4. **孪生状态持久化**：Cosmos DB 延迟 < 15ms

**三段式输出协议**：
```
1. 执行宣告：[1 句话说改动]
2. 代码产出：[纯净代码块]
3. 核验终端命令：[1 行 Bash 命令]
```

---

### 11.8 系统集成双模式（物理闭环 vs 数字孪生）

**Mode A: 物理闭环模式（Physical Hardware Loop）**
```
Edge Simulator (MQTT) → IoT Hub → EventHubTrigger
  → Cosmos DB 状态持久化
  → 3-Agent Pipeline (obstacle < 15cm 时触发)
  → C2D REST API (HMAC-SHA256 SAS) → IoT Hub → 设备电机
```

**Mode B: 数字孪生模拟器模式（Digital Twin Control Plane）**
```
Dashboard (HTTP POST /simulate_agent)
  → 相同 3-Agent Pipeline
  → Cosmos DB 查询历史状态
  → 返回 pipeline_trace + final_action + cloud_metrics
  → 渲染视觉孪生 + 编排节点
```

**两种模式的延迟对比**（实测）：

| 部署方式 | 端到端延迟 | Cosmos DB | OpenAI 推理 |
|---------|-----------|-----------|-------------|
| 本地 (`func start`) | 3.5s ~ 4.5s | 50 ~ 150ms | 1.5 ~ 3.0s |
| 部署到 Azure Functions | 1.5s ~ 2.5s | 2 ~ 8ms | 1.2 ~ 2.2s |

差异原因：本地运行存在跨区域的网络往返（马来西亚本地 → 新加坡 Azure 数据中心），而部署后所有组件在同一数据中心内，并通过 Private Endpoint 直连。

---

### 11.9 24+ 架构蓝图目录

项目 `docs/reference/blueprints/` 包含 24+ 份 Azure 云架构最佳实践蓝图，覆盖企业级云架构师 80% 的日常工作领域：

| # | 领域 | 占比 | OmniGuard 现状 | 蓝图文件 |
|---|------|------|---------------|---------|
| 1 | **身份与访问 (IAM)** | ~15% | 部分实现（MI + KV） | `01-identity-foundation.md` |
| 2 | **网络与边界安全** | ~12% | 已就绪（VNet + PE + NSG） | `13-enterprise-networking-private-dns.md` |
| 3 | **API 管理与网关** | ~10% | 无 APIM，用 BFF 代理 | `02-api-management-gateway.md` |
| 4 | **可观测性** | ~10% | LA Workspace 已设 | `04-observability-platform.md` |
| 5 | **安全态势** | ~10% | 无 Defender/Sentinel | `03-security-posture.md` |
| 6 | **计算与容器化** | ~8% | ACA + Functions 已运行 | `05-compute-container-optimization.md` |
| 7 | **数据平台** | ~8% | Cosmos DB 已用 | `06-data-platform-deep-dive.md` |
| 8 | **事件驱动** | ~7% | IoT Hub → EventHub | `07-event-driven-integration.md` |
| 9 | **CI/CD & DevOps** | ~7% | scripts/ 脚本部署 | `08-cicd-devops-pipeline.md` |
| 10 | **成本 FinOps** | ~5% | 无 | `09-cost-finops.md` |
| 11 | **高可用 HA/DR** | ~5% | 单区域 Singapore | `10-ha-dr-business-continuity.md` |
| 12 | **合规与治理** | ~3% | 无 | `11-compliance-governance.md` |
| 13 | **IoT 零接触预配** | ~10% | DPS 已配置 | `14-iot-dps-zero-touch-provisioning.md` |
| 14 | **IaC 治理** | — | Bicep 三层模板 | `16-enterprise-iac-governance-plan.md` |

每个蓝图独立为 MD 文件，包含现状分析 → 架构设计 → 实施步骤 → Bicep 代码的完整链路。面试时可以引用这些蓝图展示**企业级架构思维**——不仅是完成功能，而是考虑身份基座、可观测性、成本优化、合规治理等完整维度。

---

### 11.10 外部代码质量审计发现

`FRONTEND_DASHBOARD_KINEMATIC_EVALUATION.md` 是一份外部评审报告，评估了前端的代码质量：

| 维度 | 评分 | 关键发现 |
|------|------|---------|
| **Kinematic 模块** | 8/10 | 共享物理内核干净，数学逻辑正确 |
| **Dashboard 模块** | 6/10 | 建议从 useRef + rAF 迁移到 XState 状态机 |
| **计划可行性** | 7/10 | 改进方向明确但需要时间投入 |

这对面试非常有用——展示你**知道自己的代码哪里不好**，以及**如何改进**，比只说优点更有说服力。

---

### 11.11 完整 34 份 ADR 索引（全部读完后的总结）

| 分类 | ADR 列表 | 关键决策 |
|------|---------|---------|
| **基础设施 (9)** | 002, 003, 004, 007, 022, 031, 032, 033, 034 | ACA 替换 Functions SKU、IoT Hub 长连接、影子 E2E、双轨身份、HTTP POST 降级 |
| **后端 (4)** | 005, 006, 024, 034 | 纯 ASGI 迁移、租户回退策略、沙盒 API、凭据统一 |
| **前端 (12)** | 008, 010-017, 025, 026, 027, 029 | Step-Based Detection、Fleet Sim v2、rAF 同步、Token Breakdown、Kinematic Sandbox、元数据泄露 |
| **架构 (9)** | 009, 018-021, 023, 028, 030, 032 | 共享物理内核、Generation Counter、双模式、黑暗仓库状态机、多 Agent 编排、IaC 配置器合规 |

---

## 12. 最终面试速查表

### 12.1 一句话描述这个项目

> "一个基于运动学-Token 定理的企业级云边协同安全编排器，通过 3-Agent LLM 流水线 + WebGPU 边缘推理 + Azure 零信任网络，证明并解决云端 AI 延迟超出 AGV 制动距离的安全死锁问题。"

### 12.2 核心技术堆栈（按面试优先级）

```
Tier 1 (必须讲清):
  ├── Azure 零信任网络 (VNet + Private Endpoints + NSG + Managed Identity)
  ├── 3-Agent LLM 流水线 (Router → Safety → Compiler) + Early Circuit-Breaking
  ├── 运动学-Token 定理 (形式化证明)
  └── 混合边缘-云端认知管线 (WebGPU Qwen2.5 + Azure OpenAI 语义路由)

Tier 2 (准备好):
  ├── Bicep 三层 IaC 架构 (订阅级 → 资源组级 → 容器级)
  ├── BFF 模式 (Next.js Catch-All Proxy)
  ├── Cosmos DB + IoT Hub 数据管道
  ├── 双模式 Dashboard (Sim vs Live)
  └── 影子 E2E 测试

Tier 3 (加分项):
  ├── 24+ 企业级 Azure 架构蓝图
  ├── Benchmark 评估 (200 场景 + Bootstrap CI)
  ├── 双轨制身份退避 (Dual-Track Identity)
  ├── KOL 投研分析 (X Scraper + AI Pipeline)
  ├── Launch Profiles (3 种部署模式)
  └── AGY 开发治理协议
```

### 12.3 5 个必须会答的陷阱题

**Q1: "这个项目是真实部署了吗？"**
**A**: 是的。Bicep 模板已经过 `az deployment sub validate` 验证，影子 E2E 测试套件自动创建完整的隔离基础设施（`omnitest` 前缀）、审计 Private DNS A 记录、ACA 容器健康状后，自愈销毁资源组。项目中包含实际测量延迟数据：本地 3.5-4.5s，部署到 Azure 后 1.5-2.5s。

**Q2: "VPC 对等和 Private Endpoint 有什么区别？"**
**A**: VPC Peering（VNet Peering）连接两个 VNet，让它们像同一网络通信；Private Endpoint 是给特定 PaaS 资源（Cosmos DB、Key Vault 等）分配一个 VNet 内的私有 IP，切断它的公网入口。本项目两者都用了：Hub-Spoke Peering 连接管理和工作负载 VNet，4 个 Private Endpoint 让数据面服务在 VNet 内网通信。

**Q3: "边缘推理的 60ms 是怎么测的？"**
**A**: 在消费级 GPU（MacBook Pro M系列 / NVIDIA GTX）上运行 Qwen2.5-0.5B Q4 量化模型，用 WebGPU 跑 1000 轮推理取中位数。路由器 Agent 仅需 ≤20 tokens 输出（分类标签），所以实际推理非常快。60ms 是实测中位数，40ms 最低，113ms 平均——全部远低于 AGV 的物理制动时间窗。

**Q4: "每秒处理的遥测事件量？"**
**A**: 目前使用 IoT Hub S1 标准（1 单元），支持每天 400,000 条消息，上限是 8 单元=3.2M/天。Cosmos DB 采用 Autoscale 400-4000 RU/s，每次遥测 upsert 约消耗 10 RU。如果扩大规模，瓶颈在 IoT Hub SKU 和 Cosmos 吞吐量，而不是应用程序。

**Q5: "Bicep 为什么不用参数文件里直接写 OpenAI Key？"**
**A**: Bicep 支持 `@secure()` 修饰参数防止日志泄露，但最佳实践是用 Key Vault。双轨制设计：企业环境 (`deployManagedIdentities: true`) 使用 Managed Identity + Key Vault 引用（`@Microsoft.KeyVault(SecretUri=...)`）；受限环境 (`deployManagedIdentities: false`) 通过 `@secure()` 参数传递到 App Settings 密文区。两种场景都不存在密钥明文落盘。

---

> **最后提醒**：这份文档不是为了背答案，而是帮助你建立对每个组件的**第一性原理理解**。面试官关心的不是你背下多少细节，而是你面对不确定问题时的架构思维过程。当你被问到"为什么用 X 而不用 Y"时，能够从约束条件出发推导出结论——那才是真正的架构能力。
