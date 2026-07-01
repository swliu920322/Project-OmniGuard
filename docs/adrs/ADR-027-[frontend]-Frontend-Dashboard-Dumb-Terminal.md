# Architectural Decision Record (ADR 027)
# 架构决策记录 (ADR 027)

## Title / 标题

ADR 027: Frontend Dashboard as a Dumb Terminal — Zero Business Logic
ADR 027: 前端仪表板作为傻瓜终端——零业务逻辑

## Status / 状态

**Approved / 已批准**

## Context / 背景

The original dashboard implementation risked leaking business logic into the frontend (e.g., `if (distance < 30) { alert('danger') }`). This creates a "toy" architecture where the frontend makes safety decisions instead of the backend, violating enterprise zero-trust principles. All safety rules, tenant policies, and routing logic belong in the backend configuration layer (Cosmos DB / scenario registry).

原始仪表板实现面临业务逻辑泄露到前端的风险（例如 `if (distance < 30) { alert('danger') }`）。这创造了"玩具"架构——前端代替后端做安全决策，违反了企业零信任原则。所有安全规则、租户策略和路由逻辑都属于后端配置层（Cosmos DB / 场景注册表）。

## Decision Drivers / 决策驱动因素

* Strict backend ownership of all business logic and safety calculations.
* Frontend must be a pure function of backend state — replaceable without logic changes.
* Clear separation of concerns for interview demonstration.

* 后端严格拥有所有业务逻辑和安全计算的所有权。
* 前端必须是后端状态的纯函数——可在不更改逻辑的情况下替换。
* 为面试演示清晰分离关注点。

## Decision / 决策

Enforce "Dumb Terminal" pattern: the frontend renders only what the backend returns, with zero derived safety logic. Map backend status enums to fixed Tailwind color classes (`PASS` → green, `BLOCKED` → red, `SHORT_CIRCUIT` → gray/disabled). No `if` statements based on distance, speed, or any physical parameter in frontend code.

强制执行"傻瓜终端"模式：前端仅渲染后端返回的内容，零衍生安全逻辑。将后端状态枚举映射到固定的 Tailwind 颜色类（`PASS` → 绿色，`BLOCKED` → 红色，`SHORT_CIRCUIT` → 灰色/禁用）。前端代码中不出现基于距离、速度或任何物理参数的 `if` 语句。

## Consequences / 后果

* **Positive / 正向**: Frontend can be completely swapped (React → Vue → Svelte) without touching safety logic.
* **Positive / 正向**: Eliminates class of bugs where frontend and backend disagree on safety rules.
* **Positive / 正向**: Strong interview talking point demonstrating enterprise architecture discipline.

* **正向**: 前端可完全替换（React → Vue → Svelte）而无需触及安全逻辑。
* **正向**: 消除了前端和后端对安全规则不一致的一类错误。
* **正向**: 有力的面试讨论点，展示了企业架构纪律。
