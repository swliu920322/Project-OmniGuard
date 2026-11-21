# 谁做了什么：两轮评测的来源记录

2026-11-21。**一句话：** 第一轮的出题、标注、复核、裁决都是同一家族（GPT）的 AI 会话；第二轮出题是 Gemini，标注和复核是 GPT，所以第二轮"写"和"标"来自不同家族。标签都是 AI 标的，不是人类专家。

**下面是逐环节的依据和没查清的地方，是审计用的细节；只想知道结论，读上面这句就够。** 会话原文在仓库之外，仓库里只有元数据摘录（[provenance/SESSION_META.md](provenance/SESSION_META.md)）。本文只还原"哪个环节由哪个会话和模型家族承担"，不评价标签或成绩质量。

## 依据类型

| 记号 | 含义 |
|---|---|
| R | 仓库证据：能指到文件、哈希或提交，并已在仓库内重算或核对 |
| S | 该会话读取自己的记录后的自述；所有者尚未亲自打开原始记录核对 |
| M | 会话元数据：所有者亲自在原始会话记录里核对过，或由只读脚本在导出的原始文件上抽取（结果见 [provenance/SESSION_META.md](provenance/SESSION_META.md)） |
| O | 所有者陈述，没有文件支撑 |
| U | 未知 |

模型字符串来自运行记录，不是对底层权重的验证。时间为 UTC，提交时间在 git 中是 +08:00。

**提交里的 `Co-Authored-By: Claude Sonnet 5.5` 不能证明由 Claude 会话写作或提交。** 第二轮 2026-11-15 的 5 个提交（`a6ba4aa`、`494c9c4`、`e40a8e5`、`ee853c0`、`887f606`）经 Gemini 会话自述由它执行，其中前三个带有这条署名，后两个没有。署名可能是提交时照抄的。下文凡写"署名"仅作旁证。

## 参与方

| 代号 | 模型家族 | 型号与档位 | 依据 |
|---|---|---|---|
| Gemini 作者会话 | Gemini | `gemini-3.8-flash-high`；会话内设置 2026-11-07 12:37 选 Medium，2026-11-09 04:03 改为 High | M（所有者核对 transcript；脚本在导出文件上抽取：391 条带 `model` 字段的记录均为该值，时间 2026-11-07 至 2026-11-21）；S |
| GPT 家族会话（第一轮 3 个子会话、第二轮 4 个盲标子会话） | GPT | 七个文件内都有两类 `model` 字段，并列记录、不互相覆盖：`session_meta` 的 `base_instructions.provenance.model` 为 `gpt-6-astra`（文件第一行，所有者 grep 命中的就是它）；`turn_context` 与 `thread_settings` 等运行配置里的 `model` 为 `gpt-6.1-sol`；`effort` 均为 `medium`。所有者确认使用的是 `gpt-6.1-sol` medium | M（所有者 grep 原文件；脚本在七个导出文件上抽取，`turn_context.model` 均为 `gpt-6.1-sol`、`effort` 均为 `medium`）；S（GPT 主会话逐字段解释）。`gpt-6-astra` 的含义 U，不断言发生过切换 |
| GPT 主会话 | GPT | `gpt-6.1-sol`；`turn_context.effort`：medium×160、high×8。所有者原先称一直使用 medium，文件里有 8 次 high，**以文件为准**；所有者说明 high 是额度充足时手动调高的，没有特别用途 | M（脚本在导出文件上抽取）；O（high 的原因） |
| Claude 实施会话 | Claude | `claude-sonnet-5-5`，`effort` 为 medium（主会话文件中 2437 条助手消息均如此）；另一个 Claude 会话（学习站点）有 89 条 `claude-fable-5-2`，与评测无关 | M（脚本在导出文件上抽取）；S；O |
| 被测服务 | DeepSeek | 请求名与返回别名均为 `deepseek-flash` | R（`RESULTS.md`）；底层版本未验证 |

