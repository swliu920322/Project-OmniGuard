"""validate_rationales.py: structure check of the clause-level annotation file. Public fake records only; no private file is read."""
import copy
import hashlib
import importlib.util
import json
import os
import pathlib
import stat

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("validate_rationales", ROOT / "eval/annotation/validate_rationales.py")
V = importlib.util.module_from_spec(spec)
spec.loader.exec_module(V)

NOTE_ID = "ZZ-ID-{:03d}"
FAKE_TEXT = "ZZ-TEXT-{0} first part. ZZ-TEXT-{0} second part."
FAKE_FAMILY = "ZZ-FAM-{:03d}"


def make_pair(n=7):
    """n fake run records and their annotation records; every record has two clauses (AFFIRMED_CURRENT, NEGATED -> AFFIRMED_CURRENT)."""
    run, ann = [], []
    for i in range(1, n + 1):
        t1, t2 = f"ZZ-TEXT-{i} first part.", f" ZZ-TEXT-{i} second part."
        note = t1 + t2
        run.append({"id": NOTE_ID.format(i), "family_id": FAKE_FAMILY.format(i), "language": "en", "note": note, "note_status": "AFFIRMED_CURRENT"})
        ann.append({"id": NOTE_ID.format(i), "family_id": FAKE_FAMILY.format(i), "language": "en", "note": note,
                    "clauses": [{"text": t1, "status": "AFFIRMED_CURRENT", "basis": "fake basis one"}, {"text": t2, "status": "NEGATED", "basis": "fake basis two"}],
                    "clause_statuses": ["AFFIRMED_CURRENT", "NEGATED"], "combined_status": "AFFIRMED_CURRENT", "rationale": "fake overall rationale"})
    return run, ann


def write(tmp_path, run, ann, raw_run=None, raw_ann=None):
    d, a = tmp_path / "run.jsonl", tmp_path / "ann.jsonl"
    d.write_text(raw_run if raw_run is not None else "\n".join(json.dumps(r, ensure_ascii=False) for r in run) + "\n", encoding="utf-8")
    a.write_text(raw_ann if raw_ann is not None else "\n".join(json.dumps(r, ensure_ascii=False) for r in ann) + "\n", encoding="utf-8")
    return str(d), str(a)


