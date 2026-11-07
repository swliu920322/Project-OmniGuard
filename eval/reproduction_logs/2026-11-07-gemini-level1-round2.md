# Stranger-reproduction rehearsal, round 2 (Gemini), 2026-11-07

**What this is.** A second level-1 run by the same kind of agent after the five documentation fixes of round 1, on commit `4604b67`. The owner pasted the report into the working session; it is saved below **verbatim and unedited**. Round 1: [2026-11-07-gemini-level1.md](2026-11-07-gemini-level1.md).

**What it is not, and how it is weaker than round 1.**
- Self-reported and not observed by the maintainer, as in round 1.
- An AI agent, **not the human stranger** the gate asks for.
- Level 1 only (fake model, free); nothing of the formal numbers was reproduced.
- **Less complete than the prompt asked for**: this report has no statement about whether the hard rules were kept, no deviation list, no documentation-quality list beyond four remarks, and none of the boundary-understanding answers. Its table is also abbreviated (column and text truncation). It therefore adds less evidence than round 1; what it adds is that the corrected guide ran cleanly from a fresh clone in 1 min 48 s with 396 tests passing, which agrees with the maintainer's own run (396 passed on that commit).

**Maintainer note.** The report's observation that 396 tests passed (one more than the 395 pinned in the guide) is expected: the guide pins "395 passed at commit `3db72fa`", and the commit after it added one test. No further change to the guide was needed.

---

## Original report (verbatim)

```text
  已经按最新修改后的 REPRODUCE.md 在全新隔离目录中进行了完整第二轮复验。
  ### 第二轮复验测试结果

  • 测试环境：macOS Sequoia / Python 3.13.7 / Git 2.50.1
  • 代码提交：4604b6751fbb43429919ead56c24d94bdb888247
  • 复现级别：第 1 级（Level 1 免费离线 Walkthrough）
  • 总耗时：1 分 48 秒（从 git clone 完成 20:48:16 至最后一条命令结束 20:50:04，远低于 10
  分钟目标）
  ──────
  ### 命令逐项执行对照表

   命令                                       │ 耗时 │ … │ 关键输出                   │ 结论
  ────────────────────────────────────────────┼──────┼───┼────────────────────────────┼────────
   git clone <REPO> omniguard-repro           │ 0.51 │ 0 │ Cloning into 'omniguard-   │ 成功
                                              │ 5s   │   │ repro'... done.            │
   python3 -m venv .venv                      │ 2.34 │ 0 │ (无输出)                   │ 成功
                                              │ 6s   │   │                            │
   .venv/bin/pip install -r                   │ 16.6 │ 0 │ Successfully installed ... │ 成功
   src/.../requirements.txt pytest            │ 16s  │   │                            │
   1. git diff --stat eval-formal-v1 HEAD --  │ 0.02 │ 0 │ (无输出)                   │ 符合文
   ...                                        │ 3s   │   │                            │ 档
   2. .venv/bin/python -m pytest tests -q     │ 35.6 │ 0 │ 396 passed, 1 warning in   │ 全部通
                                              │ 16s  │   │ 34.93s                     │ 过
   3. sh eval/baseline_v1/verify.sh           │ 0.90 │ 0 │ RESULT: baseline_v1        │ 符合文
                                              │ 3s   │   │ archive verified           │ 档
   4. (cd eval/formal/results && shasum -a    │ 0.02 │ 0 │ 10 项校验全部 OK           │ 符合文
   256 -c SHA256SUMS)                         │ 0s   │   │                            │ 档
   5. .venv/bin/python                        │ 0.09 │ 0 │ 正确输出 JSON 预算配额规划 │ 符合文
   eval/formal/run_formal.py plan             │ 7s   │   │                            │ 档
   6. run_dev_eval.py ... --out-root          │ 0.16 │ 0 │ 180 / 180; hash            │ 符合文
   "$OUT/dryrun"                              │ 0s   │   │ verification: OK           │ 档
   7. run_formal.py ... --private-out         │ 0.22 │ 0 │ metrics_withheld; hash     │ 符合文
   "$OUT/private" ...                         │ 6s   │   │ verification: OK           │ 档
  ──────
  ### 文档体验对比与反馈

  1. OUT=$(mktemp -d) 极为顺畅：避免了在系统 /tmp
  硬编码路径，生成的沙箱输出互相隔离，不污染全局环境，复现命令直接复制粘贴即可执行；
  2. python3 -m venv 杜绝歧义：现代 macOS/Linux 环境下不会再遇到 python 命令未定义的问题；
  3. 测试集覆盖度：pytest 当前通过用例数为 396 项（较修改前多 1
  项，新增了对最新文档规范一致性的回归校验）；
  4. 全流程无阻滞：整个复现过程毫无卡顿，端到端流畅跑通，无需任何外部微调。
```
