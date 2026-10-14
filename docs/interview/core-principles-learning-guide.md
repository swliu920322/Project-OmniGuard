---
id: "DOC-INTERVIEW-CORE-PRINCIPLES"
title: "从 OmniGuard 学懂核心原理"
summary: "从零解释项目涉及的事件驱动、Azure IoT、采样控制、云边安全、多 Agent、评价和 IaC 原理，并给出代码入口与练习。"
version: "1.0.0"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - cyber-physical-safety
  - multi-agent
perspectives:
  - cloud-architecture
  - academic-research
layers:
  - cross-cutting
doc_type: tutorial
status: accepted
code_refs:
  - "src/cloud-orchestrator/embodied_brain/brain.py"
  - "src/cloud-orchestrator/embodied_brain/utils.py"
  - "src/cloud-orchestrator/edge-simulator/device_mock.py"
  - "src/client-edge/src/app/shared/physics/kinematic-token.ts"
  - ".azure/main.bicep"
test_refs:
  - "tests/test_brain.py"
  - "tests/test_benchmark_archives.py"
  - "tests/test_benchmark_scenarios.py"
---
# 从 OmniGuard 学懂核心原理

## 先建立一张完整地图

不需要同时学习“机器人、Azure、AI、前端、数学”五套体系。这个项目真正需要理解的是一条因果链：

    环境状态变化
      -> 软件设备产生遥测
      -> 云端事件系统接收遥测
      -> 确定性规则或 AI 作出判断
      -> 动作通过 C2D/API 返回
      -> 模拟 AGV 根据动作继续或停止

这条链路同时受三个约束：

1. **时间约束**：动作是否在车辆越过安全距离前返回；
2. **语义约束**：模型是否正确理解场景和策略；
3. **工程约束**：消息、身份、网络、部署和观测是否可靠。

学习时只需要不断回答五个问题：

- 数据从哪里来，到哪里去？
- 哪一步可能等待、失败、重试或重复？
- 哪一步是确定性的，哪一步是概率性的？
- 哪个结果是模拟值，哪个结果是实际测量？
- 如果这一层失败，系统应该安全停止，还是继续运行？

## 原理一：事件驱动系统把生产者和消费者解耦

### 什么是事件驱动

同步 HTTP 请求通常是：调用方发送请求，并一直等待接收方返回结果。

事件驱动系统通常是：生产者发布事件，消息系统保存或转发事件，消费者按照自己的速度处理。

    producer -> event broker -> consumer

在 OmniGuard 中：

- `device_mock.py` 是生产者；
- IoT Hub 接收设备遥测；
- IoT Hub 的 Event Hub-compatible endpoint 提供事件流；
- Azure Functions 的 Event Hub Trigger 是消费者；
- `iot_telemetry_processor` 处理消息。

### 为什么不让设备直接调用模型 API

设备直接调用模型 API 会把设备身份、模型密钥、重试和服务可用性耦合在一起。IoT Hub 提供的是设备接入边界：

- 每个设备可以有独立身份；
- 设备使用 MQTT 长连接上传遥测；
- 云端可以集中消费消息；
- 后端可以向指定设备发送 C2D 消息。

这并不自动意味着系统已经“零信任”。服务端身份、权限、网络和密钥仍要分别设计。

### Partition、consumer group 和 checkpoint

Event Hub 会把事件分布到若干 partition。partition 内可以保持顺序，不同 partition 可以并行消费。

Consumer group 表示一套独立的消费视图。例如，审计系统和告警系统可以各自读取同一事件流，而不互相抢走消息。

Checkpoint 记录消费者已经处理到 partition 的什么位置。Azure Functions 的 Event Hub Trigger 需要存储账户维护租约和 checkpoint，这就是为什么本地运行时即使只想接收 IoT 消息，也可能因为 `AzureWebJobsStorage` 配置或网络权限失败。

### At-least-once 和幂等

消息系统常见保证是 at-least-once：一条消息不会轻易丢失，但在故障和重试时可能被处理多次。

因此消费者要尽量幂等：同一事件处理一次和处理两次，最终状态不应被破坏。

