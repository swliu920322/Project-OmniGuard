"""Metadata-only extract from exported AI session files (Claude Code, Codex, Antigravity/Gemini).

Reads the private copies (outside the repository) and writes only: file name and SHA-256, line count, first and last
timestamp, the model strings and reasoning settings the tool recorded, the times of `git commit` tool calls, and the times of
tool calls that touch named files. It never writes conversation text, commands or tool arguments, so secrets in the raw
files cannot reach the output. Commit calls are matched to git commit times; a match shows which session issued a commit.

    python3 -I eval/provenance/extract_session_meta.py [--exports DIR] [--out-dir DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DEFAULT_EXPORTS = Path.home() / ".omniguard_custody/provenance_exports"
WATCH = ["validate_rationales.py", "router_v2/rules.py", "router_v2/pipeline.py", "router_v2/prompt.py", "r3.py"]
WRITE_TOOLS = {"Write", "Edit", "write_file", "edit_file"}
MATCH_WINDOW_S = 60  # a commit is matched to a call made up to this many seconds before it


def parse_ts(value):
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


def detect(first_records):
    for d in first_records:
        if d.get("type") in ("session_meta", "turn_context", "event_msg", "response_item"):
            return "codex"
        if d.get("type") in ("PLANNER_RESPONSE", "USER_INPUT", "GENERIC", "SYSTEM_MESSAGE") and "step_index" in d:
            return "antigravity"
        if d.get("type") in ("assistant", "user", "attachment") and ("uuid" in d or "message" in d):
            return "claude"
    return "unknown"


def tool_calls(d, kind):
    """Yield (timestamp, tool_name, command, path) for every tool call in one record.

    `command` is set only for command-running tools (the command text); `path` only for file tools (the path argument).
    Written file contents are never looked at, so a document that merely mentions a file or `git commit` is not counted. Nothing here is written out."""
    if kind == "claude":
        m = d.get("message")
        if d.get("type") == "assistant" and isinstance(m, dict) and isinstance(m.get("content"), list):
            for c in m["content"]:
                if isinstance(c, dict) and c.get("type") == "tool_use":
                    inp = c.get("input") if isinstance(c.get("input"), dict) else {}
                    yield parse_ts(d.get("timestamp")), c.get("name"), (inp.get("command") or "") if c.get("name") == "Bash" else "", inp.get("file_path") or ""
    elif kind == "antigravity":
        for t in d.get("tool_calls") or []:
            if isinstance(t, dict):
                a = t.get("args") if isinstance(t.get("args"), dict) else {}
                yield parse_ts(d.get("created_at")), t.get("name"), (a.get("CommandLine") or "") if t.get("name") == "run_command" else "", a.get("Path") or ""
    elif kind == "codex":
        p = d.get("payload")
        if d.get("type") == "response_item" and isinstance(p, dict) and str(p.get("type", "")).startswith(("function_call", "custom_tool_call", "local_shell_call")) \
                and not str(p.get("type", "")).endswith("_output"):
            body = p.get("arguments") or p.get("input") or p.get("action") or ""
            yield parse_ts(d.get("timestamp")), p.get("name") or p.get("type"), body if isinstance(body, str) else json.dumps(body, ensure_ascii=False), ""


def models_and_effort(d, kind, models, efforts):
    p = d.get("payload") if isinstance(d.get("payload"), dict) else {}
    if kind == "claude":
        m = d.get("message")
        if isinstance(m, dict) and m.get("model"):
            models["message.model"][m["model"]] += 1
        if d.get("type") == "assistant" and d.get("effort"):
            efforts["effort"][str(d["effort"])] += 1
    elif kind == "antigravity":
        if d.get("model"):
            models["model"][d["model"]] += 1
    elif kind == "codex":
        prov = (p.get("base_instructions") or {}).get("provenance") if isinstance(p.get("base_instructions"), dict) else None
        if d.get("type") == "session_meta" and isinstance(prov, dict) and prov.get("model"):
            models["session_meta.provenance.model"][prov["model"]] += 1
        if d.get("type") == "turn_context":
            if p.get("model"):
                models["turn_context.model"][p["model"]] += 1
            if p.get("effort"):
                efforts["turn_context.effort"][str(p["effort"])] += 1


def extract_file(path, watch=WATCH):
    path = Path(path)
    recs, bad = [], 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            recs.append(json.loads(line))
        except json.JSONDecodeError:
            bad += 1
    kind = detect(recs[:50])
    models, efforts = {}, {}
    models = {k: Counter() for k in ("message.model", "model", "session_meta.provenance.model", "turn_context.model")}
    efforts = {k: Counter() for k in ("effort", "turn_context.effort")}
    stamps, commits, touches = [], [], {w: {"write_tool": [], "command_mentions": []} for w in watch}
    for d in recs:
        models_and_effort(d, kind, models, efforts)
        top = d.get("timestamp") or d.get("created_at") or (d.get("payload") or {}).get("timestamp") if isinstance(d.get("payload"), dict) else d.get("timestamp") or d.get("created_at")
        ts = parse_ts(top)
        if ts:
            stamps.append(ts)
        for when, name, command, tpath in tool_calls(d, kind):
            if when and "git commit" in command:
                commits.append(when)
            for w in watch:
                if when and name in WRITE_TOOLS and w in tpath:
                    touches[w]["write_tool"].append(when)
                elif when and w in command:
                    touches[w]["command_mentions"].append(when)
    return {"file": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "tool": kind, "lines": len(recs), "unparsable_lines": bad,
            "first": iso(min(stamps)) if stamps else None, "last": iso(max(stamps)) if stamps else None,
            "models": {k: dict(v) for k, v in models.items() if v}, "effort": {k: dict(v) for k, v in efforts.items() if v},
            "git_commit_calls": [iso(t) for t in sorted(commits)],
            "touches": {w: {k: [iso(t) for t in sorted(v)] for k, v in t_.items() if v} for w, t_ in touches.items() if t_["write_tool"] or t_["command_mentions"]}}


def git_commits(repo=ROOT):
    out = subprocess.run(["git", "log", "--format=%h %ct", "--all"], cwd=repo, capture_output=True, text=True, check=True).stdout
    return [(h, datetime.fromtimestamp(int(t), tz=timezone.utc)) for h, t in (line.split() for line in out.splitlines() if line.strip())]


def match_commits(results, commits, window=MATCH_WINDOW_S):
    """Which session's commit calls precede each git commit within the window. Several sessions can match the same commit; that is shown, not resolved."""
    table = {}
    for h, ct in commits:
        for r in results:
            for call in r["git_commit_calls"]:
                gap = (ct - datetime.fromisoformat(call.replace("Z", "+00:00"))).total_seconds()
                if 0 <= gap <= window:
                    table.setdefault(h, []).append({"file": r["file"], "tool": r["tool"], "call_at": call, "gap_s": int(gap)})
    return table


