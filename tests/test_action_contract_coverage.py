"""action_contract_coverage.py: every listed bad Compiler output is stopped by the code layer and every valid one passes."""
import importlib.util
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("action_contract_coverage", ROOT / "eval/action_contract_coverage.py")
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)


def test_every_listed_bad_output_is_stopped_and_every_valid_one_passes():
    rows = A.run()
    assert len(rows) >= 20
    assert [r["category"] for r in rows if not r["ok"]] == []


def test_the_check_can_fail():
    """A case wrongly labelled 'must be stopped' is reported as not ok, so the table cannot pass by construction."""
    rows = A.run([("a valid stop, mislabelled", [{"action": "stop"}], A.GO, A.DEFAULT_ALLOWED_ACTIONS, True)])
    assert rows[0]["ok"] is False


def test_the_report_lists_both_groups(tmp_path):
    out = tmp_path / "c.md"
    assert A.main([str(out)]) == 0
    text = out.read_text(encoding="utf-8")
    assert "应当被挡住的" in text and "应当被接受的" in text and "没有调用模型" in text
