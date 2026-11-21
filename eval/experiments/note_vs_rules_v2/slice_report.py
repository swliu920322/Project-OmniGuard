"""Read-only slice report for the round-2 note comparison.

Reads three published files (the custodian's per-record ledger, the test set, the family list), checks
that they reproduce the published totals, then cuts the same 180 records by note status, language,
note-only stop risk and family. No model call, no network, no input is changed. The ledger is the
custodian's post-run audit, not something this script derives; the totals check is what shows the
script read it correctly.

    python eval/experiments/note_vs_rules_v2/slice_report.py            # writes slices/SLICE_REPORT.md and .json
    python eval/experiments/note_vs_rules_v2/slice_report.py --check-only
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE / "evidence"
SYSTEMS = ("model", "R1", "R2", "R3")
STATUS_ORDER = ("AFFIRMED_CURRENT", "NEGATED", "HISTORICAL", "HYPOTHETICAL", "UNCERTAIN", "IRRELEVANT")
LANG_ORDER = ("zh", "en", "mixed")
SMALL = 30  # a slice with fewer records than this is flagged; the three language variants of one family are not independent either

# Published in RESULTS.md: note status correct, and the paired cells (both / model only / R3 only / neither).
EXPECTED = {"n": 180, "model": 173, "R3": 77, "pair": {"both": 75, "model_only": 98, "r3_only": 2, "neither": 5}}


def read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def build_rows(audit, test_rows, families):
    """One row per record: id, family, language, gold, note-only risk, and per-system correctness of the note status."""
    by_id = {r["id"]: r for r in test_rows}
    if len(by_id) != len(test_rows) or len({r["id"] for r in audit}) != len(audit):
        raise ValueError("duplicate record ids")
    if set(by_id) != {r["id"] for r in audit}:
        raise ValueError("ledger and test set do not hold the same record ids")
    rows = []
    for rec in audit:
        test = by_id[rec["id"]]
        if test["family_id"] != rec["family_id"]:
            raise ValueError("family mismatch for one record")
        if rec["family_id"] not in families:
            raise ValueError("family missing from the family list")
        gold = rec["gold_note_status"]
        rows.append({
            "id": rec["id"], "family": rec["family_id"], "language": test["language"], "gold": gold,
            "risk": bool(rec["note_only_risk"]),
            "pred": {s: rec["predictions"][s]["note_status"] for s in SYSTEMS},
            "ok": {s: rec["predictions"][s]["note_status"] == gold for s in SYSTEMS},
        })
    return rows


def pair_cells(rows):
    cells = Counter()
    for r in rows:
        cells[("both" if r["ok"]["R3"] else "model_only") if r["ok"]["model"] else ("r3_only" if r["ok"]["R3"] else "neither")] += 1
    return {k: cells.get(k, 0) for k in ("both", "model_only", "r3_only", "neither")}


def check_totals(rows, expected=EXPECTED):
    """Return a list of problems; empty means the ledger reproduces the published totals."""
    problems = []
    got = {"n": len(rows), "model": sum(r["ok"]["model"] for r in rows), "R3": sum(r["ok"]["R3"] for r in rows), "pair": pair_cells(rows)}
    for key in ("n", "model", "R3", "pair"):
        if got[key] != expected[key]:
            problems.append(f"{key}: ledger gives {got[key]}, published {expected[key]}")
    return problems


def cut(rows, key):
    """Group rows by key(row); count the records and each system's correct note statuses."""
    groups = defaultdict(lambda: {"n": 0, **{s: 0 for s in SYSTEMS}})
    for r in rows:
        g = groups[key(r)]
        g["n"] += 1
        for s in SYSTEMS:
            g[s] += r["ok"][s]
    return dict(groups)


def family_summary(rows):
    """Per family: records, and how many each of the model and R3 got right. The three language variants share one situation."""
    fam = defaultdict(lambda: {"n": 0, "model": 0, "R3": 0})
    for r in rows:
        f = fam[r["family"]]
        f["n"] += 1
        f["model"] += r["ok"]["model"]
        f["R3"] += r["ok"]["R3"]
    out = {"families": len(fam)}
    for s in ("model", "R3"):
        out[s] = {"all_right": sum(f[s] == f["n"] for f in fam.values()),
                  "some_wrong": sum(f[s] < f["n"] for f in fam.values()),
                  "all_wrong": sum(f[s] == 0 for f in fam.values())}
    return out, dict(fam)


def model_errors(rows, families):
    return [{"id": r["id"], "family": r["family"], "gold": r["gold"], "model": r["pred"]["model"],
             "language": r["language"], "phenomenon": families[r["family"]].get("phenomenon", "")}
            for r in rows if not r["ok"]["model"]]


def ordered(groups, order):
    return [(k, groups[k]) for k in order if k in groups] + [(k, v) for k, v in sorted(groups.items(), key=lambda kv: str(kv[0])) if k not in order]


