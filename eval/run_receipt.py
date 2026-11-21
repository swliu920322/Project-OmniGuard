"""Read-only run receipt: one page per real run, built from the sealed run files.

For every run directory it reads config.json and summary.json (round 2) or public_summary.json (round 1),
and lists ten items: what ran, how it ended, data, rule and prompt versions, model, request settings, budget,
what was used, authorisation, rollback point. An item the files do not record is shown as "not recorded";
nothing is filled in, and no run directory is changed. The receipt summarises sealed files, it is not new evidence.

    python3 -I eval/run_receipt.py            # writes eval/RUN_RECEIPTS.md
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

EVAL = Path(__file__).resolve().parent
ROOTS = (EVAL / "formal/results", EVAL / "experiments/note_vs_rules_v2/evidence/runs")
MISSING = "未记录"


def load_run(directory):
    """Return {'cfg': ..., 'sum': ..., 'files': [...]} for a directory that holds a summary file, else None."""
    d = Path(directory)
    summary = next((n for n in ("summary.json", "public_summary.json") if (d / n).is_file()), None)
    if summary is None:
        return None
    run = {"dir": d.name, "files": [summary], "sum": json.loads((d / summary).read_text(encoding="utf-8")), "cfg": {}}
    if (d / "config.json").is_file():
        run["cfg"] = json.loads((d / "config.json").read_text(encoding="utf-8"))
        run["files"].insert(0, "config.json")
    return run


def find_runs(roots=ROOTS):
    out = []
    for root in roots:
        for p in sorted(Path(root).rglob("*")):
            if p.is_dir():
                run = load_run(p)
                if run:
                    out.append(run)
    return out


def dig(obj, dotted):
    for part in dotted.split("."):
        if not isinstance(obj, dict) or part not in obj:
            return None
        obj = obj[part]
    return obj


def first(run, *places):
    """First recorded value among (source, dotted path) places; returns (value, 'file:path') or (None, None)."""
    for source, path in places:
        value = dig(run[source], path)
        if value is not None:
            return value, f"{'config.json' if source == 'cfg' else run['files'][-1]}:{path}"
    return None, None


def fmt(v):
    """Readable text for a recorded value; 64-character hashes are shortened, nothing else is cut."""
    if isinstance(v, dict):
        return "，".join(f"{k}:{fmt(x)}" for k, x in v.items() if x is not None)
    if isinstance(v, list):
        return "、".join(fmt(x) for x in v)
    if isinstance(v, str) and len(v) in (40, 64) and all(c in "0123456789abcdef" for c in v):
        return f"{v[:12]}…"
    if isinstance(v, str) and len(v) > 80:
        return f"{v[:80]}…（全文见来源文件）"
    return str(v)


def receipt(run):
    """Ten items, each (item, text, where). text is MISSING when the sealed files do not record it."""
    rows = []

    def add(item, parts):
        shown = [f"{label}{fmt(v)}" for label, v, _ in parts if v is not None]
        where = sorted({w.split(":")[0] for _, v, w in parts if v is not None and w})
        rows.append((item, "；".join(shown) if shown else MISSING, ", ".join(where) if shown else ""))

    def get(label, *places):
        v, w = first(run, *places)
        return (label, v, w)

    add("运行标识", [get("", ("sum", "run_id")), get("suite=", ("sum", "suite")), get("mode=", ("sum", "mode")),
                 get("canary=", ("sum", "is_canary")), get("measurement=", ("sum", "is_measurement"))])
    add("结束情况", [get("status=", ("sum", "status")), get("stop_reason=", ("sum", "stop_reason")),
                 get("interruption=", ("sum", "interruption")) if "interruption" in run["sum"] else ("", None, None)])
    add("数据", [get("dataset_sha256=", ("cfg", "dataset_sha256"), ("sum", "dataset_sha256"))])
    add("规则与提示词版本", [get("spec_version=", ("cfg", "spec_version"), ("sum", "spec_version")),
                      get("prompt_sha256=", ("cfg", "prompt_sha256"), ("sum", "prompt_sha256")),
                      get("code_freeze_sha256=", ("cfg", "code_freeze_sha256"), ("sum", "code_freeze_sha256")),
                      get("scoring_policy=", ("cfg", "scoring_policy"), ("sum", "scoring_policy"))])
    add("模型", [get("请求名=", ("cfg", "model.configured_model_name")),
               get("声明身份=", ("cfg", "model.identity_stated_by_owner"), ("sum", "model_identity_stated_by_owner")),
               get("返回别名=", ("sum", "distinct_response_models")), get("漂移标记=", ("sum", "model_drift_flag"))])
    add("请求设置与重试", [get("重试次数=", ("cfg", "request_settings.sdk_max_retries")), get("超时秒=", ("cfg", "request_settings.sdk_timeout_s")),
                      get("温度参数=", ("cfg", "request_settings.temperature")), get("输出上限=", ("cfg", "request_settings.max_tokens"))])
    add("预算上限", [get("max_calls=", ("cfg", "budget.max_calls"), ("sum", "budget.max_calls")),
                 get("max_tokens=", ("cfg", "budget.max_tokens"), ("sum", "budget.max_tokens")),
                 get("max_usd=", ("cfg", "budget.max_usd"), ("sum", "budget.max_usd"))])
    add("实际使用", [get("calls_recorded=", ("sum", "calls_recorded")), get("planned=", ("sum", "planned")),
                 get("usd_from_reported_usage=", ("sum", "usd_from_reported_usage")),
                 get("calls_without_usable_usage=", ("sum", "calls_without_usable_usage"))])
    add("授权", [get("授权人=", ("cfg", "authorization.authorized_by")), get("美元上限=", ("cfg", "authorization.usd_cap_as_given"))])
    add("回滚点", [get("frozen_tag=", ("cfg", "frozen_tag"), ("sum", "frozen_tag")), get("repo_head=", ("cfg", "repo_head"), ("sum", "repo_head"))])
    return rows


def render(runs):
    lines = ["# 运行回执\n",
             "由 `run_receipt.py` 从已封存的运行文件汇总，**只读，不改任何运行目录**。没有记录的项显示「未记录」，不补、不猜。回执是汇总，不是新证据。\n",
             "## 总览：每次运行哪些项有记录\n"]
    items = [r[0] for r in receipt(runs[0])] if runs else []
    lines.append("| 运行 | " + " | ".join(items) + " |")
    lines.append("|---|" + "---|" * len(items))
    for run in runs:
        marks = ["—" if text == MISSING else "✓" for _, text, _ in receipt(run)]
        lines.append(f"| `{run['dir']}` | " + " | ".join(marks) + " |")
    lines.append("\n✓ 有记录，— 未记录。\n")
    for run in runs:
        lines.append(f"## `{run['dir']}`\n")
        lines.append(f"读取的文件：{', '.join(run['files'])}\n")
        lines.append("| 项 | 值 | 来源 |\n|---|---|---|")
        for item, text, where in receipt(run):
            lines.append(f"| {item} | {text.replace('|', '/')} | {where} |")
        lines.append("")
    lines.append("## 读法与局限\n")
    lines.append("- 第一轮只有公开摘要（私有的配置和逐条文件已丢，见 `LIMITATIONS.md` 第 22 条），所以请求设置和授权显示「未记录」；这不表示当时没有设置，只表示公开文件里没有这一项。")
    lines.append("- 「声明身份」是所有者声明，不是验证过的模型版本；「返回别名」只说明接口返回的名字一致。")
    lines.append("- 没有「人工干预次数」和「运行前测试通过情况」这两个结构化字段；运行过程的文字记录在 `experiments/note_vs_rules_v2/HANDOFF_TO_GPT.md`。")
    lines.append("- 第二轮主测试的记录里 `measurement=False`；这个字段在第二轮的含义没有核对，该次运行的正式性质以 `RESULTS.md` 为准，不据此字段下结论。")
    lines.append("- 费用是按配置价格的估算，不是账单。")
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(EVAL / "RUN_RECEIPTS.md"))
    args = ap.parse_args(argv)
    runs = find_runs()
    if not runs:
        print("no run directories found", file=sys.stderr)
        return 1
    Path(args.out).write_text(render(runs), encoding="utf-8")
    print(f"wrote {args.out} for {len(runs)} runs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
