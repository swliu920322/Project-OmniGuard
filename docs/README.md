# Project-OmniGuard — Documentation Hub

> **Diátaxis-compliant documentation** for the Cloud-Edge Collaborative Security Orchestrator.  
> Last updated: 2026-07-09

---

## 📖 Quick Navigation

| Section | Description | Audience |
|:--------|:------------|:---------|
| [Architecture Decision Records](adrs/INDEX.md) | 33 ADRs covering infra, backend, frontend, and cross-domain architecture decisions | All Engineers |
| [Fleet Dashboard Reference](dashboard/00-overview.md) | Complete reference for the 4-mode Fleet Dashboard (Theorem / Compare / Fleet / Live) | Frontend / Researchers |
| [Dashboard Presentation Script](dashboard/presentation-script.md) | Guided walkthrough script for live demonstrations | Presenters |
| [Project Evolution Roadmap](PROJECT_EVOLUTION_ROADMAP_20260706.md) | Deep audit and enterprise-grade evolution roadmap | Architects / Advisors |

---

## 🏗️ Architecture Decision Records (ADRs)

All significant engineering decisions are documented in structured [Context → Decision → Consequences] format.  
**→ [Full ADR Index](adrs/INDEX.md)**

### By Domain

#### ☁️ Cloud Infrastructure `[infra]`

| # | Decision |
|---|----------|
| 002 | [SWA Control Plane Cross-Region Routing](adrs/ADR-002-%5Binfra%5D-SWA-Control-Plane-Cross-Region-Routing.md) |
| 003 | [Serverless SKU Migration](adrs/ADR-003-%5Binfra%5D-Serverless-SKU-Migration.md) |
| 004 | [Standard SKU Pivot](adrs/ADR-004-%5Binfra%5D-Standard-SKU-Pivot.md) |
| 007 | [IoT Hub Long-Lived Connection and Event Hub Trigger](adrs/ADR-007-%5Binfra%5D-IoT-Hub-Long-Lived-Connection.md) |
| 022 | [ACA IaC Topology Refactoring](adrs/ADR-022-%5Binfra%5D-ACA-IaC-Topology-Refactoring.md) |
| 031 | [Shadow Environment E2E Test Suite](adrs/ADR-031-%5Binfra%5D-Shadow-E2E-Test-Suite.md) |
| 033 | [ACA Ingress HTTP-to-HTTPS POST Demotion](adrs/ADR-033-%5Binfra%5D-ACA-Ingress-HTTP-POST-Demotion.md) |

#### ⚙️ Backend `[backend]`

| # | Decision |
|---|----------|
| 005 | [Migration to Pure ASGI](adrs/ADR-005-%5Bbackend%5D-Migration-to-Pure-ASGI.md) |
| 006 | [Tenant Policy Fallback Strategy](adrs/ADR-006-%5Bbackend%5D-Tenant-Fallback-Strategy.md) |
| 024 | [Dynamic Orchestration Sandbox API](adrs/ADR-024-%5Bbackend%5D-Dynamic-Orchestration-Sandbox-API.md) |
| 034 | [OpenAI Credentials Unification](adrs/ADR-034-%5Barchitecture%5D-OpenAI-Credentials-Unification.md) |

#### 🎨 Frontend `[frontend]`

| # | Decision |
|---|----------|
| 008 | [Unified Step-Based Detection Loop](adrs/ADR-008-%5Bfrontend%5D-Unified-Step-Based-Detection-Loop.md) |
| 010 | [Dashboard v2 — Fleet Simulation](adrs/ADR-010-%5Bfrontend%5D-Dashboard-v2-Fleet-Simulation.md) |
| 011 | [LLM Token Breakdown Live Control](adrs/ADR-011-%5Bfrontend%5D-LLM-Token-Breakdown-Live-Control.md) |
| 012 | [Pause / Resume AccumS Preservation](adrs/ADR-012-%5Bfrontend%5D-Pause-Resume-AccumS-Preservation.md) |
| 016 | [Ref-Based Physics vs React State Separation](adrs/ADR-016-%5Bfrontend%5D-Ref-Based-Physics-vs-React-State-Separation.md) |
| 017 | [Single rAF Multi-Track Synchronization](adrs/ADR-017-%5Bfrontend%5D-Single-rAF-Multi-Track-Synchronization.md) |
| 025 | [Kinematic Token Theorem Sandbox](adrs/ADR-025-%5Bfrontend%5D-Kinematic-Token-Theorem-Sandbox.md) |
| 026 | [Fleet Control Plane Dashboard](adrs/ADR-026-%5Bfrontend%5D-Fleet-Control-Plane-Dashboard.md) |
| 029 | [Proof of Cloud Metadata Exfiltration](adrs/ADR-029-%5Bfrontend%5D-Proof-of-Cloud-Metadata-Exfiltration.md) |

