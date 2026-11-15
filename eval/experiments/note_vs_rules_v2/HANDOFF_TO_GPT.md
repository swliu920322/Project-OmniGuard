# 交给 GPT 验收：P0/P1 离线实现

范围：[PLAN.md](PLAN.md) 的 P0、P1。离线完成，**没有调用模型、没有读取任何私有或测试数据、没有付费授权**。

## 提交

见 `git log --oneline -- eval/experiments/note_vs_rules_v2`：计划与草稿 v0；R3 修订 1（v1）；R3 修订 2（v2）与留出集；运行器、分析、测试、交接材料与冻结候选。工作区里前一轮面试材料的未提交改动（`eval/README.md`、`eval/interview/*`、`tests/test_docs_consistency.py`）**没有**混入这些提交。

## 复用 / 新增

复用且**未改动**：`eval/spec/*`、`eval/baseline_b/*`（含 `prompt_b.py`、`evaluate.py`、`fake_model.py`、`run_dev_eval.py`）、`eval/baseline_v1/measure/measure_lib.py`、`eval/formal/run_formal.py`（其 `run_once` 作为安全外壳被原样调用）。验证：`git diff eval-formal-v1 HEAD -- src eval/formal/run_formal.py eval/baseline_b eval/spec eval/acceptance eval/dev` 应无输出。详见 [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md)（含 8 处计划与代码不匹配及最小调整）。

新增（本目录）：`r3.py`、`note_analysis.py`、`run_note_compare.py`、`dev_eval.py`、`dev_extra.jsonl`、`dev_holdout.jsonl`、`dev_runs/`、`R3_DEV_LOG.md`、`AUTHOR_BRIEF.md`、`CUSTODIAN_GUIDE.md`、`V2_FREEZE.json`；测试 `tests/test_note_vs_rules_v2.py`。

## 验证命令

```bash
python -m pytest tests/test_note_vs_rules_v2.py -q                       # 本轮测试
python -m pytest tests -q --deselect tests/test_docs_consistency.py      # 全部（工作区里的 docs 一致性测试属上一轮未提交改动）
python eval/experiments/note_vs_rules_v2/dev_eval.py                      # 复现开发集数字
python eval/experiments/note_vs_rules_v2/dev_eval.py --holdout            # 留出集（只读，已跑过一次，之后未改动 R3）
python eval/experiments/note_vs_rules_v2/run_note_compare.py plan         # 182 次请求的规划；价格未核实
python -m pytest tests/test_note_vs_rules_v2.py -q -k committed_freeze                   # V2_FREEZE.json 与当前文件一致
```

## 开发集表现与缺陷（全部为开发材料，作者在起草前读过公开开发备注，数字偏乐观）

| 池 | R1 | R2 | R3 v2 |
|---|---:|---:|---:|
| 开发池（142 条不同备注：开发 72、开发压力 20、公开边界 15、作者补写 35，另 4 条争议不计分） | 118 | 51 | **141** |
| 留出集（作者补写，R3 修订之前写好，冻结后只跑一次；28 条计分，2 条争议） | 18 | 9 | **24** |

R3 在留出集的 4 个错误（H-04 无时态动词、H-09 “干净”未收、H-21 **漏停**：持续到现在的状态被读成过去、H-26 不在前方的人）和开发池的 1 个错误（X-35 机器人维护人员）都保留并披露，见 [R3_DEV_LOG.md](R3_DEV_LOG.md)。篇幅：234 行，36 个词表共 314 项，仅标准库加冻结的参考规则；一版初稿加两次修订。**R3 没有被宣称为强基线已充分**。

## 演练（假客户端）

`tests/test_note_vs_rules_v2.py` 42 项，覆盖：R3 的范围、承接、对比、错别字与误报反例；已知局限；数据检查（配额、家族、语言、物理门控、精确重合、重复输入）且输出不含记录；各方案读同一渲染文本；干跑后的运行目录与分析目录封存、公开报告无 id 与备注；预测错误但被代码纠正仍不得分；备注独有风险子集的漏停；配对计数与家族 bootstrap（2000 次、种子 20261109）可复现；预算提前停止的报告标 `complete: false`；在途请求中断（退出码 130）；缺用量保留预留且不记为零；接口错误与无效回复留在分母；健康检查各项；真实运行的前置条件（开关、干净树、标签、私有目录在仓库外、通过的健康运行）；计划；冻结与旧冻结文件未变。

## 2026-11-15 状态更新

