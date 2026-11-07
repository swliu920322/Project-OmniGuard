# OmniGuard 第 1 级（免费离线）独立复现记录

- **测试日期**：2026-11-07 20:39:06 ~ 20:41:38 (UTC+8)
- **测试身份**：初次查看 OmniGuard 项目的外部第三方开发者（无预设背景、无私有文件）
- **基准提交**：`3db72fa270c81524dfe8251463e0f231eda1c01c`
- **复现规范文档**：[eval/REPRODUCE.md](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/eval/REPRODUCE.md)
- **复现级别**：第 1 级（Level 1：离线免费 Walkthrough）

---

## 1. 环境信息

| 项目 | 参数 / 版本 |
|---|---|
| **操作系统** | macOS Sequoia (Darwin LiuShengWeis-MacBook-Air-6.local 24.6.0 arm64) |
| **系统 Python** | Python 3.13.7 (系统默认 `python3` 及 `python`) |
| **Git 版本** | git version 2.50.1 (Apple Git-155) |
| **测试隔离目录** | `scratch/repro_workspace/omniguard-repro`（独立克隆，不污染原工作区） |
| **代码克隆源与提交号** | `<REPO>` @ `3db72fa270c81524dfe8251463e0f231eda1c01c` |
| **Python 版本选用说明** | 文档注明记录运行基于 3.11.9，需求 3.10+。本次测试直接依文档默认 `python -m venv` 命令，在系统 3.13.7 环境下建虚拟环境并完成安装与测试。 |

---

## 2. 耗时统计

> **计时起点**：`git clone` 完成瞬间 (20:39:06)  
> **计时终点**：全部命令运行完成瞬间 (20:41:38)  
> **总耗时**：**2 分 32 秒** (152 秒)  
> **10 分钟目标**：**达成** (远低于 10 分钟上限)

| 步骤 / 命令 | 耗时 | 退出码 | 状态 | 说明 |
|---|---|:---:|:---:|---|
| `git clone <REPO> omniguard-repro` | 0.525s | 0 | 完成 | 本地目录克隆，进入独立隔离区 |
| `python -m venv .venv` | 2.333s | 0 | 完成 | 创建独立隔离虚拟环境 |
| `.venv/bin/pip install -r src/.../requirements.txt pytest` | 16.550s | 0 | 完成 | 安装依赖与 pytest 测试框架 |
| 命令 1：`git diff --stat eval-formal-v1 HEAD -- ...` | 0.021s | 0 | 通过 | 冻结代码、提示词、规范与清单完全一致 |
| 命令 2：`.venv/bin/python -m pytest tests -q` | 36.006s | 0 | 通过 | 395 项自动化测试全部通过 (0 failed, 1 warning) |
| 命令 3：`sh eval/baseline_v1/verify.sh` | 0.955s | 0 | 通过 | 历史基线归档 24 个文件 SHA-256 全量匹配 |
| 命令 4：`(cd eval/formal/results && shasum -a 256 -c SHA256SUMS)` | 0.023s | 0 | 通过 | 正式评测已发布公开文件 10 项校验和全部 OK |
| 命令 5：`.venv/bin/python eval/formal/run_formal.py plan` | 0.098s | 0 | 通过 | 预算与配额静态解析正常 (上限 642 次 / US$0.57) |
| 命令 6：`run_dev_eval.py --mode dry-run --fault-plan none ...` | 0.152s | 0 | 通过 | Baseline-B 离线假模型演练完成，哈希校验 OK |
| 命令 7：`run_formal.py run --suite main --mode dry-run ...` | 0.214s | 0 | 通过 | 正式流水线离线演练完成，哈希校验 OK |
| *(补充)* 命令 6 默认故障注入演练（去除 `--fault-plan none`） | 0.129s | 3 | 预期触发 | 第 51 次调用按预期触发违规拦截，退出码 3，封存正常 |

---

## 3. 每条命令详细输出对照

### 命令 1：冻结代码差异核查
- **命令**：`git diff --stat eval-formal-v1 HEAD -- src eval/formal/run_formal.py eval/formal/CODE_FREEZE.json eval/baseline_b eval/spec eval/acceptance eval/dev`
- **退出码**：`0`
- **关键输出**：无输出（空输出）。
- **判定**：符合文档描述（`prints nothing`）。