#### 🏗️ Cross-Domain Architecture `[architecture]`

| # | Decision |
|---|----------|
| 009 | [Shared Physics Kernel Extraction](adrs/ADR-009-%5Barchitecture%5D-Shared-Physics-Kernel.md) |
| 018 | [Generation Counter Pattern](adrs/ADR-018-%5Barchitecture%5D-Generation-Counter-Pattern.md) |
| 019 | [Scenario-Driven Configuration](adrs/ADR-019-%5Barchitecture%5D-Scenario-Driven-Configuration.md) |
| 020 | [Step-Based Detection as Universal Abstraction](adrs/ADR-020-%5Barchitecture%5D-Step-Based-Detection-Abstraction.md) |
| 021 | [Dual-Mode Architecture — Sim vs Live](adrs/ADR-021-%5Barchitecture%5D-Dual-Mode-Architecture.md) |
| 023 | [Dark Warehouse Survival State Machine](adrs/ADR-023-%5Barchitecture%5D-Dark-Warehouse-Survival-State-Machine.md) |
| 028 | [Multi-Agent Orchestration Engine](adrs/ADR-028-%5Barchitecture%5D-Multi-Agent-Orchestration-Engine.md) |
| 030 | [IaC Configurator — Enterprise Compliance](adrs/ADR-030-%5Barchitecture%5D-IaC-Configurator-Enterprise-Compliance.md) |
| 032 | [Dual-Track Identity Decoupling & Fallback Governance](adrs/ADR-032-%5Barchitecture%5D-Dual-Track-Identity-Decoupling-and-Fallback-Governance.md) |

---

## 🔬 Research: Kinematic-Token Theorem

The Fleet Dashboard proves a core research thesis: **cloud-only LLM inference creates a physical safety deadlock for real-time AGV control**.

### The Problem

For an AGV traveling at speed $v$ with braking distance $d_{brake}$:

$$T_{cloud} = T_{network} + T_{prompt} + T_{generation}$$

When $v \times T_{cloud} > d_{obstacle} - d_{brake}$, the AGV **cannot physically stop before collision**, regardless of the LLM's decision quality.

### The Proof (4 Dashboard Modes)

| Mode | Route | What It Proves |
|:-----|:------|:---------------|
| **Theorem** | `/dashboard/theorem` | Single-AGV: sliding Token Breakdown sliders shows exact collision threshold |
| **Compare** | `/dashboard/compare` | Cloud-only AGV crashes while Edge AGV stops safely — side-by-side |
| **Fleet** | `/dashboard` | 3-AGV simultaneous simulation: Cloud-Only vs Cloud+Edge vs Token-Breakdown |
| **Live** | `/dashboard/live` | Real Azure OpenAI latency validates the theorem with production infrastructure |

### The Solution

A **hybrid edge-cloud cognitive pipeline**:
- **Edge layer (15ms)**: WebGPU in-browser inference handles safety-critical decisions locally
- **Cloud layer (2600ms+)**: Multi-Agent pipeline handles complex strategic reasoning via VNet-internal Azure OpenAI

---

## 🛡️ Security Architecture Deep-Dive

### Zero-Trust Network Topology

```
Public Internet
    │
    ▼
┌─────────────────────────────────┐
│ Frontend Container App          │  ← external: true (only public surface)
│ (Next.js API Gateway / BFF)     │
└────────────┬────────────────────┘
             │ .internal DNS (private)
             ▼
┌─────────────────────────────────┐
│ Backend Container App           │  ← external: false (VNet-internal only)
│ (FastAPI ASGI + Functions)      │
└────────────┬────────────────────┘
             │ Private Endpoints (no public access)
             ▼
┌──────┬──────────┬───────────┬──────────────┐
│Cosmos│ Key Vault│ Blob Store│ Azure OpenAI │
│  DB  │  (RBAC)  │ (SAS)     │  (Private)   │
└──────┴──────────┴───────────┴──────────────┘
```

