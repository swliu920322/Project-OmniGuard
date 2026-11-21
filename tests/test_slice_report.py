"""slice_report.py: read-only slices of the round-2 comparison. Fake records for the logic; the published files only for the totals check."""
import hashlib
import importlib.util
import pathlib

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("slice_report", ROOT / "eval/experiments/note_vs_rules_v2/slice_report.py")
S = importlib.util.module_from_spec(spec)
spec.loader.exec_module(S)

FAMILIES = {"ZZ-FAM-1": {"phenomenon": "ZZ-PHENOMENON-1"}, "ZZ-FAM-2": {"phenomenon": "ZZ-PHENOMENON-2"}}


def fake(n_per_family=3):
    """Two fake families x three languages. Model is right on 5 of 6, R3 on 2 of 6; one record carries note-only risk."""
    audit, test = [], []
    langs = ("zh", "en", "mixed")
    i = 0
    for fam in FAMILIES:
        for lang in langs:
            i += 1
            gold = "NEGATED" if fam == "ZZ-FAM-1" else "HISTORICAL"
            model_ok = i != 6
            r3_ok = i in (1, 4)
            audit.append({"id": f"ZZ-ID-{i}", "family_id": fam, "gold_note_status": gold, "note_only_risk": i == 2,
                          "predictions": {s: {"note_status": gold if ok else "IRRELEVANT"} for s, ok in
                                          (("model", model_ok), ("R1", False), ("R2", False), ("R3", r3_ok))}})
            test.append({"id": f"ZZ-ID-{i}", "family_id": fam, "language": lang})
    return audit, test


def test_rows_and_cuts_count_correct_note_statuses():
    rows = S.build_rows(*fake(), FAMILIES)
    assert len(rows) == 6
    assert sum(r["ok"]["model"] for r in rows) == 5
    assert sum(r["ok"]["R3"] for r in rows) == 2
    by_status = S.cut(rows, lambda r: r["gold"])
    assert by_status["NEGATED"]["n"] == 3 and by_status["NEGATED"]["model"] == 3
    assert by_status["HISTORICAL"]["model"] == 2
    assert S.cut(rows, lambda r: r["risk"])[True]["n"] == 1


def test_pair_cells_add_up_and_families_summarised():
    rows = S.build_rows(*fake(), FAMILIES)
    cells = S.pair_cells(rows)
    assert sum(cells.values()) == 6
    assert cells == {"both": 2, "model_only": 3, "r3_only": 0, "neither": 1}
    summary, _ = S.family_summary(rows)
    assert summary["families"] == 2
    assert summary["model"] == {"all_right": 1, "some_wrong": 1, "all_wrong": 0}


def test_totals_check_reports_a_mismatch():
    rows = S.build_rows(*fake(), FAMILIES)
    good = {"n": 6, "model": 5, "R3": 2, "pair": {"both": 2, "model_only": 3, "r3_only": 0, "neither": 1}}
    assert S.check_totals(rows, good) == []
    bad = dict(good, model=6)
    assert any("model" in p for p in S.check_totals(rows, bad))


def test_mismatched_inputs_are_refused():
    audit, test = fake()
    with pytest.raises(ValueError):
        S.build_rows(audit[:-1], test, FAMILIES)
    test[0] = dict(test[0], family_id="ZZ-FAM-2")
    with pytest.raises(ValueError):
        S.build_rows(audit, test, FAMILIES)
    with pytest.raises(ValueError):
        S.build_rows(*fake(), {"ZZ-FAM-1": {}})


def test_report_has_roles_table_caveats_and_no_new_claims():
    rows = S.build_rows(*fake(), FAMILIES)
    md, data = S.render(rows, FAMILIES, {"x.jsonl": "0" * 64}, [])
    assert "## 0. 谁做了什么" in md and "不是新成绩" in md and "不说明什么" in md
    assert "ZZ-ID-6" in md and "ZZ-PHENOMENON-2" in md
    assert data["model_errors"][0]["id"] == "ZZ-ID-6"
    assert "提升" not in md


def test_published_ledger_reproduces_the_published_totals(tmp_path):
    evidence = ROOT / "eval/experiments/note_vs_rules_v2/evidence"
    watched = [evidence / "review/record_audit.jsonl", evidence / "data/test_set.jsonl", evidence / "data/families.json"]
    before = [hashlib.sha256(p.read_bytes()).hexdigest() for p in watched]
    assert S.main(["--out-dir", str(tmp_path)]) == 0
    assert (tmp_path / "SLICE_REPORT.md").exists() and (tmp_path / "slice_report.json").exists()
    assert [hashlib.sha256(p.read_bytes()).hexdigest() for p in watched] == before
