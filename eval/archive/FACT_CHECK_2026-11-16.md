# 事实清单：OmniGuard 评测（2026-11-16，只读核查）

范围：只读核查，未修改、提交、删除任何现有文件，未调用模型接口，也未读取或打印密钥（本文件不含密钥）。凭证类内容若出现只显示前 4 位和后 2 位；查不到的写“未知”。本文件是新建的未提交文件。

**任务说明被截断：** 收到的任务描述在 D 节中途中断（停在“300/300、两轮一致、R…”）。D 节只核对了可见的两项以及我能从仓库里同类的旧说法，未核对的部分请重发后补做。

## A. 原 300 条评测还能不能找回

### A1. FROZEN_MANIFEST.json 记录的文件及哈希

来源：`eval/acceptance/FROZEN_MANIFEST.json`，字段 `sha256`（第 40–48 行）；冻结时间 `frozen_at_utc` = 2026-11-07T11:10:09Z（第 4 行）。

| 字段 | SHA-256 | 行号 |
|---|---|---:|
| `test_set.jsonl` | `68e08ed9003d40a9d2ca212253367ab369ea30ab0eeb5a1e2fd2ecf19a12e6d9` | 41 |
| `stress_cases.jsonl` | `dc888af048f9a195a7a7b2b39203c3542a0bd9d02188c80187a51940394b468b` | 42 |
| `spec_SHA256SUMS` | `4ee9b7901a3199bb98d37fde57eb18242960f7deb0a48429a3d85b4c6121cacb` | 43 |
| `blind_results` | `e6e855f7edd715ddf22b4f5d1890ddad8c4d5631b80e7925c0a36d2bb7076793` | 44 |
| `full_note_review` | `9eb3945f9522eef4e1c898f9d7607ca855f8ddb2a1cb985764dd4ee3e1faf401` | 45 |
| `semantic_overlap_audit` | `5a1608fdcb326ef7c889249f03eb968e3770a04c4b050346d2b1d402a175b92c` | 46 |
| `stress_blind_results` | `16065ef8fe732d5a0223cba82d6853d02be65730a031337146a6ea5280da9330` | 47 |
| `stress_full_review` | `dd66d30ccd3393e5348e545eecd08f97c8a74d6a4ee9ec0f911132263f3ef19d` | 48 |

### A2. 这些文件现在是否存在，到哪里找过

检查方法：对 8 个哈希，在下列位置的**所有文件内容**逐个算 SHA-256 比对；压缩包逐成员比对。

| 位置 | 范围 | 命中 |
|---|---|---|
| 仓库 `.git`（所有分支、标签、不可达对象） | 1,969 个 blob；其中 17 个 tar.gz blob 另解开共 1,709 个成员 | 仅 `spec_SHA256SUMS`（blob `aceb7e9aed`），其余 7 个无 |
| `OmniGuard-backup-20261115/omniguard-all.bundle`、`omniguard-all-1327.bundle` | 克隆成临时裸仓库后扫描，分别 1,789、1,808 个 blob | 仅 `spec_SHA256SUMS` |
| `OmniGuard-backup-20261115/worktree-HEAD.tgz` | 4,398 个成员 | 仅 `spec_SHA256SUMS`（`./eval/spec/SHA256SUMS`） |
| `~/.omniguard_custody/`（私有数据目录） | 1,864 个文件，只含第二轮材料 | 无 |
| `~/.omniguard_custody_backup/` | 1,816 个文件，1,709 个压缩包成员 | 无 |
| `/private/tmp/omniguard-formal-authorized-20261107`、`omniguard-acceptance-v1`、`omniguard-formal-offline-review` | 目录存在，0 个文件 | 无 |
| 废纸篓 `~/.Trash`、OneDrive（`~/Library/CloudStorage/OneDrive-个人`、`~/OneDrive`） | 系统拒绝访问（Operation not permitted） | **未检查** |
| 其他设备、外接盘 | — | 未检查（未知） |

### A3. 结论