### Identity & Access Control

| Layer | Mechanism |
|:------|:----------|
| **Cloud ↔ Cloud** | User-Assigned Managed Identity + Key Vault RBAC (no passwords in code) |
| **Cloud ↔ IoT** | HMAC-SHA256 SAS Token (hand-crafted, not SDK wrapper) |
| **Cloud ↔ Storage** | Time-limited SAS tokens (60-second expiry) |
| **Network** | NSG bidirectional rules + VNet service endpoints |

### Validation: Shadow E2E Test

The Shadow E2E test (`tests/shadow-e2e-test.py`) is an **automated infrastructure security audit**:

1. Deploys a complete shadow copy of the entire infrastructure
2. Verifies Private DNS A records resolve to correct subnet IPs (`10.1.2.x`)
3. Checks Key Vault Private DNS resolution
4. Validates ACA container provisioning state
5. Self-destructs the shadow environment (handles Ctrl+C gracefully)

---

## 🤖 Multi-Agent Orchestration

### Pipeline Architecture

Three specialized agents process IoT telemetry with **cascading early circuit-breaking**:

| Agent | Role | Token Budget | Short-Circuit Condition |
|:------|:-----|:-------------|:------------------------|
| **Router** | Intent classification | 20 tokens | `SENSOR_ERROR` → STOP immediately |
| **Safety** | Compliance & risk audit | 50 tokens | `BLOCK: [reason]` → safety override |
| **Compiler** | Action sequence generation | 100 tokens | — (final stage) |

### Multi-Tenant Scenario Configuration

Per-tenant customizable agent prompts, safety rules, and action schemas:

```json
{
  "Tenant-Alpha": {
    "scenario": "Data Center Patrol",
    "agent_safety_rules": "Maintain 30cm minimum distance. No spray_water or fast_forward."
  },
  "Tenant-Beta": {
    "scenario": "Hospital Delivery",
    "agent_safety_rules": "If HUMAN_DETECTED, the only allowed action is 'stop'. No bypassing."
  }
}
```

---

## ⚙️ IaC Visual Configurator

An interactive frontend that compiles and assembles Azure Bicep templates:

| Feature | Description |
|:--------|:------------|
| **Scenario Presets** | Sandbox (minimal) / Secure IoT (full zero-trust) / Custom |
| **Visual Configuration** | VNet CIDR, Managed Identity toggles, SKU pricing, deployment region |
| **Topology Diagram** | Interactive Bicep module dependency graph with drill-down navigation |
| **Package Download** | Exports configured Bicep templates as downloadable `.zip` |
| **Preflight Validation** | Runs `az deployment sub validate` against Azure before deployment |
| **Backup Rotation** | Auto-backups with scenario-aware naming (max 5, FIFO rotation) |

---

## 📊 Project Metrics

| Metric | Value |
|:-------|:------|
| Frontend components | 30+ TSX files, ~3,500 lines |
| Backend modules | 10 files, ~800 lines |
| IaC templates | 3 Bicep files, ~560 lines |
| Automation scripts | 10 scripts, ~1,200 lines |
| E2E test suite | 287 lines (self-healing) |
| Architecture Decision Records | **33 ADRs** |
| Azure Certifications (Author) | 5 (AZ-305, AZ-104, AI-102, SC-300, AB-100) |
| Estimated total codebase | **6,300+ lines** |

---

## 📚 Further Reading

- 📐 [System Design Blueprints](docs/reference/) — Architectural schemas for fleet routing and cloud validation
- 📖 [Fleet Dashboard Reference](docs/dashboard/00-overview.md) — Complete 626-line reference document
- 🎤 [Dashboard Presentation Script](docs/dashboard/presentation-script.md) — Guided demo walkthrough
- 🗺️ [Project Evolution Roadmap](docs/PROJECT_EVOLUTION_ROADMAP_20260706.md) — Enterprise-grade evolution plan
- 📋 [ADR Index](docs/adrs/INDEX.md) — All 33 Architecture Decision Records

---

## 📜 License

[MIT License](LICENSE) — Liu Shengwei