# Enterprise Directory Structure Review — Project-OmniGuard
# 企业级目录结构架构评审与演进报告

本报告针对 `Project-OmniGuard` 目前的目录结构进行企业级规范评审，提供现状剖析、潜在隐患评估以及符合微软云原生标准 (Azure Landing Zone & Twelve-Factor App) 的黄金目录演进方案。

---

## 1. 现状解构与评估

目前项目的物理结构如下：
* **`/` (根目录)**：包含 `Makefile`、`.gitignore` 和全局配置。
* **`.azure/`**：存放 Bicep 基础设施模板、参数配置文件、以及本地配置台状态数据。
* **`docs/`**：包含 `adrs/`（决策记录）和 `blueprints/`（蓝图指南）。
* **`sh/`**：存放运维、部署、干跑等 shell 脚本。
* **`src/`**：存放源码，其中 `client-edge/` 为 Next.js 前端，`cloud-orchestrator/` 为 Python FastAPI 后端。

---

## 2. 企业级视角下的四大优势 (Strengths)

### 🟢 1. 科学的 Monorepo (单体大仓) 设计
将前端、后端、以及 IaC 基础设施存放在同一个 Git 仓库中。
* **优势**：非常符合中小企业快速迭代的敏捷开发标准。当配置台新增参数时，能够在一个 Pull Request 内同步提交 React 前端修改、FastAPI 路由调整以及 Bicep 模板更新，防止多仓分离引发的版本脱节与编译失败。

### 🟢 2. 规范的 Source Code 隔离 (`/src`)
* **优势**：所有应用逻辑均被内聚在 `src/` 下，保持了根目录的绝对干净，避免了诸如 Dockerfile、package.json 等与工程化相关的配置文件在根目录下“打架”。

### 🟢 3. 卓越的“文档即代码” (Documentation as Code)
* **优势**：在 `docs/` 下推行 `adrs/`（架构决策记录）和 `blueprints/`（演进蓝图）。这在企业级软件工程中是 **黄金准则**，能够最大化保留项目团队的“机构记忆 (Institutional Memory)”，让新加入的开发人员瞬间理解为什么做某个技术决策。

### 🟢 4. 独立于云端的物理预设 (Templates Separation)
* **优势**：将 sandbox 和 secure-iot 的 Bicep 源码独立封装在子文件夹中，显示了良好的 IaC 配置治理思想，确保基础架构不易被误改。

---

## 3. 企业级视角下的四大隐患 & 痛点 (Risks & Pain Points)

在企业级交付与云原生持续集成 (CI/CD) 场景下，当前的结构存在以下隐藏的规范冲突：

### 🔴 1. 命名空间冲突：`.azure/` 的特殊意义
* **风险**：`.azure` 是微软官方 CLI 工具（特别是 **Azure Developer CLI - azd**、**Azure Functions Core Tools**）默认占用的**本地元数据目录**，用来存放本机的环境缓存和临时 Session。
* **隐患**：如果将我们自定义的 Bicep 物理模板和 parameters 文件强行存放在 `.azure/` 中，一旦未来引入 `azd` 工具链或者微软官方自动化流，该目录下的用户代码极易在命令运行或工具升级时被静默篡改、覆盖或误删。

### 🔴 2. 违反“不可变镜像”原则：动态缓存存放在源码包中 (`/daily_cache`)
* **风险**：Python 后端采集的推文及翻译文件保存在 `src/cloud-orchestrator/daily_cache/` 目录下。
* **隐患**：在云原生标准下，容器镜像（Docker Image）一旦构建就应当是**不可变且只读**的（Immutable Artifact）。如果将频繁变动、随时需要更新 of JSON 缓存文件放在 `src/` 代码区：
  1. 会导致本地 Git 不断产生无意义的 Diff 噪音（如我们在测试中发现翻译运行完后产生了大量 Cache Diff）；
  2. 容器运行时，ACA 容器的本地写操作在容器重启后会全部丢失，无法实现多实例共享缓存。
  * *企业标准*：这类动态数据应当被剥离至根目录下的 `/data` 目录（本地开发），或在云端直接挂载 **Azure Files/Blob Storage** 进行云端持久化。