常见做法包括：

- 为事件分配唯一 `event_id`；
- 保存已处理 ID 或使用带版本号的状态更新；
- 动作指令包含 command ID；
- 设备拒绝重复执行已经完成的 command；
- Cosmos DB 更新使用版本/ETag 或条件写入。

当前项目没有完整的事件去重和命令幂等协议。这是合理的研究原型限制，也是很好的“如果生产化会怎么做”回答。

### Backpressure 是什么

如果设备产生消息的速度大于消费者处理速度，未处理事件会积压，这就是 backpressure。

本项目的串行 LLM 调用可能耗时数秒甚至更久，而设备模拟器可以每秒发送遥测。如果所有消息都触发三个 Agent，消费速度就可能落后于生产速度。

生产设计需要考虑：

- 是否每条遥测都需要 AI；
- 是否只处理最新状态；
- 是否聚合或采样；
- 是否设置并发上限；
- 失败消息是否进入 dead-letter 路径；
- 过期动作是否应该直接丢弃。

### 项目入口与练习

阅读：

- [软件设备模拟器](../../src/cloud-orchestrator/edge-simulator/device_mock.py)
- [Event Hub Trigger](../../src/cloud-orchestrator/embodied_brain/brain.py)
- [C2D 实现](../../src/cloud-orchestrator/embodied_brain/utils.py)

练习：画出一条遥测从 `device_mock.py` 到 `iot_telemetry_processor` 再回到 `message_handler` 的路径，在每条箭头旁标注协议、可能失败的位置以及是否可能重复。

掌握标准：能够不用代码解释 partition、checkpoint、at-least-once、幂等和 backpressure，并指出当前项目哪些没有完整实现。

## 原理二：Azure Functions 是事件计算，不是硬实时控制器

### Trigger 和 binding

Trigger 决定函数什么时候被调用；binding 帮助函数与 Azure 服务交换数据。项目使用 Event Hub Trigger 接收 IoT Hub 暴露的事件流。

Functions 的优势是：

- 不需要自己维护事件轮询进程；
- 能根据事件负载扩缩；
- 与 Azure 事件和存储服务集成方便；
- 适合遥测处理、告警、状态更新和异步任务。

### 为什么会有冷启动

在按需计算计划中，如果一段时间没有请求，平台可能回收实例。下一次事件到来时，需要重新分配实例、加载 Python、导入依赖并初始化客户端，这会增加冷启动延迟。

即使没有冷启动，以下延迟也仍然存在：

- 消息等待消费者轮询；
- 网络建立和 TLS；
- Cosmos DB 读写；
- 三次串行 LLM 调用；
- C2D 下发。

因此“Function 被成功触发”只能证明事件处理开始了，不能证明动作满足机器的 deadline。

### 应该怎样使用 Functions

适合：

- 收集遥测；
- 更新数字状态；
- 生成告警；
- 运行没有硬 deadline 的智能分析；
- 编排后续异步工作。

不应单独承担：

- 紧急停止；
- 毫秒级稳定闭环；
- 断网时仍必须执行的安全逻辑。

### 项目入口与练习

阅读 [brain.py](../../src/cloud-orchestrator/embodied_brain/brain.py) 中的 `iot_telemetry_processor`，把函数内部步骤分成：本地计算、Azure I/O、LLM I/O、C2D I/O。

练习：假设 Cosmos 写入 50 ms，三个模型分别需要 1 s、2 s 和 5 s，C2D 需要 100 ms，先忽略排队，计算总延迟。然后解释为什么真实最坏值不能只用这些平均值相加得到。

掌握标准：能回答“为什么最初选择 Functions 是合理的”和“为什么后来不能把它当作紧急制动控制器”。

## 原理三：数字控制是离散采样，不是连续观察

### 采样周期

数字控制系统只能在离散时间点读取状态。若检测间隔为 `T` 秒、速度为 `v` 米/秒，在下一次检查前车辆最多会继续移动约：

    d_wait = v × T

示例：

