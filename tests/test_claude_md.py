"""CLAUDE.md stays short and its checkable claims stay true: size budget, make targets, file paths, pytest option, frozen-file names."""
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
CLAUDE = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")

# Budget for always-loaded instructions: not more than 60 lines and 8 KB. CLAUDE.md is at 57 lines and about 7.3 KB, so the cap is
# a guard against slow growth; when it fails, cut text before raising the cap (a skill or instruction that grows without limit dilutes the rules that matter).
MAX_LINES = 60
MAX_BYTES = 8192


def tracked_files():
    out = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return [line for line in out.splitlines() if line]


def is_ignored(path):
    return subprocess.run(["git", "check-ignore", "-q", path], cwd=ROOT).returncode == 0


def make_targets(makefile_text):
    return set(re.findall(r"^([A-Za-z0-9_-]+):", makefile_text, re.M))


def mentioned_make_targets(text):
    names = set()
    for group in re.findall(r"make ([a-z][a-z0-9_|-]*)", text):
        names.update(group.split("|"))
    return names


def path_tokens(text):
    """Backticked tokens that look like repository paths or file names; URLs, routes, commands and patterns are left out."""
    out = set()
    for tok in re.findall(r"`([^`\s]+)`", text):
        tok = tok.rstrip(",.;:)")
        if tok.startswith(("/", "-", "$", "http")) or any(c in tok for c in "*<>|") or "::" in tok:
            continue
        if tok.startswith(("python", "make", "npm")):
            continue
        if "/" in tok or tok.endswith((".py", ".md", ".json", ".ts", ".sh")):
            out.add(tok)
    return out


def missing_paths(text, tracked):
    bad = []
    for tok in sorted(path_tokens(text)):
        if (ROOT / tok).exists() or is_ignored(tok):
            continue
        if tok.endswith("/"):
            if any(f"/{tok}" in f"/{f}" for f in tracked):
                continue
        elif any(f == tok or f.endswith("/" + tok) for f in tracked):
            continue
        bad.append(tok)
    return bad


def over_budget(text):
    problems = []
    if text.count("\n") > MAX_LINES:
        problems.append(f"{text.count(chr(10))} lines, budget {MAX_LINES}")
    if len(text.encode("utf-8")) > MAX_BYTES:
        problems.append(f"{len(text.encode('utf-8'))} bytes, budget {MAX_BYTES}")
    return problems


def test_claude_md_stays_within_its_size_budget():
    assert over_budget(CLAUDE) == []


def test_every_make_target_named_in_claude_md_exists():
    targets = make_targets((ROOT / "Makefile").read_text(encoding="utf-8"))
    missing = mentioned_make_targets(CLAUDE) - targets
    assert not missing, f"CLAUDE.md names make targets that do not exist: {sorted(missing)}"


def test_every_path_named_in_claude_md_exists():
    bad = missing_paths(CLAUDE, tracked_files())
    assert not bad, f"CLAUDE.md names paths that are neither tracked nor ignored: {bad}"


def test_pytest_option_described_in_claude_md_is_set():
    assert "`-x`" in CLAUDE
    assert '"-v -x ' in (ROOT / "pyproject.toml").read_text(encoding="utf-8")


def test_frozen_files_named_in_claude_md_are_in_the_v2_freeze_list():
    frozen = {pathlib.PurePosixPath(p).name for p in json.loads((ROOT / "eval/experiments/note_vs_rules_v2/V2_FREEZE.json").read_text())["files"]}
    for name in ("rules.py", "pipeline.py", "prompt.py", "run_formal.py", "run_note_compare.py", "r3.py"):
        assert name in CLAUDE, name
        assert name in frozen, f"{name} is named as frozen in CLAUDE.md but is not in V2_FREEZE.json"


def test_the_checks_can_fail():
    """A stale instruction file must be caught, otherwise the tests above prove nothing."""
    stale = "Run `make no-such-target`, then edit `eval/no_such_dir/ghost_file.py`."
    assert mentioned_make_targets(stale) - make_targets((ROOT / "Makefile").read_text(encoding="utf-8")) == {"no-such-target"}
    assert missing_paths(stale, tracked_files()) == ["eval/no_such_dir/ghost_file.py"]
    assert over_budget("x\n" * (MAX_LINES + 1)) and over_budget("x" * (MAX_BYTES + 1))
    assert over_budget("short\n") == []
