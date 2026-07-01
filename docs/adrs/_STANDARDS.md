# ADR Classification & Document Standards

> 本文档定义哪些内容应归档为 ADR、如何分类，以及项目文档的目录结构规范。
> This file defines what belongs in an ADR, how to tag it, and the project-wide document directory standards.

---

## 1. ADR 入选标准 / What Makes an ADR

一份文档应当成为 ADR（放入 `docs/adrs/`）当且仅当它记录了一个**已经执行或已批准的架构决策**。判断标准：

| 是 ADR（归档到 adrs/） | 不是 ADR（放在别处） |
|---|---|
| 记录了一个确定的选择（"我们选了 X，不选 Y"） | 记录了正在考虑的多个选项（这是研究/规划） |
| 包含 Context → Decision → Consequences 结构 | 主要是操作步骤或教程 |
| 决策对系统架构有持久影响 | 纯 UI 微调或一次性脚本说明 |
| 决策已落地或被正式批准 | 草稿、 brainstorm、待讨论方案 |

### 常见非 ADR 文档的正确去处

| 文档类型 | 应放入 |
|---|---|
| 操作步骤、部署指南 | `docs/tutorials/` |
| 阶段规划、路线图 | `docs/plan/` |
| 竞品分析、技术调研 | `docs/plan/` (标记为 research) |
| 代码重构设计思路 | `docs/plan/` |
| 审计报告、第三方评估 | `docs/audits/` |
| 概念解释、公式推导 | `docs/archive/` (路由失效后) |
| NLP / Engineering 成长日志 | `docs/logs/` |

---

## 2. Tag 分类规则 / Tag Assignment

每个 ADR 必须有且仅有一个 **Primary Tag**（在文件名中）。如果一个决策涉及多个域，在 INDEX.md 中标注 "also [tag]"。

| Tag | 文件名前缀 | 何时使用 |
|---|---|---|
| `[infra]` | 云基础设施 | SKU 选型、网络拓扑（VNet/Subnet/Private Endpoint）、部署策略（SWA/ACA/Functions）、成本决策、区域选择 |
| `[backend]` | 后端架构 | API 设计（REST/ASGI/routing）、数据持久化（Cosmos DB/Storage）、事件驱动（Event Hub/IoT Hub）、认证与授权、后端框架选择 |
| `[frontend]` | 前端架构 | 状态管理（React state/ref/context）、组件拆分、动画引擎（rAF/step-based）、路由设计、UI 架构模式（dumb terminal）、样式方案 |
| `[ai]` | AI 架构 | 模型选型（GPT-4/5-mini）、Agent 编排策略、Token 优化、推理管线设计、Prompt 架构 |
| `[architecture]` | 跨域架构 | 涉及多个层的抽象设计（如 shared kernel、generation counter、dual-mode）、模块边界划分、系统级架构权衡、设计模式选择 |

### Tag 选择决策树

```
这个决策主要影响哪个层？
├── 云资源/SKU/网络/成本 → [infra]
├── 后端 API/数据/事件 → [backend]
├── 前端 UI/状态/动画 → [frontend]
├── 模型选型/Agent/Token → [ai]
├── 跨多个层 → [architecture]
└── 不确定 → [architecture]（宁可泛，不可错）
```

---

## 3. ADR 文件命名规范 / File Naming

```
ADR-NNN-[tag]-Short-Kebab-Case-Description.md
```

- `NNN`: 三位数，全局递增（不可重复使用已删除的编号）
- `[tag]`: 小写，`infra`/`backend`/`frontend`/`ai`/`architecture`
- `Short-Kebab-Case`: 英文，30-60 字符，无 `&`、`/` 等特殊字符

示例：
```
ADR-016-[frontend]-Ref-Based-Physics-vs-React-State-Separation.md
ADR-022-[infra]-ACA-IaC-Topology-Refactoring.md
```

---

## 4. ADR 内容模板 / Content Template

每个 ADR 应包含以下双语结构：

```markdown
# Architectural Decision Record (ADR NNN)
# 架构决策记录 (ADR NNN)

## Title / 标题
（一行英文标题 / 一行中文标题）

## Status / 状态
**Approved / 已批准**

## Context / 背景
（EN 段落描述问题背景）
（CN 段落翻译）

## Decision Drivers / 决策驱动因素
（EN bullet list）
（CN bullet list）

## Decision / 决策
（EN 描述最终选择及理由）
（CN 翻译）

## Consequences / 后果
- **Positive / 正向**: ...
- **Negative / 负向**: ...
- （CN 翻译）
```

---

## 5. 文档生命周期 / Document Lifecycle

```
[Active 活跃] → [Superseded 被取代] → [Archived 归档]
```

- **Active**: 仍在使用的文档。留在原目录。
- **Superseded**: 被新版本明确取代的文档。标记为 superseded 或移入 `docs/archive/`。
- **Archived**: 路由已删除或内容完全过时。移入 `docs/archive/` 并保留原路径结构。

### 归档规则

| 情况 | 动作 |
|---|---|
| 一个规划文档被新版本明确取代（如 v1 → v2） | 旧版 → `docs/archive/plan/` |
| 一个路由被删除，相关教程失效 | 教程 → `docs/archive/`（同名子目录） |
| Blueprint 转为正式 ADR | 删除原 Blueprint，ADR 放入 `docs/adrs/` |
| 一份文档合并入另一份 | 保留入口文件 + 重定向注释 |

---

## 6. INDEX.md 维护规则 / Index Maintenance

`docs/adrs/INDEX.md` 是所有 ADR 的唯一入口点。新增 ADR 后必须同时更新 INDEX.md：

1. 将新 ADR 加入对应 Tag 分类的表格
2. 按编号升序排列
3. 链接使用 URL 编码（`[` → `%5B`, `]` → `%5D`）
4. 跨域 ADR 在主 tag 表格中添加 `— also [tag]` 标注

---

## 7. 目录结构全景 / Directory Map

```
docs/
├── adrs/              # 架构决策记录（含 INDEX.md + _STANDARDS.md）
│   ├── INDEX.md       # 按 tag 分类的索引
│   ├── _STANDARDS.md  # 本文档
│   └── ADR-NNN-*.md   # 具体 ADR
├── plan/              # 规划、路线图、设计思路
├── tutorials/         # 操作指南
├── audits/            # 审计报告
├── logs/              # 成长日志
├── reference/         # 参考指南（系统工程文档）
│   └── blueprints/    # 留存的工程图纸（非 ADR 类）
├── dashboard/         # Dashboard 专项文档
└── archive/           # 过时文件（保留原目录结构）
```

---

> **Last updated**: 2026-07-02
> **Maintainer**: 在新增或归档 ADR 后更新本文档中的编号/规则。