| 文件 | 结论 |
|---|---|
| `test_set.jsonl` | **找不到**（在上述可读位置均无哈希一致的文件；其余可能位置未检查） |
| `stress_cases.jsonl` | **找不到**（在上述可读位置均无哈希一致的文件；其余可能位置未检查） |
| `spec_SHA256SUMS` | **已找回且哈希一致**（`eval/spec/SHA256SUMS`，在仓库内） |
| `blind_results` | **找不到**（在上述可读位置均无哈希一致的文件；其余可能位置未检查） |
| `full_note_review` | **找不到**（在上述可读位置均无哈希一致的文件；其余可能位置未检查） |
| `semantic_overlap_audit` | **找不到**（在上述可读位置均无哈希一致的文件；其余可能位置未检查） |
| `stress_blind_results` | **找不到**（在上述可读位置均无哈希一致的文件；其余可能位置未检查） |
| `stress_full_review` | **找不到**（在上述可读位置均无哈希一致的文件；其余可能位置未检查） |

补充：Codex 会话日志记录过 2026-11-07 把私有数据和运行目录打成两个压缩包放在 `/private/tmp`（`omniguard-acceptance-v1-private.tgz`、`omniguard-formal-and-data-private-20261107.tgz`），这两个包现在不在任何已检查位置。清理原因未确认（推测系统临时目录清理，**未验证**）。第二轮的 17 个封存包（`eval/experiments/note_vs_rules_v2/archive/`）只含第二轮材料，不含第一轮原件（见该目录 `README.md`“这些名字不代表跑了几次模型”一节）。

第一轮目前仍能核对的是**聚合**：`eval/formal/results/*/public_summary.json`、`report.md`、`VERIFICATION.json`、`SHA256SUMS`、`eval/formal/results/reproducibility_*.json`，这些文件当前通过 `shasum -c`；逐条原件（题目正文、逐条回复、逐条评分）找不到，所以聚合数字不能再从原件复算。

## B. 新跑的 180 条

### B1. 来源

- **不是原 300 条的子集，是重新编写的。** 依据：`eval/experiments/note_vs_rules_v2/AUTHOR_BRIEF.md` 第 1 节“为 AGV 仿真的可选备注写 180 条带备注的记录”；原 300 条已找不到，也没有逐条去重（`eval/LIMITATIONS.md` 第 22 条）。
- **没有生成脚本，没有随机种子。** 由独立作者会话人工／AI 写作，不是脚本生成。（第一轮的开发集 `eval/dev/dev_set.jsonl` 才由 `eval/dev/make_dev_set.py` 按种子生成；本轮测试集不是。）仓库内未记录作者的模型身份，作者的自述见 `HANDOFF_TO_GPT.md`“作者接触历史已经披露”一节，**未独立核实**。
- **生成时间（来自私有目录文件修改时间，+0800）：** 初稿 `candidate_test_set_v2.jsonl` 2026-11-15 13:27:53；Revision1 15:21:27；Revision2 17:04:58；Revision3（即最终运行文件）18:21:12。最终字节的哈希承诺提交 `a65eb62` 在 2026-11-15 19:44:15。
- 随机种子只出现在**盲标环节**，不用于出题：20261107 是第一次 54 条的分层抽样种子，20261115、20261116、20261117、20261118 是各盲标包的匿名 ID 打乱种子（见 `HANDOFF_TO_GPT.md` 各节）。
- 最终运行文件：`eval/experiments/note_vs_rules_v2/evidence/data/test_set.jsonl`，SHA-256 `6249acb7385857262942e746a91c55f19500f8be0905a7499ae2b25b580a1369`（`eval/experiments/note_vs_rules_v2/evidence/runs/main/20261115T152854Z_main_real_e5fd14c2/config.json` 第 41 行 `dataset_sha256.main`）。

### B2. 分布

来源：`evidence/data/test_set.jsonl`（180 条），主类用冻结规则 `compose(遥测, 金标备注状态)` 计算。

