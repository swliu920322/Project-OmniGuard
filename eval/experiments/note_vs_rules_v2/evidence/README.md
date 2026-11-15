# 第二轮最终原件与离线核验

本目录在运行结束、封存恢复和交叉复核之后，按所有者既定决定整理入仓。现在这 180 条是**公开回归材料**；不能再用作后续开发未见的新测试。没有公开或重建已丢失的旧 300 条。

## 从哪里开始

| 路径 | 内容与用途 |
|---|---|
| [../RESULTS.md](../RESULTS.md) | 正式分数、代价、边界、两次复核及待办 |
| [data/test_set.jsonl](data/test_set.jsonl) | 冻结的 180 条原始输入及标签；SHA-256 仍为 `6249acb7385857262942e746a91c55f19500f8be0905a7499ae2b25b580a1369` |
| [data/families.json](data/families.json) | 最终派生修正的 60 个实验分组；不是已证明统计独立的实地场景 |
| [data/annotation_rationales.jsonl](data/annotation_rationales.jsonl) | 原分句标注依据；保留原样，字段非空不证明语义正确，已知过于概括的依据见结果报告 |
| `data/*adjudications.jsonl`、`metadata_corrections.jsonl`、`FINAL_REVIEW.json` | 最终裁决、元数据修正与制作终审；较早的候选／全部历史盲标原件仍在保管目录，本目录没有把历史记录冒充新盲标 |
| [data/DATA_FREEZE_CANDIDATE.json](data/DATA_FREEZE_CANDIDATE.json) | 当时不可变的候选快照，含“待提交”等历史状态；最终激活由 `a65eb62` 字节承诺核验、执行标签和运行配置共同绑定，不回写此历史文件 |
| [runs/health/20261115T152849Z_main_real_5a331f0f/](runs/health/20261115T152849Z_main_real_5a331f0f/) | 2 条公开开发材料健康检查的请求、回复、配置、用量及摘要，不计正式分数 |
| [runs/main/20261115T152854Z_main_real_e5fd14c2/](runs/main/20261115T152854Z_main_real_e5fd14c2/) | 正式 180 条 `calls.jsonl`、`config.json`、`summary.json`、原封存清单；完整回复保留 reasoning 和结束原因 |
| [rules/](rules/) | 同一输入下 R1／R2／R3 的逐条预测，测后离线生成，无 API 请求 |
| [analysis/](analysis/) | 原运行器产生的配对 ID、各条结果和聚合分析；`analysis_private.json` 现按既定决定公开，原文件名和字节不变 |
| [review/CROSS_REVIEW.json](review/CROSS_REVIEW.json)、[review/record_audit.jsonl](review/record_audit.jsonl) | 未参与 R3 开发的保管者测后复算；包含实际控制流归因、180 条账本、敏感性假设及开发材料核对。保管者参与过数据裁决，不是新盲标者或领域专家 |
| [SHA256SUMS](SHA256SUMS) | 本交付目录的递归字节清单；内层原始清单继续保留 |

`calls.jsonl` 的实际输入、请求参数、完整回复、用量、时长和返回别名保持封存字节。没有复制凭据、`.env`、含本机绝对路径的进程命令及运行日志。原常驻私有包和两份同盘恢复包仍保留；本地入仓不等于远端备份，尚未推送。

原 `summary.json` 内的 `data_is_frozen_acceptance_file`／`is_measurement` 针对旧 300 条验收文件，不能拿来判定本轮新数据是否冻结；`suite: main` 也是复用外壳的字段。**本轮以 [../results/20261115T152854Z_main_real_e5fd14c2/note_compare.json](../results/20261115T152854Z_main_real_e5fd14c2/note_compare.json) 的备注指标、complete 状态及 V2 冻结绑定为准。** 不改旧字段来伪装新的验收类型。

旧聚合目录 `results/` 中的 `VERIFICATION.json`、`BACKUP_RECEIPT.json` 和运行报告保留当时阶段快照，其中的“交叉复核待完成”没有回写；随后完成的复核以本目录 `review/CROSS_REVIEW.json` 和上级 `RESULTS.md` 为准。

## 免费复算已有记录

在仓库根目录运行，需要 Python 3.10+。这一步只读现有回复，不需要 API Key、不请求模型：

```sh
(cd eval/experiments/note_vs_rules_v2/evidence && shasum -a 256 -c SHA256SUMS)
OUT=$(mktemp -d)
python3 eval/experiments/note_vs_rules_v2/audit_recompute.py \
  --data eval/experiments/note_vs_rules_v2/evidence/data/test_set.jsonl \
  --run-dir eval/experiments/note_vs_rules_v2/evidence/runs/main/20261115T152854Z_main_real_e5fd14c2 \
  --expect-sha256 6249acb7385857262942e746a91c55f19500f8be0905a7499ae2b25b580a1369 \
  --output "$OUT/CROSS_REVIEW.json" \
  --ledger "$OUT/record_audit.jsonl"
```

脚本不用 `evaluate.py` 或 `note_analysis.py` 的计分函数，独立累加正确数、漏停、误停、配对四格、token、费用、分位数和家族 bootstrap；渲染和动作仍复用冻结的参考规范，所以不是独立重写业务规范。R3 归因复用其 `explain()` 控制流，不能据此声称已隔离出词汇／长度的因果效应。

脚本先核验 14 个冻结文件，输入逐条核对实际渲染文字及请求参数；正式分数与诊断性替代标签分析分开。任何敏感性分析均不改原标签，不是重测成绩。已保存回复的复算不保证未来服务响应相同。

## 真实重跑另行授权

真实调用入口仍是冻结运行器 [../run_note_compare.py](../run_note_compare.py)。从 `eval-note-v2-r3-final-20261115` 对应提交的新 worktree 运行，数据可通过此交付目录的绝对路径传入；先做新的公开健康检查，再运行完整集。需自备凭据、重新核实价格、明确预算及新授权，不能复用已消耗的本轮 182 次授权。模型实际版本未独立验证，提示词固定也不保证分数或时延相同。

## Downloads 阶段包的本机归档

2026-11-16，17 个封存包及校验单、4 份项目手册／论文导出件已复制到项目根目录的 `.local-archives/omniguard-v2/`，21 个主文件逐个与 Downloads 原件核对 SHA-256 一致，原件未移动或删除。该本机归档目录被 Git 忽略，权限仅当前用户可读写；不是公开交付的一部分，也不是独立介质或远端备份。

`current/` 保留制作历史累计包 `OmniGuard-v2-revision3-final-candidate-20261115T112131Z.tar.gz`（181 个文件）和运行核验包 `authorized_note_v2_20261115T152848Z_verified.tar.gz`（49 个文件，含其清单）；`history/` 保留其余 15 个阶段包及校验单；`reference-documents/` 放历史手册和论文。全部压缩包约 9.78 MB。

已核对其余包的文件内容被两个累计包覆盖，三个旧标注依据在累计制作包的 `archives/` 下保留。历史包不作为当前成绩入口，但继续保留原容器以对应旧哈希。`MANIFEST.json` 和本机 README 记录每份文件的用途、大小和哈希；缺配套校验单的两个运行包已在本机归档中补生成，未改原压缩包。

本机归档清单 `MANIFEST.json` 的 SHA-256：`c8e140c5c3902bbe5dcaeb2a041c3b273ad14d4613c66d4abce2b7ad842efd70`。清单及包体被 Git 忽略；Git 中这条索引不能恢复本机归档，不代表已推送备份。
