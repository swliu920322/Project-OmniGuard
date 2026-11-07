# Project OmniGuard

一个研究 AI Agent 应该放在运动机器控制回路中什么位置的云边协同安全实验平台。

OmniGuard 包含模拟 AGV 仪表盘、三级云端 Agent 流水线、Azure 基础设施模板和可追溯的 benchmark 结果。它是研究与工程验证项目，不是经过安全认证的实体机器人控制产品。

[English](README.md) · [系统架构](ARCHITECTURE.md) · [文档入口](docs/README.md) · [证据规则](docs/evidence/README.md) · [路由评测报告](eval/report.md) · [路由证据索引](eval/EVIDENCE_INDEX.md)

## 仓库包含什么

| 区域 | 作用 | 定位 |
|---|---|---|
| AGV Dashboard | 模拟纯云端、云+边缘、长 Token 控制回路 | 核心演示 |
| Embodied Brain | Router → Safety → Compiler，支持提前退出 | 核心研究实现 |
| Azure IaC | Bicep 模板和部署脚本 | 工程参考 |
| Benchmark Archive | 保存历史跑次、诊断跑次及局限 | 实验证据（历史背景） |
| 状态路由评测（`eval/`） | 六类规范、冻结合成测试集、真实模型运行、规则对照、压力用例 | 新路由的证据 |

本仓库明确区分已实现行为、模拟参数、实测结果和未来方案。引用数字前请先阅读[证据规则](docs/evidence/README.md)。

## 系统流程

```text
遥测数据 / 固定种子场景
          |
          v
      物理预检查
          |
          v
   Router Agent ------ 传感器异常 ------> stop
          |
          v
   Safety Agent ------ 策略阻断 --------> safety override
          |
          v
 Action Compiler -----------------------> 结构化动作
```

浏览器 Dashboard 是仿真；Python benchmark 会调用当前配置的 LLM provider；Azure 资源通过 IaC 描述，但代码仓库本身不能证明某套云环境此刻正在运行。

## 架构图

Azure 参考方案在 [docs/architecture](docs/architecture/README.md) 里有三张图：恢复的论文图 3.1（系统架构）和图 3.2（流水线时序），以及按 Bicep 快照绘制的拓扑图，并说明论文图和快照的差异。云环境为论文部署过一次，现已拆除。

## 状态路由及其评测

Router 阶段有一个可选的扩展形态，共 **6 类遥测状态路由**：`CRITICAL_OBSTACLE`、`OVERHEAT`、`LOW_HEALTH`、`LOW_BATTERY`、`OVERSPEED`、`NORMAL_NAV`，另可附带一条操作员备注（报告前方有人或障碍）。它是对模拟 AGV 的状态识别与处置路由，不是聊天式的意图识别。所有阈值、优先级和动作都是本仿真的实验约定，不是行业标准或现场数据（见[规范](eval/spec/LABEL_SPEC.md)）。

一次决策怎么做：代码先检查输入（缺失、越界或过长的输入直接 HALT，不会到达模型）；模型只返回一个严格的 JSON（路由和备注状态）；代码补上模型没点名的遥测风险，应用物理门控和独立的急停标志，合成**唯一**的动作（停车优先于任何移动，回充和限速变为后续待办）。模型回复不能解除代码识别出的遥测风险和急停限制；仅来自备注的风险仍可能因模型误判而漏停。无法使用的回复一律停车。

**新路由的适用范围。** 只有可选租户 `Tenant-Alpha-Extended`（`router_mode: extended`）在 HTTP 模拟端点里使用它；原来的租户、它们的提示词和 IoT Hub 旧路径都没有改动。`goal: CHARGER` 只是结构化目标，代码不检查车辆是否到达充电位。

### 每类证据证明什么

| 证据 | 证明什么 | 不证明什么 |
|---|---|---|
| 浏览器 Dashboard | 在配置参数下的时延与安全距离动态 | 任何实体机器人上的实测 |
| 真实模型 Router 评测（[报告](eval/report.md)） | 提示词 B-1.0 在 300 条冻结合成记录和 55 个压力用例上，对照规范里写明的规则 | 生产准确率、泛化能力、机器人安全 |
| 假依赖下的 HTTP 流程（`tests/test_extended_endpoint.py`） | 端点在 Safety 和 Compiler 之后仍保留评测的约束：输入检查、急停、动作契约、关闭重试 | 端点对真实模型的运行 |
| 规则对照 R1 / R2 | 固定关键词规则在同一批记录上的表现 | 优化版相对基线的提升 |

### 正式结果（标签 `eval-formal-v1`，冻结数据 `acceptance-v1`）

