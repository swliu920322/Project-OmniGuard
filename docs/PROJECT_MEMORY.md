# Project-OmniGuard 持久记忆与维护地图

> 目的：给后续维护、扩展、排障、重构提供一份长期可复用的项目心智地图。
> 这份文档聚焦“仓库结构、职责边界、运行模式、关键脚本、前后端拆分、IaC 与 ADR 的关系”。

---

## 1. 项目总览

`Project-OmniGuard` 是一个 **Azure 云部署为主、支持本地调试** 的前后端分离项目，整体上可以拆成两大部分：

1. **IaC / 基础设施层**
   - 以 Bicep 为核心
   - 负责订阅级资源、网络、存储、Function App、Static Web App 等云资源编排
   - 入口主要在 `.azure/`

2. **项目应用层**
   - 前端：`src/client-edge/`
   - 后端：`src/cloud-orchestrator/`
   - 后端以 Azure Functions / ASGI 方式部署，同时支持本地 `func start` 调试

此外，仓库根目录还有：
- `docs/adrs/`：架构决策记录
- `docs/architect-growth-journa-logs/`：成长日志与阶段复盘
- `sh/`：部署、检查、启动、销毁脚本
- `Makefile`：把常用命令统一封装起来

---

## 2. 核心分层

### 2.1 IaC 层：`.azure/`

这是项目的基础设施主干，负责 Azure 上的资源生命周期。

#### 关键文件
- `.azure/main.bicep`
  - 订阅级入口
  - 创建资源组
  - 调用嵌套模块
- `.azure/nested-infra.bicep`
  - 资源组级网络与中间层
  - 定义 VNet、Subnet、NSG、Private Endpoint、Static Web App 绑定等
- `.azure/compute-module.bicep`
  - Function App / 计算大脑的部署模块
  - 包含应用设置、存储绑定、VNet 集成等
- `.azure/network-rules.json`
  - 网络安全规则矩阵
  - 用于解耦网络策略与模板代码

#### IaC 的设计特点
- 以 **模块化 Bicep** 拆分职责
- 以 **订阅级 main.bicep + 资源组级 nested-infra.bicep + 计算模块 compute-module.bicep** 组合部署
- 支持网络隔离、私网集成、静态站点和后端算力分离

---

### 2.2 前端层：`src/client-edge/`

这是一个 Next.js 前端，主要负责页面展示、导航、以及和后端的交互入口。

#### 主要页面
1. **启动 Bicep 页面**
   - `src/client-edge/src/app/page.tsx`
   - 现在是一个“启动台”
   - 用来选择组合模式，例如：
     - 本地订阅 + 第三方 OpenAI
     - 本地订阅 + Azure OpenAI
     - 云端订阅 + Azure OpenAI
   - 这是后续扩展最关键的入口之一

2. **个人简历页面**
   - 同样由 `src/client-edge/src/app/page.tsx` 承载其中的履历展示区域
   - 作为个人介绍、经验、证书、教育背景的展示页

3. **Bicep 模板最佳实践 / IaC Hub 页面**
   - `src/client-edge/src/app/iac/page.tsx`
   - 展示 preset 列表
   - 负责进入 `canvas` 画布页

4. **Bicep 画布页面**
   - `src/client-edge/src/app/iac/canvas/page.tsx`
   - 用于查看、编辑、上传、理解多文件 Bicep 拓扑
   - 是未来扩展 IaC 自动化能力的重要入口

#### 前端相关支持文件
- `src/client-edge/src/config/bicepPresets.ts`
  - 自动扫描 `src/client-edge/src/presets/`
  - 生成预设方案列表
- `src/client-edge/src/components/digital-human/`
  - 数字人 / 聊天助手组件
  - 负责本地与云端推理分流
- `src/client-edge/src/lib/launchProfile.ts`
  - 启动模式定义
  - 负责本地保存与读取当前模式
- `src/client-edge/src/types/`
  - TS 类型声明
- `src/client-edge/src/utils/`
  - Bicep 解析工具
