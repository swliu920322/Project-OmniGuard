# eval：评测证据与阅读导航

这里保存 OmniGuard 的路由规范、数据制作过程、模型评测程序、运行结果和面试讲解材料。第一次接触项目，不需要从几百个运行文件开始读。

项目使用 AGV 仿真遥测和一条可选备注，验证模型如何选择六类状态路由，以及程序如何约束输出。它没有实现视觉感知或实体车辆控制。延迟研究与路由准确率是两条不同的证据线。

## 第一次来，按这个顺序

如果不知道 `primary` 等代码字段是什么意思，先看 [一辆小车的中文入门例子](../docs/guide/START_HERE_zh.md)，不需要预先懂 Agent 或评测术语。

1. **理解项目为什么做**：[面试讲述稿](../study/interview/INTERVIEW_STORY_zh.md)。从机器人的云端等待问题，到 AGV 仿真，再到路由评测。
2. **理解代码怎么走**：[后端阅读地图](../docs/guide/BACKEND_CODE_GUIDE_zh.md)。包含三个 Agent 角色、六类状态、调用图与源码定位。
3. **看实际测出了什么**：[正式报告](report.md)、[延迟证据](LATENCY_EVIDENCE.md)。准确率、模型调用耗时与仿真设定不要混用。
4. **追查结论依据**：[证据索引](EVIDENCE_INDEX.md) → 规范／冻结清单 → 正式结果与独立核对。
5. **想自己运行**：[复现指南](REPRODUCE.md)。免费离线、公开开发集实测、私有正式数据复现分成三级，不能相互替代。

检查结果可信度直接从 [report.md](report.md) 开始。面试备考材料是个人学习资料，不是评测证据，放在 [study/](../study/README.md)。

概念拓展见 [Agent 与意图](../docs/guide/AGENT_INTENT_DESIGN_zh.md) 和 [业务 harness](../docs/guide/BUSINESS_HARNESS_zh.md)：前者解释角色与类别，后者解释后端如何承载模型执行；设计示意不算已实现功能。

## 名称里的字母是什么意思？

这些是项目内部命名，不是需要先掌握的专业术语。尤其 `B` 在两处重用了，读的时候要带上上下文。

| 名称 | 含义，用中文怎么读 | 不代表什么 |
|---|---|---|
| `eval` | evaluation，评测资料与程序 | 不只是结果文件夹 |
| 基线 A（Baseline A） | 原实现的归档与重测，用来交代原来是什么 | 不是新六类任务可以直接比较的“提升前” |
| 基线 B（Baseline B） | 新六类任务的固定初始方案，完整给出规则但不做结果驱动优化 | B 是方案编号，不是成绩，也不单独等于版本号 |
| `B-1.0` | 基线 B 提示词的 1.0 版 | 不是模型版本，不是 1.0 分 |
| `v1`、`v2` | version 1、version 2，第一版、第二版；具体是谁的版本要看名字 | **v 不表示结果**，也不保证所有带 v1 的文件属于同一轮 |
| `baseline_v1/` | 旧实现第一版基线归档；本项目把它作为基线 A 的材料目录 | 不等于新任务的 `baseline_b/` |
| 基线 A 重测中的条件 `B`／`P` | B 是 benchmark 路径，P 是业务 Router 路径，提示词和输入格式不同 | 条件 B 不是上面的“基线 B” |
| `router_v2` | 扩展路由代码包的版本命名 | 不代表 Router 准确率提升过 |
| `R1`／`R2` | 两个关键词规则对照方案 | 不是模型的两次运行，也不是模型的两个优化版本 |
| `results/`、`report.md` | 结果目录、结果报告 | 这才是查成绩的地方，不能从版本名读出成绩 |
| `run`、`runs/` | 一次执行、执行记录目录；同一版本可以执行多次 | 一次执行不一定成功，也不一定是正式评测 |
| `dry-run`、`canary` | 假模型演练、少量真实调用的小测试 | 都不能代替完整正式测量 |
| `spec`、`dev`、`formal` | 判定规范、开发资料、正式评测 | 开发成绩与正式成绩不能混写 |
| `b61ffc5` 这类字符串 | Git 提交内容的短标识，开头的 b 只是十六进制字符 | 不是基线 B，也没有业务含义 |