- 前一轮面试材料已另行整理并提交，不再有“未提交的面试材料”；全部测试可直接运行：`python -m pytest tests -q`（当前 439 项通过），不再需要 `--deselect tests/test_docs_consistency.py`。
- 旧私有测试与逐条运行记录已不在本机（`eval/LIMITATIONS.md` 第 22 条），与旧已用测试的逐条去重无法执行，需在结果里披露。
- 保管与恢复验证成为 P4 前置条件（`CUSTODIAN_GUIDE.md` 第 5 节）。
- 公开方式：测前隔离，测完后公开整套合成评测材料（用户已决定）；Claude 分两次评审（运行前不看私有题与答案，运行后可读逐条结果复核）；收尾四个条件见 `PLAN.md` 第 8 节；推送另行授权。
- **候选题状态（2026-11-15）：** 候选文件 `candidate_test_set_v2.jsonl`（SHA-256 `4cfbf30ed776bc3ef38ecbc42ea5a34e2ec4fc46611c0f278c01045dbf7bbdb8`）与家族文件 `candidate_families_v2.json`（初版 `b2e194f3df9b4f928bfdc2bea16895d9e60a006fedc708e565678fa96236d218`；补齐说明后为 `e8141d1269733a32ec47f397201e6d3be81c11bf3ee162eb36fd600bbad6d958`）存放在仓库外固定目录。GPT 用新版检查器和 44 项相关测试重跑，结构核验通过，候选题原件哈希未变；另有180条标注依据文件，哈希 `60404ca88f613de22a189b626eb39abd6ac15f981aa395ea2d324529f241b159`。家族绑定、标注依据与180条原件逐条对应，分句合并一致；两份本机同盘副本哈希匹配，目录700、文件600，独立介质备份与恢复验证仍未完成。**未冻结，未做语义审核；** 作者已披露接触历史，属于尚未独立核实的自述；不再要求重复声明。后续：保管者组织 54 条盲标（盲标包须重新匿名化，去掉原 ID、家族名和初始标签）、全量复核、家族审计、权限收紧、独立备份与恢复校验；这些通过、争议处理有记录后，才做最终冻结与预算规划，再申请运行授权。Claude 在此期间只审代码与流程。
- 下一步顺序：1) 同步本类交接文档（本次已做）；2) 新的隔离作者先交家族与表达类型覆盖计划，不先写满 180 条；3) 保管者核对覆盖与配额，再制作、盲标、复核、冻结并做备份恢复验证；4) 审核运行器与预算，取得授权后才调用模型。

## 仍缺（不属于 P0/P1）

- 独立测试（P2）：180条候选已交并通过结构核验，尚未完成独立盲标、全量语义复核和家族审计，不是最终冻结数据。
- 与旧已用测试的逐条去重：旧数据已丢失，无法做，须披露。
- 固定保管位置、独立备份与恢复验证：尚未建立。
- 价格未核实；没有预算授权；`plan` 在没有数据时有若干上界无法精确计算（已在输出里列出）。
- 盲标抽样的实现 / 语义重合检查由保管者负责，仓库里没有对应脚本（只有精确重合检查）。
- 如果 `V2_FREEZE.json` 所列文件有任何修改，需重新 `freeze` 并重新验收。


## 2026-11-15 保管者更新：匿名盲标包已准备，待提交抽样承诺

本次只准备盲标材料，没有进行盲标、全量语义复核、模型请求或正式测量，也不表示数据已冻结。原候选数据未改。

- 抽样复用 `eval/spec/annotation.py::stratified_sample`，种子 `20261107`，按初始六状态各30条抽9条，共54条（30%），涉及42个候选家族；初始状态只用于分层抽样，不交给盲标者。
- 原ID在全180条中以种子 `20261115` 重新打乱后分配匿名ID，盲标包只含 `item_id` 和与模型一致渲染的 `input_text`，没有原记录ID、家族名或初始标签。已检查原ID／家族名未进入交付文本。
- 盲标者只接收交付目录内的输入和说明。匿名映射、抽样清单、作者标签与依据留在保管侧；说明明确禁止盲标者读取它们。
- 保管路径不写入仓库；本机原件与同盘副本逐字节一致，目录700、文件600。没有做独立介质备份或压缩包恢复验证，不能称其完成。

| 对象 | SHA-256 |
|---|---|
| 候选测试文件 | `4cfbf30ed776bc3ef38ecbc42ea5a34e2ec4fc46611c0f278c01045dbf7bbdb8` |
| 盲标输入包 | `a53941bb8eb955c0142d00f87c594ed4b71583b41da205a689d1d0cf51396e77` |
| 盲标说明 | `5d6ce71654a3ed6a488a2527f515af6702bb372d76d37928987fea790d0c10d3` |
| 私有匿名映射 | `f6fcbdd76b44f81862f76df3ba9426e77681fa299654d6f75941c848ebc19ea2` |
| 私有抽样清单 | `902cab2131681a21589bc1d3e4093f74e95752112037e3ab780c6ad115af8b74` |
| 包内SHA256SUMS | `543f736cb906d7619b13c91d1b31b7266e82b88b2bed0cb8a52af7a943ec2c38` |

**下一步严格顺序：** 先提交本节抽样承诺（尚未提交，不宣称已满足协议）；再把两份交付文件给未见初始标签的新会话；收回盲标结果后校验并封存、提交其哈希；之后才向复核者提供初始标签进行全量复核与家族审计。争议和修改留版本记录，再决定是否满足最终冻结条件。

作者接触历史已经披露：其自述包括高层项目背景、规范、公开开发排除材料及交接说明，且自述未参与R3开发、未阅读R3内部规则或开发预测。保留为尚未独立核实的自述，不写“未声明”或“技术强制隔离”。
