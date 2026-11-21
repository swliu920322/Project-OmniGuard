# 运行回执

由 `run_receipt.py` 从已封存的运行文件汇总，**只读，不改任何运行目录**。没有记录的项显示「未记录」，不补、不猜。回执是汇总，不是新证据。

## 总览：每次运行哪些项有记录

| 运行 | 运行标识 | 结束情况 | 数据 | 规则与提示词版本 | 模型 | 请求设置与重试 | 预算上限 | 实际使用 | 授权 | 回滚点 |
|---|---|---|---|---|---|---|---|---|---|---|
| `20261107T113916Z_main_real_a6e1b5e8` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ |
| `20261107T113942Z_main_real_094cb6c1` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ |
| `20261107T114703Z_main_real_19df553b` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ |
| `20261107T115548Z_stress_real_8352b4ff` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ |
| `20261115T152849Z_main_real_5a331f0f` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `20261115T152854Z_main_real_e5fd14c2` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

✓ 有记录，— 未记录。

## `20261107T113916Z_main_real_a6e1b5e8`

读取的文件：public_summary.json

| 项 | 值 | 来源 |
|---|---|---|
| 运行标识 | 20261107T113916Z_main_real_a6e1b5e8；suite=main；mode=real；canary=True；measurement=False | public_summary.json |
| 结束情况 | status=completed；stop_reason=completed all planned calls | public_summary.json |
| 数据 | dataset_sha256=main:bad376fce65d… | public_summary.json |
| 规则与提示词版本 | spec_version=1.0；prompt_sha256=9247896719b6…；code_freeze_sha256=b33c68bc4861…；scoring_policy=an error, an unusable or truncated reply and an interrupted request stay in the …（全文见来源文件） | public_summary.json |
| 模型 | 声明身份=DeepSeek-V4.1-Flash-1017 (owner-stated, actual version unverified)；漂移标记=False | public_summary.json |
| 请求设置与重试 | 未记录 |  |
| 预算上限 | max_calls=2；max_tokens=20000；max_usd=0.02 | public_summary.json |
| 实际使用 | calls_recorded=2；planned=2；usd_from_reported_usage=0.000974；calls_without_usable_usage=0 | public_summary.json |
| 授权 | 未记录 |  |
| 回滚点 | frozen_tag=eval-formal-v1；repo_head=fec6acf39762… | public_summary.json |

## `20261107T113942Z_main_real_094cb6c1`

读取的文件：public_summary.json

| 项 | 值 | 来源 |
|---|---|---|
| 运行标识 | 20261107T113942Z_main_real_094cb6c1；suite=main；mode=real；canary=False；measurement=True | public_summary.json |
| 结束情况 | status=completed；stop_reason=completed all planned calls | public_summary.json |
| 数据 | dataset_sha256=main:68e08ed9003d… | public_summary.json |
| 规则与提示词版本 | spec_version=1.0；prompt_sha256=9247896719b6…；code_freeze_sha256=b33c68bc4861…；scoring_policy=an error, an unusable or truncated reply and an interrupted request stay in the …（全文见来源文件） | public_summary.json |
| 模型 | 声明身份=DeepSeek-V4.1-Flash-1017 (owner-stated, actual version unverified)；漂移标记=False | public_summary.json |
| 请求设置与重试 | 未记录 |  |
| 预算上限 | max_calls=300；max_tokens=600000；max_usd=0.25 | public_summary.json |
| 实际使用 | calls_recorded=300；planned=300；usd_from_reported_usage=0.133227；calls_without_usable_usage=0 | public_summary.json |
| 授权 | 未记录 |  |
| 回滚点 | frozen_tag=eval-formal-v1；repo_head=fec6acf39762… | public_summary.json |

## `20261107T114703Z_main_real_19df553b`

读取的文件：public_summary.json

| 项 | 值 | 来源 |
|---|---|---|
| 运行标识 | 20261107T114703Z_main_real_19df553b；suite=main；mode=real；canary=False；measurement=True | public_summary.json |
| 结束情况 | status=completed；stop_reason=completed all planned calls | public_summary.json |
| 数据 | dataset_sha256=main:68e08ed9003d… | public_summary.json |
| 规则与提示词版本 | spec_version=1.0；prompt_sha256=9247896719b6…；code_freeze_sha256=b33c68bc4861…；scoring_policy=an error, an unusable or truncated reply and an interrupted request stay in the …（全文见来源文件） | public_summary.json |
| 模型 | 声明身份=DeepSeek-V4.1-Flash-1017 (owner-stated, actual version unverified)；漂移标记=False | public_summary.json |
| 请求设置与重试 | 未记录 |  |
| 预算上限 | max_calls=300；max_tokens=600000；max_usd=0.25 | public_summary.json |
| 实际使用 | calls_recorded=300；planned=300；usd_from_reported_usage=0.134626；calls_without_usable_usage=0 | public_summary.json |
| 授权 | 未记录 |  |
| 回滚点 | frozen_tag=eval-formal-v1；repo_head=fec6acf39762… | public_summary.json |

## `20261107T115548Z_stress_real_8352b4ff`

读取的文件：public_summary.json

