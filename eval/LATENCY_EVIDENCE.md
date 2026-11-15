# 延迟研究证据说明（2026-11-08）

依据：只读原始仿真与后端代码、已入库的延迟记录；没有改实现，没有新增实验，没有读私有评测数据。行号是当前提交的行号，代码改动后以函数名为准。与正式评测的成本、延迟字段清单配套阅读：[LATENCY_COST.md](LATENCY_COST.md)。

**一句话**：延迟相关的数字有三类来源——仿真里**设定**的值（滑块、预设）、历史基准里**实测**的各阶段模型调用耗时、以及 2026-11-07 起的 Router 单次请求耗时。三者的起止点不同，不能相加或互相替代；没有一个数字是 HTTP 端到端延迟或实体车辆的刹停时间。

## ① 等待云端期间，车辆怎么动

有两套互不相同的仿真，不要混着讲：

| 仿真 | 文件 | 等待期间的行为 |
|---|---|---|
| 实时仪表盘 `/dashboard/live`（会真的请求后端） | `src/client-edge/src/app/dashboard/live/hooks/useFleetSimulation.ts`：`runStep` 约 223–291 行，`stepMotion` 约 378–400 行，运动循环约 404–416 行；决策应用 `live/lib/physics.ts` 的 `applyDecision`（约 152 行起） | 发请求时不暂停车辆：每个动画帧按**当前速度**前进 `speed × dt`，直到响应到达；响应里有 `move` 就设为该速度，否则速度置 0；若在响应前走到障碍处，记碰撞（生命值扣 50，速度置 0）。每帧 `dt` 被截到 0.1 秒（第 120 行 `MAX_FRAME_DT_S`），后台标签页时车辆比真实时间走得少。 |
| 动力学沙盒 `/dashboard/theorem`、`compare`、`fleet`（纯前端，不发请求） | `dashboard/hooks/useKinematicSimulation.ts`（约 96–165 行）、`useFleetSimulation2.ts`、`dashboard/lib/kinematic.ts`、`src/client-edge/src/app/shared/physics/kinematic-token.ts` | 车辆匀速前进；每隔一个“云端延迟”（滑块值 ±20% 随机抖动，第 7 行 `JITTER_RANGE`）才“收到决策”。收到时若已越过 `总距离−余量` 的边界则安全停车（停车距离 = 速度 × 刹车延迟），若已到尽头则碰撞。边缘模式的边界按 `速度 × 边缘延迟` 平移。 |

实时仪表盘还有两处要知道：
- 勾选“网络抖动”时，前端在发请求前 `sleep(2500 ms)`（`live/config/simulation.ts` 的 `JITTER_DELAY_MS`，`runStep` 约 233 行），并在界面和物理日志里把 2500 ms 加到后端返回的 `latency_ms` 上（`live/lib/simulation.ts` 的 `computeActualLatencyMs`，约 70 行）。这是**人为加的延迟**，不是测出来的。
- 发送的遥测快照是在这段睡眠**之后**才取的（约 236–248 行），所以抖动睡眠本身不会让上传的数据变旧；只有 HTTP 往返那一段会让数据在到达时变旧。

## ② 总耗时和各阶段计时：从哪里开始、到哪里结束