- `v = 1 m/s`，`T = 20 ms`，等待距离约 `0.02 m`；
- `v = 1 m/s`，`T = 3 s`，等待距离约 `3 m`；
- `v = 1 m/s`，`T = 7.667 s`，等待距离约 `7.667 m`。

第三个例子使用 diagnostic benchmark 的中位延迟做推导说明。它不是实际 AGV 行驶测量。

### 停车需要的不只是检测时间

更完整但仍简化的安全距离可以写成：

    d_required
      = detection/reaction distance
      + physical braking distance
      + uncertainty margin

当前浏览器 kernel 中的 `brakingDistanceM` 实际计算的是速度乘以 brake latency，更接近“制动指令生效前的反应距离”，不是根据减速度计算的真实机械制动距离。

若考虑恒定减速度 `a`，常见的理想制动距离项是：

    d_brake = v² / (2a)

真实系统还需要传感器误差、坡度、载荷、轮胎/地面附着、执行器故障和安全系数。项目没有验证这些参数，所以不能声称完成了机器人安全分析。

### Deadline 比“最终成功”更重要

对普通后台任务，晚一点完成可能仍然有价值。对移动机器，超过 deadline 的正确动作也可能已经没有意义。

因此应该同时记录：

- 动作是否正确；
- 动作何时产生；
- 产生时是否仍在有效窗口内；
- 过期动作是否被拒绝执行。

### 项目入口与练习

阅读 [physics kernel](../../src/client-edge/src/app/shared/physics/kinematic-token.ts) 和 [Dashboard reference](../dashboard/00-overview.md)。

练习：选取三组速度、clearance 和 latency，计算 `v × T`。再加入一个假定减速度，用 `v²/(2a)` 比较“等待距离”和“机械制动距离”。明确标记哪些是项目配置、哪些是自己的假设。

掌握标准：能推导公式、解释单位、说明简化条件，并主动说出它不等于真实机器人制动模型。

## 原理四：云端智能路径与本地安全路径属于不同时间尺度

### 两条路径

合理的概念架构应把它们分开：

    local safety path
    sensor -> deterministic guardian -> actuator stop

    cloud intelligence path
    telemetry -> cloud event -> AI interpretation/planning/audit

本地安全路径追求：

- 延迟上界；
- 断网可用；
- 行为可预测；
- 小而可验证。

云端智能路径追求：

- 更丰富的上下文；
- 跨设备信息；
- 复杂策略和规划；
- 日志、审计和持续改进。

### 边缘不等于绝对安全

边缘只是计算位置更靠近设备，并不会自动解决所有问题。边缘模型同样可能：

- 分类错误；
- 推理超时；
- 资源不足；
- 软件崩溃；
- 接收错误传感器输入。

真正关键的是安全路径是否具有明确上界、降级策略和可验证行为，而不是简单贴上 edge 标签。

### 项目当前的意义

浏览器里的 cloud/edge 对比是解释时间尺度的模型，不是边缘硬件 benchmark。20 ms 等数值是配置值。

项目由此支持的结论是：云端 Agent 可以参与理解、规划和审计；紧急停止需要独立的、本地且有界的机制。

练习：画两条路径，并为每条路径写出“目标、deadline、失败时行为、允许使用的算法”。

掌握标准：能解释“为什么不是把所有逻辑都移到 edge”，也能解释“为什么云端仍然有价值”。

## 原理五：确定性规则和概率模型承担不同责任

### 什么是确定性检查

相同输入按照明确规则总是产生相同输出，例如：

    if hp <= 0: offline_lock
    if battery < 5: emergency_halt

这类条件适合直接写成代码或经过验证的 policy engine，不需要 LLM 理解自然语言。

### 什么是概率模型

LLM 根据上下文生成最可能的输出。即使 temperature 为 0，模型版本、provider 行为、prompt、解析和服务更新仍可能影响结果。它不等于形式化确定性。

适合 LLM 的任务：

- 非结构化语义理解；
- 高层意图分类；
- 复杂上下文摘要；
- 候选计划生成；
- 人类审阅前的建议。

不应只依赖 LLM 的任务：