### 命令 2：单元与契约自动化测试
- **命令**：`.venv/bin/python -m pytest tests -q`
- **退出码**：`0`
- **关键输出**：
  ```text
  collected 395 items
  tests/test_annotation_materials.py ...........                           [  2%]
  tests/test_api.py ...........                                            [  5%]
  ...
  ======================= 395 passed, 1 warning in 35.33s ========================
  ```
- **判定**：符合文档描述（文档描述 `about 390 tests`，实际执行 `395 passed`）。

### 命令 3：历史基线归档完整性校验
- **命令**：`sh eval/baseline_v1/verify.sh`
- **退出码**：`0`
- **关键输出**：
  ```text
  PASS  tag eval-baseline-v1 is an annotated tag object
  PASS  tag points to commit a58b1258280567d3061973197151a0c917276fd8
  PASS  all SHA-256 hashes in SHA256SUMS match the archived files
  PASS  SHA256SUMS lists every archived file (24 listed, 24 on disk)
  PASS  every archived file is byte-identical to the same path at the tag
  RESULT: baseline_v1 archive verified
  ```
- **判定**：符合文档描述。

### 命令 4：已发布正式评测结果哈希校验
- **命令**：`(cd eval/formal/results && shasum -a 256 -c SHA256SUMS)`
- **退出码**：`0`
- **关键输出**：
  ```text
  20261107T113916Z_main_real_a6e1b5e8/public_summary.json: OK
  20261107T113916Z_main_real_a6e1b5e8/report.md: OK
  20261107T113942Z_main_real_094cb6c1/public_summary.json: OK
  20261107T113942Z_main_real_094cb6c1/report.md: OK
  20261107T114703Z_main_real_19df553b/public_summary.json: OK
  20261107T114703Z_main_real_19df553b/report.md: OK
  20261107T115548Z_stress_real_8352b4ff/public_summary.json: OK
  20261107T115548Z_stress_real_8352b4ff/report.md: OK
  VERIFICATION.json: OK
  reproducibility_20261107T113942Z_main_real_094cb6c1__20261107T114703Z_main_real_19df553b.json: OK
  ```
- **判定**：符合文档描述（全部 10 项均为 `OK`）。

### 命令 5：正式评测配额与预算计划
- **命令**：`.venv/bin/python eval/formal/run_formal.py plan`
- **退出码**：`0`
- **关键输出**：正确输出 JSON，总调用上限计划 642 次，总预算硬顶 US$0.57，dev run 预估 US$0.29~0.35。
- **判定**：符合文档描述。

### 命令 6：Baseline-B 假模型端到端 Dry-Run
- **命令**：`.venv/bin/python eval/baseline_b/run_dev_eval.py --mode dry-run --fault-plan none --out-root /tmp/omniguard-dryrun`
- **退出码**：`0`
- **关键输出**：
  ```text
  run directory: /tmp/omniguard-dryrun/20261107T124123Z_dry-run_1ac416d4
  calls recorded: 180 / planned 180; status: completed; completed all planned calls
  hash verification: OK
  ```
- **判定**：符合文档描述（`hash verification: OK`）。

### 命令 7：Formal Runner 在公开 Dev 集上的 Dry-Run
- **命令**：
  ```bash
  .venv/bin/python eval/formal/run_formal.py run --suite main --mode dry-run --skip-freeze-check \
      --data eval/dev/dev_set.jsonl --expect-sha256 "$(shasum -a 256 eval/dev/dev_set.jsonl | cut -d' ' -f1)" \
      --private-out /tmp/omniguard-private --public-out /tmp/omniguard-public --max-calls 180
  ```
- **退出码**：`0`
- **关键输出**：
  ```text
  public aggregates: /tmp/omniguard-public/20261107T124129Z_main_dry-run_6ba44e36
  private run directory: /tmp/omniguard-private/20261107T124129Z_main_dry-run_6ba44e36
  status: completed; completed all planned calls
  hash verification: OK
  ```
- **判定**：符合文档描述（聚合摘要保留、指标扣留 `metrics_withheld`、哈希校验一致）。

---

## 4. 偏差与失败清单

**无**。所有文档要求的命令均执行成功，退出码及关键输出完全符合文档说明。