| 计时 | 起点 | 终点 | 位置 | 不包含 |
|---|---|---|---|---|
| 后端 `latency_ms`（总） | 处理函数的第一行 `start_time = time.time()` | 最终动作合成之后、构造响应体时 | `src/cloud-orchestrator/embodied_brain/brain.py` 约 176 与 378 行；扩展租户在 `extended.py` 用同一个 `start_time` | 浏览器到 Next.js 代理再到后端的网络、代理耗时、响应序列化和传输 |
| 后端各阶段 | 阶段调用前 `t0 = time.time()` | 调用后立即取差 | 同文件：Cosmos 写约 268–279 行、读约 302 行；Router `t_agent_1` 约 308–310 行；Safety、Compiler 同样包住 `ask_agent` | 阶段之间的代码；各阶段之和**不等于**总值（总值还含解析、限流检查、Cosmos 等） |
| 前端显示的延迟 | 无前端计时器 | 无 | `live/lib/simulation.ts` 的 `fetchSimulation` 没有计时；界面读的是后端 `latency_ms`（开抖动时再加 2500） | 浏览器看到的真实往返时间**没有被记录** |
| 历史基准 `benchmark.py` 阶段 | 每个阶段前 `time.time()` | 阶段后 | `embodied_brain/benchmark.py`：Router 约 118–123 行，Safety 约 147–159 行，Compiler 约 183–193 行 | 不走 HTTP 端点、不含 Cosmos、不含物理门控以外的任何环节；物理门控计时只是一次比较 |
| 历史基准 `total_pipeline` | — | — | 同文件约 294–297 行：Router + Safety + Compiler 三段之和，**只统计走完全流程（PASS）的场景** | 提前退出的场景不进总值（所以不是所有请求的延迟） |
| 基线 A 重测 | 调用前 `time.perf_counter()` | 调用返回后 | `eval/baseline_v1/measure/run_baseline_a.py` 约 141、164 行 | 只测 Router 一段；SDK 重试关闭、缓存 TTL 设为 0（见 `measure/SCOPE.md`） |
| 基线 B 开发集与正式运行 | 同上 | 同上 | `eval/baseline_b/run_dev_eval.py` 约 85–94 行的 `RecordingClient`；正式运行复用同一个记录函数 | 单次模型请求，无重试；含隐藏的推理 token 的生成时间 |

会影响延迟读数的实现细节：
- `ask_agent` 有一个进程内缓存，**5 秒内相同输入直接返回缓存**，该阶段耗时近 0（`embodied_brain/utils.py` 约 100–145 行，最多 128 项）。后端默认限流是每个客户端 5 秒 1 次，通常不会触发，但缓存是跨客户端共享的，所以线上读数不是全部都经过模型。基线 A 重测把它关掉了；历史基准有没有命中过，没有记录，**未核实**。
- 原路径的客户端构造没有设置重试和超时（`llm_provider.py` 约 146 行，用 SDK 默认值；按我对 SDK 的了解默认会重试，未在本仓库核实）。历史基准里 60 例诊断的 Compiler 最大 71 秒，**是否包含重试，记录里看不出**。扩展租户的Router适配器明确关闭重试并设60秒SDK超时；Safety和Compiler仍走原有 `ask_agent`，不能把Router的设置推广到整条HTTP链路。SDK超时也不等于已验证的全链路硬截止时间。

## ③ 哪些来自真实请求，哪些是设定

| 数值 | 性质 | 来源 |
|---|---|---|
| 刹车延迟 15 ms、边缘延迟 20 ms（及 10/5 等预设） | **设定**，不是硬件测量 | `dashboard/lib/kinematic.ts` 的 `PRESETS`、`DEFAULT_PARAMS`；[docs/evidence/README.md](../docs/evidence/README.md) 第 78 行已明说 |
| 云端延迟 3000 ms 默认、预设 200/800/5000 ms | **设定** | `kinematic.ts`、`dashboard/config/scenarios.ts` |
| “计算出的云端延迟” = 网络 RTT + (提示词 + 输出 token) ÷ 生成速率 | **公式加设定的参数**（RTT 80–100 ms、速率 150–200 token/s 等） | `shared/physics/kinematic-token.ts` 的 `computeCloudLatencyMs`；参数在 `scenarios.ts`、`useFleetSimulation2.ts` |
| 抖动 ±20%、网络抖动 +2500 ms | **设定** | `useKinematicSimulation.ts`、`live/config/simulation.ts` |
| 历史基准各阶段耗时 | **真实模型请求的实测**，但是本机直接调用函数，不经过 HTTP | `benchmark_results/runs/` |
| 基线 A、基线 B 的单次请求耗时 | **真实请求的实测**，Router 一段 | `eval/baseline_v1/measured/…/calls.jsonl`、`eval/baseline_b/runs/…/calls.jsonl` |
| 仪表盘上显示的“后端延迟” | **真实请求的实测**（服务端口径），可能被抖动开关加上 2500 的**设定值** | 见 ② |

## 可以引用的数字（每个都要带口径）