GPT 子会话（文件均在 `~/.codex/sessions/` 下，创建时间取文件内 `session_meta`）：

| 子会话 | 日期目录 | 创建时间 UTC |
|---|---|---|
| `/root/blind_annotation`（第一轮开发材料的盲标与复核；后来也读过测试候选和语义重合审计材料） | 2026/11/07 | 2026-11-07 10:55:23 |
| `/root/independent_test_author`（第一轮作者） | 2026/11/07 | 2026-11-07 10:55:54 |
| `/root/test_revision2_blind`（第一轮最终盲标与复核） | 2026/11/07 | 2026-11-07 11:07:15 |
| `/root/v2_blind_annotation_54` | 2026/11/15 | 2026-11-15 05:57:18 |
| `/root/revision1_blind_64` | 2026/11/15 | 2026-11-15 07:40:24 |
| `/root/revision2_blind_21` | 2026/11/15 | 2026-11-15 09:18:34 |
| `/root/revision3_blind_7` | 2026/11/15 | 2026-11-15 10:37:35 |

## 第一轮（300 条主测试）

| 环节 | 执行方 | 依据 |
|---|---|---|
| 规范起草与实现 | Claude 实施会话创建 `LABEL_SPEC.md`、`reference_labeler.py`、`annotation.py`、`make_report.py`、`rule_control.py`（R1/R2）、`baseline_b/evaluate.py`、`run_formal.py` 等（Claude 自述其写入记录）；GPT 主会话提出修改并由 Claude 采纳，提交 `6858b1f`、`1b6e09c`、`2ac27c6` 存在。GPT 称这不等于认领整个规范，规范逐段起草者 U | S；提交 R |
| 题目编写与初始标签 | GPT 子会话（独立测试作者） | S |
| 盲标 | GPT 子会话，与作者是不同会话 | S |
| 备注全量复核 | 同一个盲标会话，在放行初始标签之后；覆盖 72 条备注，不是 300 条 | S |
| 争议裁决、保管、冻结、运行 | GPT 主会话；冻结时间 2026-11-07 11:10:09 | R（`eval/acceptance/FROZEN_MANIFEST.json`）；执行方 S |
| 独立逐条复算 | GPT 主会话没收到过；Claude 会话记录中没找到；其他窗口是否做过 U | S / U |
| Gemini | 没有参与第一轮的出题、标注、实验设计或运行；同一会话 2026-11-07 做过第一级复现预演 | S（Gemini、GPT 一致）；O |

**第一轮的作者、盲标、复核、裁决、保管都来自 GPT 家族**（分属不同会话）。这一轮只有规范实现和规则开发来自别的家族。盲标和复核的"一致"因此不能当作跨家族的独立佐证。

会话元数据核对（[SESSION_META.md](provenance/SESSION_META.md)）：规范提交 `6858b1f`、`1b6e09c`、`2ac27c6` 和 `router_v2` 初版提交 `01d4ce4` 都匹配到 Claude 会话发起的 `git commit` 调用（相差 0 至 28 秒），支持"规范实现与规则开发来自 Claude"。

## 第二轮（180 条备注理解测试）

