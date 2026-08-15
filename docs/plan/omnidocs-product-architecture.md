---
id: "DOC-PLAN-OMNIDOCS-PRODUCT-ARCHITECTURE-MD-01"
title: "omnidocs product architecture"
summary: "omnidocs product architecture — specification reference auto-profiled into the OmniDocs multi-perspective index. (plan/omnidocs-product-architecture.md)"
version: "1.0.0"
updated_at: "2026-08-15"
authors: ["Shengwei Liu"]
domains:
  - multi-agent
perspectives:
  - cloud-architecture
layers:
  - cross-cutting
doc_type: specification
status: draft
code_refs: []
test_refs: []
---
# OmniDocs Product Architecture — Data Contract as Core
# OmniDocs 产品架构 — 数据契约为核心

> **版本**: `v1.0.0`
> **对应 ADR**: [ADR-035](../../adrs/ADR-035-%5Barchitecture%5D-Data-Contract-First-Multi-System-Productization.md)
> **生效时间**: 2026-08-15

---

## 1. 一句话原则 (One-Sentence Principle)

> **manifest 是产品，前端是皮肤；npm 包 / Web Component / CLI 都是让皮肤进别人网站的三种方式。**

系统的最终可交付物是构建期生成的静态 JSON 契约（`docs-manifest.json` + `relation-graph.json`），
一切平台能力都以"消费这份契约"为边界。谁拿得到 JSON，谁就是用户。

---

## 2. 交付物全景 (Deliverable Map)

```
packages/
├── schema/            @omnidocs/schema    契约唯一事实源 (Zod + TS + CPV)      [零框架依赖]
├── indexer/           @omnidocs/indexer   构建期 CLI: 扫描/校验/生成 manifest   [纯 SSG]
├── ui/                @omnidocs/ui        React 组件库 (Viewer/Graph/Filter)   [react=peer]
├── elements/          @omnidocs/elements  Web Component 封装 (任何框架可嵌)     [Shadow DOM]
└── portal/            omnidocs-portal     参考型 Next.js App (独立部署示例)     [消费以上全部]
```

### 依赖方向 (严格单向)

```
portal ──→ ui ──→ schema
indexer ───────→ schema
elements ────→ ui (via wrapper) ──→ schema
```

**禁止反向引用**：`schema` 不得 import 任何包；`ui` 不得 import `indexer`/`portal`。
这是多系统协同演进不打架的前提。

---

## 3. 契约核心 (The Contract)

### 3.1 两层产物

| 产物 | 内容 | 消费方 |
|---|---|---|
| `docs-manifest.json` | 每篇文档的元数据 + 正文 + headings，全量索引 | portal / ui / 外部搜索系统 |
| `relation-graph.json` | 节点(文档) + 边(code_ref / test_ref / same_domain) 关系网络 | graph 可视化 / 知识图谱 |

### 3.2 契约版本 (CPV — Contract Package Version)

`@omnidocs/schema` 导出常量：

```ts
export const DOCS_CONTRACT_VERSION = '1.0.0';
```

- **breaking change**（字段改名/枚举增删/必填变更）→ `DOCS_CONTRACT_VERSION` major 递增 + 包 semver major 递增。
- 所有消费方锁自己的 schema 依赖，用 manifest 中的 `contractVersion` 做运行时兼容断言。

### 3.3 目录约定

- **内容源**: `docs/**/*.md`（git 仓库内）
- **构建产物**: `generated/docs/docs-manifest.json` + `relation-graph.json`（.gitignore 可选，但 portal 部署必须 CI 构建）
- 产物可通过 CDN / GitHub Pages / Azure SWA 静态托管，作为"内容分发面"。

---

## 4. 集成面矩阵 (Integration Surfaces)

| 集成方式 | 产物 | 适用场景 | 运行时成本 |
|---|---|---|---|
| npm 包 | `@omnidocs/ui` + manifest URL | 宿主本来就是 React | 无（静态） |
| **Web Component** | `@omnidocs/elements` `<omnidocs-viewer src>` | 宿主是 Vue / 原生 HTML / 门户页内嵌 | 无（静态） |
| iframe + postMessage | 整个 portal | 要完整功能 + SSO 接驳 | 一个 iframe |
| HTTP API | manifest 直连 CDN | 别的后端要搜索/内容接口 | 无（静态文件） |
| CLI | `npx @omnidocs/indexer build` | 内容作者侧离线出资产 | 构建期 |

> 设计约束：前三者的运行时成本都应趋近于零——因为产物全是静态 JSON + 静态 JS 组件。

---

## 5. 多系统协同机制 (How Multiple Products Cooperate)

1. **契约优于代码**：跨系统只共享 JSON 契约 + 类型包，不共享实现。
2. **依赖单向**：见第 2 节，杜绝循环依赖。
3. **Peer 依赖**：`@omnidocs/ui` 声明 `react`/`react-dom` 为 peerDependency
   —— 避免与宿主 React 版本冲突（多产品配合最常见的坑）。
