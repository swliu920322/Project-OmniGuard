import os
import re
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
}
DOC_TYPES = {"adr", "blueprint", "specification", "tutorial", "playbook", "theorem"}
REQUIRED_KEYS = ["id", "title", "summary", "domains", "perspectives", "layers", "doc_type"]


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

    # 枚举校验（与 @omnidocs/schema 枚举一致）
    for p in frontmatter["perspectives"]:
        assert p in PERSPECTIVES, f"Unknown perspective '{p}' in: {filepath}"
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


def test_default_manifest_exists_and_contract_valid():
    """契约产物存在，且 contractVersion 大版本为 1。"""
    import json

    manifest_path = os.path.join("generated", "docs", "docs-manifest.json")
    assert os.path.exists(manifest_path), "docs-manifest.json not built — run `make docs-build`"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    assert manifest["contractVersion"].startswith("1."), "contractVersion major must be 1 (CPV)"
    assert manifest["docCount"] == len(manifest["docs"])
    assert manifest["docCount"] >= len(get_all_markdown_files()) - 5  # 允许少量敏感/预览文档未入册