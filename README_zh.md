# Project-OmniGuard

**云边协同安全编排器 · 零信任容器化沙盘 · 运动学-Token 定理验证平台**

[![Azure Container Apps](https://img.shields.io/badge/Azure-Container%20Apps-0078D4.svg?style=flat-square&logo=microsoftazure)](https://azure.microsoft.com/en-us/products/container-apps/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100-009688.svg?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Azure IoT Hub](https://img.shields.io/badge/Azure-IoT%20Hub-0078D4.svg?style=flat-square&logo=microsoftazure)](https://azure.microsoft.com/en-us/products/iot-hub/)
[![WebGPU](https://img.shields.io/badge/WebGPU-边缘AI-764ABC.svg?style=flat-square)](https://www.w3.org/TR/webgpu/)
[![ADRs](https://img.shields.io/badge/ADRs-33%20项决策-green.svg?style=flat-square)]()
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

**Project-OmniGuard** 是一个企业级云边协同安全决策平台。项目提出并验证了一个核心研究命题——**运动学-Token 定理**：在具身智能 AGV 机队实时控制场景中，纯云端大模型推理延迟必然造成物理安全死锁。平台通过 **零信任网络隔离**、**多智能体 AI 编排（含早期熔断短路）** 和 **WebGPU 边缘推理** 三层防线，证明并解决了这一安全问题。

> **研究贡献：** 形式化证明云端大模型响应时间 ($T_{cloud} = T_{network} + T_{prompt} + T_{generation}$) 超出 AGV 运营速度下的运动学制动距离，必须引入混合边缘-云端认知管线。

---

## 🌟 九大核心技术亮点

### 1. 零信任网络安全纵深

| 层级 | 实现方式 | 工程证据 |
|:-----|:---------|:---------|
| **API 网关防线** | Next.js App Router 捕获性路由代理后端请求，消除 CORS 并混淆私有路径 | BFF 模式 |
| **后端物理隐身** | FastAPI 容器设为 VNet 内网独占 (`external: false`)，对公网完全不可见 | `compute-module.bicep` |
| **私网端点合拢** | Cosmos DB、Key Vault、Azure Storage、Azure OpenAI 共 4 个独立 Private Endpoint，切断公网 | `nested-infra.bicep` |
| **托管身份（无密码）** | User-Assigned Managed Identity + Key Vault RBAC + Cosmos DB 角色分配 | 零硬编码凭据 |
| **NSG 双向微分段** | Deny Internet Inbound + Allow Backend Only to Storage Subnet | `network-rules.json` |
| **Hub-Spoke 网络拓扑** | 订阅级 Bicep 部署，计算/存储/IoT 子网物理隔离 | 三层模块化 IaC |

### 2. 多智能体 AI 编排引擎（三级流水线 + 早期熔断）

```
IoT 遥测数据
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 物理短路层                                               │
│   HP ≤ 0 → offline_lock         (跳过全部 Agent)        │
│   Battery < 5% → emergency_halt (跳过全部 Agent)        │
└─────────────┬───────────────────────────────────────────┘
              ▼
    ┌─────────────────┐
    │ Agent 1: 路由器   │ ─── 意图分类 (≤20 tokens)
    └────────┬────────┘
             │ SENSOR_ERROR? → 立即 STOP
             ▼
    ┌─────────────────┐
    │ Agent 2: 安全防火墙│ ─── 合规审计 (≤50 tokens)
    └────────┬────────┘
             │ BLOCK? → 安全覆盖
             ▼
    ┌─────────────────┐
    │ Agent 3: 动作编译器│ ─── 生成 JSON 动作序列 (≤100 tokens)
    └────────┬────────┘
             ▼
    C2D 消息 → 设备电机
```

- **多租户场景注册表**：按租户自定义 Agent 提示词、安全规则和动作 Schema
- **数字孪生持久化**：每次遥测事件高频 Upsert 到 Cosmos DB（按 `tenant_id` 分区）
- **逐 Agent 延迟追踪**：`agent_1_latency_ms`、`agent_2_latency_ms`、`agent_3_latency_ms` + Cosmos R/W 延迟

### 3. IoT 全双工数据管线

- **上行链路**：IoT Hub → Event Hub 兼容端点 → Functions EventHubTrigger → Agent 流水线
- **下行链路**：Agent 流水线 → HMAC-SHA256 SAS Token 手签 → C2D 消息 → 设备电机
- **设备模拟器**：Python 边缘设备 Mock（`edge-simulator/`），支持本地全链路联调

### 4. 运动学-Token 定理（研究贡献）

Fleet Dashboard 四模态交互式验证：

| 仪表盘路由 | 验证目标 | 后端依赖 |
|:-----------|:---------|:---------|
| `/dashboard/theorem` | 单 AGV 运动学定理沙盒 | 无（纯前端物理引擎） |
| `/dashboard/compare` | 云端 vs 边缘并排对照 | 无 |
| `/dashboard` | 三 AGV 机队仿真（纯云 / 云+边缘 / Token 分解） | 无 |
| `/dashboard/live` | 接入真实 Azure OpenAI 延迟的生产验证 | Azure Functions + Cosmos DB |

### 5. 混合边缘-云端认知管线（WebGPU）

| 管线 | 技术栈 | 服务端算力成本 | 场景 |
|:-----|:-------|:-------------|:-----|
| **边缘管线 A** | WebGPU + Qwen2.5-0.5B + Xenova/MiniLM-L6-v2 | **$0.00** | 高频寒暄、本地 RAG |
| **云端管线 B** | Azure OpenAI（SSE 流式）经 VNet 内网 FastAPI | 按 Token 计费 | 超出本地知识边界的复杂查询 |

语义路由器通过 **余弦相似度**（阈值 ≥ 0.72）判断查询是否可本地解算，不达标则无缝滑向新加坡云端。

### 6. IaC 可视化配置器与场景编译器

- 可视化配置 VNet CIDR、SKU 定价、托管身份、部署区域
- 从场景预设（`sandbox` / `secure-iot`）动态组装 Bicep 模板
- 交互式 Bicep 拓扑依赖图，支持模块级下钻导航
- 导出可下载的 IaC 部署包（`.zip`）
- Bicep 预检编译 + Azure 云端预飞行校验（`az deployment sub validate`）
- 自动备份轮转（最多 5 份，场景感知命名）

### 7. 影子环境 E2E 测试套件

自愈式端到端测试，验证**整个零信任基础设施**：

1. **部署**：在影子资源组拉起完整基础设施（前缀 `omnitest`）
2. **审计**：校验 Private DNS A 记录指向正确子网 IP (`10.1.2.x`)、ACA 容器健康状态
3. **自愈**：自动销毁影子资源组 + 清理临时参数文件
4. **中断安全**：Ctrl+C 信号处理，确保资源不泄露

### 8. KOL 投研预测与供应链情报

- Twitter/X 大 V 推文翻页采集 + AI 批量双语翻译
- 供应链瓶颈分析、信念观察清单、价值链映射
- 可配置时间窗口的热点话题、行业分布与推文时间线可视化

### 9. 数字人 AI 助手

- **路由感知系统提示**：根据用户当前页面动态切换大模型人格
- **SAS 认证私有资产**：60 秒过期的短时令牌签发
- **SSE 流式响应**：`X-Accel-Buffering: no` 零延迟推送

---

## 📁 仓库源码结构

```text
├── .azure/                         # 基础设施即代码 (IaC)
│   ├── main.bicep                  # 订阅级部署指挥官
│   ├── nested-infra.bicep          # VNet + Private Link + NSG + Key Vault + 托管身份
│   ├── compute-module.bicep        # 前后端容器与日志分析
│   └── templates/                  # 场景预设 Bicep 模板库
├── scripts/                        # 自动化运维工具箱 (10 个脚本)
├── src/
│   ├── client-edge/                # Next.js 14 前端 (App Router)
│   │   └── src/app/
│   │       ├── dashboard/          # 机队仿真与遥测仪表盘 (4 模态)
│   │       ├── prediction/         # KOL 供应链情报控制台
│   │       ├── iac/                # IaC 拓扑查看器与配置台
│   │       └── api/[...path]/      # 捕获性 API 网关代理 (BFF)
│   └── cloud-orchestrator/         # FastAPI 后端 (Azure Functions ASGI)
│       ├── embodied_brain/         # 多智能体编排引擎
│       ├── digitalhuman/           # 上下文感知流式路由器
│       ├── kol_analysis/           # KOL 投研分析 API
│       └── edge-simulator/         # IoT 设备 Mock
├── tests/                          # 影子环境 E2E 测试 (287 行，自愈)
├── docs/                           # Diátaxis 规范文档库
│   └── adrs/                       # 33 份架构决策记录
└── Makefile                        # 统一命令总线 (12 个目标)
```

---

## 🛠️ 快速上手

```bash
# 终端 1：启动后端 (Azure Functions, 端口 7071)
make start-backend

# 终端 2：启动前端 (Next.js, 端口 3000)
make start-frontend
```

### 部署指令

```bash
make whatif         # 预检基础设施变更 (干跑)
make provision      # 幂等部署 Azure 基础设施
make deploy-aca     # 零缓存编译 → ACR 推送 → ACA 滚动更新
python tests/shadow-e2e-test.py  # 影子 E2E 测试 (部署→审计→自愈销毁)
```

---

## 📊 项目数据

| 指标 | 数值 |
|:-----|:-----|
| 前端组件 | 30+ TSX 文件，约 3,500 行 |
| 后端模块 | 10 文件，约 800 行 |
| IaC 模板 | 3 Bicep 文件，约 560 行 |
| 自动化脚本 | 10 脚本，约 1,200 行 |
| E2E 测试 | 287 行（自愈式） |
| 架构决策记录 | **33 份 ADR** |
| 作者 Azure 认证 | 5 项 (AZ-305, AZ-104, AI-102, SC-300, AB-100) |
| 估算总代码量 | **6,300+ 行** |

---

## 📚 延伸阅读

- 📐 [系统架构设计蓝图](docs/reference/) — 机队路由与云端验证设计图纸
- 📖 [Fleet Dashboard 完整参考](docs/dashboard/00-overview.md) — 626 行详细参考文档
- 🎤 [仪表盘演示脚本](docs/dashboard/presentation-script.md) — 现场演示引导词
- 🗺️ [项目企业级演进路线图](docs/PROJECT_EVOLUTION_ROADMAP_20260706.md) — 深度审计与演进规划
- 📋 [ADR 索引](docs/adrs/INDEX.md) — 全部 33 份架构决策记录

---

## 📜 License

[MIT License](LICENSE) — 刘圣伟