| 主类（金标） | 条数 |
|---|---:|
| NORMAL_NAV | 60 |
| CRITICAL_OBSTACLE | 64 |
| LOW_BATTERY | 16 |
| OVERHEAT | 20 |
| LOW_HEALTH | 12 |
| OVERSPEED | 8 |

| 备注状态 | 条数 | 中文 | 英文 | 中英混合 |
|---|---:|---:|---:|---:|
| AFFIRMED_CURRENT | 30 | 10 | 10 | 10 |
| UNCERTAIN | 30 | 10 | 10 | 10 |
| NEGATED | 30 | 10 | 10 | 10 |
| HISTORICAL | 30 | 10 | 10 | 10 |
| HYPOTHETICAL | 30 | 10 | 10 | 10 |
| IRRELEVANT | 30 | 10 | 10 | 10 |

- 每类（六种主类）**不是**各 50：它们是备注状态均衡（各 30），主类由遥测和备注共同决定，上表是实际分布。
- 遥测：正常 90 条、有数值风险 90 条；60 个实验家族，每个 3 条。
- **压力用例：本轮 180 条里没有。** 第二轮没有压力集；55 例压力用例属于第一轮（见 C3）。

### B3. 它是在看到原 300 条的结果之前还是之后确定的

**之后。** 时间线（均为 +0800，取自 git）：

| 事件 | 提交 | 时间 |
|---|---|---|
| 原 300 条冻结清单 | `186049d` | 2026-11-07 19:10:53 |
| 原 300 条运行并发布聚合结果 | `e5a0b0e` | 2026-11-07 20:02:36 |
| 第二轮计划首次提交（含 R3 草稿） | `1ec769a` | 2026-11-09 09:29:53 |
| 第二轮候选题初稿保存 | （私有文件时间） | 2026-11-15 13:27:53 |
| 最终字节承诺 | `a65eb62` | 2026-11-15 19:44:15 |
| 执行标签 `eval-note-v2-r3-final-20261115` 所指提交 | `1eddd79` | 2026-11-15 19:49:44 |
| 第二轮真实运行（180 条正式测试及 2 次健康检查） | （运行记录 `started_at`） | UTC 2026-11-15 15:28:48–15:34:55，即 +0800 23:28:48–23:34:55 |

作者是否看过第一轮结果：**未知**（计划要求不接收模型预测或错误分析，见 `AUTHOR_BRIEF.md` 第 0–1 节；实际是作者自述，未核实）。

### B4. 两次运行之间的变化

| 项 | 第一轮 | 第二轮 | 是否变化 |
|---|---|---|---|
| 提示词 B-1.0 SHA-256 | `9247896719b66e139d0155f6f48716805805e6ba3ceec356c8264ee2b3d4a609`（`eval/acceptance/FROZEN_MANIFEST.json` 第 79 行；`eval/formal/results/20261107T113942Z_main_real_094cb6c1/public_summary.json` `prompt_sha256`） | 同（`eval/experiments/note_vs_rules_v2/evidence/runs/main/20261115T152854Z_main_real_e5fd14c2/config.json` `baseline.prompt_sha256`） | **未变** |
| `router_v2/prompt.py` | 文件 SHA-256 前 12 位 `4f6eae88f333`（标签 `eval-formal-v1`） | 同（标签 `eval-note-v2-r3-final-20261115`） | **未变**；git 历史只有 1 次提交 `01d4ce4`（2026-11-07 17:41） |
| `router_v2/rules.py` | `489c1c252d5d` | `489c1c252d5d` | **未变**；唯一提交 `01d4ce4` |
| `router_v2/pipeline.py` | `55dddf702606` | `55dddf702606` | **未变**；提交 `01d4ce4`、`c6f85a2`、`6aa7824`（均在 2026-11-07 18:34 前） |
| `eval/baseline_b/prompt_b.py` | `48611f8a5d69` | `48611f8a5d69` | **未变**；提交 `1fff109`、`a15c870`（2026-11-07 15:09 前） |
| 两个标签之间 `router_v2/` 目录差异 | — | `git diff eval-formal-v1 eval-note-v2-r3-final-20261115 -- src/cloud-orchestrator/router_v2` 无输出 | **未变** |
| 请求模型名 | 公开摘要记录别名与所有者声明：`DeepSeek-V4.1-Flash-1017 (owner-stated, actual version unverified)`；请求名为 `deepseek-v4-flash`、返回别名 `deepseek-flash`（`eval/report.md` 第 10 行） | 请求名与返回别名均为 `deepseek-flash`（`eval/experiments/note_vs_rules_v2/evidence/runs/main/20261115T152854Z_main_real_e5fd14c2/config.json` `model.configured_model_name`，第 53 行） | **请求名不同**（旧名仍被提供商接受），提供商声明的版本相同；真实版本两轮均**未验证** |
| temperature | 请求 temperature=0，但提供方推理模式忽略它（`eval/report.md` 第 10 行） | 0.0（`eval/experiments/note_vs_rules_v2/evidence/runs/main/20261115T152854Z_main_real_e5fd14c2/config.json` `request_settings.temperature`，第 65 行），输出上限 2048，SDK 重试 0，超时 60 秒 | 相同；提供商默认推理模式不保证 temperature 生效（`eval/experiments/note_vs_rules_v2/evidence/runs/main/20261115T152854Z_main_real_e5fd14c2/config.json` `model.note`） |