---

## 5. 文档质量检查与改进反馈

在复现过程中指出的 5 项改进点已在后续文档修订中体现：
1. **虚拟环境创建推荐使用 `python3`**（避免系统无 `python` 别名导致失败）。
2. **用例数量更新**（注明 commit `3db72fa` 实际为 395 项测试通过）。
3. **输出路径参数化**（推荐使用 `OUT=$(mktemp -d)`，避免直接污染全局 `/tmp`）。
4. **守卫中止退出码说明**（补充说明不带 `--fault-plan none` 时在第 51 次调用触发并以 exit code 3 结束）。
5. **明确指定仓库根目录执行前提**（声明相对路径生效的工作目录）。

---

## 6. 边界理解题答题记录

1. **仅 Clone 公开仓库能否复现 300/300？为什么？**
   - **结论**：**不能**。
   - **原因**：300 条独立合成测试记录（`test_set.jsonl`）及 55 例压力测试集由保管人（custodian）保管在私有包中，公开仓库仅公开 SHA-256 哈希值与统计特征，未公开明细样本。第 1 级为离线假模型，第 2 级仅支持公开开发集（180 条）。若无私有测试集，无法产生正式评测预测。

2. **第 2 级与第 3 级各需要什么？各自花钱吗？大约多少？**
   - **第 2 级**：需要自备 OpenAI 兼容 API Key。花钱，2 次冒烟测试小于 US$0.01（硬顶 US$0.05）；全量 180 条开发集调用约花费 US$0.08 ~ 0.10。
   - **第 3 级**：需要自备 API Key + 数据保管人持有的私有测试文件（`test_set.jsonl` 与 `stress_cases.jsonl`，哈希匹配） + 切换至 `eval-formal-v1` tag 的干净 worktree + 项目预算。花钱，全量 634 次调用上限预算 US$0.57，按配置保守费率实际消耗约 US$0.285（630,792 tokens）。

3. **报告中 300/300 的适用范围与三个必要限定**：
   - **范围**：仅适用于该项目自定规范（spec 1.0）下的该特定合成测试集与提示词 B-1.0，是仿真环境下的状态分类实验数字。
   - **三大限定**：
     1. **34 家族限定**：300 条记录属于 34 个保守家族，非 300 个独立场景，Wilson 置信区间未作家族聚类校正。
     2. **AI 标注与复核**：标签基于 AI 盲标与全量复核生成，非领域专家金标。
     3. **仿真规范实验**：无物理实机上路、无真实端到端 HTTP 大模型部署、不保证实机到达充电桩，非工业安全认证。

4. **是否有“优化版”？能否宣称“从 X 提升到 Y”？**
   - **结论**：**没有“优化版”，绝不能说“从 X 提升到 Y”**。
   - **原因**：本项目仅实施了 Baseline B-1.0，未制作任何调整后的优化版本，不存在 Y；对照组 R1/R2 是硬编码关键词规则对照，非模型迭代；历史基线 A 为旧标签体系及不同模型，不可比。

5. **模型版本是否被验证？`temperature=0` 的保留？**
   - **模型版本**：未经验证。请求名 `deepseek-v4-flash` 返回别名 `deepseek-flash`，版本属于所有者单方声明，无法通过接口技术保证底层真实权重版本。
   - **`temperature=0` 保留**：提供方在推理模式下忽略 `temperature=0` 参数，因此输出不能视为严格确定性。

---

## 7. 第 2、3 级评述

- **第 2 级执行状态**：**未运行：未获授权**（测试过程中未提供 API Key 且未授权）。
- **第 3 级公开方案评价**：
  文档对未公开冻结数据的三种处理路径（A. 保持私有、B. 公开发布、C. 申请流程共享）分析透彻。尤其是明确指出“一旦公开该测试集即遭曝光，丧失作为未污染独立测试集的效力”，利弊权衡充分，完全满足决策需要。

---

## 8. 结论

- **第 1 级**：**通过**（代码冻结比对无差异、395 项自动化测试全过、历史基线归档与正式结果哈希吻合、两项 dry-run 完整输出 `hash verification: OK`）。
- **10 分钟内完成**：**是**（实际耗时 **2 分 32 秒**）。
