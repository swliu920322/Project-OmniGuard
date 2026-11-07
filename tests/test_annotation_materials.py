"""Annotation materials: the blind packet leaks nothing, the sample is the seeded stratified one, sealing precedes release, nothing needs a model."""
import json
import pathlib
import re
import shutil
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
ANN = ROOT / "eval/annotation"
for sub in ("eval/spec", "eval/dev", "eval/annotation"):
    sys.path.insert(0, str(ROOT / sub))
import annotation as A  # noqa: E402
import packets as P  # noqa: E402
import reference_labeler as R  # noqa: E402

SAMPLE = json.loads((ANN / "blind_sample.json").read_text())
PACKET = [json.loads(line) for line in (ANN / "blind_packet.jsonl").read_text().splitlines()]
MAPPING = json.loads((ANN / "mapping.json").read_text())


def test_the_files_on_disk_are_what_the_seed_regenerates():
    files = P.build()
    for name, text in files.items():
        assert (ANN / name).read_text() == text, name
    assert subprocess.run([sys.executable, str(ANN / "packets.py"), "build", "--check"], capture_output=True, text=True).returncode == 0


def test_96_items_and_a_stratified_seeded_sample_of_at_least_30_percent_and_4_per_status():
    assert SAMPLE["items"] == 96 and len(MAPPING) == 96
    assert SAMPLE["actual_fraction"] >= 0.30 and SAMPLE["seed"] == A.SAMPLE_SEED and SAMPLE["short_statuses"] == []
    for status, v in SAMPLE["per_status"].items():
        assert v["sampled"] >= 4 and v["sampled"] / v["total"] >= 0.30, status
    its = P.opaque_ids(P.items())
    again = A.stratified_sample({k: v["status"] for k, v in its.items()}, R.NOTE_STATUSES)
    assert again["ids"] == SAMPLE["ids"] and P.sha256_text("\n".join(SAMPLE["ids"])) == SAMPLE["ids_sha256"]
    assert sorted(p["item_id"] for p in PACKET) == SAMPLE["ids"]


def test_the_blind_packet_carries_the_input_text_and_nothing_that_hints_at_a_label():
    text = (ANN / "blind_packet.jsonl").read_text()
    for row in PACKET:
        assert set(row) == {"item_id", "input_text"} and re.fullmatch(r"A\d{3}", row["item_id"]) and "Operator note:" in row["input_text"]
    for leak in (*R.NOTE_STATUSES, *R.CLASSES, "family", "F-0", "F-1", "gold", "DEV-", "STR-", "status", "basis", "clauses", "special", "language", "split"):
        assert leak not in text, leak
    its = P.opaque_ids(P.items())
    assert all(row["input_text"] == its[row["item_id"]]["input_text"] for row in PACKET)


def test_opaque_ids_do_not_follow_the_source_order():
    sources = [MAPPING[k] for k in sorted(MAPPING)]
    assert sources != sorted(sources) and len(set(sources)) == 96
    assert not any(k == v for k, v in MAPPING.items())


def test_the_instructions_forbid_peeking_and_state_every_rule():
    text = (ANN / "ANNOTATOR_INSTRUCTIONS.md").read_text()
    for s in R.NOTE_STATUSES:
        assert f"`{s}`" in text
    assert "Do not" in text and "blind_results.jsonl" in text and "current state" in text
    assert not any(row["input_text"] in text for row in PACKET)


def test_the_review_packet_with_the_initial_labels_is_never_in_the_repository_and_a_seal_if_present_is_intact():
    for f in ANN.iterdir():
        if f.is_file() and f.suffix in (".json", ".jsonl", ".md", ".py") and f.name != "packets.py":
            assert "initial_note_status" not in f.read_text(), f.name
    seal = ANN / "sealed" / "BLIND_SEALED.json"
    if seal.exists():                                                                              # the custodian has sealed the independent blind results
        rec = json.loads(seal.read_text())
        assert rec["results_sha256"] == P.sha256_file(ANN / "sealed" / "blind_results.jsonl") and rec["sample_ids_sha256"] == SAMPLE["ids_sha256"]
        lines = [json.loads(x) for x in (ANN / "sealed" / "blind_results.jsonl").read_text().splitlines()]
        assert P.validate_results(lines, SAMPLE["ids"]) == []


def _good_results(sample_ids, its):
    return [{"item_id": i, "clauses": its[i]["clauses"], "note_status": its[i]["status"]} for i in sample_ids]


def test_result_validation_catches_every_kind_of_bad_file():
    its = P.opaque_ids(P.items())
    ids = SAMPLE["ids"]
    good = _good_results(ids, its)
    assert P.validate_results(good, ids) == []
    assert P.validate_results(good[:-1], ids)                                                       # one missing
    assert P.validate_results(good + [good[0]], ids)                                                # duplicate
    assert P.validate_results(good[:-1] + [{**good[-1], "item_id": "A999"}], ids)                   # not in the sample
    bad_status = [{**good[0], "note_status": "MAYBE"}] + good[1:]
    assert P.validate_results(bad_status, ids)
    mismatch = [{**good[0], "note_status": next(s for s in R.NOTE_STATUSES if s != good[0]["note_status"])}] + good[1:]
    assert any("does not follow" in p for p in P.validate_results(mismatch, ids))
    empty_basis = [{**good[0], "clauses": [{**good[0]["clauses"][0], "basis": " "}]}] + good[1:]
    assert P.validate_results(empty_basis, ids)
    extra_key = [{**good[0], "model": "x"}] + good[1:]
    assert P.validate_results(extra_key, ids)