### B5. 实际运行次数与一致性

| 轮次 | 运行 | 结果 |
|---|---|---|
| 第一轮 | 健康检查 `a6e1b5e8`（2 次调用）、主测试两次 `094cb6c1`、`19df553b`（各 300 条）、压力 `8352b4ff`（32 次真实请求+23 次本地检查） | 两次主测试一致：`eval/formal/results/reproducibility_20261107T113942Z_main_real_094cb6c1__20261107T114703Z_main_real_19df553b.json` 的 `prediction_agreement` = 1.0（第 16 行）、`note_status_agreement` = 1.0、`accuracy_difference_points` = 0.0、`verdict` = PASSED |
| 第二轮 | 公开开发集健康检查 2 次 + **正式 180 条只跑一次**（`20261115T152854Z_main_real_e5fd14c2`） | **没有重复运行，所以第二轮没有“两次一致”的证据**（`archive/README.md` 同样说明） |

## C. 180 条的结果

来源：`evidence/runs/main/20261115T152854Z_main_real_e5fd14c2/calls.jsonl`（模型）、`evidence/rules/R{1,2,3}_predictions.jsonl`（规则）、`evidence/data/test_set.jsonl`（输入与金标）；由我现场重新计数，**不调用 `note_analysis` 的计分函数**，漏停／误停用 `router_v2.rules.execute` 的动作与金标动作比较。

### C1. 固定模型（B-1.0）

- 主类准确率：180/180 = 100.00%；备注状态准确率：173/180 = 96.11%；漏停 0、误停 0；接口错误 0；解析失败 0。
- 来源与字段：`note_compare.json`（`eval/experiments/note_vs_rules_v2/results/20261115T152854Z_main_real_e5fd14c2/`），见 `RESULTS.md` 主指标表。

**6 类主类混淆矩阵（模型）：**

| 金标＼预测 | NORMAL_NAV | CRITICAL_OBSTACLE | LOW_BATTERY | OVERHEAT | LOW_HEALTH | OVERSPEED | (无输出) | 合计 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| NORMAL_NAV | 60 | 0 | 0 | 0 | 0 | 0 | 0 | 60 |
| CRITICAL_OBSTACLE | 0 | 64 | 0 | 0 | 0 | 0 | 0 | 64 |
| LOW_BATTERY | 0 | 0 | 16 | 0 | 0 | 0 | 0 | 16 |
| OVERHEAT | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 20 |
| LOW_HEALTH | 0 | 0 | 0 | 0 | 12 | 0 | 0 | 12 |
| OVERSPEED | 0 | 0 | 0 | 0 | 0 | 8 | 0 | 8 |

**6 种备注状态混淆矩阵（模型）：**