| 数字 | 口径 | 文件 |
|---|---|---|
| 历史 200 例（2026-07-16）：Router 中位 1642.3 ms、均值 1780.6 ms；Safety 中位 1183.5 ms；Compiler 中位 2800.6 ms、均值 3191.3 ms；全流程 `total_pipeline` 中位 5680.1 ms、均值 6173.6 ms、最大 16390.6 ms，n=121（仅走完全流程的场景） | 三个阶段的模型调用耗时之和，直接调函数，不含 HTTP、Cosmos、网络；模型名记录为“DeepSeek V4 Flash”，版本未验证；旧三类标签 | `src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-07-16-thesis-200/summary.json` |
| “每次提前退出平均省 4613.4 ms，共省 364,459 ms” | **反事实估算**（用走完全流程的各阶段均值估计被跳过的调用），不是观测到的耗时 | 同上 `circuit_breaking`，[benchmark_results/README.md](../src/cloud-orchestrator/embodied_brain/benchmark_results/README.md) |
| 诊断 60 例（2026-08-18）：Router 中位 1215.8 ms；Safety 中位 1208.3 ms；Compiler 中位 5175.5 ms、均值 14238.1 ms、最大 71191.3 ms；全流程中位 7667.4 ms、均值 16720.6 ms、最大 73892.5 ms，n=35 | 同上口径；模型字段为 `unknown`；该运行不是论文运行，不是主基准 | `…/runs/2026-08-18-diagnostic-60/results.json`、`report.txt` |
| 基线 A 重测（2026-11-07）：Router 一段，条件 B n=200 中位 1168.7 ms、P95 1667.9 ms、最大 2906.9 ms；条件 P n=200 中位 1459.5 ms、P95 6199.1 ms、最大 8592.8 ms；无失败；P95 为最近秩法 | 单次请求墙钟，含隐藏推理，重试关闭，缓存关闭；旧标签；不经 HTTP | `eval/baseline_v1/measured/20261107T045641Z_real_db062c4f/calls.jsonl`（本说明里的统计是对该文件现算的） |
| 开发集 B-1.0（2026-11-07）：175 次成功请求中位约 1.76 s、P95 约 2.65 s、最大约 15.1 s；含 5 次错误则 P95 约 3.15 s | 单次请求墙钟；一次开发集运行；不是正式运行 | `eval/baseline_b/runs/20261107T075357Z_real_c5e026a8/calls.jsonl`，细节见 [LATENCY_COST.md](LATENCY_COST.md) |
| 仿真设定值（15 ms、20 ms、3000 ms 等） | 只能说“仿真中配置的参数” | 见 ③ |

## 不能得出的结论

- **不能**说“云端控制一定撞车”或“边缘 20 ms 能避免碰撞”：碰撞与否由滑块设定的延迟决定，仿真只演示了“延迟 × 速度 = 盲走距离”的算术。
- **不能**把 15 ms 刹车延迟、20 ms 边缘延迟说成硬件实测；没有实体车辆，也没有实测的刹停距离。
- **不能**把历史基准的 5.7 秒或 6.2 秒说成“系统端到端延迟”：它们是三次模型调用之和，只含走完全流程的场景，不含网络、HTTP、Cosmos。
- **不能**把 4613.4 ms 说成观测到的节省，它是反事实估算。
- **不能**把几次运行的数字合成一条趋势或“延迟改善”：模型名、日期、标签、重试和缓存条件都不同，且 2026-08-18 那次模型未记录。
- **不能**由 Router 一段的延迟推出扩展租户端点的延迟（还有 Safety 和 Compiler 两次模型调用和 Cosmos），也没有对真实模型跑过该端点。
- **不能**给出正式评测的延迟中位数或 P95：公开文件没有，私有记录里的字段尚未汇总。
- **不能**说“低延迟”“实时”，或把这些数字当作某个 SLA。

## 仍缺的证据

1. 正式运行（两次主测试、32 次压力请求）的单次请求延迟汇总：需要私有记录保管者按 [LATENCY_COST.md](LATENCY_COST.md) 第 2.1 节的字段给出聚合值。
2. 浏览器看到的真实往返时间（含代理和网络）：前端没有计时器，需要加一个才能得到；本次不改实现。
3. 历史基准运行中是否发生过 SDK 重试或缓存命中：记录里没有。
4. 扩展租户端点对真实模型的端到端延迟：没有跑过。