def pct(a, n):
    return f"{a}/{n} ({100 * a / n:.1f}%)" if n else "0/0"


def table(groups, order, label):
    lines = [f"| {label} | 条数 | 模型 | R1 | R2 | R3 |", "|---|---|---|---|---|---|"]
    for k, g in ordered(groups, order):
        flag = "（样本小）" if g["n"] < SMALL else ""
        lines.append(f"| {k}{flag} | {g['n']} | " + " | ".join(pct(g[s], g["n"]) for s in SYSTEMS) + " |")
    return "\n".join(lines)


ROLES = """| 角色 | 本轮由谁承担 | 看得到什么 | 作用 | 依据 |
|---|---|---|---|---|
| 作者 | Gemini 会话 | 题与自己的标签 | 产生待检验的材料 | [来源表](../../../ANNOTATOR_PROVENANCE.md) |
| 盲标 | GPT 家族子会话 | 只有题和规则，看不到标签 | 度量：独立标注后算一致率 | 同上 |
| 复核 | GPT 家族子会话 | 题、作者标签与依据 | 纠错，不是度量 | 同上 |
| 裁决与保管 | GPT 主会话 | 全部 | 定最终标签，冻结，保管 | 同上 |
| 被测方 | DeepSeek 模型；规则 R1/R2/R3 | 题的文字与遥测 | 被评测 | [RESULTS.md](../RESULTS.md) |
| 测后账本 | GPT 保管者 | 全部，含结果 | 逐条对照金标与预测 | `evidence/review/record_audit.jsonl` |
| 本报告 | 只读脚本 | 上述公开文件 | 把总数切成片 | 本文件 |"""


