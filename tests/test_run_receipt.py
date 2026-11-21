"""run_receipt.py: a read-only summary of sealed run files. Fake runs for the logic; the published runs only to check nothing is changed."""
import hashlib
import importlib.util
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("run_receipt", ROOT / "eval/provenance/run_receipt.py")
RR = importlib.util.module_from_spec(spec)
spec.loader.exec_module(RR)


def write_run(tmp_path, cfg=None, summary=None, name="ZZ-RUN-1"):
    d = tmp_path / name
    d.mkdir()
    (d / "summary.json").write_text(json.dumps(summary if summary is not None else {"run_id": name, "status": "completed", "calls_recorded": 3}))
    if cfg is not None:
        (d / "config.json").write_text(json.dumps(cfg))
    return d


def rows_of(directory):
    return {item: (text, where) for item, text, where in RR.receipt(RR.load_run(directory))}


def test_recorded_items_are_shown_with_their_file(tmp_path):
    cfg = {"request_settings": {"sdk_max_retries": 0, "sdk_timeout_s": 60.0}, "frozen_tag": "ZZ-TAG", "dataset_sha256": {"main": "a" * 64}}
    rows = rows_of(write_run(tmp_path, cfg))
    assert "重试次数=0" in rows["请求设置与重试"][0] and rows["请求设置与重试"][1] == "config.json"
    assert "frozen_tag=ZZ-TAG" in rows["回滚点"][0]
    assert "aaaaaaaaaaaa…" in rows["数据"][0] and "a" * 64 not in rows["数据"][0]
    assert "status=completed" in rows["结束情况"][0] and rows["结束情况"][1] == "summary.json"


def test_unrecorded_items_stay_unrecorded_and_nothing_is_guessed(tmp_path):
    rows = rows_of(write_run(tmp_path))  # no config.json at all
    for item in ("请求设置与重试", "授权", "数据", "回滚点", "预算上限", "模型"):
        assert rows[item][0] == RR.MISSING and rows[item][1] == "", item


def test_long_text_is_marked_as_cut_and_short_text_is_not():
    assert RR.fmt("x" * 200).endswith("（全文见来源文件）")
    assert RR.fmt("short") == "short"
    assert RR.fmt({"a": 1, "b": None}) == "a:1"
    assert RR.fmt("f" * 40) == "f" * 12 + "…"


def test_directories_without_a_summary_are_ignored(tmp_path):
    (tmp_path / "ZZ-empty").mkdir()
    write_run(tmp_path, name="ZZ-RUN-2")
    assert [r["dir"] for r in RR.find_runs([tmp_path])] == ["ZZ-RUN-2"]


def test_published_runs_are_summarised_without_changing_them(tmp_path):
    watched = [p for root in RR.ROOTS for p in root.rglob("*") if p.is_file()]
    before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in watched}
    out = tmp_path / "receipts.md"
    assert RR.main(["--out", str(out)]) == 0
    assert {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in watched} == before
    text = out.read_text(encoding="utf-8")
    assert "20261115T152854Z_main_real_e5fd14c2" in text and "20261107T113942Z_main_real_094cb6c1" in text
    runs = {r["dir"]: r for r in RR.find_runs()}
    assert "重试次数=0" in {i: t for i, t, _ in RR.receipt(runs["20261115T152854Z_main_real_e5fd14c2"])}["请求设置与重试"]
    assert {i: t for i, t, _ in RR.receipt(runs["20261107T113942Z_main_real_094cb6c1"])}["请求设置与重试"] == RR.MISSING
