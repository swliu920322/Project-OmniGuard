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
- 下一步顺序：1) 同步本类交接文档（本次已做）；2) 新的隔离作者先交家族与表达类型覆盖计划，不先写满 180 条；3) 保管者核对覆盖与配额，再制作、盲标、复核、冻结并做备份恢复验证；4) 审核运行器与预算，取得授权后才调用模型。

## 仍缺（不属于 P0/P1）

- 独立测试（P2）：没有制作，实施者不能代出；保管者与作者的隔离能力要先核实；作者先交覆盖计划。
- 与旧已用测试的逐条去重：旧数据已丢失，无法做，须披露。
- 固定保管位置、独立备份与恢复验证：尚未建立。
- 价格未核实；没有预算授权；`plan` 在没有数据时有若干上界无法精确计算（已在输出里列出）。
- 盲标抽样的实现 / 语义重合检查由保管者负责，仓库里没有对应脚本（只有精确重合检查）。
- 如果 `V2_FREEZE.json` 所列文件有任何修改，需重新 `freeze` 并重新验收。
