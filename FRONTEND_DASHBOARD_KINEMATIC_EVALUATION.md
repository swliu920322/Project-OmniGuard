# Project-OmniGuard Frontend Dashboard & Kinematic Evaluation

Date: 2026-07-01

## Executive Summary

这份原始分析报告的大方向是可行的：它正确识别了 `dashboard` 与 `kinematic` 两个前端模块的定位差异，也抓住了当前代码质量的核心矛盾，即 `kinematic` 模块结构相对清晰，而 `dashboard` 模块功能完整但主页面承担了过多职责。

不过，报告中有几处判断已经不完全符合当前代码状态，需要修正后再作为实施计划使用：

- `formatLatency` 重复定义的问题目前已不存在。当前它已经在 `src/client-edge/src/app/kinematic/lib/kinematic.ts` 中统一导出，并被 Hook 与组件复用。
- `dashboard` autopilot 循环并非完全没有清理机制。当前 `src/client-edge/src/app/dashboard/page.tsx` 的 autopilot `useEffect` 已经使用 `active` 标志和 `clearTimeout` cleanup。
- `Zustand` 不需要“引入依赖”，因为 `src/client-edge/package.json` 已经包含 `zustand`。更准确的建议是“开始使用已存在的 Zustand 依赖重构状态管理”。
- `PhysicalTwinVisualizer.tsx` 并没有直接更新 React 状态，也没有承担主要状态管理职责。它确实包含了一些派生计算和风险判断，但问题级别低于原报告描述。

综合判断：计划可执行，但应先做范围收敛，避免为了重构而重构。建议优先处理 `dashboard/page.tsx` 的职责拆分、重复物理逻辑提取和类型化配置，再考虑更大的状态管理迁移。

## Current Code Findings

### Kinematic Module

当前 kinematic 模块结构较健康：

- 页面入口：`src/client-edge/src/app/kinematic/page.tsx`，约 98 行。
- 核心计算：`src/client-edge/src/app/kinematic/lib/kinematic.ts`，约 85 行。
- 动画 Hook：`src/client-edge/src/app/kinematic/hooks/useKinematicSimulation.ts`，约 149 行。
- UI 组件拆分清楚，包括 `FormulaCard.tsx`、`ParameterPanel.tsx`、`SimulationStage.tsx`、`AuditLog.tsx`。

原报告对其架构评价基本成立：计算逻辑、动画状态、UI 展示有明确分层，适合作为 dashboard 重构时的参考样式。

需要修正的点：

- `formatLatency` 已经集中定义在 `kinematic/lib/kinematic.ts`，当前不是重复问题。
- `useKinematicSimulation.ts` 中 `useEffect([isRunning])` 依赖较少是有意通过 ref 读取最新参数，不能简单归类为 exhaustive-deps 错误。
- `computeKinematicResult` 目前主要依赖 slider 的最小值保证输入合法，函数自身没有完整防御非法输入。如果未来该函数被 API、测试或其他页面复用，建议补上 `tokenRate <= 0`、`latencySeconds <= 0` 等保护。

推荐优先级：

1. 为 `computeKinematicResult` 增加单元测试，覆盖 cloud、edge、极端 tokenRate、极端 clearance 等场景。
2. 将公式解释、默认参数和 UI slider 配置继续保持单一来源，避免文档与实现漂移。
3. 暂不需要对 kinematic 做大规模架构调整。

### Dashboard Module

原报告对 dashboard 的主要风险判断成立。

当前 `src/client-edge/src/app/dashboard/page.tsx` 约 959 行，集中包含：

- 页面布局。
- 租户配置。
- Prompt override 表单。
- API 请求。
- autopilot 循环。
- 手动 simulation。
- 物理状态更新。
- 电池、温度、HP、碰撞判定。
- 日志拼接。
- 多个 UI 区块。

这已经超过了一个页面组件适合承担的职责范围。维护成本高、测试困难、状态行为不容易审计，是当前 dashboard 最大的问题。

确认成立的问题：

- `runAutopilotStep` 与 `triggerSimulation` 中存在大量重复逻辑，尤其是 API payload 构造、latency 处理、物理滑行距离、碰撞、电池消耗、温度变化、日志生成。
- 魔法数字较多，例如 jitter 延迟 `2500`、循环间隔 `800`、基础电池消耗 `0.6`、停止额外消耗 `2.0`、转向额外消耗 `1.2`、过热阈值 `60`、温度恢复基线 `40` 等。
- 状态数量较多，且存在 state/ref 双轨同步。虽然这是为了解决异步循环 stale closure，但长期维护成本较高。
- 缺少针对物理计算、状态转移和日志生成的纯函数测试入口。

需要修正的点：

- autopilot 并非完全缺少清理逻辑。当前 effect cleanup 中已经 `clearTimeout(timerId)`，同时通过 `active = false` 阻止异步完成后继续调度下一轮。
- `PhysicalTwinVisualizer.tsx` 当前更像展示组件，内部仅计算 `brakingDistance`、`collisionRisk`、`isOverheated` 等派生值。它不是 dashboard 状态耦合的主要来源。
- “立即引入 Zustand”应改为“逐步迁移到已安装的 Zustand”。一次性把整个 dashboard 状态搬进 store 风险较高。

