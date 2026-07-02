# Architecture Decision Records

> Project OmniGuard 的架构决策记录，按**关注域（Tag）**分类，方便不同角色的读者快速定位相关决策。
> Architecture decisions tagged by concern domain — jump to what matters to you.

---

## Tag Key

| Tag | 读者 Audience | 关注域 Focus |
|---|---|---|
| `[infra]` | ☁️ 云架构师 Cloud Architect | SKU、网络拓扑、部署策略、成本 |
| `[backend]` | ⚙️ 后端工程师 Backend Engineer | API 设计、数据持久化、事件驱动、认证 |
| `[frontend]` | 🎨 前端工程师 Frontend Engineer | 状态管理、UI 架构、动画引擎、路由 |
| `[ai]` | 🤖 AI 架构师 AI Architect | 模型选型、Agent 编排、Token 优化、推理管线 |
| `[architecture]` | 🏗️ 系统架构师 System Architect | 跨域抽象、模块边界、架构权衡 |

---

### ☁️ Cloud Infrastructure `[infra]`

| # | 决策 Decision | 状态 |
|---|---|---|
| 002 | [SWA Control Plane Cross-Region Routing & BYO AI Asset Integration](./ADR-002-%5Binfra%5D-SWA-Control-Plane-Cross-Region-Routing.md) | ✅ |
| 003 | [Serverless SKU Migration](./ADR-003-%5Binfra%5D-Serverless-SKU-Migration.md) | ✅ |
| 004 | [Standard SKU Pivot](./ADR-004-%5Binfra%5D-Standard-SKU-Pivot.md) | ✅ |
| 007 | [IoT Hub Long-Lived Connection and Event Hub Trigger](./ADR-007-%5Binfra%5D-IoT-Hub-Long-Lived-Connection.md) | ✅ |
| 022 | [ACA IaC Topology Refactoring](./ADR-022-%5Binfra%5D-ACA-IaC-Topology-Refactoring.md) | ✅ |
| 031 | [Shadow Environment E2E Test Suite — Isolated Deployment & Self-Healing Teardown](./ADR-031-%5Binfra%5D-Shadow-E2E-Test-Suite.md) | ✅ |

### ⚙️ Backend `[backend]`

| # | 决策 Decision | 状态 |
|---|---|---|
| 005 | [Migration to Pure ASGI](./ADR-005-%5Bbackend%5D-Migration-to-Pure-ASGI.md) | ✅ |
| 006 | [Tenant Policy Fallback via Connection String](./ADR-006-%5Bbackend%5D-Tenant-Fallback-Strategy.md) | ✅ |
| 024 | [Dynamic Orchestration Sandbox API](./ADR-024-%5Bbackend%5D-Dynamic-Orchestration-Sandbox-API.md) | ✅ |

### 🎨 Frontend `[frontend]`

| # | 决策 Decision | 状态 |
|---|---|---|
| 008 | [Unified Step-Based Detection Loop](./ADR-008-%5Bfrontend%5D-Unified-Step-Based-Detection-Loop.md) | ✅ |
| 010 | [Dashboard v2 — Fleet Simulation](./ADR-010-%5Bfrontend%5D-Dashboard-v2-Fleet-Simulation.md) | ✅ |
| 011 | [LLM Token Breakdown Live Control](./ADR-011-%5Bfrontend%5D-LLM-Token-Breakdown-Live-Control.md) — also `[ai]` | ✅ |
| 012 | [Pause / Resume AccumS Preservation](./ADR-012-%5Bfrontend%5D-Pause-Resume-AccumS-Preservation.md) | ✅ |
| 013 | [Route Restructuring Under /dashboard](./ADR-013-%5Bfrontend%5D-Route-Restructuring-Under-Dashboard.md) | ✅ |
| 014 | [UX Polish — Readability, Labels, Contrast](./ADR-014-%5Bfrontend%5D-UX-Polish-Readability-Labels-Contrast.md) | ✅ |
| 015 | [Live Dashboard Restoration from Git History](./ADR-015-%5Bfrontend%5D-Live-Dashboard-Restoration.md) | ✅ |
| 016 | [Ref-Based Physics vs React State Separation](./ADR-016-%5Bfrontend%5D-Ref-Based-Physics-vs-React-State-Separation.md) | ✅ |
| 017 | [Single rAF for Multi-Track Synchronization](./ADR-017-%5Bfrontend%5D-Single-rAF-Multi-Track-Synchronization.md) | ✅ |
| 025 | [Kinematic Token Theorem Sandbox](./ADR-025-%5Bfrontend%5D-Kinematic-Token-Theorem-Sandbox.md) | ✅ |
| 026 | [Fleet Control Plane Dashboard](./ADR-026-%5Bfrontend%5D-Fleet-Control-Plane-Dashboard.md) | ✅ |
| 027 | [Frontend Dashboard as Dumb Terminal](./ADR-027-%5Bfrontend%5D-Frontend-Dashboard-Dumb-Terminal.md) | ✅ |
| 029 | [Proof of Cloud Metadata Exfiltration](./ADR-029-%5Bfrontend%5D-Proof-of-Cloud-Metadata-Exfiltration.md) | ✅ |

### 🏗️ Cross-Domain Architecture `[architecture]`

| # | 决策 Decision | 状态 |
|---|---|---|
| 009 | [Shared Physics Kernel Extraction](./ADR-009-%5Barchitecture%5D-Shared-Physics-Kernel.md) | ✅ |
| 018 | [Generation Counter Pattern](./ADR-018-%5Barchitecture%5D-Generation-Counter-Pattern.md) | ✅ |
| 019 | [Scenario-Driven Configuration (Strategy Pattern)](./ADR-019-%5Barchitecture%5D-Scenario-Driven-Configuration.md) | ✅ |
| 020 | [Step-Based Detection as Universal Abstraction](./ADR-020-%5Barchitecture%5D-Step-Based-Detection-Abstraction.md) | ✅ |
| 021 | [Dual-Mode Architecture — Sim vs Live](./ADR-021-%5Barchitecture%5D-Dual-Mode-Architecture.md) | ✅ |
| 023 | [Dark Warehouse Survival State Machine](./ADR-023-%5Barchitecture%5D-Dark-Warehouse-Survival-State-Machine.md) | ✅ |
| 028 | [Multi-Agent Orchestration Engine](./ADR-028-%5Barchitecture%5D-Multi-Agent-Orchestration-Engine.md) | ✅ |
| 030 | [IaC Configurator — Enterprise Compliance, Key Vault Integration & GitOps Pipeline](./ADR-030-%5Barchitecture%5D-IaC-Configurator-Enterprise-Compliance.md) — also `[infra]`, `[frontend]` | ✅ |

---

> **状态图例** | Status Legend: ✅ Accepted & Implemented · 🔷 Proposed · ❌ Superseded