- 生命安全或设备保护的最终硬约束；
- 严格 deadline；
- 必须百分之百符合 schema 的执行边界。

### Guardrail 应该怎样分层

    input validation
      -> deterministic physical invariants
      -> model interpretation
      -> deterministic policy validation
      -> schema validation / action allow-list
      -> actuator-side safety check

当前项目的 Safety 阶段本身仍由 LLM 判断自然语言规则，所以它展示的是 safety-agent 思路，不是最终的确定性 safety firewall。生产化时，30 cm 之类的硬阈值应该由版本化配置和确定性代码执行。

练习：把 Tenant-Alpha 规则拆成两类：可直接编码的硬约束，以及需要语义理解的软策略。解释为什么要拆开。

掌握标准：能够说明“用了 Safety Agent”不等于“系统已经安全”。

## 原理六：多 Agent 的价值来自职责和可观察性，不来自数量

### 当前三个阶段

| 阶段 | 责任 | 可以 early exit 吗 |
|---|---|---|
| Router | 把遥测映射到场景类别 | SENSOR_ERROR 时可以 |
| Safety | 根据策略允许或阻断 | BLOCK 时可以 |
| Compiler | 产生结构化动作 | 最后阶段 |

拆分的好处：

- 每一步可以记录 trace；
- 可以看到错误发生在哪层；
- 可以在早期拒绝明显无效或危险请求；
- prompt 和输出责任更集中。

拆分的代价：

- 三个串行网络调用的延迟相加；
- 任意一步失败都会影响整体；
- 不同 prompt 可能使用不同定义；
- token 和调用成本增加；
- 系统测试组合更多。

### 串行延迟

若三个 Agent 串行执行：

    T_total ≈ T_router + T_safety + T_compiler + T_other

Early exit 的作用是减少某些路径的后续调用：

    sensor error -> skip safety/compiler
    safety block -> skip compiler

但“少调用一次”只直接证明减少了调用数量。节省了多少真实时间和成本，需要具体运行证据。

### 什么时候不需要多 Agent

如果一个确定性规则引擎已经可以完成任务，三个 LLM 是多余的。如果一个模型可以一次产生分类、理由和候选动作，再由确定性 validator 审查，也可能比三个串行模型更合适。

面试中应把多 Agent 描述成被测试的设计选择，而不是行业正确答案。

练习：提出三种替代方案并比较：单 Agent、三个串行 Agent、规则引擎加一个 planning Agent。比较延迟、可审计性、成本和故障面。

掌握标准：能解释为什么选择当前方案，也能说出什么证据会让自己放弃它。

## 原理七：评价必须把标签、组件和系统结果分开

### Confusion matrix 的基本含义

对 critical 类别：

- true positive：critical，被识别为 critical；
- false negative：critical，被识别为非 critical；
- false positive：非 critical，被识别为 critical；
- true negative：非 critical，被识别为非 critical。

常用指标：

    recall = TP / (TP + FN)
    precision = TP / (TP + FP)
    accuracy = 所有正确样本 / 所有被评价样本

安全场景通常更关注 false negative，但前提是 critical 标签本身与运行策略一致。

### 为什么旧结果会误导

旧生成器把 5–50 cm 标为 critical，Safety policy 却以低于 30 cm 为硬阈值。因此 31–46 cm 的五个 Router disagreement 被统计为 false negative，却不能直接解释成违反 30 cm 策略。

还必须继续检查最终动作。那五条记录最终都包含 stop，所以它们不是五个已经证明的不安全执行动作。

### 四层评价

| 层级 | 应回答的问题 |
|---|---|
| 数据定义 | 场景标签是否与策略版本一致？ |
| Router | 分类是否与标签一致？ |
| Safety | 是否按照策略阻断？ |
| Final action | 最终动作是否违反安全约束？ |

### 为什么同时报告 median、mean 和 tail

- median：一半样本低于它，一半高于它；
- mean：容易被极端值拉高；
- p95：大部分但不是全部请求的尾部表现；
- max：本次运行观察到的最坏值。