| 金标＼预测 | AFFIRMED_CURRENT | UNCERTAIN | NEGATED | HISTORICAL | HYPOTHETICAL | IRRELEVANT | (无输出) | 合计 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| AFFIRMED_CURRENT | 30 | 0 | 0 | 0 | 0 | 0 | 0 | 30 |
| UNCERTAIN | 0 | 30 | 0 | 0 | 0 | 0 | 0 | 30 |
| NEGATED | 0 | 0 | 30 | 0 | 0 | 0 | 0 | 30 |
| HISTORICAL | 0 | 0 | 5 | 24 | 0 | 1 | 0 | 30 |
| HYPOTHETICAL | 0 | 0 | 0 | 0 | 29 | 1 | 0 | 30 |
| IRRELEVANT | 0 | 0 | 0 | 0 | 0 | 30 | 0 | 30 |

### C2. 同一批 180 条上的规则基线

| 方案 | 主类 | 主类准确率 | 备注状态 | 备注准确率 | 漏停 | 误停 | 接口错误 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 固定模型 | 180/180 | 100.00% | 173/180 | 96.11% | 0 | 0 | 0 |
| R1 | 131/180 | 72.78% | 60/180 | 33.33% | 31 | 8 | 0（本地代码） |
| R2 | 116/180 | 64.44% | 41/180 | 22.78% | 28 | 21 | 0（本地代码） |
| R3 | 138/180 | 76.67% | 77/180 | 42.78% | 26 | 10 | 0（本地代码） |

与 `RESULTS.md` 的数字对照：R1 备注 60、主类 131、漏停/误停 31/8；R2 41、116、28/21；R3 77、138、26/10；模型 173、180、0/0。上表为我重新计数的结果。

**6 类主类混淆矩阵（R1）：**

| 金标＼预测 | NORMAL_NAV | CRITICAL_OBSTACLE | LOW_BATTERY | OVERHEAT | LOW_HEALTH | OVERSPEED | (无输出) | 合计 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| NORMAL_NAV | 54 | 6 | 0 | 0 | 0 | 0 | 0 | 60 |
| CRITICAL_OBSTACLE | 23 | 26 | 5 | 4 | 3 | 3 | 0 | 64 |
| LOW_BATTERY | 0 | 2 | 14 | 0 | 0 | 0 | 0 | 16 |
| OVERHEAT | 0 | 2 | 0 | 18 | 0 | 0 | 0 | 20 |
| LOW_HEALTH | 0 | 1 | 0 | 0 | 11 | 0 | 0 | 12 |
| OVERSPEED | 0 | 0 | 0 | 0 | 0 | 8 | 0 | 8 |

**6 类主类混淆矩阵（R2）：**

| 金标＼预测 | NORMAL_NAV | CRITICAL_OBSTACLE | LOW_BATTERY | OVERHEAT | LOW_HEALTH | OVERSPEED | (无输出) | 合计 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| NORMAL_NAV | 45 | 15 | 0 | 0 | 0 | 0 | 0 | 60 |
| CRITICAL_OBSTACLE | 20 | 30 | 5 | 4 | 2 | 3 | 0 | 64 |
| LOW_BATTERY | 0 | 3 | 13 | 0 | 0 | 0 | 0 | 16 |
| OVERHEAT | 0 | 5 | 0 | 15 | 0 | 0 | 0 | 20 |
| LOW_HEALTH | 0 | 4 | 0 | 0 | 8 | 0 | 0 | 12 |
| OVERSPEED | 0 | 3 | 0 | 0 | 0 | 5 | 0 | 8 |

**6 类主类混淆矩阵（R3）：**

| 金标＼预测 | NORMAL_NAV | CRITICAL_OBSTACLE | LOW_BATTERY | OVERHEAT | LOW_HEALTH | OVERSPEED | (无输出) | 合计 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| NORMAL_NAV | 52 | 8 | 0 | 0 | 0 | 0 | 0 | 60 |
| CRITICAL_OBSTACLE | 20 | 35 | 4 | 2 | 1 | 2 | 0 | 64 |
| LOW_BATTERY | 0 | 1 | 15 | 0 | 0 | 0 | 0 | 16 |
| OVERHEAT | 0 | 2 | 0 | 18 | 0 | 0 | 0 | 20 |
| LOW_HEALTH | 0 | 1 | 0 | 0 | 11 | 0 | 0 | 12 |
| OVERSPEED | 0 | 1 | 0 | 0 | 0 | 7 | 0 | 8 |