- `src/client-edge/src/workers/`
  - Web Worker 相关逻辑

---

### 2.3 后端层：`src/cloud-orchestrator/`

后端是一个 **Azure Functions + FastAPI/ASGI** 风格的服务。

#### 主要职责
- 提供聊天流式接口
- 提供资产认证 / SAS 令牌签发
- 接收前端请求并按页面上下文决定提示词
- 支持本地调试与云端部署两种运行方式

#### 关键文件
- `function_app.py`
  - FastAPI 路由入口
  - `/api/assets/auth`
  - `/api/chat/stream`
  - LLM 客户端统一从 `local.settings.json` 读取 `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_API_DEPLOYMENT_NAME`，直连 Azure OpenAI，不再做多供应商适配
- `requirements.txt`
  - Python 依赖清单
- `local.settings.example.json`
  - 本地配置样例
- `local.settings.json`
  - 本地调试配置（通常由脚本生成）
- `host.json`
  - Azure Functions 主机配置
- `Function_deploy.md`
  - 后端部署说明
- `readme.md`
  - 架构说明与运行笔记

#### 后端运行模式
- **Azure 云上模式**
  - 通过 Azure Functions 部署
  - 使用云端环境变量配置存储和 OpenAI 接口
- **本地模式**
  - `func start`
  - 读取本地 `local.settings.json`
  - 用于开发、验证和调试

---

## 3. 运行与部署入口

### 3.1 Makefile

根目录的 `Makefile` 是最重要的命令聚合入口之一。

#### 常见目标
- `make fe`
  - 进入前端目录并安装依赖
- `make infra`
  - 拉起云端底座
- `make provision`
  - 执行 `sh/infra-up.sh`
- `make destroy`
  - 执行 `sh/infra-destroy.sh`
- `make dev`
  - 启动后端本地调试

#### 维护建议
- 新增常用功能时，尽量先往 `Makefile` 里收口
- 让“单条命令完成一个完整动作”成为默认习惯

---

### 3.2 `sh/` 目录脚本

这是当前项目中非常关键的运维层。

#### `sh/infra-up.sh`
- 负责基础设施部署与配置同步
- 已拆成“模式化”的运行方式：
  - Azure 模式
  - 第三方 OpenAI 兼容模式
- 还会同步本地 `local.settings.json`

#### `sh/deploy-core.sh`
- 偏向后端发布
- 负责把 Function App 发布到 Azure

#### `sh/check.md`
- 运行核验与对账说明

#### `sh/infra-destroy.sh`
- 清理云资源
- 属于危险操作，后续扩展时要更加谨慎

---

## 4. 当前最重要的设计边界

### 4.1 前后端分离

这是项目的基础架构前提：
- **前端** 负责交互、展示、启动模式选择
- **后端** 负责推理、流式输出、SAS / 存储交互

### 4.2 IaC 与业务代码分离

Bicep 模板应尽量只负责：
- 创建资源
- 注入必要环境变量
- 绑定网络和存储

业务逻辑不要再下沉到 Bicep 中。

### 4.3 本地与云端配置分离

建议形成统一原则：
- **代码仓库里不写真实密钥**
- 云端运行时通过环境变量注入
- 本地通过 `local.settings.json` 或开发脚本同步

### 4.4 单订阅耦合问题

你当前提到的痛点是：**infra-up 太依赖单个 Azure 订阅**。

未来更稳的做法是把启动拆成三个层次：
1. 选择订阅
2. 选择 AI provider
3. 选择部署模式（本地 / 云端）

这三层最好都做成显式参数，而不是写死在脚本里。

---

## 5. 启动模式建议

### 当前已经存在的思路
- 本地订阅 + 第三方 OpenAI
- 本地订阅 + Azure OpenAI
- 云端订阅 + Azure OpenAI

### 后续建议继续扩展
- 本地订阅 + 本地 mock LLM
- 云端订阅 + BYO OpenAI 兼容接口
- 多订阅切换启动
- 只部署 IaC 不部署应用
- 只同步本地配置不重新部署

