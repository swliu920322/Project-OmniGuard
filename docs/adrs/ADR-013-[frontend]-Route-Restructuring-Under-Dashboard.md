# Architectural Decision Record (ADR 013)

## Title

ADR 013: Route Restructuring — All Demo Pages Under `/dashboard`

---

## Status

**Implemented**

---

## Context

The demo flow followed a narrative arc: Theorem (single-AGV sandbox) → Compare (side-by-side proof) → Fleet (3-AGV simulation) → Live (real cloud calls). However, these pages were scattered across two route roots:

- `/kinematic` — single-AGV theorem sandbox
- `/kinematic/compare` — side-by-side comparison
- `/dashboard` — fleet simulation
- `/dashboard/live` — live cloud integration

This created several problems:
- **Inconsistent navigation**: FleetHeader had links to `/kinematic` and `/kinematic/compare`, while KinematicHeader had its own nav style. Each page had its own header layout with different visual languages.
- **No shared layout**: Dark theme, navigation, and global container styles had to be duplicated. If one page's styling diverged, the demo felt fragmented.
- **Audience confusion**: "/kinematic" and "/dashboard" suggested they were separate applications, not a single demo narrative.
- **No tab-based navigation**: Viewers couldn't easily discover that four pages existed. The cross-links were small text buttons in page headers.

---

## Decision

Move all kinematic pages under `/dashboard/` with a shared layout:

```
BEFORE:                          AFTER:
/kinematic                       /dashboard/theorem
/kinematic/compare               /dashboard/compare
/dashboard                       /dashboard          (fleet, unchanged)
/dashboard/live                  /dashboard/live     (unchanged)
```

Key changes:
- **New `dashboard/layout.tsx`**: Client component with `usePathname()` for active-tab highlighting. Navigation tabs: Theorem | Compare | Fleet | Live. Sticky top bar with consistent styling.
- **Moved shared code**: `kinematic/lib/kinematic.ts` → `dashboard/lib/kinematic.ts`, hooks to `dashboard/hooks/`, components to `dashboard/components/`. Import paths unchanged (same relative depth).
- **Removed outer wrappers**: Each page previously wrapped its content in `min-h-screen bg-slate-950 text-slate-100 flex flex-col ...`. The layout now provides this, so each page uses `<></>` fragments.
- **Pruned redundant nav links**: FleetHeader removed Theorem/Compare buttons (now in nav bar). Live page removed SIM/Theorem links.
- **Deleted `/kinematic/`**: Entire directory removed after migration.

---

## Consequences

Positive:
- One unified navigation bar: viewers see all four pages at a glance
- Single layout: theme, fonts, backgrounds defined once
- Cleaner URLs: `/dashboard/theorem` is clearly part of the dashboard family
- No duplicate styling between old kinematic and dashboard pages

Negative:
- Bookmarked `/kinematic` URLs become 404 (acceptable for a demo project)
- One-time migration effort: ~20 files moved, ~50 import paths updated
- `layout.tsx` is a client component (needs `usePathname`) — can't be fully server-rendered

---

## Chinese Translation

### 标题

ADR 013: 路由重构 —— 所有演示页面归入 `/dashboard`

### 背景

演示流程遵循叙事弧：Theorem（单 AGV 沙盒）→ Compare（并排对比）→ Fleet（3-AGV 仿真）→ Live（真实云调用）。然而，这些页面分散在两个不同的路由根下：

- `/kinematic` —— 单 AGV 定理沙盒
- `/kinematic/compare` —— 并排对比
- `/dashboard` —— 舰队仿真
- `/dashboard/live` —— 实时云集成

这产生了几个问题：
- **导航不一致**：FleetHeader 有指向 `/kinematic` 和 `/kinematic/compare` 的链接，KinematicHeader 有自己的导航样式。每个页面都有不同的视觉语言。
- **无法共享布局**：深色主题、导航、全局容器样式必须重复。如果一页的样式偏移，演示会显得支离破碎。
- **观众困惑**："/kinematic" 和 "/dashboard" 暗示它们是独立的应用，而非同一个演示叙事。
- **无 Tab 导航**：观众不容易发现存在四个页面。交叉链接是隐藏在页面头部的小号文字按钮。

### 决策

将所有运动学页面移到 `/dashboard/` 下，使用共享布局：

```
之前：                         之后：
/kinematic                       /dashboard/theorem
/kinematic/compare               /dashboard/compare
/dashboard                       /dashboard          （舰队，不变）
/dashboard/live                  /dashboard/live     （不变）
```

关键改动：
- **新建 `dashboard/layout.tsx`**：Client 组件，使用 `usePathname()` 高亮当前 Tab。导航栏：Theorem | Compare | Fleet | Live。粘性顶栏，统一样式。
- **搬家共享代码**：`kinematic/lib/kinematic.ts` → `dashboard/lib/kinematic.ts`，hooks 到 `dashboard/hooks/`，components 到 `dashboard/components/`。导入路径不变（相对深度相同）。
- **移除外层包装**：每页原包裹在 `min-h-screen bg-slate-950 text-slate-100 flex flex-col ...` 中。布局现统一提供，每页使用 `<></>` 片段。
- **精简冗余导航**：FleetHeader 移除 Theorem/Compare 按钮（已在导航栏）。Live 页面移除 SIM/Theorem 链接。
- **删除 `/kinematic/`**：迁移后删除整个目录。

### 结果

优点：
- 统一的导航栏：观众一目了然看到四个页面
- 单一布局：主题、字体、背景一次定义
- 更清晰的 URL：`/dashboard/theorem` 明确是 dashboard 家族的一部分
- 旧 kinematic 和 dashboard 页面之间无重复样式

缺点：
- 已收藏的 `/kinematic` URL 变为 404（对演示项目可接受）
- 一次性迁移工作量：约 20 个文件被移动，约 50 个导入路径被更新
- `layout.tsx` 是 Client 组件（需要 `usePathname`）——无法完全服务端渲染