def sha(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def run_cli(tmp_path, run, ann, capsys, *extra, **raw):
    d, a = write(tmp_path, run, ann, **raw)
    before = (sha(d), sha(a))
    code = V.main(["--data", d, "--rationales", a, *extra])
    out = capsys.readouterr().out
    assert (sha(d), sha(a)) == before                       # the tool never changes an input
    return code, json.loads(out), out


def test_a_consistent_pair_passes_and_counts_are_right(tmp_path, capsys):
    run, ann = make_pair(7)
    code, res, _ = run_cli(tmp_path, run, ann, capsys)
    assert code == 0 and res["ok"] is True and res["problems"] == {}
    assert (res["run_records"], res["annotation_records"], res["clauses"]) == (7, 7, 14)
    assert len(res["data_sha256"]) == 64 and "structure" in res["note"]


def test_a_top_level_rationale_does_not_stand_in_for_the_clause_basis(tmp_path, capsys):
    run, ann = make_pair(7)
    for a in ann:
        for c in a["clauses"]:
            del c["basis"]                                    # 7 records, 14 clauses, each record still has a non-empty rationale
    code, res, _ = run_cli(tmp_path, run, ann, capsys)
    assert code == 1
    assert res["problems"]["clause_basis_missing_or_blank"] == {"records": 7, "clauses": 14, "lines": 0}


@pytest.mark.parametrize("bad", [None, "", "   \n\t", 5, ["x"], {"a": 1}])
def test_basis_must_be_a_non_blank_string(tmp_path, capsys, bad):
    run, ann = make_pair(2)
    ann[0]["clauses"][1]["basis"] = bad
    code, res, _ = run_cli(tmp_path, run, ann, capsys)
    assert code == 1 and res["problems"]["clause_basis_missing_or_blank"] == {"records": 1, "clauses": 1, "lines": 0}


def test_clause_status_list_must_equal_the_clauses_own_statuses(tmp_path, capsys):
    run, ann = make_pair(3)
    ann[1]["clause_statuses"] = ["NEGATED", "AFFIRMED_CURRENT"]
    code, res, _ = run_cli(tmp_path, run, ann, capsys)
    assert code == 1 and res["problems"]["clause_statuses_differ_from_clauses"]["records"] == 1


def test_clause_texts_must_rebuild_the_note_character_for_character(tmp_path, capsys):
    for mutate in (lambda a: a["clauses"][1].update(text=a["clauses"][1]["text"].lstrip()),                  # the space between clauses is missing
                   lambda a: a["clauses"][0].update(text=a["clauses"][0]["text"][:-1]),                      # the full stop is missing
                   lambda a: a["clauses"][0].update(text=a["clauses"][0]["text"] + " ")):               # a look-alike space is not a space
        run, ann = make_pair(2)
        mutate(ann[0])
        code, res, _ = run_cli(tmp_path, run, ann, capsys)
        assert code == 1 and res["problems"]["clause_texts_do_not_rebuild_the_note"]["records"] == 1


def test_combined_status_must_follow_the_frozen_rule_and_the_run_record(tmp_path, capsys):
    run, ann = make_pair(3)
    ann[0]["combined_status"] = "NEGATED"                     # the frozen rule gives AFFIRMED_CURRENT for these two clauses
    run[1]["note_status"] = "UNCERTAIN"                       # the annotation is right, the run record disagrees
    code, res, _ = run_cli(tmp_path, run, ann, capsys)
    assert code == 1
    assert res["problems"]["combined_status_differs_from_clauses"]["records"] == 1
    assert res["problems"]["combined_status_differs_from_run_record"]["records"] == 2        # record 0 (annotation moved) and record 1 (run record moved)


def test_ids_must_match_one_to_one_and_be_unique(tmp_path, capsys):
    run, ann = make_pair(4)
    ann.pop()                                                  # one annotation missing
    extra = copy.deepcopy(ann[0]); extra["id"] = "ZZ-ID-999"
    ann.append(extra)                                          # one annotation without a run record
    ann.append(copy.deepcopy(ann[1]))                          # one duplicate id
    code, res, _ = run_cli(tmp_path, run, ann, capsys)
    assert code == 1
    for key in ("annotation_missing_for_run_record", "annotation_without_run_record", "annotation_duplicate_id"):
        assert res["problems"][key]["records"] == 1, key


def test_binding_fields_must_agree_with_the_run_record(tmp_path, capsys):
    run, ann = make_pair(3)
    ann[0]["family_id"] = "ZZ-FAM-OTHER"
    ann[1]["language"] = "zh"
    ann[2]["note"] = ann[2]["note"] + "!"
    code, res, _ = run_cli(tmp_path, run, ann, capsys)
    assert code == 1
    for key in ("family_id_differs_from_run_record", "language_differs_from_run_record", "note_differs_from_run_record"):
        assert res["problems"][key]["records"] >= 1, key


def test_duplicate_json_keys_and_broken_lines_are_counted_not_echoed(tmp_path, capsys):
    run, ann = make_pair(2)
    raw = "\n".join(json.dumps(a, ensure_ascii=False) for a in ann)
    raw = raw.replace('"rationale": "fake overall rationale"}', '"rationale": "fake overall rationale", "rationale": "ZZ-DUP"}', 1) + "\n{not json ZZ-BROKEN\n[1, 2]\n"
    code, res, out = run_cli(tmp_path, run, ann, capsys, raw_ann=raw)
    assert code == 1
    assert res["problems"]["annotation_duplicate_json_key"]["lines"] == 1
    assert res["problems"]["annotation_not_json"]["lines"] == 1
    assert res["problems"]["annotation_line_not_an_object"]["lines"] == 1
    assert "ZZ-DUP" not in out and "ZZ-BROKEN" not in out


def test_optional_clause_id_is_accepted_and_checked_for_type_only(tmp_path, capsys):
    run, ann = make_pair(3)
    ann[0]["clauses"][0]["clause_id"] = 1
    ann[0]["clauses"][1]["clause_id"] = "c2"                   # present, string or int: fine; absent elsewhere: fine
    assert run_cli(tmp_path, run, ann, capsys)[0] == 0
    ann[1]["clauses"][0]["clause_id"] = True                   # a bool is not an id
    code, res, _ = run_cli(tmp_path, run, ann, capsys)
    assert code == 1 and res["problems"]["clause_id_invalid_type"]["clauses"] == 1


def test_clause_and_status_shape_problems(tmp_path, capsys):
    run, ann = make_pair(4)
    ann[0]["clauses"][0]["status"] = "MAYBE"
    ann[1]["clauses"][1]["text"] = "  "
    ann[2]["clauses"] = []
    ann[3]["combined_status"] = "NOPE"
    code, res, _ = run_cli(tmp_path, run, ann, capsys)
    assert code == 1
    for key in ("clause_status_invalid", "clause_text_missing_or_blank", "clauses_missing_or_empty", "combined_status_invalid"):
        assert key in res["problems"], key


def test_public_output_never_carries_text_ids_family_names_or_paths(tmp_path, capsys):
    run, ann = make_pair(5)
    for a in ann:
        a["clauses"][0]["basis"] = None
    ann[0]["clause_statuses"] = ["NEGATED", "NEGATED"]
    ann[2]["note"] = "ZZ-OTHER-NOTE"
    code, res, out = run_cli(tmp_path, run, ann, capsys)
    assert code == 1
    for leak in ("ZZ-TEXT", "ZZ-ID", "ZZ-FAM", "ZZ-OTHER", "fake basis", "fake overall", str(tmp_path), "run.jsonl", "ann.jsonl"):
        assert leak not in out, leak


def test_private_errors_file_is_mode_600_has_ids_but_no_text_and_is_never_overwritten(tmp_path, capsys):
    run, ann = make_pair(3)
    ann[1]["clauses"][0]["basis"] = ""
    d, a = write(tmp_path, run, ann)
    out_path = tmp_path / "priv" / "diag.jsonl"
    out_path.parent.mkdir()
    assert V.main(["--data", d, "--rationales", a, "--private-errors", str(out_path)]) == 1
    printed = capsys.readouterr().out
    assert str(out_path) not in printed and "ZZ-ID" not in printed
    assert stat.S_IMODE(os.stat(out_path).st_mode) == 0o600
    body = out_path.read_text(encoding="utf-8")
    assert "ZZ-ID-002" in body and "ZZ-TEXT" not in body and "fake basis" not in body
    # an existing file is not overwritten, and the diagnostic path may not be an input
    assert V.main(["--data", d, "--rationales", a, "--private-errors", str(out_path)]) == 2
    assert json.loads(capsys.readouterr().out)["error"] == "private_errors_path_already_exists"
    assert V.main(["--data", d, "--rationales", a, "--private-errors", a]) == 2
    assert json.loads(capsys.readouterr().out)["error"] == "private_errors_path_equals_an_input"
    assert out_path.read_text(encoding="utf-8") == body


def test_no_private_errors_file_is_created_when_everything_passes(tmp_path, capsys):
    run, ann = make_pair(2)
    d, a = write(tmp_path, run, ann)
    out_path = tmp_path / "diag.jsonl"
    assert V.main(["--data", d, "--rationales", a, "--private-errors", str(out_path)]) == 0
    capsys.readouterr()
    assert not out_path.exists()


def test_the_tool_does_not_import_the_frozen_runner_and_uses_the_frozen_combine_rule():
    src = (ROOT / "eval/annotation/validate_rationales.py").read_text(encoding="utf-8")
    assert "run_note_compare" not in src and "import openai" not in src and "requests" not in src
    assert V.RL.combine_clause_statuses(["AFFIRMED_CURRENT", "NEGATED"]) == "AFFIRMED_CURRENT"


@pytest.mark.parametrize("field,code", [
    ("language", "language_invalid"),
    ("clause_status", "clause_status_invalid"),
    ("status_list_entry", "clause_statuses_missing_or_invalid"),
    ("combined_status", "combined_status_invalid"),
])
@pytest.mark.parametrize("bad", [[], {}])
def test_non_scalar_enum_values_are_reported_without_exception_or_leak(tmp_path, capsys, field, code, bad):
    run, ann = make_pair(1)
    if field == "language":
        ann[0]["language"] = bad
    elif field == "clause_status":
        ann[0]["clauses"][0]["status"] = bad
    elif field == "status_list_entry":
        ann[0]["clause_statuses"][0] = bad
    else:
        ann[0]["combined_status"] = bad
    exit_code, res, out = run_cli(tmp_path, run, ann, capsys)
    assert exit_code == 1 and res["ok"] is False
    assert code in res["problems"]
    assert "ZZ-ID" not in out and "ZZ-TEXT" not in out and str(tmp_path) not in out


def test_two_empty_inputs_are_not_a_successful_validation(tmp_path, capsys):
    exit_code, res, _ = run_cli(tmp_path, [], [], capsys)
    assert exit_code == 1 and res["ok"] is False
    assert res["run_records"] == res["annotation_records"] == 0
    assert {"run_has_no_records", "annotation_has_no_records"} <= res["problems"].keys()



def test_late_hash_read_failure_returns_a_private_safe_error(tmp_path, capsys, monkeypatch):
    run, ann = make_pair(1)
    d, a = write(tmp_path, run, ann)
    original_sha = V._sha

    def deny_one_hash(path):
        if path == d:
            raise PermissionError("ZZ-SECRET-PATH " + path)
        return original_sha(path)

    monkeypatch.setattr(V, "_sha", deny_one_hash)
    assert V.main(["--data", d, "--rationales", a]) == 1
    out = capsys.readouterr().out
    res = json.loads(out)
    assert res["ok"] is False and res["data_sha256"] is None
    assert "run_unreadable" in res["problems"]
    assert "ZZ-SECRET-PATH" not in out and str(tmp_path) not in out and "ZZ-ID" not in out


def test_private_diagnostic_write_failure_never_echoes_the_path(tmp_path, capsys):
    run, ann = make_pair(1)
    ann[0]["clauses"][0]["basis"] = None
    d, a = write(tmp_path, run, ann)
    target = tmp_path / "ZZ-MISSING-PARENT" / "private-errors.jsonl"
    assert V.main(["--data", d, "--rationales", a, "--private-errors", str(target)]) == 2
    out = capsys.readouterr().out
    res = json.loads(out)
    assert res["ok"] is False and res["error"] == "private_errors_write_failed"
    assert not target.exists()
    assert "ZZ-MISSING" not in out and str(tmp_path) not in out and "ZZ-ID" not in out