| 环节 | 执行方 | 依据 |
|---|---|---|
| 候选与 Revision 1/2/3 的作者与初始标签 | Gemini 作者会话 | R（该会话报告的 18 个交付物哈希在封存包内全部对得上）；M；S |
| 盲标（4 批） | GPT 子会话 | S。Gemini 自述没做过 |
| 全量复核与增量复核 | GPT 子会话，在放行标签后 | S。Gemini 自述没做过 |
| 争议裁决、保管、终审、运行 | GPT 主会话 | S；终审文件 R（`evidence/data/FINAL_REVIEW.json`） |
| 流程审核与交接文档提交 | **两个会话分担。** Gemini 会话执行了 5 个提交：`a6ba4aa`（15:12）、`494c9c4`（15:35）、`e40a8e5`（17:00）、`ee853c0`（17:50）、`887f606`（18:07），均为本地时间 +08:00；脚本在它的会话里找到对应的 `git commit` 调用，与 git 提交时间相差 4 至 16 秒。`887f606` 同时匹配到一个 Claude 会话的调用（相差 23 秒），Gemini 的更近（4 秒），两者都列出，不替你选。`b6d6413`、`a65eb62` 等其他核对过的提交匹配到 Claude 会话 | M（会话元数据与 git 时间）；执行方的最终归属为推断 |
| 辅助检查器 `eval/annotation/validate_rationales.py` 初版 | Claude 会话：写入类工具调用 10:45:33Z 与 10:46:07Z，提交调用 10:47:15Z，git 提交 10:47:16Z；Gemini 没有任何对该文件的写入类调用 | M |
| 辅助检查器加固版（提交 `1a702a2`，19:44 本地） | Claude 会话在 11:44:13Z 发起了提交（M），自述不是它写的；Gemini、所有者均称不是自己。GPT 主会话的命令在 **11:00:25Z、11:01:26Z** 提到该文件及其测试（M），与 GPT 自述的两次编辑时间一致；那是 `exec` 里的命令，工具没有把它分类为写入，所以是"命令里提到"，不是写入的直接证明。这些时间落在初版提交与加固版提交之间，**最可能就是加固版的内容，由 Claude 会话提交**，没有逐行比对 | 提交归属 M；内容归属为推断 |
| 规则 R3 | 提交 `1ec769a`、`dbb6b90`、`d5e20ec`（2026-11-09）由 Claude 会话发起（M，调用与提交相差 0、2、2 秒）；Claude 会话对 `r3.py` 的操作是命令（23 次提到），不是写入类工具，内容的逐项核对未做 | 提交归属 M；内容 U |
| 测后复算 | Claude 会话先复算（输入为私有的 revision3 文件与运行记录，运行结束后读取，脚本 `p5_recompute.py`，提交 `4a41818`），GPT 主会话随后交叉核对 | S；提交与文件 R |

**第二轮的作者（Gemini）与标注、复核、裁决方（GPT）不是同一家族。** 这是流程上的差异，不是准确率的提升。

**第二轮的流程审核与提交由 Gemini 会话分担了一部分**，即作者同时是部分流程提交的执行者。这些提交记录的是裁决、处置与哈希，作者本来就需要拿到这些材料才能修订；但仓库里"Claude 审核并提交"的叙述在这些点上不能原样当作 Claude 做的。

### 作者的接触范围（Gemini 自述，S）

- 读过：保管者指令与台账共 13 个文件（含复核意见摘要、裁决理由、替换槽位）；公开开发集 `eval/dev/dev_set.jsonl`（180 条，其中 72 条带备注）、`eval/dev/stress/stress_dev.jsonl`（66 条）、`eval/dev/families.json`（34 个家族）。
- 没读过：盲标原始结果、规则 R3 的源码与词表、R1/R2/R3 对候选的预测、DeepSeek 的回复或分数、第一轮 300 条测试集。
- 作者对盲标结果隔离，对复核意见和裁决理由不隔离。
- 上一份自述有两处错误，已被它本人更正：把校验器说成自己写的；把开发集说成 24 条（实为混淆了第一轮盲标抽样量）。

### 盲标与复核会话的接触范围（GPT 主会话自述，S）

- 盲标阶段确认读取的文件：`ANNOTATOR_INSTRUCTIONS.md` 与 `blind_packet.jsonl`（第一轮为 `blind-inputs-24.jsonl`）。
- 转入复核后读取：`REVIEW_INSTRUCTIONS.md`、`review_packet.jsonl`、`review_families.json`、`public_exclusion_notes.jsonl`，以及补充盲标结果、作者回应与裁决台账等；也读过公开开发材料（`dev_set.jsonl`、`dev_extra.jsonl`、`dev_holdout.jsonl`、`ambiguous_examples.json`、`stress_dev.jsonl`）。
- 未发现向这些会话交付 R1/R2 正式预测或待测模型回复的记录。
- **任务消息正文含加密部分，无法确认主会话是否透露过作者身份或模型**（U）。"任务输入是两个文件"不等于"模型完整上下文只有两个文件"。