@pytest.fixture
def sandbox(tmp_path, monkeypatch):
    """A throw-away git repository holding copies of the inputs, so sealing and release can be exercised for real."""
    repo = tmp_path / "repo"
    (repo / "eval/dev/stress").mkdir(parents=True)
    (repo / "eval/annotation").mkdir(parents=True)
    shutil.copy(ROOT / "eval/dev/dev_set.jsonl", repo / "eval/dev/dev_set.jsonl")
    shutil.copy(ROOT / "eval/dev/stress/stress_dev.jsonl", repo / "eval/dev/stress/stress_dev.jsonl")
    shutil.copy(ANN / "blind_sample.json", repo / "eval/annotation/blind_sample.json")
    for cmd in (["init", "-q"], ["config", "user.email", "t@example.com"], ["config", "user.name", "t"]):
        subprocess.run(["git", "-C", str(repo), *cmd], check=True)
    subprocess.run(["git", "-C", str(repo), "add", "-A"], check=True)
    subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"], check=True)
    monkeypatch.setattr(P, "ROOT", repo)
    monkeypatch.setattr(P, "HERE", repo / "eval/annotation")
    return repo


def test_seal_then_commit_then_release_in_that_order_only(sandbox, tmp_path, capsys):
    its = P.opaque_ids(P.items())
    results = tmp_path / "blind_results.jsonl"
    out = tmp_path / "review_packet.jsonl"
    assert P.release(out) == 2 and not out.exists()                                                 # nothing sealed
    results.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in _good_results(SAMPLE["ids"], its)))
    assert P.seal(results) == 0
    assert P.release(out) == 2 and "committed" in capsys.readouterr().err and not out.exists()      # sealed but not committed
    subprocess.run(["git", "-C", str(sandbox), "add", "-A"], check=True)
    subprocess.run(["git", "-C", str(sandbox), "commit", "-qm", "seal"], check=True)
    assert P.release(sandbox / "eval/annotation/review.jsonl") == 2                                  # not inside the annotation folder
    assert P.release(out) == 0
    rows = [json.loads(x) for x in out.read_text().splitlines()]
    assert len(rows) == 96 and all({"item_id", "input_text", "initial_note_status", "initial_clauses"} <= set(r) for r in rows)
    (sandbox / "eval/annotation/sealed/blind_results.jsonl").write_text("tampered\n")               # changed after sealing
    assert P.release(tmp_path / "again.jsonl") == 2


def test_a_bad_results_file_is_not_sealed(sandbox, tmp_path):
    bad = tmp_path / "bad.jsonl"
    bad.write_text(json.dumps({"item_id": "A001", "clauses": [], "note_status": "NEGATED"}) + "\n")
    assert P.seal(bad) == 2 and not (sandbox / "eval/annotation/sealed").exists()


def test_the_report_gives_agreement_before_adjudication_and_the_review_change_rate(sandbox, tmp_path):
    its = P.opaque_ids(P.items())
    results = tmp_path / "blind.jsonl"
    good = _good_results(SAMPLE["ids"], its)
    flipped = {**good[0], "clauses": [{**good[0]["clauses"][0], "status": "IRRELEVANT"}], "note_status": "IRRELEVANT"}
    if good[0]["note_status"] == "IRRELEVANT":
        flipped = {**good[0], "clauses": [{**good[0]["clauses"][0], "status": "NEGATED"}], "note_status": "NEGATED"}
    results.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in [flipped] + good[1:]))
    assert P.seal(results) == 0
    review = _good_results(sorted(its), its)
    review[3] = {**review[3], "clauses": [{**review[3]["clauses"][0], "status": "HISTORICAL"}], "note_status": "HISTORICAL"} if review[3]["note_status"] != "HISTORICAL" else review[3]
    review_file = tmp_path / "review.jsonl"
    review_file.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in review))
    assert P.report(review_file) == 0
    rep = json.loads((sandbox / "eval/annotation/agreement_report.json").read_text())
    assert rep["blind_sample"]["n"] == 33 and rep["blind_sample"]["raw_agreement"] == round(32 / 33, 15) or abs(rep["blind_sample"]["raw_agreement"] - 32 / 33) < 1e-9
    assert len(rep["blind_sample"]["disagreements"]) == 1 and rep["review"]["items_reviewed"] == 96 and "not an agreement figure" in rep["review"]["note"]
    assert rep["review"]["status_changed"] in (0, 1) and flipped["item_id"] in rep["to_owner"]


def test_the_materials_need_no_model_and_no_network():
    src = (ANN / "packets.py").read_text()
    for banned in ("import openai", "import requests", "import socket", "urllib", "httpx", "ask_agent", "get_llm_client"):
        assert banned not in src