例如可以完整地说：**“用基线 B 的 B-1.0 提示词，在本轮冻结合成测试集上执行两次，结果分别为 300/300。”** 方案、提示词版本、数据和运行结果是四件不同的事。面试首次提及时先用中文解释，不要求对方记内部缩写。

## 目录地图

```text
eval/
├── README.md                 本导航
├── interview/                学习路线、答题主手册、中文入门、代码地图与按需专题
├── report.md                 本轮正式评测结论
├── EVIDENCE_INDEX.md         结论到证据的索引、执行台账、验收状态
├── LIMITATIONS.md            已知局限与不能声称的结论
├── LATENCY_EVIDENCE.md       延迟计时边界、真实请求与仿真设定
├── LATENCY_COST.md           延迟／费用统计口径与缺失字段
├── REPRODUCE.md              分级复现方法
├── REPRODUCE_TEST_PROMPT.md  给外部复现者的任务说明
├── spec/                    规范、参考规则、标注与数据分组协议
├── dev/                     公开开发集、开发压力集、规则对照结果
├── annotation/              开发备注的盲标、封存与复核材料
├── acceptance/              独立测试数据的哈希承诺与标注审计
├── baseline_v1/             原版三类实现归档及重测
├── baseline_b/              新任务固定提示词、评分器、开发运行与故障诊断
├── formal/                  正式运行入口、代码冻结与公开聚合结果
├── experiments/             后续实验计划／实现，须按各自状态区分，不能冒充已完成成绩
└── reproduction_logs/       外部 AI 的离线复现预演记录
```

面试备考材料已移到 [study/](../study/README.md)，新人导读在 [docs/guide/](../docs/guide/README.md)；证据文件仍在原位。旧提交里的路径可能不同，查历史时使用对应提交的目录。

## 根目录每份文档负责什么

| 文件 | 读完能知道什么 | 注意 |
|---|---|---|
| [report.md](report.md) | 本轮六类正式结果、规则对照、压力结果和费用 | 300 条合成记录来自 34 个家族；没有优化版，也没有 X→Y |
| [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md) | 每项主张对应什么文件、哪些关卡仍未完成 | 文档写好不等于口述或真人复现已通过 |
| [LIMITATIONS.md](LIMITATIONS.md) | 数据、版本、执行、统计和部署的局限 | 引用成绩时一起看 |
| [LATENCY_EVIDENCE.md](LATENCY_EVIDENCE.md) | 哪些是真计时、哪些是模拟参数、车辆等待时如何运动 | 历史三阶段模型调用之和不是浏览器端到端延迟 |
| [LATENCY_COST.md](LATENCY_COST.md) | 可计算的平均费用、开发延迟旁证及正式延迟缺失字段 | 费用按配置费率估算，不是账单 |
| [REPRODUCE.md](REPRODUCE.md) | 从哪里运行、需要什么依赖、不同层级证明什么 | 只克隆公开仓库不能重新测出私有正式数据的成绩 |
| [REPRODUCE_TEST_PROMPT.md](REPRODUCE_TEST_PROMPT.md) | 如何要求一个新会话只报告、不修复地试跑指南 | 这是任务说明，不是已经通过的证据 |

## 子目录里的关键文件

### spec/：先规定题目和答案怎么算

