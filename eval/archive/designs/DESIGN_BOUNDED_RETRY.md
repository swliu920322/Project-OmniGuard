# 设计：Safety 和 Compiler 的有界重试与故障分类（G7）

2026-11-21。**已实施（同日）：** `embodied_brain/bounded_agent.py` 和 `extended.py` 的两处调用，测试在 `tests/test_bounded_agent.py` 与 `tests/test_extended_endpoint.py`，没有改动 `ask_agent` 和任何冻结文件，没有联网、没有调用模型。超时 60 秒是占位，与 Router 相同，没有依据，待测得 Safety 和 Compiler 的耗时后再定。下面是原设计。 对应八关流程第 5 关（系统设计）。

## 1. 主张

Router 一路有"不重试、固定超时、故障分类"的保证；Safety 和 Compiler **没有**。本文设计怎样补上同等的保证，并说明为什么不能简单照搬。

## 2. 证据：现在是什么样（读了代码，并在本机离线核对了 SDK 默认值）

| 事实 | 来源 |
|---|---|
| Router 的客户端：重试 0、超时 60 秒；确认不了就不发请求，直接停车 | `router_v2/pipeline.py` 的 `no_retry_client`，有测试 |
| Safety 和 Compiler 用 `ask_agent` | `embodied_brain/extended.py` |
| `ask_agent` 用共享客户端 `get_llm_client()`，该客户端由 `openai_config.py` 创建，**没有设置重试和超时** | `embodied_brain/utils.py`、`openai_config.py` |
| 所以用的是 SDK 默认值：**重试 2 次，读取超时 600 秒**（本机 `openai 2.41.1` 实测） | 离线核对，没有联网 |
| `ask_agent` 没有异常处理，也没有分类；异常传到 `extended.py` 外层，变成 `INTERNAL_ERROR` 停车（状态 500） | `extended.py` 最后一个 `except` |
| `ask_agent` 有 5 秒的结果缓存，键是提示词与输入；重复相同请求会直接返回旧结果 | `embodied_brain/utils.py` |
| `docs`、`CLAUDE.md`、`LIMITATIONS` 已说明 Safety 和 Compiler 没有不重试保证 | `CLAUDE.md` |

**这意味着：** 最坏情况下，一次 Safety 请求可能在 SDK 内部重试 2 次、每次最多等 600 秒，而车辆在这段时间里没有得到任何决定。Router 已判停的请求不受影响（它们不进入 Safety），但**Router 放行的请求**会被拖慢，而且无法区分"超时"和"其他故障"。

## 3. 推理：为什么不能简单照搬

1. **改 `ask_agent` 会影响所有调用方。** 旧的三类租户和 IoT 路径也用它，设计要避免改变它们的行为。
2. **Router 那套是冻结的。** `pipeline.py` 在冻结清单里，不能改；要新建一个只给 Safety 和 Compiler 用的包装，而不是修改 `no_retry_client`。
3. **失败后该怎么办有两种选择，不是一种：**
   - 立即停车（和现在一致，最保守）；
   - 有界重试（例如最多 1 次）再停车。
   重试增加等待，而这个系统的前提正是"等待有代价"；所以默认应是不重试。
4. **缓存要处理。** 5 秒缓存会让一个刚失败后再请求的情形拿到旧答案；在安全相关路径上，缓存命中应当被记录，不能静默。

## 4. 设计

新增一个**只给 Safety 和 Compiler 用的**调用函数，不改 `ask_agent`：

| 要求 | 做法 |
|---|---|
| 重试 | 默认 0；用 `with_options(max_retries=0)`，确认不了就停车，像 `no_retry_client` 那样 |
| 超时 | 固定值，例如 15 秒（具体值要依据测得的单次请求耗时再定，不是现在就能定的） |
| 故障分类 | `TIMEOUT`、`RATE_LIMIT`、`API_ERROR`、`BAD_REPLY` 四类，与 Router 的分类一致 |
| 缓存 | 绕开；或命中时写入追踪 |
| 失败结果 | 一律停车，原因写成具体分类，而不是笼统的 `INTERNAL_ERROR` |
| 追踪 | 在响应的 `trace` 里写出分类和耗时 |

**测试（用假客户端，不联网）：**
- 重试次数确认为 0；确认不了则不发请求。
- 超时、限流、接口错误、坏回复，各自得到对应分类并停车。
- 缓存命中被记录。
- 旧租户的行为不变（用已有的 `test_legacy_tenants_keep_their_flow_defaults_and_errors`）。

## 5. 局限

- **已实施后发现的行为变化：** 以前 Safety 回复为空会被当作通过（只有以 `BLOCK` 开头才停车），现在空回复是 `BAD_REPLY` 并停车。推理模型可能把 `max_completion_tokens`（Safety 50、Compiler 100）花在思考上而返回空回复，所以新路径可能比旧路径多停；没有测过，要靠 G5 的真实运行量出来，再决定是否放宽。

- 把重试关掉会让偶发网络抖动变成停车，**可用性下降**；这是用保守换确定。要不要放宽（例如允许 1 次重试），是所有者的取舍，需要测得的耗时数据支撑。
- 超时值 15 秒只是占位，没有依据。要先有 Safety 和 Compiler 的单次耗时分布（见 G5 设计）。
- 这只给**模型角色**加保证，不改变"代码层最终校验"的事实。
- 实施会改动 `embodied_brain/extended.py` 和新增文件，这属于被 `CLAUDE.md` 列为需要谨慎的后端代码；`extended.py` 不在冻结清单里，但改动需要经过评审和测试。

## 6. 需要的授权

| 项 | 授权 |
|---|---|
| 写设计、写假客户端测试 | 所有者同意即可 |
| 改 `extended.py` | 所有者同意；先做假客户端测试 |
| 真实请求验证 | 所有者对次数、token、美元上限明确授权；本文不触发 |

## 7. 与参考文章的对应

| 文章的说法 | 本设计 |
|---|---|
| 有界循环；模型决定怎么修，harness 决定还允不允许再试一次 | 重试次数由代码固定，默认 0 |
| 没有停止条件的 agent，不是自主，是失控 | 把 600 秒读取超时、2 次默认重试换成固定的停止条件 |
| 失败映射到改动：原地打转要加重试上限和升级路径 | 故障分类加"停车"作为升级路径 |
| 修类不修例 | 一个包装给两个角色，不是各改各的 |