## Feasibility Assessment

### Short-Term Plan: Feasible With Adjustments

原计划中的短期项总体可行，但建议调整为：

1. 不再处理 `formatLatency` 重复问题，因为当前已经完成。
2. 优先新增 `dashboard` 配置常量文件，例如 `src/client-edge/src/app/dashboard/config/simulation.ts`。
3. 提取 dashboard 纯函数，例如：
   - `buildSimulationPayload`
   - `applyPhysicsStep`
   - `calculateBatteryDrain`
   - `calculateTemperatureChange`
   - `buildPhysicsLogs`
4. 保留现有 UI 和状态结构，先降低重复和风险。
5. 补充少量测试或至少保留可测试的纯函数入口。

这一阶段风险低，收益高，建议先做。

### Medium-Term Plan: Feasible, But Should Be Incremental

拆分 `page.tsx` 是必要的，但不建议一口气把目标定为“200 行以内”。更现实的目标是先把页面减到 400-500 行，再根据模块边界继续拆。

建议拆分顺序：

1. `lib/physics.ts`：物理状态转移，必须是纯函数。
2. `lib/simulation.ts`：API payload、响应解析、日志生成。
3. `config/simulation.ts`：常量、租户默认配置、阈值。
4. `hooks/useFleetSimulation.ts`：封装手动 simulation 与 autopilot 共享流程。
5. `components/SandboxPanel.tsx`：拆出 Prompt override UI。
6. 最后再考虑 Zustand store。

Zustand 适合这个项目，但建议只在纯函数边界稳定后迁移。否则会把现有复杂度搬到 store 中，问题不会自然消失。

### Long-Term Plan: Partially Feasible

长期计划中的测试、CI、动画循环优化都合理。

需要谨慎的是“微前端拆分”。当前项目规模还没有到必须上微前端的程度。`dashboard` 的问题主要是单文件职责过载，而不是部署边界或团队边界问题。微前端会显著增加构建、路由、状态共享和部署复杂度，不建议作为 2-3 个月内的默认方向。

更合理的长期目标：

- 建立 Vitest 单元测试。
- 为核心仿真逻辑建立 regression tests。
- 为 dashboard 和 kinematic 增加 Playwright smoke test。
- 将物理仿真逻辑稳定为可复用 domain layer。
- 保持 Next.js 单体前端，除非未来真的出现独立团队或独立发布需求。

## Recommended Roadmap

### Phase 1: Low-Risk Cleanup

- 提取 dashboard 常量。
- 合并 `runAutopilotStep` 和 `triggerSimulation` 的共享逻辑。
- 提取纯函数，不改变 UI 行为。
- 保留当前 autopilot cleanup。
- 为 kinematic 的 `computeKinematicResult` 增加边界输入保护或测试。

### Phase 2: Page Decomposition

- 拆出 `SandboxPanel`、`ControlPanel`、`StatusHeader` 等 UI 区块。
- 把 dashboard 页面从“逻辑 + UI + 状态机”降级为“布局编排 + hook 调用”。
- 将 API 请求和状态转移合并到一个专用 Hook。

### Phase 3: State Store Migration

- 使用已有 `zustand` 依赖。
- 只迁移稳定且跨组件共享的状态，例如 fleet telemetry、simulation status、tenant config。
- UI 局部状态仍可保留在组件内部，例如 tab、textarea focus、active console tab。

### Phase 4: Test & Verification

- 使用 Vitest 测试纯函数。
- 使用 Playwright 做 dashboard/kinematic 基础页面 smoke test。
- 为关键场景固定测试用例：正常移动、阻塞停止、碰撞、低电量、过热、jitter 延迟。

## Risk Notes

- Dashboard 重构最大风险是改变演示行为。建议先写测试或保存关键场景输入输出，再动逻辑。
- API 响应结构 `final_action: Array<Record<string, any>>` 类型过宽，后续应收紧为 discriminated union，否则物理逻辑仍会依赖不安全字段访问。
- 当前 dashboard 有用户体验价值，重构时应避免同时大改视觉设计。
- 文档更新应该跟随代码重构同步进行，但不应成为第一阶段的主要工作。

## Final Verdict

原计划总体可行，方向也正确，但需要基于当前代码状态做三点调整：

1. 删除已经过期的问题项，例如 `formatLatency` 重复和 autopilot 完全无 cleanup。
2. 将 dashboard 重构拆成小步，先抽纯函数和常量，再迁移 Zustand。
3. 暂缓微前端等大架构升级，把重点放在可测试性、重复逻辑消除和页面职责拆分。

建议评分：

- Kinematic 当前状态：8/10。结构清晰，只需要补测试和边界保护。
- Dashboard 当前状态：6/10。功能完整，但主文件过重，重复逻辑和状态复杂度已经明显影响可维护性。
- 原始优化计划可行性：7/10。方向正确，但部分事实需要更新，实施粒度需要收敛。
