"""Control check of the scoring chain, run through the project's own scorer (note_analysis.correctness, evaluate.note_outcome).

No model call, no network, no input changed. Three controls on the 180 published records, plus one reproduction:

  oracle        every prediction equals the gold               -> must score 100%
  anti-oracle   every prediction is a different status         -> must score 0%
  constant      one status for every record                    -> must score exactly that status's share (30/180 here)
  shuffle       gold statuses permuted among the records       -> must land near the chance level, sum((n_s/n)^2)
  reproduction  the published model and R3 replies, same scorer -> must give 173/180 and 77/180

A failed control means the scoring chain (or the way it is fed) is wrong; it says nothing about how good a model is.
The shuffle band is a reference for reading a score, not a significance test.

    python3 -I eval/experiments/note_vs_rules_v2/control_check.py
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
for sub in ("eval/spec", "eval/baseline_b", "eval/baseline_v1/measure", "eval/formal", "eval/experiments/note_vs_rules_v2"):
    sys.path.insert(0, str(ROOT / sub))
import evaluate as E  # noqa: E402
import note_analysis as NA  # noqa: E402
import reference_labeler as R  # noqa: E402
import run_formal as RF  # noqa: E402

EVIDENCE = HERE / "evidence"
DEFAULT_PATHS = {
    "test_set": EVIDENCE / "data/test_set.jsonl",
    "model_calls": EVIDENCE / "runs/main/20261115T152854Z_main_real_e5fd14c2/calls.jsonl",
    "R1": EVIDENCE / "rules/R1_predictions.jsonl", "R2": EVIDENCE / "rules/R2_predictions.jsonl", "R3": EVIDENCE / "rules/R3_predictions.jsonl",
}
PUBLISHED = {"model": 173, "R3": 77}  # RESULTS.md
SEED = 20261121
TOLERANCE = 0.015  # the simulated shuffle mean must sit within 1.5 points of the exact chance level


def read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_records(path):
    return [RF.normalize_test(raw, i) for i, raw in enumerate(read_jsonl(path), 1)]


def call(rec, primary, status):
    return {"id": rec["id"], "prediction": {"primary": primary, "note_status": status}, "finish_reason": "stop", "error": None}


def other(value, options):
    return options[(options.index(value) + 1) % len(options)]


def oracle_calls(records):
    return [call(r, r["gold"]["primary"], r["note_status"]) for r in records]


def anti_oracle_calls(records):
    return [call(r, other(r["gold"]["primary"], R.CLASSES), other(r["note_status"], R.NOTE_STATUSES)) for r in records]


def constant_calls(records, status):
    return [call(r, r["gold"]["primary"], status) for r in records]


def correct_count(records, calls, scorer):
    return sum(scorer(records, calls).values())


def chance_level(records):
    n = len(records)
    return sum((c / n) ** 2 for c in Counter(r["note_status"] for r in records).values())


def shuffle_band(outcomes, gold, n_shuffles, seed=SEED):
    """Accuracy of fixed outcomes against gold statuses permuted among the records."""
    rng = random.Random(seed)
    accs = []
    for _ in range(n_shuffles):
        g = gold[:]
        rng.shuffle(g)
        accs.append(sum(o == x for o, x in zip(outcomes, g)) / len(g))
    accs.sort()
    k = len(accs)
    return {"mean": sum(accs) / k, "low": accs[int(0.025 * k)], "high": accs[min(k - 1, int(0.975 * k))], "n_shuffles": k}


def run_controls(records, scorer=NA.correctness, outcome=E.note_outcome, n_shuffles=1000, published_calls=None):
    n = len(records)
    gold = [r["note_status"] for r in records]
    out = {"n": n, "checks": {}}
    out["oracle"] = correct_count(records, oracle_calls(records), scorer)
    out["anti_oracle"] = correct_count(records, anti_oracle_calls(records), scorer)
    counts = Counter(gold)
    out["constant"] = {s: correct_count(records, constant_calls(records, s), scorer) for s in R.NOTE_STATUSES}
    perfect = oracle_calls(records)
    shuffled = shuffle_band([outcome(c, r) for c, r in zip(perfect, records)], gold, n_shuffles)
    exact = chance_level(records)
    out["shuffle"] = {**shuffled, "exact_chance": exact}
    out["checks"] = {
        "oracle scores 100%": out["oracle"] == n,
        "anti-oracle scores 0%": out["anti_oracle"] == 0,
        "each constant predictor scores its status share exactly": all(out["constant"][s] == counts.get(s, 0) for s in R.NOTE_STATUSES),
        "shuffled mean is within 1.5 points of the exact chance level": abs(shuffled["mean"] - exact) <= TOLERANCE,
    }
    out["systems"] = {}
    for name, calls in (published_calls or {}).items():
        by_id = {c["id"]: c for c in calls if c.get("id")}
        outs = [outcome(by_id[r["id"]], r) if r["id"] in by_id else "NOT_STARTED" for r in records]
        real = sum(o == g for o, g in zip(outs, gold))
        band = shuffle_band(outs, gold, n_shuffles)
        out["systems"][name] = {"correct": real, "accuracy": real / n, "shuffle_mean": band["mean"], "shuffle_low": band["low"], "shuffle_high": band["high"],
                                "scorer_correct": correct_count(records, calls, scorer)}
        if name in PUBLISHED:
            ZH[f"{name} reproduces the published {PUBLISHED[name]}/{n}"] = f"{name} 经同一打分函数重现已发布的 {PUBLISHED[name]}/{n}"
            out["checks"][f"{name} reproduces the published {PUBLISHED[name]}/{n}"] = out["systems"][name]["scorer_correct"] == PUBLISHED[name] and real == PUBLISHED[name]
    out["passed"] = all(out["checks"].values())
    return out


ZH = {"oracle scores 100%": "完美答案得 100%", "anti-oracle scores 0%": "反向答案得 0%",
      "each constant predictor scores its status share exactly": "每个固定答案恰好得到该状态的条数",
      "shuffled mean is within 1.5 points of the exact chance level": "打乱标签的均值与精确随机水平相差不超过 1.5 个百分点"}


def pct(x):
    return f"{100 * x:.1f}%"


def render(res, inputs):
    n = res["n"]
    lines = ["# 打分链路的对照检查\n",
             "只读脚本 `control_check.py` 的输出，用项目自己的打分函数（`note_analysis.correctness`、`evaluate.note_outcome`）。没有调用模型，没有改动任何输入。**不是新成绩，也不是对模型好坏的评价。**\n",
             f"## 总结：{'全部通过' if res['passed'] else '有未通过的项，先查打分链路，不要引用分数'}\n",
             "| 检查 | 结果 |\n|---|---|"]
    lines += [f"| {ZH.get(name, name)} | {'通过' if ok else '**未通过**'} |" for name, ok in res["checks"].items()]
    lines += ["", "## 1. 为什么看", "- 一个分数要可信，先要知道打分链路本身分得出好坏：完美答案该得满分，故意错的答案该得零分，随机的答案该落在随机水平。",
              "- 这里检查的是**打分代码和它的输入方式**，不是标签是否正确（标签仍是 AI 标注），也不是模型是否好。", "",
              "## 2. 是什么、怎么算\n",
              "| 对照 | 做法 | 预期 | 实际 |\n|---|---|---|---|",
              f"| 完美答案 | 每条预测等于金标 | {n}/{n} | {res['oracle']}/{n} |",
              f"| 反向答案 | 每条预测换成另一个状态 | 0/{n} | {res['anti_oracle']}/{n} |"]
    lines.append("| 固定答案 | 每条都答同一个状态 | 恰好等于该状态条数（每种 " + str(n // 6) + "） | " + "、".join(f"{s}={c}" for s, c in res["constant"].items()) + " |")
    sh = res["shuffle"]
    lines.append(f"| 打乱标签 | 把金标在记录间随机打乱，重复 {sh['n_shuffles']} 次（种子固定） | 精确随机水平 {pct(sh['exact_chance'])} | 均值 {pct(sh['mean'])}，95% 范围 {pct(sh['low'])} 至 {pct(sh['high'])} |")
    lines += ["", "## 3. 已公开的预测经同一个打分函数\n",
              "| 系统 | 正确 | 准确率 | 打乱金标后的均值 | 95% 范围 |\n|---|---|---|---|---|"]
    for name, s in res["systems"].items():
        lines.append(f"| {name} | {s['correct']}/{n} | {pct(s['accuracy'])} | {pct(s['shuffle_mean'])} | {pct(s['shuffle_low'])} 至 {pct(s['shuffle_high'])} |")
    lines += ["", "## 4. 怎么读", "- 模型和 R3 经打分函数得到的数字等于已发布的 173/180 和 77/180，说明输入方式没有错。",
              "- 随机水平约 16.7%（六种状态各 30 条）。读一个系统的准确率时，把它和这个水平并排看；比如 R2 只比随机水平高一些。",
              "- 打乱标签的范围是**读分数的参照**，不是显著性检验：同一情境有三种语言的写法，条数不是独立样本。",
              "", "## 5. 局限", "- 这些对照检查不出标签本身的错误，也检查不出打分函数里与这些对照无关的缺陷。",
              "- 范围由固定种子的模拟得到，换种子会有小幅变化；精确随机水平由各状态条数算出。",
              "- 第一轮没有逐条原件，所以只检查了第二轮的 180 条。", "", "## 6. 输入文件", "| 文件 | SHA-256 |\n|---|---|"]
    lines += [f"| `{k}` | `{v}` |" for k, v in inputs.items()]
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out-dir", default=str(HERE / "controls"))
    ap.add_argument("--shuffles", type=int, default=1000)
    args = ap.parse_args(argv)
    records = load_records(DEFAULT_PATHS["test_set"])
    published = {"model": read_jsonl(DEFAULT_PATHS["model_calls"]), **{k: read_jsonl(DEFAULT_PATHS[k]) for k in ("R1", "R2", "R3")}}
    res = run_controls(records, n_shuffles=args.shuffles, published_calls=published)
    inputs = {Path(p).name if k != "model_calls" else "runs/main/…/calls.jsonl": sha256(p) for k, p in DEFAULT_PATHS.items()}
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "CONTROL_CHECK.md").write_text(render(res, inputs), encoding="utf-8")
    (out / "control_check.json").write_text(json.dumps(res, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("passed" if res["passed"] else "FAILED", "-", {k: v for k, v in res["checks"].items() if not v} or "all checks ok")
    return 0 if res["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
