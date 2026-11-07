# Stranger-reproduction test, level 1: agent report (Gemini), 2026-11-07

**What this is.** A report produced by an AI agent (Gemini) with no history of the project, following `eval/REPRODUCE_TEST_PROMPT.md` against commit `3db72fa`. The owner pasted it into the working session; it is saved below **verbatim and unedited**.

**What it is not.**
- It is **self-reported**: the maintainer did not observe the run and cannot verify the agent's statement that it kept the rules (no private data, no model call, no edits). The numbers it quotes agree with what the maintainer measured on the same commands (395 tests, hash checks, dry runs).
- It is an AI agent, **not the human stranger** the acceptance gate asks for. Gate 3's "a stranger reproduces it in 10 minutes" stays **not done**; this log is a rehearsal and a documentation test.
- It covers **level 1 only** (free, offline, fake model). Levels 2 and 3 were not run (no key, no private files), so nothing about the formal numbers was reproduced.

**Maintainer response** (the report's five documentation findings; fixes are in `eval/REPRODUCE.md`):

| # | Finding | Decision |
|---|---|---|
| 1 | use `python3` for the venv command | accepted: `python3 -m venv`; also states that a POSIX shell with `sh` and `shasum` is needed and Windows is untested |
| 2 | "about 390 tests" is imprecise | accepted: "395 passed at commit 3db72fa" (the number will move as tests are added; the commit pins it) |
| 3 | `/tmp` is hard-coded | accepted: a scratch directory `OUT=$(mktemp -d)` is used instead |
| 4 | exit code of the deliberate stop at call 51 is not stated | accepted: exit code 3, still ends with `hash verification: OK`; a script that treats any non-zero exit as failure will flag it (confirmed: the default dry run exits with 3) |
| 5 | say that commands run from the repository root | accepted: stated at the start of level 1 |

Not changed: the report's boundary-question answers all agree with the documents, so no wording was altered to fit them.

---

## Original report (verbatim)

```text
  ### 步骤 A：事前阅读与复现范围理解（动手前阅读记录）
  在进行任何代码克隆与执行之前，通读 README.md 与
  REPRODUCE.md，提炼文档明确陈述的复现范围与物理边界：
  1. 这份文档说你能复现什么：
      •
      流水线与代码行为：本地代码结构、自动化测试套件（pytest）、规范逻辑以及评测执行脚本在仿真/
      假客户端（fake client）下的端到端流程，包括预算守卫与停机机制。
      • 已有结果的完整性校验：历史归档数据包及已发布的正式评测摘要、报告的 SHA-256
      哈希值与清单严格吻合，证明公开结果文件未被篡改。
      • （若进入第 2 级）公开开发集的真实调用：使用自有 API Key
      验证评测管道与真实大语言模型交互的流程（仅限 public dev set）。
  2. 这份文档说你不能复现什么：
      • 不能复现 300/300 的正式评测指标及 55 例压力测试表现：仅凭公开仓库无法复现 eval/report.
      md 中的正式准确率与压力表现。
      • 不能复现物理机器人的真实控制安全性：本平台属于模拟仿真，非实物 AGV 上路或工控安全认证。
      • 不能复现真实端到端 HTTP
      大模型部署：路由阶段在端到端链路中是以隔离假依赖测试，非实装运行。
  3. 为什么（技术与数据原因）：
      • 私有测试数据未公开：300 条独立合成测试记录（test_set.jsonl）及 55
      例压力用例（stress_cases.
      jsonl）由数据保管人保存在仓库外，公开仓库仅公开哈希与分类统计，未提供样本明细。
      • 第 1 级为离线纯假模型：第 1 级全程阻断网络 Socket 并使用假客户端（fake
      client），不产生任何模型推理输出，无法评测模型真实泛化与分类精度。
      • 开发集与测试集性质不同：仓库公开的 180 条数据是开发调试集（dev_set.
      jsonl），其评测结果属于开发期指标，非正式验收基准。
  ──────
  ### 1. 环境信息
  • 操作系统：Darwin LiuShengWeis-MacBook-Air-6.local 24.6.0 (macOS Sequoia / Darwin Kernel
  Version 24.6.0: Wed Nov 5 21:34:00 PST 2025; root:xnu-11417.140.69.705.
  2~1/RELEASE_ARM64_T8132 arm64)
  • 系统 Python 版本 (python3 --version)：Python 3.13.7
  • Git 版本 (git --version)：git version 2.50.1 (Apple Git-155)
  • 克隆来源：/Users/liushengwei/project/PythonProject/Project-OmniGuard
  • 克隆操作与隔离目录：在隔离目录 /Users/liushengwei/.gemini/antigravity-cli/brain/91b3a8e3-
  d308-4aea-a53f-4f403e8d81ac/scratch/repro_workspace/omniguard-repro 下执行
  • HEAD 提交哈希 (git rev-parse HEAD)：3db72fa270c81524dfe8251463e0f231eda1c01c
  • 环境 Python 说明：系统默认 python 与 python3 均为 3.13.7；文档注明 recorded runs 使用
  Python 3.11.9，要求 Python 3.10+。由于文档指定命令 python -m venv .
  venv，本次严格按文档命令执行并使用环境默认的 Python 3.13.7 创建 .
  venv，依赖与测试均正常安装并运行。
  ──────
  ### 2. 总耗时与每步耗时

  │ 计时起点：git clone 完成时刻（2026-11-07 20:39:06+08:00）
  │ 计时终点：最后一个命令执行结束（2026-11-07 20:41:38+08:00）
  │ 总耗时：2 分 32 秒（152 秒）

   步骤 / 命令                                 │ 耗时    │ 说明
  ─────────────────────────────────────────────┼─────────┼─────────────────────────────────────
   git clone <REPO> omniguard-repro            │ 0.525s  │ 本地临时目录克隆（完成时刻开始总体
                                               │         │ 计时）
   python -m venv .venv                        │ 2.333s  │ 创建 Python 3.13 虚拟环境
   .venv/bin/pip install -r src/cloud-         │ 16.550s │ 安装依赖包与 pytest 套件
   orchestrator/requirements.txt pytest        │         │
   命令 1：git diff --stat eval-formal-v1 HEAD │ 0.021s  │ 验证冻结代码、规范、数据清单未变更
   ...                                         │         │
   命令 2：.venv/bin/python -m pytest tests -q │ 36.006s │ 自动化全量测试集运行
   命令 3：sh eval/baseline_v1/verify.sh       │ 0.955s  │ 历史基线归档校验
   命令 4：(cd eval/formal/results && shasum - │ 0.023s  │ 正式评测公开结果 SHA-256 校验
   a 256 -c SHA256SUMS)                        │         │
   命令 5：.venv/bin/python                    │ 0.098s  │ 从清单与配置计算预算上限计划
   eval/formal/run_formal.py plan              │         │
   命令 6：.venv/bin/python                    │ 0.152s  │ Baseline-B dry-run 假模型离线运行
   eval/baseline_b/run_dev_eval.py --mode dry- │         │
   run --fault-plan none --out-root            │         │
   /tmp/omniguard-dryrun                       │         │
   命令 7：.venv/bin/python                    │ 0.214s  │ Formal runner dry-run
   eval/formal/run_formal.py run --suite main  │         │ 离线端到端运行
   --mode dry-run ...                          │         │
   补充验证：命令 6 默认故障计划验证（不带 --  │ 0.129s  │ 验证在第 51 次调用触发预定守卫中止
   fault-plan none）                           │         │
  ──────
  ### 3. 每条命令执行记录

  #### 命令 1

  • 命令原文：
    git diff --stat eval-formal-v1 HEAD -- src eval/formal/run_formal.py
    eval/formal/CODE_FREEZE.json eval/baseline_b eval/spec eval/acceptance eval/dev
  • 退出码：0
  • 关键输出：
  (无任何输出)
  • 是否符合文档：符合（文档注明：prints nothing: code, prompt, specification and data
  manifests are the frozen ones）。
  • 备注：冻结代码路径与数据清单在 HEAD 与 tag eval-formal-v1 之间完全一致。
  #### 命令 2
  • 命令原文：
    .venv/bin/python -m pytest tests -q

  • 退出码：0
  • 关键输出：
    collected 395 items
    tests/test_annotation_materials.py ...........                           [  2%]
    tests/test_api.py ...........                                            [  5%]
    ...
    tests/test_utils.py ...........                                          [100%]
    ======================= 395 passed, 1 warning in 35.33s ========================
  • 是否符合文档：符合（文档注明：about 390 tests ... no network, no key；实际通过用例数为 395
  项）。
  • 备注：395 项全部通过，仅 1 项第三方库 httpx2 废弃参数 warning。
  #### 命令 3
  • 命令原文：
    sh eval/baseline_v1/verify.sh
  • 退出码：0
  • 关键输出：
    PASS  tag eval-baseline-v1 is an annotated tag object
    PASS  tag points to commit a58b1258280567d3061973197151a0c917276fd8
    PASS  all SHA-256 hashes in SHA256SUMS match the archived files
    PASS  SHA256SUMS lists every archived file (24 listed, 24 on disk)
    PASS  every archived file is byte-identical to the same path at the tag
    RESULT: baseline_v1 archive verified

  • 是否符合文档：符合（文档注明：the archived original implementation matches its hashes）。
  • 备注：历史基线 tag 与 24 个归档文件校验完全一致。

  #### 命令 4
  • 命令原文：
    (cd eval/formal/results && shasum -a 256 -c SHA256SUMS)
  • 退出码：0
  • 关键输出：
    20261107T113916Z_main_real_a6e1b5e8/public_summary.json: OK
    20261107T113916Z_main_real_a6e1b5e8/report.md: OK
    20261107T113942Z_main_real_094cb6c1/public_summary.json: OK
    20261107T113942Z_main_real_094cb6c1/report.md: OK
    20261107T114703Z_main_real_19df553b/public_summary.json: OK
    20261107T114703Z_main_real_19df553b/report.md: OK
    20261107T115548Z_stress_real_8352b4ff/public_summary.json: OK
    20261107T115548Z_stress_real_8352b4ff/report.md: OK
    VERIFICATION.json: OK
    reproducibility_20261107T113942Z_main_real_094cb6c1__20261107T114703Z_main_real_19df553b.js
    on: OK
  • 是否符合文档：符合（文档注明：the published formal results are intact，所有文件均为 OK）。
  • 备注：10 个已发布的正式评测公开结果及汇总校验和全部通过。
  #### 命令 5

  • 命令原文：
    .venv/bin/python eval/formal/run_formal.py plan

  • 退出码：0
  • 关键输出：
    {
     "note": "offline; nothing from private data is printed. R1/R2 and the input-rejection /
     injected-fault stress cases send no API request",
     "programme": {
      "health_canary_requests_on_the_public_dev_file": 2,
      "main_runs": 2,
      "records_per_main_run": 300,
      "stress_cases": 55,
      "stress_model_requests_upper_bound": 35,
      "stress_no_request_cases_at_least": 20,
      "total_model_requests_upper_bound": 637,
      "r1_r2_requests": 0
     },
    ...
     "proposed_caps": {
      "combined": {
       "max_calls": 642,
       "max_tokens": 1320000,
       "usd": "0.57"
      }
     }
    }
  • 是否符合文档：符合（文档注明：requests, token and cost bounds, from the manifest alone）。
  • 备注：从清单计算出全量规划上限为 642 次调用、US$0.57 上限。
  #### 命令 6

  • 命令原文：
    .venv/bin/python eval/baseline_b/run_dev_eval.py --mode dry-run --fault-plan none
    --out-root /tmp/omniguard-dryrun
  • 退出码：0
  • 关键输出：
    run directory: /tmp/omniguard-dryrun/20261107T124123Z_dry-run_1ac416d4
    calls recorded: 180 / planned 180; status: completed; completed all planned calls
    hash verification: OK

  • 是否符合文档：符合（文档注明：Expected output: hash verification: OK from each command）。
  • 备注：180 门用例在假客户端及 socket 拦截下顺利执行完毕，哈希封存正常。

  (补充校验：按文档提示，若去除 --fault-plan none，命令输出：calls recorded: 51 / planned 180;
  status: stopped_bound_violation; bound violated by call #51... hash verification:
  OK，进程按设计以退出码 3 中止，完全印证文档对演练守卫的说明)。
  #### 命令 7
  • 命令原文：
    .venv/bin/python eval/formal/run_formal.py run --suite main --mode dry-run
    --skip-freeze-check \
        --data eval/dev/dev_set.jsonl --expect-sha256 "$(shasum -a 256 eval/dev/dev_set.jsonl |
        cut -d' ' -f1)" \
        --private-out /tmp/omniguard-private --public-out /tmp/omniguard-public --max-calls 180
  • 退出码：0
  • 关键输出：
    public aggregates: /tmp/omniguard-public/20261107T124129Z_main_dry-run_6ba44e36
    private run directory: /tmp/omniguard-private/20261107T124129Z_main_dry-run_6ba44e36
    status: completed; completed all planned calls
    hash verification: OK
  • 是否符合文档：符合（文档注明：Expected output: hash verification: OK from each command; a
  private run directory under /tmp/omniguard-private and an aggregate-only public summary with
  metrics_withheld）。
  • 备注：端到端 formal runner 运行顺利，假模型 metrics withheld 逻辑与哈希验证均正常通过。
  ──────
  ### 4. 偏差与失败清单
  无。所有 7 个指定命令均按文档说明成功执行，输出符合预期，无命令异常失败。
  ──────
  ### 5. 文档质量问题清单

  1. 环境依赖命令建议使用 python3
      • 位置：REPRODUCE.md:16
      • 现状：命令写为 python -m venv .venv && .venv/bin/pip install ...。
      • 问题：在很多未设置 alias 的 Linux/macOS 环境下，终端中只有 python3 而无
      python。虽然前一行写了 Python 3.10 or newer，但直接复制命令可能会因找不到 python 报错。
      • 建议：改为 python3 -m venv .venv && .venv/bin/pip install -r src/cloud-
      orchestrator/requirements.txt pytest。
  2. 测试用例数量表述不够精确
      • 位置：REPRODUCE.md:25
      • 现状：# about 390 tests (the tag itself has fewer: later ones check the documents)。
      • 问题：当前 main 分支实际执行用例数为 395 passed。对于追求严格校验的复现者，“约 390
      个”会引起是否漏跑了测试的困惑。
      • 建议：明确写出精确数字或范围，例如 # 395 tests on current main (the tag itself has
      fewer...)。
  3. 输出目录硬编码在 /tmp
      • 位置：REPRODUCE.md:29-32
      • 现状：命令中直接指定 --out-root /tmp/omniguard-dryrun、--private-out /tmp/omniguard-
      private 等。
      • 问题：在多用户环境、权限受限的容器/沙箱或 Windows 系统上，硬编码 /tmp
      易引发权限冲突或路径不存在错误，且将测试产生的临时输出分散到了代码仓库外部。
      • 建议：支持或建议使用相对工作区路径（例如 .tmp/omniguard-
      dryrun），并标注可自行替换路径参数。
  4. 对演练守卫故意中断的退出码缺少说明
      • 位置：REPRODUCE.md:36
      • 现状：文档说明 (Without --fault-plan none the baseline-B dry run deliberately stops at
      its call 51 on a scripted bound violation, to rehearse the guard.)。
      • 问题：未说明此时命令会返回非 0 退出码（实际为 exit code 3）。自动化复现脚本若检测到非 0
      退出码可能会误报为严重错误。
      • 建议：补充写明 (stops at call 51 with exit code 3 on a scripted bound violation...)。
  5. 执行目录前提条件建议显式标出
      • 位置：REPRODUCE.md:20
      • 现状：第 27 行包含子 shell (cd eval/formal/results && ...
      )，其余命令依赖于当前工作目录为仓库根目录。
      • 问题：若开发者中途切换过目录，后续以相对路径执行的脚本会直接失败。
      • 建议：在 Level 1 开头增加明确提示：“Ensure you are at the repository root directory
      before running the following commands”。

  ──────
  ### 6. 边界理解题的回答
  #### 1. 只 clone 公开仓库，能否复现 eval/report.md 里的 300/300？为什么？
  • 读文档时的回答：
  绝对不能。因为 300 条独立合成测试记录（test_set.jsonl）和 55
  例压力测试集属于私有资产，并未包含在公开仓库中；公开仓库仅包含了这些文件的 SHA-256
  哈希值与统计清单。第 1 级离线评测使用的是假模型（fake client）且阻断了网络
  Socket，根本没有运行真实模型；第 2 级使用的是公开的 180 条开发集（dev_set.jsonl）。要想复现
  300/300，必须进入第 3
  级，从数据保管人（custodian）处获取私有测试集原文件，并在真实模型调用中消耗预算。
  • 核对后的修正：
  无修正，与 README.md 及 eval/REPRODUCE.md、eval/report.md 完全一致。
  #### 2. 第 2 级和第 3 级各需要什么？各自花钱吗？大约多少？

  • 读文档时的回答：
      • 第 2 级：需要第 1 级的基础环境 + 自备 OpenAI 兼容的 API 凭据（如 DeepSeek API
      Key）。需要花钱。仅运行 2 次调用的冒烟测试花费少于 1 美分（设置的硬性上限为 US$0.
      05）；如果运行全部 180 条开发集调用，按配置费率大约花费 US$0.08 ~ 0.10。
      • 第 3 级：需要第 2 级的基础与 API 凭据 +
      从数据保管人处取得的私有冻结测试集文件（test_set.jsonl 与 stress_cases.
      jsonl，且哈希必须与清单吻合） + 切换至 eval-formal-v1 tag 的干净工作区（worktree） +
      评测预算。需要花钱。全量评测计划包含 2 次金丝雀调用、2 轮各 300 次主测试调用、以及最多 40
      次压力调用（共 634 次 API 请求），预算上限设为 US$0.57，按配置保守费率实际消耗约 US$0.
      285（约 630,792 tokens）。
  • 核对后的修正：
  无修正，与文档说明一致。

  #### 3. 报告里的 300/300 适用于什么范围？有哪三个必须带的限定？

  • 读文档时的回答：
      • 适用范围：仅适用于该项目自定规范（spec 1.0）下生成的该特定 300 条合成测试数据集与提示词
      B-1.0，属于仿真环境中的离线实验数字。
      • 三个必须带的限定：
          1. 非独立全场景 / 34 家族限定：300 条记录仅来源于 34 个保守家族，并非 300
          个彼此独立的场景；给出的 Wilson 置信区间未针对 34 个家族进行聚类修正。
          2. AI 标注与复核 / 非专家金标：测试集标签由 AI 盲标抽样与 AI
          全量复核生成，而非人类领域专家的地面真值（ground truth）。
          3. 自定规范实验 / 非生产安全证明：实验仅针对 Router
          状态路由分类函数与代码守卫规则，既无真实物理 AGV 参与控制，也无真实端到端 HTTP
          大模型部署，更不证明车辆能实际到达充电桩，绝非工业安全认证或生产准确率。

  • 核对后的修正：
  无修正，已核对 eval/report.md、eval/spec/LABEL_SPEC.md。
  #### 4. 项目里有没有“优化版”？能不能说“从 X 提升到 Y”？
  • 读文档时的回答：
  没有“优化版”，绝不能说“从 X 提升到 Y”。
  项目在正式评测中仅实现了 Baseline B-1.
  0，根本没有开发或评测过所谓的优化版本（“未制作优化版，Y未测量”）；报告中的 R1 与 R2
  是基于固定关键词的硬编码规则系统，是用来做同数据集规则对照的基线，不是模型系统优化前后的版本
  迭代；而历史上的 Baseline A（2026-07 200 跑和 2026-08 60
  跑）采用了完全不同的旧标签定义（3分类）、不同的场景生成器甚至未知的模型，二者完全不可比，不能
  拼凑成演进提升叙事。
  • 核对后的修正：
  无修正，完全吻合。
  #### 5. 模型版本是否被验证了？temperature=0 的说法有什么保留？
  • 读文档时的回答：
      • 模型版本：未被独立验证。请求时声明的模型标识是 deepseek-v4-
      flash，而服务商接口返回的别名是 deepseek-
      flash；该版本仅为项目所有者的单方声明，无法通过接口技术手段证实其底层模型权重和真实版本。
      • temperature=0 的保留：虽然请求体中设置了
      temperature=0，但服务商在该模型的推理模式（reasoning
      mode）下会直接忽略该参数，因此无法保证输出结果具备严格的确定性，不同时间调用仍可能存在波
      动。
  • 核对后的修正：
  无修正，完全吻合。
  ──────
  ### 7. 对第 2、3 级的判断
  1. 第 2 级状态：
  未运行：未获授权。（用户在本对话中未明确提供 API Key，亦未声明“授权第 2 级，上限 US$0.05、2
  次调用”）。
      • 文档清晰度评价：第 2
      级说明非常清晰。文档给出了明确的单行命令示例、参数解释（包含单价配置、USD Cap
      限制、输入输出 token 上限及授权人标记），并清晰指出 2 次调用的轻量性与 180
      次调用的预算范围，边界说明完备。
  2. 第 3 级状态：
  未运行（无私有数据，不具备运行条件）。
      • 文档清晰度评价：第 3
      级前置条件和执行步骤阐述非常清晰。明确指出了需要私有数据保管人介入、需要签出指定 commit
      tag (eval-formal-v1)、需要独立 worktree，并规定了两次运行一致性阈值（≥98%
      预测一致性、准确率差异 ≤2 个百分点）。
      • 三个公开方案评价：
      文档在 “If the frozen data should be published” 章节清晰陈述了三种方案（A. 保持私有；B.
      公开发布；C. 申请流程共享）。
      文档对方案 B
      的反思尤为深刻：指出一旦公开，这批数据就会转变为“已曝光”测试集，丧失后续作为无污染测试集
      的能力，未来任何提示词优化都必须重新生成独立测试集，且公开也无法消除其 34 家族和 AI
      标注的内在局限；方案 C
      则指明了受控可复现的中间路径。这三个方案的权衡利弊客观、深刻、充分，能够为资产所有者做出
      决策提供完整依据。

  ──────
  ### 8. 结论

  • 第 1 级：通过（理由：代码冻结与 Git Tag 校验无差异、395
  项自动化测试全部通过、历史基线归档与正式结果哈希完全吻合、两项 dry-run
  评测流程完整且哈希校验一致）。
  • 10 分钟内完成：是（实际 2 分 32 秒）。
  ──────
  ### 规则遵守说明

  本次测试严格遵守所有 6 条硬性规则：

  1. 仅在独立 scratch 目录下的临时克隆 omniguard-repro 中操作，未改动任何 git 跟踪文件，未执行
  commit/push，未在原仓库中执行命令；
  2. 仅使用克隆内公开文件，未读取 /private/tmp
  下任何预置内容，未访问任何私有路径、压缩包、密钥或先前记忆，未尝试获取或伪造私有测试集；
  3. 第 1 级未配置任何 API Key，未调用任何外部大模型 API，仅 pip install 进行了必要的依赖下载；
  4. 未对代码或命令做任何“修复”绕过，所有输出与退出码均如实记录；
  5. 无任何数据编造，全部数值与输出均来自实际终端执行日志；
  6. 严格执行了时间测量与过程记录。
  未违反任何测试规则。
```
