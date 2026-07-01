# Architectural Decision Record (ADR 009)

## Title

ADR 009: Shared Physics Kernel — Pure Math Extraction

---

## Status

**Implemented**

---

## Context

Two copies of similar physics logic existed across the project:

| File | Contains | Problem |
|---|---|---|
| `kinematic/lib/kinematic.ts:45` | `computeBrakingDistanceM` | OK, but only kinematic used it |
| `dashboard/lib/physics.ts:148` | `applyPhysicsStep` | Duplicated `distance = speed × time` math |

If the V_max formula was updated in kinematic but forgotten in dashboard, the two pages would disagree. An examiner comparing them would notice the inconsistency. Additionally, the V_max and computeCloudLatencyMs functions were defined once but needed by both sides.

---

## Decision

Extract all deterministic physical formulas into a single shared module:

```
src/client-edge/src/app/shared/physics/
├── kinematic-token.ts   # Pure functions: brakingDistanceM, vMaxMps, computeCloudLatencyMs, etc.
└── index.ts             # Re-exports
```

The shared kernel contains: zero React, zero side effects, immutable pure functions that answer "how far does the AGV travel during latency X at speed Y."

Rules:
- Anything that answers a physics question goes in shared
- React state, animation loops, jitter, dashboard-only metrics (battery, temp) stay out
- The shared file is a plain `.ts` file with zero dependencies

---

## Consequences

Positive:
- Single source of truth: one test validates both pages
- Reviewer can point to one file: "this is the theorem in code"
- Dashboard v2 could import `computeCloudLatencyMs` without redefining it

Negative:
- Added indirection (re-export from kinematic/lib/kinematic.ts for backward compat)
- Team needs to consciously decide "does this belong in shared or is it page-specific"

---

## Chinese Translation

### 标题

ADR 009: 共享物理内核 —— 纯数学函数提取

### 背景

项目中存在两套类似的物理计算逻辑：

| 文件 | 包含 | 问题 |
|---|---|---|
| `kinematic/lib/kinematic.ts:45` | `computeBrakingDistanceM` | 只有 kinematic 使用 |
| `dashboard/lib/physics.ts:148` | `applyPhysicsStep` | 重复的 `距离 = 速度 × 时间` 计算 |

如果在 kinematic 中更新了 V_max 公式但忘了更新 dashboard，两页会不一致。考官对比时会发现矛盾。

### 决策

将所有确定性物理公式提取到一个共享模块：

```
src/client-edge/src/app/shared/physics/
├── kinematic-token.ts   # 纯函数：brakingDistanceM, vMaxMps, computeCloudLatencyMs 等
└── index.ts             # 重新导出
```

共享内核的规则：
- 回答物理问题的内容放入共享
- React 状态、动画循环、抖动计算、dashboard 专属指标（电池、温度）保留在各自页面
- 共享文件是纯 `.ts` 文件，零依赖

### 结果

优点：
- 单一真相源：一处测试验证两页
- 审查者可指向一个文件："这就是定理的代码实现"
- Dashboard v2 可以直接引用 `computeCloudLatencyMs` 而无需重复定义

缺点：
- 增加了一层间接引用（kinematic/lib/kinematic.ts 重新导出以保持向后兼容）
- 团队需要有意判断"这属于共享还是页面专有"