deadline-bound 系统不能只报告 mean。还需要样本数、运行条件和每阶段耗时。

### 可复现性最低要求

- provider 和 resolved model；
- seed；
- temperature；
- 标签/策略版本；
- planned count 和 completed count；
- 原始逐行结果；
- 运行时间和状态；
- 统计脚本版本。

阅读 [Evidence index](../evidence/README.md) 和 [benchmark guide](../../src/cloud-orchestrator/embodied_brain/benchmark_results/README.md)。

练习：不用看结论，随机选择十条 CSV 记录，自己判断 Router、Safety 和 final action 三个层级是否正确。

掌握标准：能够解释为什么“90% accuracy”既可能很有用，也可能几乎没有决策价值。

## 原理八：IaC 的价值是可重复表达约束，不是文件很多

### Declarative infrastructure

Bicep 描述期望存在的 Azure 资源和关系，Azure Resource Manager 负责比较并执行变更。它与一串手工 Portal 点击的区别是：配置可以版本化、评审和重复执行。

### Idempotency

理想情况下，相同模板重复部署不会不断创建新的不同资源，而是让环境收敛到同一目标状态。

现实中仍会遇到：

- 全局唯一资源名冲突；
- API version 不兼容；
- 资源软删除后名称或配额没有释放；
- 角色分配缺少权限；
- 区域没有模型容量；
- 网络规则阻止部署后的应用访问依赖。

### Control plane 与 data plane

Control plane 权限管理“能否创建或配置资源”。Data plane 权限管理“能否读取秘密、写入 Cosmos 数据或调用模型”。

一个身份能够部署 Cosmos DB，不代表它自动能够读写容器；能够创建 Key Vault，也不代表它自动能够读取 secret。

### Managed Identity 与连接字符串

Managed Identity 的目标是让 Azure 工作负载获得平台身份，通过 RBAC 访问其他资源，避免长期密钥。

连接字符串更容易快速接通，但需要安全存储、轮换，并存在泄露风险。试用订阅或受限租户无法创建 role assignment 时，fallback 可能是现实选择，但必须记录风险，不能把 fallback 宣传成零密钥架构。

### Private Endpoint 与 Private DNS

Private Endpoint 为 PaaS 服务提供 VNet 内的私有 IP。客户端还必须通过 Private DNS 把服务域名解析到该私有 IP。

因此“创建了 Private Endpoint”并不代表链路已经可用；DNS zone、VNet link、子网规则和应用所在网络都必须匹配。

### 区域与配额也是架构约束

Azure AI 模型容量、SKU 和版本不是每个区域都相同。区域选择会影响模型可用性、网络拓扑、数据驻留、价格和延迟。

项目历史中不断调整模板的价值就在这里：基础设施设计不是把服务图标连起来，而是处理权限、配额、命名、区域和网络之间的约束。

### 学习方法

不要立即重新部署付费环境。先做三步：

1. 阅读 [.azure/main.bicep](../../.azure/main.bicep)，只画资源和依赖；
2. 选择一次 Git 历史中的失败，写出错误、根因、修复和代价；
3. 有可用订阅时先运行 what-if，再决定是否部署。

掌握标准：能深入讲一个实际部署失败，比能背出二十个 Azure 服务更重要。

## 原理九：可观察性必须贯穿整条控制链

为了判断“动作为什么晚了或错了”，每次请求需要关联同一条 trace：

    event_id / correlation_id
      -> ingestion timestamp
      -> function start
      -> Cosmos read/write
      -> Router start/end/result
      -> Safety start/end/result
      -> Compiler start/end/result
      -> C2D accepted
      -> device acknowledged/executed

仅记录总耗时会隐藏瓶颈。仅记录 C2D accepted 也不能证明设备已经执行。

生产化还应区分：

- retryable error 与 permanent error；
- timeout 与模型拒绝；
- parse failure 与错误分类；
- command generated、delivered、acknowledged、executed；
- 当前状态与过期状态。

当前 benchmark 已保存部分 stage latency 和 trace，但真实 IoT 路径没有完整端到端 acknowledgement。这是明确的能力边界。