def render(results, matches, commits):
    L = ["# 会话元数据摘录\n",
         "由 `extract_session_meta.py` 从私有的会话导出文件**只抽取元数据**生成：模型字段、推理档位、时间范围、`git commit` 调用的时间、对指定文件的调用时间。",
         "**不包含对话文字、命令或工具参数。** 导出原文在仓库之外（`~/.omniguard_custody/provenance_exports/`），含疑似密钥的行，不提交。哈希是原文的 SHA-256。\n",
         "## 1. 各文件\n", "| 文件 | 工具 | 起止（UTC） | 模型字段（来源：值×次数） | 推理档位 | SHA-256 |", "|---|---|---|---|---|---|"]
    for r in results:
        ms = "；".join(f"{src}: " + "、".join(f"{v}×{n}" for v, n in vals.items()) for src, vals in r["models"].items()) or "未记录"
        ef = "；".join(f"{src}: " + "、".join(f"{v}×{n}" for v, n in vals.items()) for src, vals in r["effort"].items()) or "未记录"
        L.append(f"| `{r['file']}` | {r['tool']} | {r['first']} 至 {r['last']} | {ms} | {ef} | `{r['sha256'][:12]}…` |")
    L += ["", "## 2. 对指定文件的调用（只列次数与首末时间）\n", "| 文件 | 会话 | 写入类工具 | 命令中提到 |", "|---|---|---|---|"]
    for r in results:
        for w, t in r["touches"].items():
            fmt = lambda xs: f"{len(xs)} 次，{xs[0]} 至 {xs[-1]}" if xs else "—"
            L.append(f"| `{w}` | `{r['file'][:40]}` | {fmt(t.get('write_tool', []))} | {fmt(t.get('command_mentions', []))} |")
    L += ["", "## 3. 提交与会话的对应\n",
          f"对每个 git 提交，找出在它之前 {MATCH_WINDOW_S} 秒内发起 `git commit` 调用的会话。多个会话同时匹配时都列出，不替你选。\n",
          "| 提交 | 提交时间 UTC | 匹配的会话文件 | 调用时间 | 间隔秒 |", "|---|---|---|---|---|"]
    ctime = dict(commits)
    for h in sorted(matches, key=lambda h: ctime[h]):
        for m in matches[h]:
            L.append(f"| `{h}` | {iso(ctime[h])} | `{m['file'][:44]}`（{m['tool']}） | {m['call_at']} | {m['gap_s']} |")
    L += ["", "## 4. 局限\n", "- 模型字符串是工具自己的记录，不是对底层权重的验证。",
          "- 调用时间是会话里发出调用的时间，提交时间是 git 记录的时间，两者相差几秒到几十秒；窗口是约定值。",
          "- 没有匹配到会话的提交，可能由其他窗口、其他工具或你本人发起，也可能该会话文件不在导出范围内。",
          "- 「写入类工具」只看工具的路径参数，不看写入的内容；「命令中提到」只说明命令文本里出现过该文件名，不说明写入。",
          "- Claude 的本会话文件仍在增长，摘录的是复制时刻的快照。"]
    return "\n".join(L) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--exports", default=str(DEFAULT_EXPORTS))
    ap.add_argument("--out-dir", default=str(HERE))
    args = ap.parse_args(argv)
    files = sorted(Path(args.exports).rglob("*.jsonl"))
    if not files:
        print("no .jsonl files found in", args.exports, file=sys.stderr)
        return 1
    results = [extract_file(f) for f in files]
    commits = git_commits()
    matches = match_commits(results, commits)
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "SESSION_META.md").write_text(render(results, matches, commits), encoding="utf-8")
    (out / "session_meta.json").write_text(json.dumps({"files": results, "commit_matches": matches}, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {out/'SESSION_META.md'} for {len(files)} files; {len(matches)} commits matched")
    return 0


if __name__ == "__main__":
    sys.exit(main())
