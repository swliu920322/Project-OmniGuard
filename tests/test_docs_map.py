"""Every document of the evidence, the newcomer guides and the study material is reachable from another document, so nothing becomes an orphan.

A document counts as linked when another tracked markdown file links to it with a relative link or names its repository path in backticks.
Generated run and result folders, raw archives and the earlier platform documents (indexed by their own INDEX files) are outside the rule.
"""
import os
import pathlib
import re
import subprocess
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]
LINK = re.compile(r"\]\(<?([^)\s>#]+)(?:#[^)>]*)?>?\)")
TICKED = re.compile(r"`([A-Za-z0-9_./\-]+\.md)`")
EXEMPT = re.compile(r"(^|/)(runs|results|measured|dryrun|diagnostics|exports|original|reproduction_logs|reference-documents|history|current)/"
                    r"|^docs/adrs/|^docs/reference/|^docs/tutorials/|^src/|^\.claude/|^\.azure/|^\.local-archives|^scripts/")


def tracked_markdown():
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True).stdout.decode("utf-8").split("\0")
    return [f for f in out if f.endswith(".md")]


def referenced(mds):
    seen = set()
    for f in mds:
        if not (ROOT / f).is_file():  # a name made up by a test
            continue
        text = (ROOT / f).read_text(encoding="utf-8", errors="ignore")
        for m in LINK.finditer(text):
            target = m.group(1)
            if re.match(r"(https?:|mailto:|#)", target) or target.startswith("/"):
                continue
            seen.add(os.path.normpath(os.path.join(os.path.dirname(f), urllib.parse.unquote(target))))
        for ticked in TICKED.findall(text):
            seen.add(os.path.normpath(ticked))
            seen.add(os.path.normpath(os.path.join(os.path.dirname(f), ticked)))
    return seen


def orphans(mds):
    seen = referenced(mds)
    return [f for f in mds if re.match(r"(eval|docs|study)/", f) and not EXEMPT.search(f) and f not in seen]


def test_no_document_is_left_without_a_link_to_it():
    assert orphans(tracked_markdown()) == [], "link these from an index (eval/README.md, docs/README.md, study/README.md) or archive them"


def test_the_rule_can_fail():
    """A document nobody links to must be reported; one that something links to must not."""
    mds = tracked_markdown() + ["eval/ZZ_NOBODY_LINKS_HERE.md"]
    assert "eval/ZZ_NOBODY_LINKS_HERE.md" in orphans(mds)
    assert "eval/LIMITATIONS.md" not in orphans(mds)


def test_the_three_audiences_have_their_own_front_door():
    for door in ("eval/README.md", "docs/guide/README.md", "study/README.md"):
        assert (ROOT / door).is_file(), door
    assert "eval/interview" not in {str(p.relative_to(ROOT)) for p in (ROOT / "eval").iterdir() if p.is_dir()}
