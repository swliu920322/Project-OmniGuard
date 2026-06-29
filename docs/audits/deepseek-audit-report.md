架构审计报告：Project-OmniGuard

  红线 1：状态解耦 — 未通过

  问题：无分布式状态层，本地缓存与全局变量在多实例下失效

  - embodied_brain/brain.py:17 — 模块级全局变量 _cosmos_container，单例模式。在 Consumption Plan 多实例场景下不会出问题（Cosmos 客户端是纯网络层），但完全没有
  Redis 状态机用于高并发协调。
  - kol_analysis/cache_manager.py:14 — 使用本地文件系统做缓存。Azure Functions 多实例共享零文件系统，缓存命中不一致。正确做法：Redis Cache 或 Cosmos DB。
  - embodied_brain/brain.py:52 — upsert_item 每次写入 Cosmos DB 都重新 get_cosmos_container() 获取 client。高频 I/O
  路径下每次都创建新连接（虽然有全局变量兜底，但每次调用 get_cosmos_container() 是冗余的）。

  红线 2：吞吐压测 — 未通过

  问题：零延迟基线、零熔断、零背压

  - 全文无延迟基线：没有任何 DB I/O 或 LLM 调用附带 17ms 延迟对标
  - embodied_brain/brain.py:58-127 — Agent pipeline 串行调 3 次 LLM。每次都是同步 HTTP 调用，无超时、无熔断、无 fallback。3 次 LLM 串行 ≈ 3-6s 延迟
  - embodied_brain/utils.py:96 — client.chat.completions.create() 无 timeout 参数，可能挂死
  - digitalhuman/router.py:78 — stream=True 的 LLM 调用也无超时
  - kol_analysis/x_scraper.py:87 — timeout=10 合理，但整体无重试/退避策略

  红线 3：去 AI 化（代码注释/文档） — 未通过

  大量营销化术语需要替换为动词驱动工程语言

  典型违规：

  ┌──────────────────────────────────┬───────────────────────────────────────────────────────────────────────────┐
  │               文件               │                                 违规内容                                  │
  ├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ digitalhuman/router.py:15        │ [⚡ AZURE SIGN] 激活 Azure OpenAI 客户端                                  │
  ├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ digitalhuman/router.py:67        │ 🟩 动态神经元系统：根据前端发送过来的物理路由，动态追加大模型的专业限定词 │
  ├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ digitalhuman/router.py:60        │ 🟩 核心对账：拦截提取前端路由坐标                                         │
  ├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ embodied_brain/brain.py:45       │ 🟩 1.5. 读取 Cosmos DB 中的上一次状态 (用于安全审计)                      │
  ├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ embodied_brain/brain.py:54       │ [💾 记忆固化] 探针 {device_id} 状态已写入 Cosmos DB                       │
  ├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ embodied_brain/brain.py:128      │ [⚡️ 物理下行] 动作序列已砸回探针 {device_id} 的电机                       │
  ├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ edge-simulator/device_mock.py:24 │ 建立底层神经丛连接                                                        │
  ├──────────────────────────────────┼───────────────────────────────────────────────────────────────────────────┤
  │ edge-simulator/device_mock.py:31 │ 神经链路贯通。开始高频压测物理环境数据                                    │
  └──────────────────────────────────┴───────────────────────────────────────────────────────────────────────────┘

  修正指令：剥离 Revolutionize/Paradigm/神经元/神经丛/记忆固化/物理下行/物理探针/神经链路 等修辞词汇。强制使用 Fix/Strip/Force/Write/Read/Send/Receive。

  附加发现

  A. 凭证泄露 — 严重安全违规

  kol_analysis/config.py:4-44 包含 硬编码的 X.com auth_token、ct0、cookies 和 API Bearer token。文件已提交到 Git 仓库。攻击者可提取这些凭证冒充用户访 X.com API。

  B. 三套独立的 LLM 客户端构建

  ┌────────────────────────────────────────┬──────────────────┬───────────────────────────────────────────────┐
  │                  文件                  │     构建方式     │                 环境变量命名                  │
  ├────────────────────────────────────────┼──────────────────┼───────────────────────────────────────────────┤
  │ digitalhuman/router.py:10-24           │ AsyncAzureOpenAI │ OPENAI_BASE_URL/API_KEY/DEPLOYMENT_NAME       │
  ├────────────────────────────────────────┼──────────────────┼───────────────────────────────────────────────┤
  │ embodied_brain/utils.py:82-94          │ AzureOpenAI      │ AZURE_OPENAI_ENDPOINT/API_KEY/DEPLOYMENT_NAME │
  ├────────────────────────────────────────┼──────────────────┼───────────────────────────────────────────────┤
  │ kol_analysis/inference_engine.py:11-50 │ AzureOpenAI      │ 同时兼容上述两套命名                          │
  └────────────────────────────────────────┴──────────────────┴───────────────────────────────────────────────┘

  同一个 Azure OpenAI 服务，三种构建方式，两个命名体系。应统一为一个工厂函数。

  C. 零测试覆盖

  整个代码库无 test 目录、无 pytest 文件、无单元测试。critical path（Agent pipeline、SAS token 生成、LLM 流式响应解析）无任何自动化验证。

  D. 同步 IoT 事件处理的风险

  embodied_brain/brain.py:25 — iot_telemetry_processor 是 EventHubMessageTrigger，但处理逻辑是同步的，包含 3 次串行 LLM 调用（每次 1-2s）。EventHub
  的默认消费者会超时并将消息退回，导致重复处理和费用暴增。正确做法：EventHub -> Queue -> Background Processing。

  E. 前端架构

  前端是 Next.js 应用，包含这些页面：
  - /dashboard — 仪表盘（Agent编排流、审计终端、云拓扑、遥测面板、物理孪生可视化）
  - /iac/canvas — Bicep 架构画布
  - /prediction / /resume — 其他页面

  前端相对清晰，但 .next/ 构建缓存（大量 .pack.gz 文件）和 out/ 静态导出都在代码库中，严重膨胀仓库体积。应加入 .gitignore。

  F. Visual Studio Code and JetBrains IDE configs committed

  .idea/ (JetBrains) 没有被 gitignore，已经存在于仓库中。

  ---
  修复优先级排序

  优先级 1 (安全)     → 从 config.py 剥离 X.com 凭证，轮换被盗 token
  优先级 1 (安全)     → 统一 LLM 客户端构建为一个工厂函数，一套 env var 命名
  优先级 2 (架构)     → 本地文件缓存 → Redis/Cosmos DB 缓存
  优先级 2 (架构)     → IoT 事件处理改为异步队列驱动
  优先级 3 (健壮性)   → 所有 LLM 调用增加 timeout + 熔断
  优先级 3 (健壮性)   → 添加单元测试覆盖核心路径
  优先级 4 (代码规范)  → 去 AI 化注释
  优先级 5 (仓库卫生)  → .next/ out/ .idea/ 加入 gitignore 并清理

✻ Baked for 52s

❯ /model                                                                                                                                                          
         
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  Select model                                                                                                                                                  
  Switch between LLM models. Applies to this session and future Langcli sessions. For other/previous model names, specify with --model.
                                                       
  ↑ 4.  Mimo 2.5 pro                      Mimo 2.5 pro · Xiaomi Mimo flagship model                                                                             
    5.  Mimo 2.5                          Mimo 2.5 · Xiaomi Mimo model                                                                                          
    6.  Kimi K2.6                         Kimi K2.6 · Flagship model                                                                                            
    7.  GLM 5.2                           GLM 5.2 · Z.ai flagship model
    8.  Claude Opus 4.6                   Claude Opus 4.6 · Anthropic flagship model
    9.  GPT 5.4                           GPT 5.4 · Openai model
    10. GPT 5.5                           GPT 5.5 · Openai flagship model
    11. MiniMax M2.5                      MiniMax M2.5 · Most capable for complex work
    12. Ring 2.6 1T                       Ring 2.6 1T · inclusionAI flagship model
  