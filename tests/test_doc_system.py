import os
import re
from pathlib import Path
from urllib.parse import unquote

import yaml
import pytest

DOCS_DIR = "docs"
# 过时文档不纳入索引门禁（与 @omnidocs/indexer 的 DEFAULT_IGNORES 保持一致）
SKIP_PREFIXES = ("archive/",)

PERSPECTIVES = {
    "academic-research",
    "cloud-architecture",
    "frontend-engineering",
    "enterprise-audit",
    # 用户自定义开放标签（与 @omnidocs/schema 开放 taxonomy 对齐）
    "product-strategy",
    "architecture-design",
}
DOMAINS = {
    "cyber-physical-safety",
    "multi-agent",
    "zero-trust-network",
    "edge-inference",
    "iac-bicep",
    "finops",
    "observability",
    "iot-telemetry",
    # 用户自定义开放标签
    "product-design",
    "ai-systems",
}
DOC_TYPES = {"adr", "blueprint", "specification", "tutorial", "playbook", "theorem"}
REQUIRED_KEYS = [
    "id",
    "title",
    "summary",
    "version",
    "updated_at",
    "domains",
    "perspectives",
    "layers",
    "doc_type",
    "status",
]

REPO_ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_LINK_RE = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")


def get_all_markdown_files():
    md_files = []
    for root, _, files in os.walk(DOCS_DIR):
        for f in files:
            if not f.endswith(".md"):
                continue
            rel = os.path.relpath(os.path.join(root, f), DOCS_DIR)
            if rel.startswith(SKIP_PREFIXES):
                continue
            md_files.append(rel)
    return sorted(md_files)


@pytest.mark.parametrize("filepath", get_all_markdown_files())
def test_markdown_frontmatter_validity(filepath):
    """所有 docs/**/*.md（排除 archive）必须拥有完整合规的 frontmatter。"""
    abs_path = os.path.join(DOCS_DIR, filepath)
    with open(abs_path, "r", encoding="utf-8") as f:
        content = f.read()

    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    assert match is not None, f"Document missing YAML frontmatter: {filepath}"

    frontmatter = yaml.safe_load(match.group(1))
    assert isinstance(frontmatter, dict), f"Invalid YAML frontmatter structure: {filepath}"

    for key in REQUIRED_KEYS:
        assert key in frontmatter, f"Missing required frontmatter key '{key}' in: {filepath}"
        assert frontmatter[key], f"Frontmatter key '{key}' is empty in: {filepath}"

    # 标签校验：内置集强校验 + 开放 taxonomy 允许用户自定义（仅格式约束，与 schema 一致）
    for p in frontmatter["perspectives"]:
        if p in PERSPECTIVES:
            continue
        assert re.fullmatch(r"[a-z0-9][a-z0-9-_]*", p), (
            f"Invalid perspective tag '{p}' in: {filepath}"
        )
    for d in frontmatter["domains"]:
        if d in DOMAINS:
            continue
        assert re.fullmatch(r"[a-z0-9][a-z0-9-_]*", d), (
            f"Invalid domain tag '{d}' in: {filepath}"
        )
    assert frontmatter["doc_type"] in DOC_TYPES, (
        f"Unknown doc_type '{frontmatter['doc_type']}' in: {filepath}"
    )

    # 代码可达性校验（死链预防）
    for ref in frontmatter.get("code_refs", []):
        assert os.path.exists(ref), f"Dead code reference '{ref}' defined in {filepath}"
    for ref in frontmatter.get("test_refs", []):
        assert os.path.exists(ref), f"Dead test reference '{ref}' defined in {filepath}"


def test_frontmatter_coverage_full():
    """Gate 2: docs/ 下 100% Markdown（排除 archive）具备有效 frontmatter。"""
    uncovered = []
    for filepath in get_all_markdown_files():
        with open(os.path.join(DOCS_DIR, filepath), "r", encoding="utf-8") as f:
            content = f.read()
        match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
        if match is None:
            uncovered.append(filepath)
            continue
        fm = yaml.safe_load(match.group(1))
        if not isinstance(fm, dict) or not all(fm.get(k) for k in REQUIRED_KEYS):
            uncovered.append(filepath)
    assert not uncovered, f"Documents missing valid frontmatter: {uncovered}"


def get_current_markdown_files():
    """Return maintained Markdown, excluding generated/dependency trees and archives."""
    ignored_parts = {
        ".git",
        ".next",
        ".pytest_cache",
        ".venv",
        "archive",
        "dist",
        "node_modules",
        "venv",
    }
    return sorted(
        path
        for path in REPO_ROOT.rglob("*.md")
        if not ignored_parts.intersection(path.parts)
    )


def test_current_markdown_links_are_portable_and_resolve():
    """Current docs may not depend on one developer's filesystem or dead local links."""
    broken = []
    nonportable = []

    for source in get_current_markdown_files():
        content = source.read_text(encoding="utf-8")
        for raw_target in MARKDOWN_LINK_RE.findall(content):
            target = raw_target.strip().split()[0].strip("<>")
            if not target or target.startswith(("#", "http://", "https://", "mailto:", "data:")):
                continue
            if target.startswith("file://"):
                nonportable.append((source.relative_to(REPO_ROOT), target))
                continue
            # Leading-slash links are application routes, not repository files.
            if target.startswith("/"):
                continue

            path_part = unquote(target.split("#", 1)[0])
            resolved = (source.parent / path_part).resolve()
            if not resolved.exists():
                broken.append((source.relative_to(REPO_ROOT), target))

    assert not nonportable, f"Non-portable file:// links: {nonportable}"
    assert not broken, f"Broken relative Markdown links: {broken}"


def test_default_manifest_exists_and_contract_valid():
    """契约产物存在，且 contractVersion 大版本为 1。"""
    import json

    manifest_path = os.path.join("generated", "docs", "docs-manifest.json")
    assert os.path.exists(manifest_path), "docs-manifest.json not built — run `make docs-build`"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    assert manifest["contractVersion"].startswith("1."), "contractVersion major must be 1 (CPV)"
    assert manifest["docCount"] == len(manifest["docs"])
    manifest_paths = {doc["filePath"] for doc in manifest["docs"]}
    expected_paths = {
        os.path.join("docs", filepath) for filepath in get_all_markdown_files()
    }
    assert manifest_paths == expected_paths, (
        "Documentation manifest is stale; run `make docs-build`. "
        f"Missing: {sorted(expected_paths - manifest_paths)}; "
        f"unexpected: {sorted(manifest_paths - expected_paths)}"
    )