说明：R1/R2/R3 在评测里要求“数值部分同参考规则”，所以主类错误来自备注状态判断；“漏停/误停”是最终动作与金标动作的差异，不是物理制动。

### C3. 压力用例

**第二轮没有压力用例。** 下面是第一轮的 55 例（`eval/formal/results/20261107T115548Z_stress_real_8352b4ff/public_summary.json` 的 `stress.by_type`、`stress.total`；类型定义和预期行为见 `eval/spec/DATA_PLAN.md` 第 5 节，第 61–90 行）：

| 类型 | 条数 | 预期 | 实际（本地拒绝 / 注入故障停车 / 真实请求） | 漏停 | 误停 | 接口错误 |
|---|---:|---|---|---:|---:|---:|
| 1 | 5 | 单位混淆或越界数值：输入校验拒绝并停车 | 5 / 0 / 0 | 0 | 0 | 0 |
| 2 | 5 | 缺字段或空值：输入校验拒绝并停车 | 5 / 0 / 0 | 0 | 0 | 0 |
| 3 | 5 | 边界等号与近边界小数：按规范判定 | 0 / 0 / 5 | 0 | 0 | 0 |
| 4 | 5 | 多风险冲突：按规范合成一个状态 | 0 / 0 / 5 | 0 | 0 | 0 |
| 5 | 5 | 备注与遥测来源不一致：取更严的读法 | 0 / 0 / 5 | 0 | 0 | 0 |
| 6 | 5 | 中英混合备注含错别字：按规范判定 | 0 / 0 / 5 | 0 | 0 | 0 |
| 7 | 5 | 多分句备注含否定、历史、假设：按规范判定 | 0 / 0 / 5 | 0 | 0 | 0 |
| 8 | 5 | 备注里的提示注入：不删除任何风险，不触发停车标志 | 0 / 0 / 5 | 0 | 0 | 0 |
| 9 | 5 | 空输入、空白备注、超过 500 字符备注：空输入拒绝，空白备注视为无备注，超长拒绝且不截断 | 3 / 0 / 2 | 0 | 0 | 0 |
| 10 | 5 | 注入超时：停车（TIMEOUT） | 0 / 5 / 0 | 0 | 0 | 0 |
| 11 | 5 | 注入限流：停车（RATE_LIMIT） | 0 / 5 / 0 | 0 | 0 | 0 |
| 合计 | 55 | | 13 / 10 / 32 | 0 | 0 | 0 |

字段：`stress.total`（第 200 行起）。真实请求 32 次中模型错类 0、不可用回复 0。10 例注入故障是本地模拟，不是真实接口故障；每条的预期以 DATA_PLAN 为准，逐条结果文件已找不到，只能核对聚合。

## D. 旧数字还有多少能核实

说明：任务描述在这里被截断，下面是我按可见两项（“300/300”“两轮一致”）及同类旧说法核对的清单。“有证据文件”指**聚合文件**在仓库里且当前哈希通过，**不等于**能从原件复算；第一轮逐条原件找不到。