def render(rows, families, inputs, problems):
    fam_sum, fam_detail = family_summary(rows)
    status = cut(rows, lambda r: r["gold"])
    lang = cut(rows, lambda r: r["language"])
    risk = cut(rows, lambda r: "备注独有停车风险" if r["risk"] else "无")
    cross = cut(rows, lambda r: f"{r['gold']} / {r['language']}")
    cells = pair_cells(rows)
    errs = model_errors(rows, families)
    out = []
    w = out.append
    w("# 第二轮备注理解：分片对照报告\n")
    w("只读脚本 `slice_report.py` 的输出。没有调用模型，没有改动任何输入。这是对已公开的 180 条结果的重新切分，**不是新成绩，也不是优化前后的对比**。\n")
    w("## 0. 谁做了什么\n")
    w(ROLES + "\n")
    w("读这张表的方式：数字来自测后账本，账本由保管者整理。脚本先核对账本能否复现公开总数（见第 1 节），再切片。作者、盲标者、复核者的模型归属来自会话自述和 git，不是数据文件字段。\n")
    w("## 1. 先核对：脚本读对了数据吗？\n")
    w("- **为什么看**：切片的前提是账本和公开总数一致。")
    w("- **是什么**：公开总数是模型 173/180、R3 77/180，配对为双方都对 75、仅模型对 98、仅 R3 对 2、双方都错 5。")
    w(f"- **结果**：{'一致，可以继续。' if not problems else '不一致：' + '；'.join(problems)}")
    w(f"- 本次读到：模型 {pct(sum(r['ok']['model'] for r in rows), len(rows))}，R3 {pct(sum(r['ok']['R3'] for r in rows), len(rows))}，配对 {cells}。\n")
    w("## 2. 按金标备注状态\n")
    w("- **为什么看**：问题 \"错在哪类备注上\" 的第一层。")
    w("- **是什么**：金标的六种备注状态，每种 30 条。正确指预测的备注状态等于金标。")
    w("- **怎么算**：逐条比较预测与金标，按状态汇总。")
    w("\n" + table(status, STATUS_ORDER, "金标状态") + "\n")
    w("- **怎么读**：同一行内横向比较四个系统；不同状态之间每种 30 条，条数相同可以直接比。")
    w("- **说明什么**：哪几种状态上规则或模型失手更多。")
    w("- **不说明什么**：为什么失手。归因见 [CROSS_REVIEW.json](../evidence/review/CROSS_REVIEW.json)。每行只有 30 条，且同一情境以三种语言重复出现，差几条不能当稳定差异。\n")
    w("## 3. 按语言\n")
    w("- **为什么看**：规则靠词表，语言可能是弱点。")
    w("- **是什么**：中文、英文、混合各 60 条。")
    w("\n" + table(lang, LANG_ORDER, "语言") + "\n")
    w("- **说明什么**：某语言上规则是否明显更差。")
    w("- **不说明什么**：不说明模型或规则\"懂\"哪种语言。三种语言是同一情境的三种写法，题目由同一作者写成。\n")
    w("## 4. 状态 × 语言\n")
    w("- **为什么看**：看第 2、3 节的差异是否集中在某一格。")
    w("- **怎么读**：每格 10 条，全部标为样本小，只看有没有明显集中，不看百分比。")
    w("\n" + table(cross, [f"{s} / {l}" for s in STATUS_ORDER for l in LANG_ORDER], "金标状态 / 语言") + "\n")
    w("## 5. 备注独有停车风险\n")
    w("- **为什么看**：这是 HANDOFF 点名要复核的子集。遥测本身没有触发停车，只有备注里有风险，漏掉会直接影响停车决定。")
    w("- **是什么**：账本字段 `note_only_risk`，为真的记录单独汇总。")
    w("\n" + table(risk, ("备注独有停车风险", "无"), "分组") + "\n")
    w("- **不说明什么**：这里的\"对\"仍是备注状态是否等于金标，不是停车动作是否正确。停车动作的结果见 RESULTS.md。\n")
    w("## 6. 配对：模型和 R3 谁对谁错\n")
    w("| 单元 | 条数 |\n|---|---|")
    for k, label in (("both", "双方都对"), ("model_only", "仅模型对"), ("r3_only", "仅 R3 对"), ("neither", "双方都错")):
        w(f"| {label} | {cells[k]} |")
    w("\n- **怎么读**：同一批 180 条上的横向对照，R3 是本次的具体规则实现，不代表规则引擎能达到的最好水平，所以不能由差值推出\"必须用 LLM\"。\n")
    w("## 7. 按家族\n")
    w("- **为什么看**：60 个家族各 3 条，是同一情境的三种语言写法。条数不是独立样本，家族数才更接近独立情境数。")
    w(f"- **是什么**：共 {fam_sum['families']} 个家族。")
    w("\n| 系统 | 三条全对的家族 | 至少错一条的家族 | 三条全错的家族 |\n|---|---|---|---|")
    for s, label in (("model", "模型"), ("R3", "R3")):
        d = fam_sum[s]
        w(f"| {label} | {d['all_right']} | {d['some_wrong']} | {d['all_wrong']} |")
    w("\n- **说明什么**：错误是分散在很多家族，还是集中在少数家族。")
    w("- **不说明什么**：家族是作者自己声明的语义分组，没有证明它们在统计上独立。\n")
    w(f"## 8. 模型的 {len(errs)} 条错分\n")
    w("只列编号、家族、金标与模型预测；题目原文在 [test_set.jsonl](../evidence/data/test_set.jsonl)，公开。\n")
    w("\n| 编号 | 家族 | 语言 | 金标 | 模型预测 | 家族现象 |\n|---|---|---|---|---|---|")
    for e in errs:
        w(f"| {e['id']} | {e['family']} | {e['language']} | {e['gold']} | {e['model']} | {e['phenomenon']} |")
    w("\n## 9. 输入文件与局限\n")
    w("\n| 文件 | SHA-256 |\n|---|---|")
    for name, digest in inputs.items():
        w(f"| `{name}` | `{digest}` |")
    w("\n- 标签是 AI 标注和 AI 复核，不是专家金标；题目是合成的，分属 60 个家族，每个家族三种语言写法。")
    w("- 同一批 180 条公开后已成为回归集，不再是未接触的新测试集。")
    w("- 本报告不改变任何已发布的数字，也不构成新的评测。")
    return "\n".join(out) + "\n", {"totals_check": problems, "pair": cells, "by_status": status, "by_language": lang, "by_note_only_risk": risk,
                                   "by_status_language": cross, "families": fam_sum, "family_detail": fam_detail, "model_errors": errs, "inputs": inputs}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--audit", default=str(EVIDENCE / "review/record_audit.jsonl"))
    ap.add_argument("--test-set", default=str(EVIDENCE / "data/test_set.jsonl"))
    ap.add_argument("--families", default=str(EVIDENCE / "data/families.json"))
    ap.add_argument("--out-dir", default=str(HERE / "slices"))
    ap.add_argument("--check-only", action="store_true", help="only verify that the ledger reproduces the published totals")
    args = ap.parse_args(argv)
    families = json.loads(Path(args.families).read_text(encoding="utf-8"))
    rows = build_rows(read_jsonl(args.audit), read_jsonl(args.test_set), families)
    problems = check_totals(rows)
    if problems:
        print("totals check FAILED:", *problems, sep="\n  ", file=sys.stderr)
        return 1
    print("totals check passed:", len(rows), "records")
    if args.check_only:
        return 0
    inputs = {Path(p).name: sha256(p) for p in (args.audit, args.test_set, args.families)}
    md, data = render(rows, families, inputs, problems)
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "SLICE_REPORT.md").write_text(md, encoding="utf-8")
    (out / "slice_report.json").write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("wrote", out / "SLICE_REPORT.md", "and slice_report.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
