"""The public documents quote the formal results correctly, link to files that exist, and do not use wording the evidence policy forbids."""
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
VER = json.loads((ROOT / "eval/formal/results/VERIFICATION.json").read_text())
DOCS = ["README.md", "README_zh.md", "eval/report.md", "eval/EVIDENCE_INDEX.md", "eval/LIMITATIONS.md", "eval/REPRODUCE.md", "eval/ORAL_CARDS_zh.md", "eval/LATENCY_COST.md", "eval/LATENCY_EVIDENCE.md", "eval/ORAL_EXPLAINED_zh.md",
        "docs/evidence/README.md", "eval/formal/FORMAL_PLAN.md", "docs/architecture/README.md", "ARCHITECTURE.md", "eval/REPRODUCE_TEST_PROMPT.md", "eval/reproduction_logs/2026-11-07-gemini-level1.md", "eval/reproduction_logs/2026-11-07-gemini-level1-round2.md"]
TEXT = {d: (ROOT / d).read_text() for d in DOCS}


def test_both_readmes_quote_the_same_verified_numbers():
    for name in ("README.md", "README_zh.md"):
        t = TEXT[name]
        for needle in ("300/300", "34", "634", f"{VER['tokens_booked']:,}", "281/300", "280/300", "23/72", "15/72", "98.74", "0.285", "eval-formal-v1", "13", "10", "32"):
            assert needle in t, (name, needle)
    assert VER["api_requests"] == 634 and VER["tokens_booked"] == 630792 and VER["usd_booked_at_configured_rates"] == "0.284948" and VER["distinct_test_records"] == 300


def test_the_evidence_policy_and_report_agree_with_the_verification_record():
    t = TEXT["docs/evidence/README.md"]
    for needle in ("300/300", "281/300", "280/300", "634 API requests", "630,792", "0.285", "34 families", "13 invalid inputs", "10 injected faults"):
        assert needle in t, needle
    r = TEXT["eval/report.md"]
    assert "634次API请求、630,792 token" in r and "0.284948" in r and "eval-formal-v1" in r


def test_forbidden_wording_is_absent_from_the_readmes_and_the_report():
    for name in ("README.md", "README_zh.md", "eval/report.md"):
        t = TEXT[name]
        for banned in ("零风险", "工业级安全", "工业级", "生产准确率100", "zero risk", "zero-risk", "industrial-grade", "industrial grade", "100% in production", "from X to Y", "提升至", "improved from", "人工专家标注"):
            assert banned not in t, (name, banned)


def test_the_readmes_state_the_boundaries():
    en, zh = TEXT["README.md"], TEXT["README_zh.md"]
    for needle in ("Tenant-Alpha-Extended", "IoT Hub path", "not an improvement", "34 families", "synthetic", "unverified"):
        assert needle in en, needle
    for needle in ("Tenant-Alpha-Extended", "IoT Hub", "不是提升", "34 个家族", "合成", "未验证"):
        assert needle in zh, needle


def test_every_relative_link_in_the_public_documents_points_to_a_file_that_exists():
    for name in DOCS:
        base = (ROOT / name).parent
        for target in re.findall(r"\]\(([^)#\s]+)(?:#[^)]*)?\)", TEXT[name]):
            if re.match(r"^[a-z]+://", target) or target.startswith("mailto:"):
                continue
            assert (base / target).exists(), (name, target)


def test_the_oral_cards_have_fifteen_questions_with_four_lines_each():
    cards = re.split(r"\n## \d+\. ", TEXT["eval/ORAL_CARDS_zh.md"])[1:]
    assert len(cards) == 15
    for c in cards:
        body = [ln for ln in c.split("\n")[1:] if ln.strip() and not ln.startswith("---") and not ln.startswith("**不要说")]
        assert [ln[0] for ln in body[:4]] == ["①", "②", "③", "④"], c[:40]
    t = TEXT["eval/ORAL_CARDS_zh.md"]
    assert "五类模型错误" in t and "本轮没有" in t                                                   # named only in the do-not-say list


def test_the_reproduction_instructions_name_files_and_commands_that_exist():
    for f in ("eval/baseline_v1/verify.sh", "eval/formal/run_formal.py", "eval/baseline_b/run_dev_eval.py", "eval/formal/results/SHA256SUMS", "eval/dev/dev_set.jsonl",
              "src/cloud-orchestrator/requirements.txt", "eval/acceptance/FROZEN_MANIFEST.json"):
        assert (ROOT / f).exists(), f
    r = TEXT["eval/REPRODUCE.md"]
    assert "does not reproduce the formal result" in r
    m = json.loads((ROOT / "eval/acceptance/FROZEN_MANIFEST.json").read_text())
    assert m["sha256"]["test_set.jsonl"].startswith("68e08ed9") and m["sha256"]["stress_cases.jsonl"].startswith("dc888af0")
    assert "private" in r and "custodian" in r


def test_the_formal_tag_points_where_the_report_says():
    out = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "eval-formal-v1^{commit}"], capture_output=True, text=True)
    if out.returncode == 0:                                                                          # tags are not part of every archive of the repository
        assert out.stdout.strip().startswith("fec6acf")


def test_the_reproduction_guide_runs_level_one_on_main_and_the_real_run_from_the_tag_worktree():
    r = TEXT["eval/REPRODUCE.md"]
    assert "Run these on `main`" in r and "git worktree add ../omniguard-formal eval-formal-v1" in r and "git diff --stat eval-formal-v1 HEAD" in r
    assert "git checkout eval-formal-v1" not in r                                                   # the tag does not contain the results or this guide


def test_the_stranger_test_prompt_forbids_private_data_model_calls_and_repairs():
    t = TEXT["eval/REPRODUCE_TEST_PROMPT.md"]
    for needle in ("不得调用任何模型 API", "/private/tmp", "OmniGuard-private", "不要“修”问题", "不要编造", "10 分钟", "不要写“已验收”"):
        assert needle in t, needle


def test_the_reproduction_guide_carries_the_fixes_from_the_stranger_rehearsal():
    r = TEXT["eval/REPRODUCE.md"]
    assert "python3 -m venv .venv" in r and "from the repository root" in r and "OUT=$(mktemp -d)" in r and "/tmp/omniguard" not in r
    assert "exits with code 3" in r and "395 passed at commit 3db72fa" in r and "Windows is untested" in r
    log = TEXT["eval/reproduction_logs/2026-11-07-gemini-level1.md"]
    assert "self-reported" in log and "not the human stranger" in log and "verbatim and unedited" in log and "395 passed" in log
    assert "level 1 only" in TEXT["eval/EVIDENCE_INDEX.md"] and "not a human" in TEXT["eval/EVIDENCE_INDEX.md"]


def test_round_two_log_is_saved_verbatim_and_its_limits_are_stated():
    t = TEXT["eval/reproduction_logs/2026-11-07-gemini-level1-round2.md"]
    for needle in ("verbatim and unedited", "Self-reported", "not the human stranger", "Less complete than the prompt asked for", "1 分 48 秒", "396 passed"):
        assert needle in t, needle
    assert "two AI-agent rehearsals" in TEXT["eval/EVIDENCE_INDEX.md"]
