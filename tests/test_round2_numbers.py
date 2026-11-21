"""The round-2 headline numbers have one machine-readable source (note_compare.json); every document that quotes them quotes them the same way.

Documents may repeat the numbers, readers need them in several places. What must not happen is a number changed in one place and left in ten others.
The check reads the numbers from the sealed comparison, requires the key documents to contain them, and looks for any statement that gives R3 or
the model a different score on the 180 records.
"""
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / "eval/experiments/note_vs_rules_v2/results/20261115T152854Z_main_real_e5fd14c2/note_compare.json"
MUST_QUOTE = ["eval/experiments/note_vs_rules_v2/RESULTS.md", "eval/EVIDENCE_INDEX.md", "study/interview/INTERVIEW_DEEP_DRILL_zh.md"]
SKIP = re.compile(r"(^|/)(archive|process|runs|results|measured|dryrun|exports|original|reproduction_logs|reference-documents)/|^docs/adrs/|^docs/reference/")


def canonical():
    d = json.loads(SOURCE.read_text(encoding="utf-8"))
    note = {k: d["schemes"][k]["note_status"] for k in ("model", "R3")}
    diff = d["comparisons"]["model_vs_R3"]["note_accuracy_difference"]
    return {"n": note["model"]["n"], "model": note["model"]["correct"], "R3": note["R3"]["correct"], "diff": diff["difference_points"], "ci": diff["ci95_points"]}


def tracked_markdown():
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True).stdout.decode("utf-8").split("\0")
    return [f for f in out if f.endswith(".md") and not SKIP.search(f)]


def contradictions(text, c):
    """Lines that quote one sealed score next to a different score for the other system (changed in one place, left in the other).

    Sensitivity analyses give other numbers on purpose (they say so in the line); they are not flagged because they quote neither sealed score.
    """
    bad = []
    for line in text.splitlines():
        has_model, has_r3 = f"{c['model']}/{c['n']}" in line, f"{c['R3']}/{c['n']}" in line
        if not (has_model or has_r3):
            continue
        for who, ok, other in (("R3", c["R3"], has_model), ("模型", c["model"], has_r3)):
            if not other:
                continue
            for m in re.finditer(rf"{who}[^0-9\n。；;]{{0,12}}(\d{{1,3}})/{c['n']}", line):
                if int(m.group(1)) not in {ok, c["n"]}:
                    bad.append(m.group(0))
    return bad


def test_the_sealed_comparison_still_says_what_the_documents_say():
    c = canonical()
    assert (c["model"], c["R3"], c["n"]) == (173, 77, 180) and c["diff"] == 53.33 and c["ci"] == [43.33, 63.33]


def test_the_key_documents_quote_the_sealed_numbers():
    c = canonical()
    for doc in MUST_QUOTE:
        text = (ROOT / doc).read_text(encoding="utf-8")
        for token in (f"{c['model']}/{c['n']}", f"{c['R3']}/{c['n']}", f"{c['diff']}"):
            assert token in text, (doc, token)


def test_no_document_gives_r3_or_the_model_another_score():
    c = canonical()
    found = {f: contradictions((ROOT / f).read_text(encoding="utf-8", errors="ignore"), c) for f in tracked_markdown()}
    assert {f: v for f, v in found.items() if v} == {}


def test_the_check_can_fail():
    c = canonical()
    assert contradictions("模型 173/180，R3 76/180", c) == ["R3 76/180"]
    assert contradictions("模型 172/180，R3 77/180", c) == ["模型 172/180"]
    assert contradictions("R3 77/180 and 模型 173/180, 主类 180/180", c) == []
    assert contradictions("换一种读法后模型 178/180，R3 75/180", c) == []  # a sensitivity analysis quotes neither sealed score
