# Project OmniGuard

一个研究 AI Agent 应该放在运动机器控制回路中什么位置的云边协同安全实验平台。

OmniGuard 包含模拟 AGV 仪表盘、三级云端 Agent 流水线、Azure 基础设施模板和可追溯的 benchmark 结果。它是研究与工程验证项目，不是经过安全认证的实体机器人控制产品。

[English](README.md) · [系统架构](ARCHITECTURE.md) · [文档入口](docs/README.md) · [证据索引](docs/evidence/README.md)

## 仓库包含什么

| 区域 | 作用 | 定位 |
|---|---|---|
| AGV Dashboard | 模拟纯云端、云+边缘、长 Token 控制回路 | 核心演示 |
| Embodied Brain | Router → Safety → Compiler，支持提前退出 | 核心研究实现 |
| Azure IaC | Bicep 模板和部署脚本 | 工程参考 |
| Benchmark Archive | 保存历史跑次、诊断跑次及局限 | 实验证据 |
| Prediction、Interpreter、OmniDocs | 共用仓库的独立产品实验 | Labs，不作为 OmniGuard 核心结论 |

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

## 当前 benchmark 证据

| 跑次 | 场景数 | Router 准确率 | Critical 召回 | 提前退出率 | 端到端时延 |
|---|---:|---:|---:|---:|---|
| 2026-07-16 历史论文跑次 | 200 | 172 条可解析输出中 94.19% | 现有摘要无法恢复 | 39.5% | 均值 6.174 秒 |
| 2026-08-18 诊断跑次 | 60 | 52 条可解析输出中 90.38% | 9/14，64.29% | 41.67% | 中位数 7.67 秒；均值 16.72 秒；最大 73.88 秒 |

两个跑次不能混用。60 条诊断跑次暴露了长尾时延和 5 个 critical 漏判，不能描述成已经完成的 200 场景 benchmark。详细来源和指标定义见 [benchmark results guide](src/cloud-orchestrator/embodied_brain/benchmark_results/README.md)。

## 目录结构

```text
.azure/                         Azure Bicep 模块和部署参数
scripts/                        部署、校验与本地启动脚本
src/client-edge/                Next.js 前端和浏览器实验
src/cloud-orchestrator/         FastAPI/Azure Functions 后端与 Agent 流水线
src/cloud-orchestrator/
  embodied_brain/               AGV Agent、场景协议与 benchmark 证据
packages/                       OmniDocs/Interpreter 实验包
standalone/                     独立演示
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
| `/iac`、`/iac/configurator` | IaC 拓扑和配置工具 | 仓库模板 |
| `/prediction` | KOL/供应链实验 | Labs 数据管线 |
| `/interpreter` | 内容解释实验 | Labs 包 |

## 文档规则

- [docs/README.md](docs/README.md) 是唯一文档入口。
- [ARCHITECTURE.md](ARCHITECTURE.md) 只描述当前系统和边界。
- [docs/evidence/README.md](docs/evidence/README.md) 管理实测、模拟、配置和计划类结论。
- [docs/adrs/INDEX.md](docs/adrs/INDEX.md) 记录架构决策。
- `docs/archive/` 保存旧计划、审查、面试稿和 prompt；归档文件不是当前规范。

## 已知限制

- AGV 为模拟对象，没有控制实体机器人。
- LLM 结果受 provider、模型、区域和运行条件影响。
- 历史 200 跑次没有保存现代安全分析所需的全部指标。
- 60 跑次没有可靠记录模型名称。
- WebGPU 和刹车时延演示不构成安全认证证据。

## License

[MIT](LICENSE)
