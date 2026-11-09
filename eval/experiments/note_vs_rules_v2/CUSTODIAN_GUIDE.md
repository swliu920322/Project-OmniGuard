# 给保管者的操作说明（本轮：备注理解，规则与模型对照）

保管者持有私有测试文件，不属于实施者。实施者只收到 **SHA-256 和 `check-data` 的统计输出**。数据、逐条结果、逐条回复都留在保管者的私有目录，**不进仓库**。

## 1. 顺序（来自计划第 3 节）

1. 先确认实施者已冻结方案：仓库里有 `V2_FREEZE.json`（R3、B-1.0 提示词、评分器、旧冻结文件的哈希）。
2. 向作者交付 `AUTHOR_BRIEF.md`；**作者写具体句子之前**，收取家族名单承诺并留存。
3. 作者交文件后，保管者运行 `check-data`（见下）并处理所有 `problems`。
4. 语义重合检查：对公开开发材料（`eval/dev/`、`eval/spec/ambiguous_examples.json`、本目录的 `dev_extra.jsonl`、`dev_holdout.jsonl`）和旧已用测试做**语义**查重（脚本只做精确重合）。不得把旧样本换数值后算新题。
5. 标注：初始标签（作者）→ 新会话**盲标抽样**（每种状态≥30%，向上取整，种子写明；180 条为每种 9 条共 54 条）→ 封存哈希 → 复核者全量复核。披露原始一致率、Cohen's kappa、分歧和裁决。无法裁决的句子在调用前移除，以同配额补足，写明原因。
6. 计算并提交**测试哈希与统计承诺**：`check-data` 的输出（不含任何记录）连同文件哈希。此后文件不得再改。
7. 实施者运行 `plan --data … --expect-sha256 …` 得到精确的请求数与上界（只含数字）。
8. 用户一次性授权预算（本轮目前**没有**授权）。

## 2. 命令（均不打印记录）

```bash
python3 eval/experiments/note_vs_rules_v2/run_note_compare.py check-data --data <file>                 # 首次：打印哈希、统计、问题清单
python3 eval/experiments/note_vs_rules_v2/run_note_compare.py check-data --data <file> --expect-sha256 <hash>
python3 eval/experiments/note_vs_rules_v2/run_note_compare.py plan --data <file> --expect-sha256 <hash> --price-input-per-mtok … --price-output-per-mtok … --price-source "<页面与日期>"
```

`check-data` 检查：哈希在解析前核对；每条有备注；无多余键；`note` 与 `note_status` 合同；180 条、每状态 30、每状态每语言 10、每状态正常／风险遥测各 15、家族≥60 且每家族≤3、语言标签与文字一致、物理门控均为通过、与公开材料的精确重合为 0、家族名与公开家族不重名、渲染输入不重复。输出只含计数和问题代码。

## 3. 公开健康检查与真实运行（需要用户授权和预算，当前没有）

1. 健康检查在**公开开发集**上做 2 次调用，不用测试题：`run --health --mode real --data eval/dev/dev_set.jsonl --expect-sha256 <dev 哈希> --limit 2 …`，随后 `check-health --run-dir <目录>`。以下条件必须全过（共八项：正常完成、无接口错误、结束原因 stop、严格输出且与备注有无相容、输出不超上限、返回别名一致、请求参数与冻结配置一致、目录封存校验通过）；任一不满足不启动主测试，不自行换参数重试。
2. 主测试：`run --mode real --data <file> --expect-sha256 <hash> --private-out <仓库外目录> --public-out <目录> --frozen-tag <指向当前提交的标签> --health-run <通过的健康目录> --max-calls 180 …`。需要 `BASELINE_B_AUTHORIZED=yes`、干净工作树、标签等于 HEAD；金额上限和价格来源由所有者提供，价格须在运行前核实。
3. 结果：私有运行目录（含 `calls.jsonl`）、`<目录>_analysis`（含配对 id 列表，私有）、公开聚合 `note_compare.json` 与 `REPORT.md`。**公开聚合里没有 id、备注原文、回复**。`run_once/` 子目录里是旧格式的聚合（主标签在前），**不要把它当作本轮结果引用**。
4. 未完成（预算提前停止、中断）的运行，报告里 `complete: false`，不得当作完整 180 条成绩。
5. 正式结果在预定开发结束后才解封给实施者；测试错误不再用于本轮改 R3 或模型方案。

## 4. 不要做的事

不要把测试文件、样例或逐条结果放进仓库或发给实施者；不要为了让某个方案更好看而替换、删减测试记录；不要用开发集结果充当正式结果。