### 建议的配置来源
- 前端：`launchProfile`
- 脚本：环境变量
- 后端：`local.settings.json` → `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_API_DEPLOYMENT_NAME`
- IaC：Bicep parameters

---

## 6. 前端页面职责表

| 页面 | 路由 | 职责 |
|---|---|---|
| 启动台 / 履历页 | `/` | 选择组合模式、展示简历 |
| 大 V 预测 | `/prediction` | 采集推文、反爬会话配置、AI 时序提炼与宏观投研决策预测 |
| IaC Hub | `/iac` | 列出预设模板、进入画布 |
| IaC 画布 | `/iac/canvas` | 预览、编辑、上传 Bicep 多文件拓扑 |

---

## 7. 后端接口地图

### `POST /api/assets/auth`
- 返回 SAS token
- 用于前端或本地资源访问

### `POST /api/chat/stream`
- 流式聊天接口
- 根据 `context` 决定页面上下文提示词
- 从 `local.settings.json` 读取 Azure OpenAI 配置，不再支持多供应商切换

### `GET /api/kol/list`
- 获取系统监控的大 V 账户列表

### `GET /api/kol/report`
- 获取缓存在本地的大 V 投研研报数据

### `POST /api/kol/predict`
- 更新免登录凭证，运行爬虫，缓存原始 JSON 推文并执行 AI 预测

---

## 8. IaC 结构建议理解

### `.azure/main.bicep`
- 负责订阅级编排
- 创建资源组
- 传参给下层模块

### `.azure/nested-infra.bicep`
- 负责网络、Static Web App、链接 backend 等
- 是项目核心网络层

### `.azure/compute-module.bicep`
- 负责 Function App、存储绑定、应用设置
- 是后端算力层

### `docs/adrs/`
- 记录架构演进
- 是理解为什么“这么设计”的最佳资料

---

## 9. 维护时优先看什么

如果后续要加功能，建议优先查看这些位置：

1. **页面入口变化**
   - `src/client-edge/src/app/page.tsx`
   - `src/client-edge/src/app/iac/page.tsx`
   - `src/client-edge/src/app/iac/canvas/page.tsx`

2. **LLM 路由变化**
   - `src/cloud-orchestrator/function_app.py` — `build_llm_client()` 直读 `local.settings.json` 配置

3. **基础设施变化**
   - `.azure/main.bicep`
   - `.azure/nested-infra.bicep`
   - `.azure/compute-module.bicep`

4. **命令入口变化**
   - `Makefile`
   - `sh/*.sh`

5. **架构背景**
   - `docs/adrs/*`
   - `src/cloud-orchestrator/readme.md`
   - `guide.md`
   - `destination.md`

---

## 10. 推荐的后续扩展方向

### 短期
- 把 `infra-up.sh` 进一步拆分为：
  - 部署
  - provider 注入
  - 本地配置同步
- 为启动台增加模式说明与一键执行按钮
- 为后端增加更明确的 profile 路由

### 中期
- 将订阅、资源组、模型、provider 做成统一配置文件
- 将前端启动台和脚本参数对齐
- 增加环境校验和预检

### 长期
- 建立更稳定的多环境支持
- 增加测试与预发模式
- 把这份文档发展成“系统维护总索引”

---

## 11. 这份文档的用途

这份文档适合拿来做：
- 仓库心智地图
- 新功能扩展前的快速回忆
- 排障定位第一站
- 新成员或未来我自己的长期维护参考

如果未来仓库继续增长，建议把这份文档保持更新，并在每次增加重要模块后补一段：
- 新模块做什么
- 路由是什么
- 依赖谁
- 配置从哪来
- 本地怎么跑
- 云上怎么部署

---

## 12. 当前结论

你这个项目已经不是“一个脚本 + 一个 Function”了，而是一个明确的三层体系：

- **IaC 层**：管云资源与网络
- **应用层**：管前端与后端业务
- **运行层**：管启动模式、订阅切换、provider 注入和本地调试

只要把这三层边界继续收紧，后面功能会很好加。

