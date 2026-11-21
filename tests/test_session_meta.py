"""extract_session_meta.py: metadata-only extract from session exports. Fake sessions in three formats; nothing from a real session is read."""
import importlib.util
import json
import pathlib
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("extract_session_meta", ROOT / "eval/provenance/extract_session_meta.py")
X = importlib.util.module_from_spec(spec)
spec.loader.exec_module(X)

SECRET = "ZZ-SECRET-sk-0123456789abcdefghijkl"


def write(tmp_path, name, rows):
    p = tmp_path / name
    p.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    return p


def claude_rows():
    def asst(ts, name, inp):
        return {"type": "assistant", "uuid": "u", "timestamp": ts, "effort": "medium",
                "message": {"model": "ZZ-claude-model", "content": [{"type": "tool_use", "name": name, "input": inp}]}}
    return [asst("2026-01-01T00:00:10.500Z", "Bash", {"command": f"git commit -m 'ZZ' # {SECRET}"}),
            asst("2026-01-01T00:00:20Z", "Write", {"file_path": "/x/validate_rationales.py", "content": f"mentions git commit and r3.py {SECRET}"}),
            asst("2026-01-01T00:00:30Z", "Write", {"file_path": "/x/notes.md", "content": "text about validate_rationales.py and git commit"}),
            asst("2026-01-01T00:00:40Z", "Bash", {"command": "cat /x/validate_rationales.py"})]


def gemini_rows():
    return [{"type": "PLANNER_RESPONSE", "step_index": 1, "model": "ZZ-gemini-model", "created_at": "2026-01-01T00:01:00Z",
             "tool_calls": [{"name": "run_command", "args": {"CommandLine": "git add . && git commit -m ZZ"}}]},
            {"type": "GENERIC", "step_index": 2, "created_at": "2026-01-01T00:02:00Z",
             "tool_calls": [{"name": "edit_file", "args": {"Path": "/x/router_v2/rules.py", "Target": "a", "Replacement": SECRET}}]}]


def codex_rows():
    return [{"type": "session_meta", "timestamp": "2026-01-01T00:03:00Z", "payload": {"base_instructions": {"provenance": {"model": "ZZ-astra"}}}},
            {"type": "turn_context", "timestamp": "2026-01-01T00:03:01Z", "payload": {"model": "ZZ-sol", "effort": "high"}},
            {"type": "response_item", "timestamp": "2026-01-01T00:03:02Z", "payload": {"type": "function_call", "name": "exec", "arguments": "git commit -m ZZ"}}]


def test_models_effort_times_and_commit_calls_are_extracted_in_each_format(tmp_path):
    c = X.extract_file(write(tmp_path, "c.jsonl", claude_rows()))
    g = X.extract_file(write(tmp_path, "g.jsonl", gemini_rows()))
    x = X.extract_file(write(tmp_path, "x.jsonl", codex_rows()))
    assert (c["tool"], g["tool"], x["tool"]) == ("claude", "antigravity", "codex")
    assert c["models"]["message.model"] == {"ZZ-claude-model": 4} and c["effort"]["effort"] == {"medium": 4}
    assert g["models"]["model"] == {"ZZ-gemini-model": 1}
    assert x["models"]["session_meta.provenance.model"] == {"ZZ-astra": 1} and x["models"]["turn_context.model"] == {"ZZ-sol": 1} and x["effort"]["turn_context.effort"] == {"high": 1}
    assert c["git_commit_calls"] == ["2026-01-01T00:00:10Z"] and g["git_commit_calls"] == ["2026-01-01T00:01:00Z"] and x["git_commit_calls"] == ["2026-01-01T00:03:02Z"]


def test_only_a_path_argument_counts_as_a_write_and_only_a_command_counts_as_a_commit(tmp_path):
    c = X.extract_file(write(tmp_path, "c.jsonl", claude_rows()), watch=["validate_rationales.py"])
    t = c["touches"]["validate_rationales.py"]
    assert t["write_tool"] == ["2026-01-01T00:00:20Z"]            # the write whose path names the file
    assert t["command_mentions"] == ["2026-01-01T00:00:40Z"]       # a command that mentions it; the note that merely talks about it is not counted
    assert len(c["git_commit_calls"]) == 1                          # file contents that contain "git commit" are not commits
    g = X.extract_file(write(tmp_path, "g.jsonl", gemini_rows()), watch=["router_v2/rules.py"])
    assert g["touches"]["router_v2/rules.py"]["write_tool"] == ["2026-01-01T00:02:00Z"]


def test_no_command_text_or_file_content_reaches_the_output(tmp_path):
    results = [X.extract_file(write(tmp_path, n, r)) for n, r in (("c.jsonl", claude_rows()), ("g.jsonl", gemini_rows()), ("x.jsonl", codex_rows()))]
    text = X.render(results, {}, []) + json.dumps(results)
    assert SECRET not in text and "ZZ-SECRET" not in text and "git commit -m" not in text


def test_a_commit_is_matched_to_the_session_that_called_it_just_before(tmp_path):
    results = [X.extract_file(write(tmp_path, "c.jsonl", claude_rows())), X.extract_file(write(tmp_path, "g.jsonl", gemini_rows()))]
    ts = lambda s: datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    commits = [("aaaaaaa", ts("2026-01-01T00:00:11")), ("bbbbbbb", ts("2026-01-01T00:01:05")), ("ccccccc", ts("2026-01-01T05:00:00"))]
    m = X.match_commits(results, commits, window=20)  # the two fake sessions call 50 s apart, so a 20 s window separates them
    assert [x["file"] for x in m["aaaaaaa"]] == ["c.jsonl"] and m["aaaaaaa"][0]["gap_s"] == 1
    assert [x["file"] for x in m["bbbbbbb"]] == ["g.jsonl"]
    assert "ccccccc" not in m  # no call in the window: it stays unmatched, not guessed


def test_two_sessions_matching_one_commit_are_both_listed(tmp_path):
    a = X.extract_file(write(tmp_path, "a.jsonl", claude_rows()))
    b = X.extract_file(write(tmp_path, "b.jsonl", claude_rows()))
    m = X.match_commits([a, b], [("ddddddd", datetime(2026, 1, 1, 0, 0, 12, tzinfo=timezone.utc))])
    assert sorted(x["file"] for x in m["ddddddd"]) == ["a.jsonl", "b.jsonl"]
