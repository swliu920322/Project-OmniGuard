# 文档盘点与整理记录（2026-11-21）

**状态：已执行。** 你选了 A（分出去但仍在仓库）并要新人导读。做了：`eval/interview/` 拆成 `docs/guide/`（新人导读 4 份）和 `study/interview/`（备考 5 份），`docs/refer/` 并入 `study/refer/`；过程记录（三份设计、事实核对、第二轮交接日志和说明）归档到 `eval/archive/` 和 `eval/experiments/note_vs_rules_v2/process/`；`eval/README.md` 重写成"先问你想知道什么"的地图；新增 `tests/test_docs_map.py`，让没有被链接的新文档变红。没有被哈希钉住的文件被移动，全部 182 份文档的相对链接检查 0 个断链，552 个测试通过。`eval/web/` 留本地（`.gitignore`）。下面是执行前的盘点，保留作记录。

---

# 盘点（执行前）

## 数字

138 份 md/html（不含归档、运行记录、前端、原始会话、复现日志）。18 份被哈希清单或冻结文件钉住；55 份被测试引用；35 份没有任何文件链接到它们，其中 33 份是 `docs/adrs`（项目早期的架构决策，自成一个文件夹，不算乱）。真正的孤儿只有 `eval/archive/FACT_CHECK_2026-11-16.md` 和 `study/refer/get-notes.md`。

## 三类读者，三类文档

| 读者 | 要什么 | 应该只看到什么 |
|---|---|---|
| **面试官／评审** | 结果是什么，凭什么信，什么没声称，怎么自己验证，谁做的 | 6 份：`eval/README.md`、`report.md`、`EVIDENCE_INDEX.md`、`LIMITATIONS.md`、`REPRODUCE.md`、`ANNOTATOR_PROVENANCE.md` |
| **新人** | 先看懂一辆小车的一次决定，再看代码怎么走 | `docs/guide/START_HERE_zh.md`、`BACKEND_CODE_GUIDE_zh.md`（再加两份概念文档），现在藏在"面试"文件夹里，找不到 |
| **你自己** | 准备面试、学习路线 | `INTERVIEW_DEEP_DRILL_zh.md`、`RECOMMEND_LEARNING_zh.md`、`CAREER_ROADMAP_zh.md`、`INTERVIEW_STORY_zh.md`、`eval/web/`、`docs/refer/`、`answer.md` |

## 逐类处理建议

| 类别 | 文件 | 建议 | 钉住／测试 |
|---|---|---|---|
| **A 入口与证据说明（保留，面试官读）** | `README.md`、`README_zh.md`、`eval/README.md`、`report.md`、`EVIDENCE_INDEX.md`、`LIMITATIONS.md`、`REPRODUCE.md`、`ANNOTATOR_PROVENANCE.md`、`docs/STATUS.md`、`docs/evidence/README.md`、`ARCHITECTURE.md` | 保留；`eval/README.md` 重写成唯一地图 | 测试引用 |
| **B 证据本身（保留，被 A 指向）** | `RESULTS.md`、`SLICE_REPORT.md`、`CONTROL_CHECK.md`、`RUN_RECEIPTS.md`、`ACTION_CONTRACT_COVERAGE.md`、`safety_compiler/README.md`、`provenance/*`、`spec/*`、`formal/*`、`baseline_b/*`、`annotation/*`、`dev/*`、各运行目录的 report | 保留原位；`RUN_RECEIPTS`、`ACTION_CONTRACT_COVERAGE` 可并入对应文件夹以减少 `eval/` 顶层 | 大多被钉住，不动 |
| **C 过程记录（归档，不删）** | `DESIGN_BOUNDED_RETRY.md`、`DESIGN_CANARY_UNKNOWN.md`、`DESIGN_SAFETY_COMPILER_EVAL.md`（已基本实施）、`FACT_CHECK_2026-11-16.md`、`HANDOFF_TO_GPT.md`（82 KB）、`HANDOFF_TO_CLAUDE.md`、`AUTHOR_BRIEF.md`、`CUSTODIAN_GUIDE.md`、`IMPLEMENTATION_NOTES.md`、`baseline_v1/MANIFEST.md`、`PROMPT_LOCATIONS.md` | 移到 `eval/archive/` 并在 `EVIDENCE_INDEX.md` 留一行指针；**移之前要更新指向它们的链接，并跑测试** | 未被钉住；`PLAN.md`、`R3_DEV_LOG.md` 被测试引用，先不动 |
| **D 学习／面试（与评测分开）** | `eval/interview/` 里 `INTERVIEW_DEEP_DRILL_zh`、`RECOMMEND_LEARNING_zh`、`CAREER_ROADMAP_zh`、`INTERVIEW_STORY_zh`；`docs/refer/*`；`answer.md`；`batch_transcribe.py`；`eval/web/` | `eval/web/` 留本地（已定）；其余见下面两个选项 | **9 份 interview 被测试引用；`CLAUDE.md` 规定手册是唯一答案来源** |
| **E 新人导读（改个位置，公开）** | `START_HERE_zh.md`、`BACKEND_CODE_GUIDE_zh.md`、`AGENT_INTENT_DESIGN_zh.md`、`BUSINESS_HARNESS_zh.md` | 放到 `docs/guide/`，面试官和新人都能找到 | 测试引用，要更新路径 |
| **F 项目早期（原位，不属于评测路径）** | `docs/adrs`（35）、`docs/reference`（17）、`docs/architecture`、`docs/dashboard`、`operations.md`、`PROJECT_MEMORY.md` | 不动；在 `docs/README.md` 里说明"这是平台和前端的决策史，评测请看 `eval/README.md`" | — |

## 关于 D：要说清楚的事实

- 面试手册等已经**推送到了 GitHub**。就算现在从仓库移走，历史里仍然看得到，除非重写公开历史，那是破坏性的操作，我不建议。所以"留本地"只能管**以后**，不能收回已经公开的。
- 手册被 9 个测试检查（数字一致、禁用词、链接存在）。如果拿出仓库，这些保护要么丢掉，要么改成"文件在才检查"。
- 所以两个选项：
  1. **分出去但仍在仓库**：移到顶层 `study/`，写明"个人备考材料，不是评测证据"，更新测试和 `CLAUDE.md` 的路径。评审者一眼分得清，测试保护还在。
  2. **完全本地**：加入 `.gitignore`，测试改成"文件存在才检查"。最干净，但以后换电脑要自己备份。

## 建议的顺序（每一步都跑测试，不动被钉住的文件）

1. 你定 D 的选项，以及 E 要不要。
2. 归档 C，更新链接，跑测试。
3. 重写 `eval/README.md` 为唯一地图（把现在分散在好几处的"读哪个"表并进去，不再新增文档）。
4. 加一个"孤儿文档"测试：新增的文档必须被某个索引链接，否则变红。
5. 冷读测试：只给一个没见过项目的新会话看 `eval/README.md`，问 5 个问题（头条数字、怎么验证、没声称什么、谁标的、怎么复现），看几步找到。