| 旧说法 | 状态 | 证据（文件、行号、字段） | 备注 |
|---|---|---|---|
| 300/300（主类，两次运行各自） | **有证据文件（仅聚合）** | `eval/formal/results/20261107T113942Z_main_real_094cb6c1/public_summary.json` 第 34 行（`metrics.primary.all_started`）；`eval/formal/results/20261107T114703Z_main_real_19df553b/public_summary.json` 第 34 行；`eval/report.md` 第 18–19 行（两跑 300/300） | 逐条原件找不到，不能复算；是合成题，两次同一批题 |
| 两轮一致（预测一致率 100%） | **有证据文件（仅聚合）** | `eval/formal/results/reproducibility_20261107T113942Z_main_real_094cb6c1__20261107T114703Z_main_real_19df553b.json` 第 16 行（`prediction_agreement`=1.0、`note_status_agreement`=1.0、`passes`=true） | 是同一批 300 条跑两次的一致，不是 600 个独立样本 |
| R1 主类 281/300、漏停 14、误停 3；R2 280/300、漏停 10、误停 6 | **有证据文件（仅聚合）** | `eval/formal/results/20261107T113942Z_main_real_094cb6c1/public_summary.json` 第 402 行（`rule_controls.R1`）；`eval/report.md` 第 40–42 行（B-1.0、R1、R2 行） | 14 次漏停逐条原因**无证据**（从未逐条分析，原件已丢） |
| 备注状态 72/72、R1 23/72、R2 15/72 | **有证据文件（仅聚合）** | `eval/formal/results/20261107T113942Z_main_real_094cb6c1/public_summary.json` 第 45 行（`metrics.note_status`、`rule_controls.*.note_status`） | 72 条是 6 种备注状态×12 |
| 70/300 `floor_override` | **有证据文件（仅聚合）** | `eval/formal/results/20261107T113942Z_main_real_094cb6c1/public_summary.json` 第 384 行（`metrics.safety.floor_override`） | 是代码补充风险的次数，**不是**救回 70 次模型错误（`LIMITATIONS.md` 第 22 条说明） |
| 压力 55/55 = 13+10+32 | **有证据文件（仅聚合）** | `eval/formal/results/20261107T115548Z_stress_real_8352b4ff/public_summary.json` 第 200 行（`stress.total`） | 10 例为本地注入故障 |
| 634 次请求、630,792 token、约 US$0.285 | **有证据文件** | `eval/report.md` 第 87 行；`eval/formal/results/VERIFICATION.json` | 按保守配置费率估算，不是账单 |
| 6 类×50、72 条备注、34 个家族 | **有证据文件（清单计数）** | `eval/acceptance/FROZEN_MANIFEST.json` 第 8 行（`class_counts`）、第 17 行（`note_status_counts`）、第 25 行（`families`） | 题目正文找不到；34 个“保守家族”，不是 300 个独立场景 |
| 盲标 24/72、κ=1、全量复核 72 条 | **只有文字记录（清单里的数字）** | `eval/acceptance/FROZEN_MANIFEST.json` 第 50 行（`annotation.blind_sample`） | 对应文件 `blind_results`（哈希 `e6e855f7…93`）找不到；是 AI 标注的自洽，不是专家金标 |
| 提示词在测试集冻结前定稿、未据测试结果调整 | **有证据文件（git）** | `git log -- src/cloud-orchestrator/router_v2/prompt.py` 只有 `01d4ce4`（2026-11-07 17:41）；冻结提交 `186049d`（19:10:53）；`eval/acceptance/FROZEN_MANIFEST.json` 第 79 行 | git 只能证明提交记录；出题者是否见过提示词**未知** |
| 旧 200 场景历史基准：79/200 提前退出、完整三步平均 6,173.6 ms | **有证据文件** | `src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-07-16-thesis-200/summary.json`（`gate_counts`、`circuit_breaking`、`latency_ms.total_pipeline`） | 与第一轮 300 条不同题库、不同标签，不能互比 |
| “陌生人 10 分钟复现”“真人口头验收” | **无证据** | `eval/EVIDENCE_INDEX.md` 第 44 行、第 88 行写明“未完成” | 保管者做过本地新克隆的哈希核验，那不是真人陌生人复现 |

## 其他需要知道的事实

- 第二轮的数字（173/180、77/180 等）有原件：`evidence/` 目录，已入仓并推送到 GitHub（见 `eval/experiments/note_vs_rules_v2/evidence/README.md`、`archive/README.md`）；第一轮没有这样的原件。
- 独立介质备份未做（所有者已延期）。本文件写作时，工作区另有 3 个他人修改的未提交文件（`eval/interview/*`），我没有触碰。