| 项 | 值 | 来源 |
|---|---|---|
| 运行标识 | 20261107T115548Z_stress_real_8352b4ff；suite=stress；mode=real；canary=False；measurement=True | public_summary.json |
| 结束情况 | status=completed；stop_reason=completed all planned calls | public_summary.json |
| 数据 | dataset_sha256=stress:dc888af048f9… | public_summary.json |
| 规则与提示词版本 | spec_version=1.0；prompt_sha256=9247896719b6…；code_freeze_sha256=b33c68bc4861…；scoring_policy=an error, an unusable or truncated reply and an interrupted request stay in the …（全文见来源文件） | public_summary.json |
| 模型 | 声明身份=DeepSeek-V4.1-Flash-1017 (owner-stated, actual version unverified)；漂移标记=False | public_summary.json |
| 请求设置与重试 | 未记录 |  |
| 预算上限 | max_calls=40；max_tokens=100000；max_usd=0.05 | public_summary.json |
| 实际使用 | calls_recorded=55；planned=55；usd_from_reported_usage=0.016121；calls_without_usable_usage=23 | public_summary.json |
| 授权 | 未记录 |  |
| 回滚点 | frozen_tag=eval-formal-v1；repo_head=fec6acf39762… | public_summary.json |

## `20261115T152849Z_main_real_5a331f0f`

读取的文件：config.json, summary.json

| 项 | 值 | 来源 |
|---|---|---|
| 运行标识 | 20261115T152849Z_main_real_5a331f0f；suite=main；mode=real；canary=True；measurement=False | summary.json |
| 结束情况 | status=completed；stop_reason=completed all planned calls | summary.json |
| 数据 | dataset_sha256=main:bad376fce65d… | config.json |
| 规则与提示词版本 | spec_version=1.0；code_freeze_sha256=b33c68bc4861…；scoring_policy=an error, an unusable or truncated reply and an interrupted request stay in the …（全文见来源文件） | config.json |
| 模型 | 请求名=deepseek-flash；声明身份=deepseek-flash; provider states DeepSeek-V4.1-Flash-1017; actual version not ind…（全文见来源文件）；返回别名=deepseek-flash；漂移标记=False | config.json, summary.json |
| 请求设置与重试 | 重试次数=0；超时秒=60.0；温度参数=0.0；输出上限=2048 | config.json |
| 预算上限 | max_calls=2；max_tokens=20000；max_usd=0.01 | config.json |
| 实际使用 | calls_recorded=2；planned=2；usd_from_reported_usage=0.000994；calls_without_usable_usage=0 | summary.json |
| 授权 | 授权人=owner explicit authorization in conversation 2026-11-15; exact wording in privat…（全文见来源文件）；美元上限=0.01 | config.json |
| 回滚点 | frozen_tag=eval-note-v2-r3-final-20261115；repo_head=1eddd79df16e… | config.json |

## `20261115T152854Z_main_real_e5fd14c2`

读取的文件：config.json, summary.json

| 项 | 值 | 来源 |
|---|---|---|
| 运行标识 | 20261115T152854Z_main_real_e5fd14c2；suite=main；mode=real；canary=False；measurement=False | summary.json |
| 结束情况 | status=completed；stop_reason=completed all planned calls | summary.json |
| 数据 | dataset_sha256=main:6249acb73858… | config.json |
| 规则与提示词版本 | spec_version=1.0；code_freeze_sha256=b33c68bc4861…；scoring_policy=an error, an unusable or truncated reply and an interrupted request stay in the …（全文见来源文件） | config.json |
| 模型 | 请求名=deepseek-flash；声明身份=deepseek-flash; provider states DeepSeek-V4.1-Flash-1017; actual version not ind…（全文见来源文件）；返回别名=deepseek-flash；漂移标记=False | config.json, summary.json |
| 请求设置与重试 | 重试次数=0；超时秒=60.0；温度参数=0.0；输出上限=2048 | config.json |
| 预算上限 | max_calls=180；max_tokens=380000；max_usd=0.19 | config.json |
| 实际使用 | calls_recorded=180；planned=180；usd_from_reported_usage=0.109678；calls_without_usable_usage=0 | summary.json |
| 授权 | 授权人=owner explicit authorization in conversation 2026-11-15; exact wording in privat…（全文见来源文件）；美元上限=0.19 | config.json |
| 回滚点 | frozen_tag=eval-note-v2-r3-final-20261115；repo_head=1eddd79df16e… | config.json |

## 读法与局限

- 第一轮只有公开摘要（私有的配置和逐条文件已丢，见 `LIMITATIONS.md` 第 22 条），所以请求设置和授权显示「未记录」；这不表示当时没有设置，只表示公开文件里没有这一项。
- 「声明身份」是所有者声明，不是验证过的模型版本；「返回别名」只说明接口返回的名字一致。
- 没有「人工干预次数」和「运行前测试通过情况」这两个结构化字段；运行过程的文字记录在 `experiments/note_vs_rules_v2/process/HANDOFF_TO_GPT.md`。
- 第二轮主测试的记录里 `measurement=False`；这个字段在第二轮的含义没有核对，该次运行的正式性质以 `RESULTS.md` 为准，不据此字段下结论。
- 费用是按配置价格的估算，不是账单。