| 文件 | 用途 |
|---|---|
| [LABEL_SPEC.md](spec/LABEL_SPEC.md) | 六类、阈值、备注状态、主次风险、执行动作与计分规范 |
| [reference_labeler.py](spec/reference_labeler.py) | 把数值规则和动作合成写成确定性代码；不是用模型生成数值答案 |
| [DATA_PLAN.md](spec/DATA_PLAN.md)、[family.py](spec/family.py) | 样本覆盖、家族分组、开发／测试分配与去重约定 |
| [ANNOTATION_PROTOCOL.md](spec/ANNOTATION_PROTOCOL.md)、[annotation.py](spec/annotation.py) | 备注盲标、复核、争议处理、抽样与一致性统计 |
| [ambiguous_examples.json](spec/ambiguous_examples.json) | 公开边界示例，属于开发资料 |
| [rule_control.py](spec/rule_control.py) | R1/R2 关键词规则对照；不是优化后的模型 |
| [relabel_legacy.py](spec/relabel_legacy.py)、`derived/` | 按新规范派生旧数据标签，保留来源哈希，不修改历史原件 |
| [SHA256SUMS](spec/SHA256SUMS) | 规范文件的哈希清单 |

### dev/：可以看着开发，不能冒充独立测试

- `dev_set.jsonl`：180 条公开开发记录；`families.json`：家族信息。
- `make_dev_set.py`：带种子生成；`dev_report.py`、`dev_report.json`、[COVERAGE_REPORT.md](dev/COVERAGE_REPORT.md)：覆盖检查及报告。
- `stress/`：66 条开发侧压力用例、生成器与覆盖报告。
- `rule_control/`：规则对照在开发材料上的离线结果，先看 [REPORT.md](dev/rule_control/REPORT.md)。
- 各处 `SHA256SUMS` 用于检查保存内容，不代表数据本身没有偏差。

### annotation/ 与 acceptance/：标签怎么复核，测试怎么隔离

- [annotation/README.md](annotation/README.md) 与 `packets.py`：开发材料的盲标包、封存、放行和报告流程。
- `ANNOTATOR_INSTRUCTIONS.md`、`blind_packet.jsonl`、`blind_sample.json`、`mapping.json`：标注规则、输入、抽样和匿名映射；`sealed/` 与 `agreement_report.json`：封存和复核产物。
- 注意：`annotation/README.md` 的状态行已于 2026-11-15 更新为“步骤 2–6 已由 AI 会话执行（AI 标注、AI 复审）”；仍须同时核对封存、报告和 [EVIDENCE_INDEX.md](EVIDENCE_INDEX.md)，不能当作人工专家标签。
- [acceptance/README.md](acceptance/README.md)：独立验收数据的保管与流程说明。
- [FROZEN_MANIFEST.json](acceptance/FROZEN_MANIFEST.json)：最终测试数据哈希、数量、家族及局限；它是测前冻结承诺，测后不会为改状态而重写。
- `CANDIDATE_COMMITMENT.json`、`REVISION2_COMMITMENT.json`、`STRESS_CANDIDATE_COMMITMENT.json`：数据冻结前的候选与修订承诺，不是新的正式成绩。
- `*BLIND_SEAL.json`、`*ANNOTATION_REPORT.json`：测试与压力备注的封存和标注复核证据。AI 标注与复核，不是专家金标。
- 独立测试的逐条输入和回复保存在仓库外。不要在开发会话里寻找、复制或据此调参。

### baseline_v1/：保存“原来是什么”

- `original/`：原实现源码、配置与历史结果的归档副本。
- [MANIFEST.md](baseline_v1/MANIFEST.md)、[PROMPT_LOCATIONS.md](baseline_v1/PROMPT_LOCATIONS.md)：归档范围与多处提示词来源。
- `verify.sh`、`SHA256SUMS`：核对归档与原标签的内容。
- `measure/`：重测工具、假客户端与离线演练；先看 [README.md](baseline_v1/measure/README.md) 和 [SCOPE.md](baseline_v1/measure/SCOPE.md)。
- `measured/`：真实小测试和完整重测，先看 [INDEX.md](baseline_v1/measured/INDEX.md)。B、P 是原任务的两种提示词／输入路径，不能当新六类系统的提升前后。

### baseline_b/：新任务固定方案与开发测量

