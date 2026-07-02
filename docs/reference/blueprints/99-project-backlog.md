# 项目待办任务库与技术债备忘 (Project Backlog & Tech Debt)

> **文档目的**: 记录 OmniGuard IaC 加速器未来演进思路、中长期低优先级（Low Priority）待办以及技术架构备忘，体现系统前瞻性设计思想。

---

## 📅 中长期路线图与待办 (Backlog)

### 1. 网页端异步一键部署 (Click-to-Deploy via Async Queue)
* **状态**: 💡 挂起 (Deferred) | **优先级**: 低 (Low) | **类型**: 功能拓展
* **架构设计思想**:
  * *背景*：为了实现 100% 网页端闭环，可在控制台右侧增加“🚀 一键云端物理部署”按钮。
  * *瓶颈风险*：Azure 物理拉起资源通常耗时 5-10 分钟，直接发起同步 HTTP 请求会导致 Next.js API Gateway 超时（504 Gateway Timeout）或浏览器连接断开。
  * *规避方案*：
    1. **后台任务调度 (Background Job)**：API 接收请求后仅生成一个 `JobId` 并立即返回 `202 Accepted`，部署动作在 NodeJS Background Worker 中异步执行。
    2. **实时日志推送 (SSE / WebSocket)**：前端建立 **Server-Sent Events (SSE)** 管道，订阅该 `JobId` 的日志流，实时回显部署控制台输出。
    3. **状态轮询与挂载**：前端通过轮询（Polling）或 SSE 状态监听，若部署成功则自动刷新控制台，展示最终生成的 FQDN 和资源清单。
  * *放弃/降级原因*：不符合企业级 SecOps 的 **GitOps（代码即单一可信源）** 最佳实践。直接从网页端部署绕过了代码评审（Pull Request Review）和版本控制，增加了无审计变更的风险。

### 2. 自动化云端销毁与清退调度器 (Auto-Teardown Scheduler)
* **状态**: 📅 待办 (Backlog) | **优先级**: 中 (Medium) | **类型**: FinOps 优化
* **架构设计思想**:
  * *背景*：开发者经常在沙箱或影子环境测试完 Bicep 部署后忘记手动删除资源组，导致云端费用超支。
  * *规避方案*：
    * 引入 `FinOps-Lifespan-Policy` 标签，在部署时将资源生命周期写入资源组的 Metadata 中（如 `Lifespan=8h`）。
    * 在测试订阅中部署一个轻量级轻量级自动化任务（如 Azure Automation Runbook 或 GitHub Actions Scheduled Cron），每小时扫描所有带有 `omnitest` 前缀的资源组，一旦超出生命周期限制，全自动强制执行销毁清退。

### 3. 多分支 IaC 状态对比器 (Multi-Branch State Diff)
* **状态**: 📅 待办 (Backlog) | **优先级**: 中-低 (Medium-Low) | **类型**: UX 提升
* **架构设计思想**:
  * *背景*：当多名架构师并行修改不同分支的网段或 SKU 时，容易在合并主干时产生冲突。
  * *规避方案*：
    * 在前端配置台中允许读取并对比不同 Git 分支上的 `.azure/configurator-ui-state.json`。
    * 以侧边栏双视图（Side-by-Side View）清晰对比网段冲突和配置项差异，防止错误的配置覆盖。

---

## 🛠️ 技术债与架构备忘 (Tech Debt Registry)

| 标识 | 模块 | 问题描述 | 影响度 | 缓解措施 / 备忘 |
|:---|:---|:---|:---|:---|
| **TD-001** | UI 测算 | 资源 SKU 价格属于静态硬编码数据，无法感知 Azure 官方实时降价或调价。 | 低 | 长期可考虑接入 Azure Retail Prices API (`https://prices.azure.com/api/retail/prices`) 进行动态价格拉取。 |
| **TD-002** | 编译依赖 | `zip` 命令打包依赖宿主机的 Linux/macOS Shell 工具链，在 Windows 原生开发环境下会失效。 | 中-低 | 本地开发推荐使用 WSL (Windows Subsystem for Linux)；长期可重构为 Node.js 原生的 `archiver` 库实现跨平台无依赖压缩。 |
| **TD-003** | 名字冲突 | Key Vault 命名使用 `take('${prefix}kv${uniqueString(...)}', 24)` 截断。若 prefix 过长可能导致 hash 位过短，增加重名碰撞概率。 | 低 | 限制配置台前缀输入长度在 2-8 字符内。 |
