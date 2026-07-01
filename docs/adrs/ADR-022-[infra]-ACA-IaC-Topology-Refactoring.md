# Architectural Decision Record (ADR 022)
# 架构决策记录 (ADR 022)

## Title / 标题

ADR 022: Deprecating Azure Functions/SWA in Favor of Azure Container Apps (ACA)
ADR 022: 弃用 Azure Functions/SWA，迁移至 Azure Container Apps (ACA)

## Status / 状态

**Approved / 已批准**

## Context / 背景

The existing compute plane relied on Azure Functions (serverless) with Static Web Apps (SWA) frontend. This architecture suffered from cold starts, hybrid binding collisions (FastAPI + Azure Functions HTTP worker), and limited control over runtime environment. A containerized approach was needed for deterministic performance, zero cold start, and unified deployment.

现有计算平面依赖于 Azure Functions（无服务器）和 Static Web Apps（SWA）前端。该架构存在冷启动、混合绑定冲突（FastAPI + Azure Functions HTTP worker）以及运行时环境控制有限的问题。需要容器化方法以实现确定性性能、零冷启动和统一部署。

## Decision Drivers / 决策驱动因素

* Eliminate cold start latency for real-time embodied AI control loops.
* Unify backend (FastAPI) and frontend (Next.js) deployment under one compute paradigm.
* Maintain zero-trust network boundary via internal-only backend ingress.

* 消除实时具身 AI 控制环路的冷启动延迟。
* 将后端（FastAPI）和前端（Next.js）统一到一种计算范式下。
* 通过仅限内部的后端入站流量维护零信任网络边界。

## Decision / 决策

Migrate from Azure Functions + SWA to Azure Container Apps (ACA) Consumption tier with `minReplicas=1`. Deploy two container apps: backend (FastAPI, internal ingress, 1.0 vCPU / 2Gi) and frontend (Next.js, external ingress, 0.5 vCPU / 1Gi). Add Azure Container Registry (ACR) for image hosting and Log Analytics Workspace for telemetry.

从 Azure Functions + SWA 迁移到 Azure Container Apps (ACA) Consumption 层，设置 `minReplicas=1`。部署两个容器应用：后端（FastAPI，内部入站，1.0 vCPU / 2Gi）和前端（Next.js，外部入站，0.5 vCPU / 1Gi）。添加 Azure Container Registry (ACR) 用于镜像托管和 Log Analytics Workspace 用于遥测。

## Consequences / 后果

* **Positive / 正向**: Predictable performance with zero cold start via pinned `minReplicas=1`.
* **Positive / 正向**: Unified Bicep topology — no more mixed SWA/Function/Plan resource types.
* **Negative / 负向**: Requires Docker image build and push pipeline (added CI complexity).

* **正向**: 通过固定 `minReplicas=1` 实现可预测的性能和零冷启动。
* **正向**: 统一的 Bicep 拓扑——不再有混合的 SWA/Function/Plan 资源类型。
* **负向**: 需要 Docker 镜像构建和推送流水线（增加了 CI 复杂性）。