练习：为一次遥测设计十个时间戳字段，说明每两个时间戳之差代表哪一段延迟。

掌握标准：面对 73.9 秒的总延迟，知道下一步应查哪个阶段，而不是只说“Azure 或模型很慢”。

## 建议的学习顺序

### 第一层：先会讲系统

完成以下任务：

1. 画出事件路径和本地安全路径；
2. 解释 `speed × latency`；
3. 解释确定性规则与 LLM 的区别；
4. 说清楚 200-run 和 60-run；
5. 承认模拟、实测和计划之间的边界。

达到标准：可以完成五分钟项目介绍，不依赖术语堆砌。

### 第二层：再会读代码

按顺序阅读：

1. `device_mock.py`；
2. `brain.py` 的 Event Hub 路径；
3. `brain.py` 的 HTTP 路径；
4. `utils.py` 的 Cosmos、LLM 和 C2D；
5. `kinematic-token.ts`；
6. benchmark guide 和测试。

达到标准：给定一条输入，能够追踪它经过哪些函数、在哪里产生 I/O、在哪里可能 early exit。

### 第三层：用小练习证明理解

- 手算三组延迟距离；
- 为事件设计 idempotency key；
- 把 30 cm 硬规则从自然语言拆成伪代码；
- 分析一条 benchmark 记录；
- 讲一次 Bicep 部署失败；
- 设计一条端到端 trace。

达到标准：不看文档也能完成，并能说明假设。

### 第四层：最后准备架构改进

只需要提出，不必立刻全部实现：

- 单一版本化 safety policy；
- 本地 deterministic guardian；
- command TTL 和设备 acknowledgement；
- event idempotency 与 dead-letter；
- 真实 cloud metadata，不使用模拟 fallback；
- v3 benchmark；
- cloud Agent advisory 化。

达到标准：每项改进都能回答解决什么风险、引入什么成本。

## 现在不需要优先学习什么

除非目标岗位明确要求，暂时不需要为了这个项目深入：

- ROS/ROS2；
- SLAM 和路径规划算法；
- PID/MPC 控制器推导；
- 电机驱动和嵌入式开发；
- 自训练模型或微调；
- Kubernetes；
- 更多 Azure 服务；
- 更复杂的前端动画。

这些主题本身有价值，但不能补强当前项目最需要的“讲清现有系统和证据”。如果未来申请机器人控制岗位，再单独建立真实硬件和控制理论学习路线。

## 面试最低掌握检查

能够独立回答以下问题，才算真正掌握项目：

- 为什么 IoT Hub 后面还能被 Event Hub Trigger 消费？
- checkpoint 为什么需要 Storage？
- 一条消息为什么可能被处理两次？
- 如果设备每秒发送一次、模型处理十秒，会发生什么？
- Function 成功执行为什么不代表动作及时？
- `speed × latency` 的单位和假设是什么？
- 20 ms edge latency 是实测还是配置？
- Safety Agent 为什么不是确定性安全控制器？
- 多 Agent 为什么可能比单 Agent 更差？
- early exit 直接证明了什么，没有证明什么？
- 90% accuracy 为什么可能掩盖风险？
- 五个 Router disagreement 为什么不是五个危险动作？
- Managed Identity 与连接字符串的取舍是什么？
- Private Endpoint 为什么还需要 DNS？
- 如果重新设计，哪部分必须留在本地？

不会回答时，不要背标准答案。回到对应代码，画路径、做计算，再用自己的语言解释。

## 这份指南与后续个人规划的关系

这是一份项目通用学习地图，不是最终职业规划。个人简历和学习顺序还要结合目标岗位、过往经验、学历、时间、英语和实际求职市场。

收到个人信息后，应重新决定：

- OmniGuard 在简历中占多少篇幅；
- 主投 Cloud、AI、Solution Architect 还是其他岗位；
- 哪些技术缺口是 P0，哪些可以暂缓；
- 是否需要补一个更小但更能证明编码能力的项目；
- LinkedIn、GitHub README 和简历应该分别强调什么；
- 面试准备使用中文、英文或双语。