### 🔴 3. 违反“单一可信源” (SSOT)：Bicep 模板多头拷贝
* **风险**：在 React 前端 `src/client-edge/src/presets/my/` 中包含了 `compute-module.bicep`。这是因为配置台需要提供 Bicep 打包下载功能。
* **隐患**：在企业开发中，如果同一个 Bicep 模块在前端源码里有一份，在 IaC 目录里又有一份，这会导致**代码重复**。一旦后续我们修改了 `secure-iot` 下的后端 compute 定义，极其容易漏改前端 Preset 里的那份拷贝，导致用户下载到的模板是过期甚至报错的。
* **💡 实用主义备注**：目前前端这一处拷贝是为了 Webpack 静态关系图的 Demo 生成，为保障前端稳定性，可以作为**静态资源 (Static Assets)** 保持冻结，但需要加以说明以区别于真实的物理信源。

### 🔴 4. 脚本混乱：`sh/` 位于根目录
* **风险**：在大型工程中，根目录下的 `sh/` 往往会退化为各种无序脚本的堆放地。
* **隐患**：应该将它们分类收纳，例如归入专门的 `/scripts` 或 `/infra/scripts` 中，从而更清晰地划分哪些是 IaC 脚本，哪些是应用构建脚本。

---

## 4. 推荐演进路线图：黄金标准目录结构 (Target Layout)

为了向企业级企业规范看齐，建议项目在后续 Sprint 中逐步向以下黄金结构演进：

```text
Project-OmniGuard/
├── .azure/                     # ⚠️ 仅用作微软官方工具链本地环境缓存目录 (必须加入 .gitignore)
├── docs/                       # 企业知识资产
│   ├── adrs/                   # 架构决策记录 (ADRs)
│   └── blueprints/             # 架构演进蓝图 (Blueprints)
├── infra/                      # 💎 统一的云基础设施主目录 (IaC Single Source)
│   ├── bicep/                  # Bicep 源代码 (替代原 .azure/ 下的编排)
│   │   ├── main.bicep
│   │   ├── nested-infra.bicep
│   │   └── templates/          # Sandbox / Secure-IoT 物理基准模板
│   ├── output/                 # 配置台生成的 parameters 存储区
│   └── scripts/                # 集中存放 provision.sh, whatif.sh, destroy.sh
├── src/                        # 💎 核心应用源码
│   ├── client-edge/            # 前端 Web 应用 (Next.js)
│   │   # 💡 移除 presets/my/ 中的物理 Bicep 拷贝
│   │   # 改由 API 动态通过 fs 读取根目录的 /infra/bicep/ 模板进行打包！
│   └── cloud-orchestrator/     # 后端大脑微服务 (FastAPI / Azure Functions)
│       ├── app/                # 框架入口 (function_app.py, host.json)
│       ├── core/               # 共享基础配置 (openai_config.py, database_client.py)
│       └── services/           # 独立业务域 (digitalhuman, embodied_brain, kol_analysis)
├── data/                       # 📂 本地临时数据/缓存区 (存放 daily_cache/)
│                               # 💡 彻底移出 src/ 源码区，本地挂载运行，云端走 Blob 存储
├── Makefile                    # 统一控制总线
└── .gitignore                  # Git 忽略配置
```

---

## 5. 改造步骤建议 (Step-by-Step Transition Plan)

如果您决定优化这个结构，建议遵循**低风险、分步走**的策略：

1. **第一步：解耦前端 Preset Bicep 拷贝**
   * 修改 `src/client-edge/src/app/api/download-iac/route.ts` 中读取模板的路径，让它直接使用相对路径 `../../../../.azure/templates/...` 读取统一模板，随后直接删除 `src/presets/my/` 目录，消除双头拷贝隐患。
2. **第二步：剥离 `/daily_cache`**
   * 将 `daily_cache` 目录从 `src/cloud-orchestrator` 移动到根目录的 `data/` 下。
   * 修改 Python 中的缓存路径引用。在 `.gitignore` 中加入 `/data/` 规则，彻底消除提交记录中巨大的 JSON 垃圾 Diff。
3. **第三步：IaC 重构（将 `.azure` 换为 `/infra`）**
   * 建立 `infra/` 目录，将整个 `.azure` 下的文件移动过去。
   * 修改 `sh/` 脚本中的 Bicep file 引用路径，并将其转移到 `infra/scripts/` 中。
   * 更新 `Makefile` 中的命令指向。