## 哈希对照（均已在仓库内重算核对，R）

| 产物 | SHA-256 前缀 |
|---|---|
| 第二轮最终测试集 | `6249acb7…` |
| `FINAL_REVIEW.json` | `be8ee780…` |
| `CROSS_REVIEW.json` | `a1522867…` |
| 第一轮冻结清单中的测试集 / 盲标 / 复核 | `68e08ed9…` / `e6e855f7…` / `9eb3945f…` |
| 第二轮候选与三版修订测试集 | `4cfbf30e…` / `d982684a…` / `6d3fd91e…` / `6249acb7…` |

## 尚未解决

1. `gpt-6-astra` 字段的含义：它在每个 GPT 文件的 `session_meta` 里，`turn_context` 里是 `gpt-6.1-sol`；两者关系 U。
2. `1a702a2` 校验器加固版：提交归属（Claude 会话）与 GPT 的命令时间已核对，**内容归属**仍是推断，没有逐行比对。无论归属，保管者参与修改了自己用来验收的检查器，需要如实写出。
2a. 第一轮开发材料盲标与复核者是 `/root/blind_annotation`，属 GPT 家族；它后来读过测试候选和语义重合审计材料，复核阶段的接触范围未逐文件核对。
3. `src/cloud-orchestrator/router_v2/{rules,pipeline,prompt}.py`：Claude 会话更正自述，称初版由它在 2026-11-07 09:38:31Z 用一条 Bash 命令生成（`rules.py` 由它写的 `eval/spec/reference_labeler.py` 复制而来，`prompt.py` 以 `eval/baseline_b/prompt_b.py` 为底改写，同时写入 `pipeline.py`），提交 `01d4ce4` 在 09:41:50Z，时间吻合。之后它又多次用 Python 字符串替换修改，是否全部落入冻结版未逐条核对。`rules.py` 与 `eval/spec/reference_labeler.py` 是字节相同的副本，这一点已在 `router_v2/README.md` 披露，并有测试比对哈希；`LABEL_SPEC.md` 说明参考标注器在纯遥测记录上生成金标，因此按构造得 100%，只是上限检查。
4. 规则 R3 与 `run_note_compare.py` 的作者，Claude 会话未逐一核对。
5. 其余 2026-11-15 文档提交的归属：`SESSION_META.md` 第 3 节已按调用时间列出每个提交匹配的会话；多个会话同时匹配的提交（如 `887f606`）需要人工裁定，没有匹配到的由其他窗口或你本人发起。
6. Claude 会话"测前是否读过第二轮私有内容"：只能说"没搜到"，不能说"没读过"。它 11-15 05:29 对 `~/.omniguard_custody` 做过 `ls`、`shasum`、`find`，其中没有读内容的命令，但输出未逐字核对。
7. 主会话向盲标子会话透露作者身份的可能性（加密正文）。
8. 三方会话原文已在私有目录 `~/.omniguard_custody/provenance_exports/` 复制并算了哈希（不进仓库；其中 Claude 的两个文件、GPT 的两个文件含疑似密钥的匹配行）；仓库里只有 [provenance/SESSION_META.md](provenance/SESSION_META.md) 的元数据摘录。三方自述报告的索引在 `provenance/README.md`。Claude 本会话文件仍在增长，摘录是快照。
9. 规范逐段起草者；备份介质的物理独立性（按所有者决定延期）。

## 对结论的影响

- 可以说：第二轮作者与标注方使用不同模型家族，作者对盲标结果隔离。
- 不可以说：第一轮标注经过跨家族独立验证；标签是人类专家金标；一致率代表正确性；提交署名等于实际写作者。