| | 结果 |
|---|---|
| 测试集 | 300 条独立合成记录，每类 50 条，来自 **34 个家族**（不是 300 个独立场景）；72 条带备注。标签为 AI 标注加 AI 复核，不是专家金标。输入保持私有，仓库只公开哈希和数量 |
| 基线 B-1.0，两次独立运行 | 每次 **300/300** 正确，macro-F1 为 1.0，备注状态各 72/72，无接口错误，两次一致率 100%。按记录计的 95% Wilson 区间 98.74%–100%（未按 34 个家族校正） |
| 同一批记录上的规则对照 | R1 281/300（macro-F1 0.936，漏停 14，误停 3），R2 280/300（0.935，漏停 10，误停 6）；备注状态 23/72 和 15/72 |
| 压力集 55 例 | 32 次请求发给模型，13 个非法输入在代码里拒绝，10 个注入故障离线验证；未观察到漏停、误停或模型错误 |
| 总用量 | 634 次 API 请求，630,792 token，按配置费率约 US$0.285（估算，不是账单） |

这些数字只描述这批合成数据在本规范下的表现：不是生产准确率，不是安全认证，也**不是提升**——没有制作优化版，所以不存在前后对比的数字。模型版本由所有者声明，未验证；请求带 `temperature=0`，但提供方的推理模式会忽略它。尚未完成：陌生人复现和所有者的口述验收。详见[局限](eval/LIMITATIONS.md)、[证据索引](eval/EVIDENCE_INDEX.md)和[复现说明](eval/REPRODUCE.md)。

## 历史 benchmark 证据（2026-07、2026-08，仅作背景）

这两个跑次早于状态路由工作：用的是原来的三类标签、不同的场景生成器，60 条跑次还缺模型名称，所以**它们不是上文结果的“前”，不能与之组成任何前后对比**。

| 跑次 | 场景数 | Router 准确率 | Critical 召回 | 提前退出率 | 端到端时延 |
|---|---:|---:|---:|---:|---|
| 2026-07-16 历史论文跑次 | 200 | 172 条可解析输出中 94.19% | 现有摘要无法恢复 | 39.5% | 均值 6.174 秒 |
| 2026-08-18 诊断跑次 | 60 | 52 条可解析输出中 90.38% | 旧 5–50 cm 标签口径下为 9/14；低于 30 cm 的 8 条全部识别并阻断 | 41.67% | 中位数 7.67 秒；均值 16.72 秒；最大 73.88 秒 |

两个跑次不能混用。60 条诊断跑次暴露了长尾时延，以及 31–46 cm 区间内的 5 个标签/策略口径分歧；这 5 条的 Compiler 最终都输出了 stop，不能写成 5 个危险动作被放行。该跑次也不能描述成已经完成的 200 场景 benchmark。详细来源和指标定义见 [benchmark results guide](src/cloud-orchestrator/embodied_brain/benchmark_results/README.md)。

## 目录结构

```text
.azure/                         Azure Bicep 模块和部署参数
scripts/                        部署、校验与本地启动脚本
src/client-edge/                Next.js 前端和浏览器实验
src/cloud-orchestrator/         FastAPI/Azure Functions 后端与 Agent 流水线
src/cloud-orchestrator/
  embodied_brain/               AGV Agent、场景协议与 benchmark 证据
  router_v2/                    扩展的六类路由决策（可选租户）
eval/                           规范、数据集、运行器、正式结果与证据索引
tests/                          单元、契约、benchmark 与影子环境测试
docs/                           当前文档与历史归档
```

## 本地运行

前置条件：Python 3.10+、Node.js 20+；使用 Functions Host 时还需要 Azure Functions Core Tools。

在两个终端分别运行：

```bash
make start-backend
make start-frontend
```

常用检查：

```bash
make test
make docs-test
```

Azure 操作见 [docs/operations.md](docs/operations.md)。执行部署或销毁前必须检查订阅和参数。

## 页面路由

| 路由 | 作用 | 数据来源 |
|---|---|---|
| `/dashboard` | 三 AGV 仿真 | 浏览器模拟 |
| `/dashboard/theorem` | 单 AGV 时延/安全距离沙盒 | 浏览器模拟 |
| `/dashboard/compare` | 云端与边缘并排比较 | 浏览器模拟 |
| `/dashboard/live` | 后端可用时发起真实请求 | 取决于运行环境 |

## 文档规则

- [docs/README.md](docs/README.md) 是唯一文档入口。
- [ARCHITECTURE.md](ARCHITECTURE.md) 只描述当前系统和边界。
- [docs/evidence/README.md](docs/evidence/README.md) 管理实测、模拟、配置和计划类结论。
- [docs/adrs/INDEX.md](docs/adrs/INDEX.md) 记录架构决策。

## 已知限制

- AGV 为模拟对象，没有控制实体机器人。
- LLM 结果受 provider、模型、区域和运行条件影响。
- 历史 200 跑次没有保存现代安全分析所需的全部指标。
- 60 跑次没有可靠记录模型名称。
- WebGPU 和刹车时延演示不构成安全认证证据。
- 状态路由的结果来自按项目自己的规范编写的合成数据，300 条记录属于 34 个家族；不是生产准确率，模型版本未验证。
- 新路由还没有通过 HTTP 端点对真实模型运行；第三方复现需要私有测试数据（见[复现说明](eval/REPRODUCE.md)）。

## License

[MIT](LICENSE)
