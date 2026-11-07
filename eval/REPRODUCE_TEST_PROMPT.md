# Prompt for a stranger-reproduction test (give this to an AI agent with no history of the project)

Purpose: find out whether someone who only has the public repository can follow `eval/REPRODUCE.md`. The agent plays the stranger. It must **report**, not repair. Fill in `<REPO>` (a git URL or a local path of the repository) and, only if you want level 2, the budget line at the end. Keep the result as `eval/reproduction_logs/<date>-<agent>.md` (a result is evidence only if it is saved together with the exact commands and outputs).

---

## Prompt (copy from here)

你是第一次看到 OmniGuard 这个项目的外部开发者。你只有仓库 `<REPO>`，没有任何背景，也没有任何私有文件。任务：只依据仓库里公开的文件，按 `eval/REPRODUCE.md` 做**第 1 级（免费离线）**复现，如实记录能否在 10 分钟内完成、哪里卡住、哪里与文档不符。你不是来修仓库的，是来测它的。

### 硬性规则（违反任何一条，本次测试作废）
1. 在新的临时目录里 `git clone <REPO> omniguard-repro`，只在这个克隆里操作。不要改动任何被 git 跟踪的文件，不要提交，不要 push，不要在原仓库目录里运行命令。
2. 只使用克隆里的文件。不得访问或读取：`/private/tmp` 下的任何内容、`~/Documents/OmniGuard-private`、任何 `.tgz` 或私有数据包、环境里的其它密钥、你对这个项目的任何先前记忆。不要尝试获取 `test_set.jsonl` 或 `stress_cases.jsonl`，也不要自己编造类似的“私有测试集”。
3. 第 1 级不需要任何 API key，也不会向任何模型服务发请求。**不得调用任何模型 API。** 只有 `pip install` 允许联网。
4. 不要“修”问题。遇到命令失败、输出与文档不符、文档含糊，就原样记录（命令、完整关键输出、你的判断），可以给改进建议，但不要自己改文件、换命令绕过，除非文档本身给出了备选。
5. 不要编造。没运行的命令写“未运行”；不要把文档里的“Expected output”当成你的输出；不要凭经验推测结果。
6. 计时：从 `git clone` 完成的那一刻开始，到最后一个命令结束，给出总耗时和每一步耗时。目标是 10 分钟内。

### 步骤
A. **先读**：`README.md` 和 `eval/REPRODUCE.md`。用你自己的话写出：这份文档说你能复现什么、不能复现什么、为什么（逐条，不要抄原文）。这一步先写下来，再动手。
B. **环境**：记录 `python3 --version`、操作系统。按文档建虚拟环境并安装依赖。如果文档要求的 Python 版本与你机器上的不符，记录并说明你用了什么。
C. **执行第 1 级的每条命令**，逐条对照文档里写的 expected output，记录：命令原文、退出码、关键输出（前后各几行）、是否符合文档、耗时。注意：第一条 `git diff --stat ...` 应当没有输出；`pytest` 应当全部通过（数量以实际为准，写出实际数字）；`shasum -c` 应当全部 OK；两个 dry-run 命令应当以 `hash verification: OK` 结束（第二个 baseline-B dry-run 若不带 `--fault-plan none` 会按文档说明在第 51 次调用处故意停止）。
D. **文档质量检查**：列出你认为缺失、含糊、顺序不对、与实际不符、对新手不友好之处；每条写清位置（文件和章节）和你希望它怎么写。
E. **边界理解题**（在你读完文档、不看 `eval/report.md` 之外的任何文件的前提下回答，答完再核对）：
   1. 只 clone 公开仓库，能否复现 `eval/report.md` 里的 300/300？为什么？
   2. 第 2 级和第 3 级各需要什么？各自花钱吗？大约多少？
   3. 报告里的 300/300 适用于什么范围？有哪三个必须带的限定？
   4. 项目里有没有“优化版”？能不能说“从 X 提升到 Y”？
   5. 模型版本是否被验证了？`temperature=0` 的说法有什么保留？
F. **第 2 级（仅当用户在本对话里明确提供了 key，并写明“授权第 2 级，上限 US$0.05、2 次调用”时才做）**：否则写“未运行：未获授权”。授权时也只允许 `--limit 2` 那条命令，并在 `eval/baseline_b/runs/` 之外不要写任何东西。**第 3 级不做**：你没有私有文件，只需要评价文档对此的说明是否清楚，以及它给出的三个公开方案的描述是否让你能做决定。

### 输出格式（Markdown，只写这些小节）
1. 环境信息（系统、Python、git 版本、克隆来源和提交号 `git rev-parse HEAD`）
2. 总耗时与每步耗时（表格）
3. 每条命令：命令 / 退出码 / 关键输出 / 是否符合文档 / 备注
4. 偏差与失败清单（逐条：现象、命令、原始输出片段、可能原因、建议）；没有就写“无”
5. 文档质量问题清单
6. 边界理解题的回答（先写你读文档时的回答，再写核对后的修正，如有）
7. 对第 2、3 级的判断（只基于文档，不要运行第 3 级）
8. **结论**：只能写其中一个——“第 1 级：通过 / 部分通过 / 未通过”，后接一句理由；再写“10 分钟内完成：是 / 否（实际 X 分 Y 秒）”。不要写“已验收”或“项目通过复现”，这不是你能判定的；也不要把第 1 级的通过说成正式数字已复现。

### 你完成后
把完整报告原样给用户，并说明你有没有违反上面的任何规则。如果你违反了某条规则，直接承认并标出受影响的结果。

---