4. **独立 semver**：schema 包 breaking change 走独立 major；manifest 带 `contractVersion` 运行时断言。
5. **发布清单**：CPV 升级时必须三方同步（schema 新版本 → indexer 生成带新版本的 manifest → 消费方锁新版本）。

---

## 6. 路由与页面规范 (Portal Routes)

| 路由 | 页面 | 核心功能 |
|---|---|---|
| `/docs` | 多维文档主枢纽 | 4 大视角切换、全域标签云、模糊搜索 |
| `/docs/perspective/[persona]` | 视角专用切片 | academic / cloud / frontend / audit 看板 |
| `/docs/viewer/[...slug]` | 统一内容渲染 | Markdown 渲染、代码高亮、LaTeX、代码追溯面板 |
| `/docs/graph` | 知识关系拓扑 | React Flow 网络图 |

---

## 7. 质量门禁 (Quality Gates)

```
make docs-build     # 触发 indexer 全量构建，失败即报错
make docs-lint      # schema 0 errors；frontmatter 100% 覆盖
make docs-test      # pytest tests/test_doc_system.py + schema 单测
```

门禁三要素：**Schema Lint**（Zod 必填与枚举）、**Dead-Link Check**（code_refs/test_refs 物理存在）、
**Perspective Gap**（确保 4 大视角覆盖度）。

---

## 8. 里程碑 (Milestones)

| 阶段 | 内容 | 产出 |
|---|---|---|
| M1 (本轮) | monorepo + schema + indexer 落地，跑通 build | `@omnidocs/schema`、`@omnidocs/indexer` 可用 |
| M2 | portal UI 组件库 + Next.js 门户，接入现有 docs/ | 独立部署的 docs.example.com |
| M3 | Web Component 封装 `@omnidocs/elements` | 非 React 宿主可内嵌 |
| M4 | CI/CD 门禁 + 版本发布自动化 | 产品化闭环 |

---

## 9. 演进守则 (Evolution Rules)

- **不要过早微服务化**：文档系统价值在"无运行时"，拆独立后端 = 反向优化。
- **Web Component 只在确认有非 React 消费方再重点投入**（M3 之前仅留接口占位）。
- **每次新增能力先问**："这份能力是契约的一部分、还是一种消费者？" 契约演进走 CPV，消费者演进独立发版。

---

## 10. 作品 vs 产品定位 (Portfolio vs Product)

> **决策依据**：OmniGuard 仓库同时承载两类形态不等价的资产。
> 本章明确二者边界，防止"业务功能被错误地产品化"。

### 10.1 两级分类

| | **作品 (Portfolio)** | **产品 (Product)** |
|---|---|---|
| 本质 | 证明"我能做什么" | 别人能用它"解决什么问题" |
| 评价标准 | 深度、品味、技术含量 | 可复制、可嵌入、可持续维护 |
| 用户 | 招聘官 / 客户 / 作者本人 | 外部开发者 / 使用者 |
| 成本结构 | 一次投入，展示即止 | 持续维护，版本迭代 |
| 例子 | 车队动力学仿真、投研分析仪、IaC 配置台、简历 | Content Interpreter、schema、indexer、interaction |

### 10.2 仓库内的归属

- **业务 Dashboard（作品层）**
  - `/dashboard`（车队动力学仿真）、`/prediction`（投研分析仪）、`/iac`（IaC 配置台）、`/resume`
  - 价值来自"作者在 Azure + AI + 具身智能领域做到过什么"，不来自代码复用。
- **文档系统（产品层）**
  - Content Interpreter + schema + indexer + interaction 包。
  - 是"关于软件的软件"——不解决具体业务，解决所有软件共有的问题（内容呈现 / 契约固化）。

### 10.3 关键关系：素材与机器

> **业务 Dashboard 是文档系统的第一批真实客户和最佳素材，不是要产品化的对象。**

- 车队仿真 ← ADR-025（Kinematic-Token 定理）；IaC 配置台 ← Bicep 蓝图；投研分析仪 ← 研究笔记。
- 这些业务研究**本来就以文档形式存在**，Content Interpreter 的下一个内容源（第二个 lexer / Blueprint）应取自它们。
- 结论：Dashboard 是"论点"，文档系统是"方法论"。方法论通用可反复讲，作品只证明一次。

### 10.4 处置原则

1. **Dashboard 保留为作品集，不业务化**——使其可被外人使用的成本极高且无人使用，且会稀释产品边界。
2. **Dashboard 的角色降级为"证据"**：演示方法论深度时引用它们。
3. **产品化的唯一候选是文档系统**：已具备契约优先（schema）、可嵌入（monorepo 包）、有方法论（解释器引擎）三要素。
4. **Dashboard 背后的文档成为产品素材**：为业务研究文档新增 lexer，让 Content Interpreter 消费——作品从"产品"变成"产品的内容源"。

> 一句话：**Dashboard 是"做过什么"的档案馆，文档系统是"会不会做"的证明。
> 前者留着当藏品，后者才是要去经营的公司。**