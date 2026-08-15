---
id: "DOC-ADR-035"
title: "Data Contract First Multi System Productization"
summary: "Data Contract First Multi System Productization — auto-generated summary. (docs/adrs/ADR-035-[architecture]-Data-Contract-First-Multi-System-Productization.md)"
version: "1.0.0"
updated_at: "2026-08-15"
authors: ["Shengwei Liu"]
domains:
  - multi-agent
perspectives:
  - cloud-architecture
  - frontend-engineering
layers:
  - cross-cutting
doc_type: adr
status: accepted
code_refs: []
test_refs: []
---
# Architectural Decision Record (ADR 035)
# 架构决策记录 (ADR 035)

## Title / 标题

Data-Contract-First Multi-System Productization for the AI-Native Doc System
AI 原生文档系统的数据契约优先多系统产品化

## Status / 状态

**Approved / 已批准**

## Context / 背景

(EN) Project-OmniGuard's AI-native documentation system (see `docs/AI_NATIVE_DOC_SYSTEM_MASTER_PLAN.md`) was designed as an internal feature of the `client-edge` frontend. The system must now be productized: it should be independently deployable (standalone portal) while remaining embeddable into other consumer products. Two naive options were rejected as mutually exclusive framings: "make it a standalone app only" (hard to embed, no code-level integration) vs "make it an npm package only" (no standalone deploy, no decoupled infrastructure).

(CN) Project-OmniGuard 的 AI 原生文档系统（见 `docs/AI_NATIVE_DOC_SYSTEM_MASTER_PLAN.md`）最初仅作为 `client-edge` 前端的内部功能设计。当前产品化诉求是：既能独立部署（独立门户），又能被其他消费方产品嵌入使用。"独立 App 或 npm 包"的二元选项均无法单独满足诉求，被否决。

## Decision Drivers / 决策驱动因素

(EN)
- Standalone deployability: docs.example.com must run with zero runtime backend (pure SSG).
- Embeddability: third-party products (React apps, Vue apps, plain HTML host) must be able to render docs inside their own UI.
- Content authors ship markdown + frontmatter; consumers must not re-implement parsing/validation.
- Co-evolution of schema, engine, UI, and reference portal must be safe and versionable.
- Minimal moving parts: the doc system offers no runtime value from microservices; serverless complexity is rejected.

(CN)
- 独立部署：docs.example.com 必须可以零运行时后端（纯 SSG）运行。
- 可嵌入：第三方产品（React / Vue / 原生 HTML 宿主）需能在其自有 UI 内渲染文档。
- 内容作者只产出 markdown + frontmatter，消费方不得重复实现解析与校验。
- schema / engine / UI / 参考门户必须安全协同演进且可版本化。
- 最小复杂度：文档系统不具备微服务化的运行时收益，serverless 化被明确否决。

## Decision / 决策

(EN) Adopt a **data-contract-first** architecture. The core integration unit is the generated static JSON contract (`docs-manifest.json` + `relation-graph.json`), not the application. Around this contract, the system is decomposed into independently versioned deliverable packages managed in a single monorepo (`npm workspaces`):

- `@omnidocs/schema` — Zod schemas, TS types, and contract version constant (CPV). Zero framework dependency. **This is the contract source of truth.**
- `@omnidocs/indexer` — build-time CLI: scans markdown, validates frontmatter against schema, enforces dead-reference prevention (code_refs/test_refs physical existence), emits the manifest + relation graph. Pure build-time/SSG, no runtime.
- `@omnidocs/ui` — React component library (Viewer / KnowledgeGraph / MultiDimensionalFilter / DocCard / CodeTraceabilityPanel / PerspectiveSelector). `react` is a peerDependency.
- `@omnidocs/elements` — Web Component wrapper around the Viewer (Shadow DOM + CSS variables) for framework-agnostic embedding.
- `omnidocs-portal` — reference Next.js app (standalone deployed, consumes schema + ui + indexer output). Also the canonical usage example.

Integration surfaces are explicit and layered: npm package (same-framework), Web Component (any framework), CDN-hosted static JSON (any consumer via HTTP), CLI (author-side assets). The manifest format is versioned via `DOCS_CONTRACT_VERSION` so all packages coordinate upgrades. Dependency direction is strictly one-way: `portal → ui → schema`, `indexer → schema`. No reverse imports.

(CN) 采用**数据契约优先**架构。系统的核心集成单元是生成的静态 JSON 契约（`docs-manifest.json` + `relation-graph.json`），而非应用本身。围绕该契约，系统在单一 monorepo（`npm workspaces`）中拆分为独立版本化的交付物包：

- `@omnidocs/schema` — Zod schema、TS 类型与契约版本常量（CPV）。零框架依赖。**这是契约的唯一事实源。**
- `@omnidocs/indexer` — 构建期 CLI：扫描 markdown、按 schema 校验 frontmatter、强制死链预防（code_refs/test_refs 物理存在性）、产出 manifest 与关系图谱。纯构建期/SSG，无运行时。
- `@omnidocs/ui` — React 组件库（Viewer / KnowledgeGraph / MultiDimensionalFilter / DocCard / CodeTraceabilityPanel / PerspectiveSelector）。`react` 声明为 peerDependency。
- `@omnidocs/elements` — 围绕 Viewer 的 Web Component 封装（Shadow DOM + CSS 变量），用于无框架依赖的嵌入。
- `omnidocs-portal` — 参考型 Next.js 应用（独立部署，消费 schema + ui + indexer 产物），同时也是标准用法示例。

集成面显式分层：npm 包（同框架）、Web Component（任意框架）、CDN 静态 JSON（任意消费方走 HTTP）、CLI（内容作者侧静态资产）。manifest 格式通过 `DOCS_CONTRACT_VERSION` 版本化，使所有包协同升级。依赖方向严格单向：`portal → ui → schema`、`indexer → schema`，禁止反向引用。

## Consequences / 后果

(EN)
- **Positive / 正向**:
  - Manifest doubles as product and integration contract; any consumer can adopt independently.
  - Pure SSG keeps zero runtime; embedding costs the host nothing beyond static assets.
  - Versioned contract enables safe parallel evolution of packages.
  - Web Component layer unlocks non-React hosts without forking the product.
- **Negative / 负向**:
  - Initial monorepo + publish tooling overhead (workspaces, peer deps, CPV discipline).
  - The web-component wrapper is only cost-effective once a non-React consumer is confirmed; it must not be built speculatively too early.
  - Contract version bumps require coordinated manifests — a release checklist is mandatory.
- (CN) 正向：manifest 同时是产品与集成契约，任何消费方均可独立接入；纯 SSG 零运行时，嵌入方仅承担静态资产成本；版本化契约保证各包安全并行演进；Web Component 层让非 React 宿主无需 fork。负向：初始 monorepo 与发布工具有额外开销（workspaces、peer deps、CPV 纪律）；web-component 封装仅在确认存在非 React 消费方后才值得构建，不应过早投机；契约版本升级需协调 manifest，必须配套发布清单。