- [README.md](baseline_b/README.md)：运行方法、预算和范围。
- `prompt_b.py`：完整但未做开发结果驱动优化的 B-1.0 提示词及解析器；`evaluate.py`：评分器。
- `run_dev_eval.py`：开发评测入口；`fake_model.py`、`dryrun/`：假客户端与离线验证。
- `runs/`：真实小测试和开发评测，包含失败记录，先看 [INDEX.md](baseline_b/runs/INDEX.md)。
- `diagnose_500.py`、[DIAGNOSTIC_PLAN.md](baseline_b/DIAGNOSTIC_PLAN.md)、`diagnostics/`：HTTP 500 的诊断计划与结果；诊断不算模型成绩。

### formal/：真正的正式测量入口和公开结果

- [FORMAL_PLAN.md](formal/FORMAL_PLAN.md)：先约定的指标、门槛、计分、预算与两跑规则。
- [ACCEPTANCE_FORMAT.md](formal/ACCEPTANCE_FORMAT.md)：外部测试数据的输入格式。
- `run_formal.py`：正式测试、压力检查、离线规划及两跑比较入口。
- [CODE_FREEZE.json](formal/CODE_FREEZE.json)：决定结果的文件哈希，与标签 `eval-formal-v1` 绑定。
- `results/`：健康小测试、两次主测试和压力运行的公开摘要／报告、两跑比较 JSON。
- [VERIFICATION.json](formal/results/VERIFICATION.json)：独立重新核对后的汇总与口径说明；[SHA256SUMS](formal/results/SHA256SUMS)：公开产物完整性清单。

### reproduction_logs/：别人试着按文档走过的记录

保存两轮 Gemini 离线预演及相关原报告。它们是 AI 自述的第一级试跑，不是人类陌生人验收，也没有重测私有正式数据。原报告可能含旧路径或机器本地地址；作为历史记录保留，执行时按当前 [REPRODUCE.md](REPRODUCE.md)。

## 看运行目录时，文件名是什么意思？

不同版本不一定都有全部文件，先看对应目录的 README／INDEX。

| 常见文件 | 含义 |
|---|---|
| `config.json` | 该次运行的参数、身份声明、版本和预算等上下文 |
| `calls.jsonl`／其他逐条记录 | 一行一次调用或逻辑用例；是否包含未发请求用例，要看运行器口径 |
| `summary.json`／`public_summary.json` | 汇总指标；public 版本隐藏逐条私有输入 |
| `report.md` | 便于人读的单次运行报告，不等于本目录外的总报告 |
| `SHA256SUMS` | 文件内容指纹，用于核对完整性，不是效果验收结论 |
| `INDEX.md` | 多次运行的时间线、状态和用途，先看它避免挑最好成绩 |

目录名中的 `dry-run` 指假模型演练，`real` 指真实请求运行；`real` 也可能是失败的小测试或诊断，不能只看名字就算正式测量。`__pycache__/` 是 Python 本地缓存，不是项目证据。

## 修改与引用规则

下一轮计划：[备注理解：规则与模型对照](experiments/note_vs_rules_v2/PLAN.md)，[Claude 执行提示词](experiments/note_vs_rules_v2/process/HANDOFF_TO_CLAUDE.md)。当前只是计划，不影响第一轮冻结结果，不代表已授权付费调用。

- 学习和面试内容放 `interview/`；结果、局限与证据导航留在根目录。
- 冻结规范、数据承诺、运行器与原始运行目录保持原位，不为整理文件夹修改其内容或重新生成哈希。
- 讲解稿有冲突时，回到原始记录、规范和核对报告；修正讲解，不用讲解覆盖证据。
- 没有优化版，不写“从 X 提升到 Y”；没有硬件实测，不把设定参数写成真实响应能力。
- 不要把运行命令当作阅读任务执行。真实 API 调用需要明确预算授权，本导航不新增授权。

## 第二轮：备注理解的模型／规则对照

正式执行及交叉核对已完成，见 [第二轮结果](experiments/note_vs_rules_v2/RESULTS.md)。最终180条合成题与182次逐条调用现已整理入仓，见 [原件及免费复算](experiments/note_vs_rules_v2/evidence/README.md)；这与原300条仍缺原件的历史评测不同。尚未推送，数据现作为公开回归材料，不能用于未来未见测试。
