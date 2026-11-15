"""Structure check for the clause-level annotation file that sits beside a run file (read-only, offline, no model).

It answers one question: do the clause rationales hold together with the run records? It does not judge whether a label is right.
Checks, per record: ids match one to one; family_id, language and note agree; every clause has non-empty text, a legal status and a
non-blank basis (a top-level rationale cannot stand in for it); the clause statuses list equals the clauses' own statuses; the clause
texts concatenated equal the note character for character; the combined status equals the frozen combine_clause_statuses of the clauses
and the run record's note_status.

The public output has counts and problem codes only: no note, no id, no family name, no absolute path. Per-record diagnostics (ids and
clause positions, still no text) go to a file only when --private-errors is given; the file is created with mode 600 and an existing
file is never overwritten. Nothing is fixed automatically and no input is changed.

    python3 eval/annotation/validate_rationales.py --data RUN.jsonl --rationales RATIONALES.jsonl [--private-errors OUT.jsonl]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "spec"))
import reference_labeler as RL  # noqa: E402  (frozen: combine_clause_statuses, NOTE_STATUSES)

STATUSES = set(RL.NOTE_STATUSES)
LANGUAGES = {"zh", "en", "mixed"}


class _DuplicateKey(ValueError):
    pass


def _no_dup(pairs):
    out = {}
    for k, v in pairs:
        if k in out:
            raise _DuplicateKey(k)
        out[k] = v
    return out


def _sha(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_jsonl(path: str, label: str, problems: dict) -> list[tuple[int, dict]]:
    """(line number, object). Parse problems are counted under a code, never echoed."""
    rows = []
    try:
        with open(path, "rb") as f:
            raw = f.read()
        text = raw.decode("utf-8")
    except (OSError, UnicodeDecodeError):
        _add(problems, f"{label}_unreadable", None)
        return rows
    for no, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            obj = json.loads(line, object_pairs_hook=_no_dup)
        except _DuplicateKey:
            _add(problems, f"{label}_duplicate_json_key", None, line=no)
            continue
        except ValueError:
            _add(problems, f"{label}_not_json", None, line=no)
            continue
        if not isinstance(obj, dict):
            _add(problems, f"{label}_line_not_an_object", None, line=no)
            continue
        rows.append((no, obj))
    return rows


def _add(problems: dict, code: str, rec_key, *, clause: int | None = None, line: int | None = None) -> None:
    p = problems.setdefault(code, {"records": set(), "clauses": 0, "lines": 0, "detail": []})
    if rec_key is not None:
        p["records"].add(rec_key)
    if clause is not None:
        p["clauses"] += 1
    if line is not None:
        p["lines"] += 1
    p["detail"].append((rec_key, clause, line))


def _nonblank(v) -> bool:
    return isinstance(v, str) and bool(v.strip())


def _valid_status(value) -> bool:
    return isinstance(value, str) and value in STATUSES


def _safe_sha(path: str, label: str, problems: dict) -> str | None:
    try:
        return _sha(path)
    except OSError:
        _add(problems, f"{label}_unreadable", None)
        return None


def validate(run_rows: list[tuple[int, dict]], ann_rows: list[tuple[int, dict]], problems: dict) -> dict:
    if not run_rows:
        _add(problems, "run_has_no_records", None)
    if not ann_rows:
        _add(problems, "annotation_has_no_records", None)
    run, ann = {}, {}
    for _, r in run_rows:
        rid = r.get("id")
        if not _nonblank(rid):
            _add(problems, "run_id_missing_or_blank", None)
            continue
        if rid in run:
            _add(problems, "run_duplicate_id", rid)
        run[rid] = r
    for _, a in ann_rows:
        aid = a.get("id")
        if not _nonblank(aid):
            _add(problems, "annotation_id_missing_or_blank", None)
            continue
        if aid in ann:
            _add(problems, "annotation_duplicate_id", aid)
        ann[aid] = a
    for rid in run.keys() - ann.keys():
        _add(problems, "annotation_missing_for_run_record", rid)
    for aid in ann.keys() - run.keys():
        _add(problems, "annotation_without_run_record", aid)

    clauses_total = 0
    for aid, a in ann.items():
        r = run.get(aid)
        if r is not None:
            for key in ("family_id", "language", "note"):
                if a.get(key) != r.get(key):
                    _add(problems, f"{key}_differs_from_run_record", aid)
        if not isinstance(a.get("language"), str) or a["language"] not in LANGUAGES:
            _add(problems, "language_invalid", aid)
        if not isinstance(a.get("note"), str):
            _add(problems, "note_not_a_string", aid)
        if not _nonblank(a.get("family_id")):
            _add(problems, "family_id_missing_or_blank", aid)
        if not _nonblank(a.get("rationale")):
            _add(problems, "rationale_missing_or_blank", aid)

        clauses = a.get("clauses")
        if not isinstance(clauses, list) or not clauses:
            _add(problems, "clauses_missing_or_empty", aid)
            continue
        statuses, texts, all_ok = [], [], True
        for i, c in enumerate(clauses):
            clauses_total += 1
            if not isinstance(c, dict):
                _add(problems, "clause_not_an_object", aid, clause=i)
                all_ok = False
                continue
            if not (isinstance(c.get("text"), str) and c["text"].strip()):
                _add(problems, "clause_text_missing_or_blank", aid, clause=i)
                all_ok = False
            if not _valid_status(c.get("status")):
                _add(problems, "clause_status_invalid", aid, clause=i)
                all_ok = False
            if not _nonblank(c.get("basis")):
                _add(problems, "clause_basis_missing_or_blank", aid, clause=i)
            if "clause_id" in c and (isinstance(c["clause_id"], bool) or not isinstance(c["clause_id"], (str, int))):
                _add(problems, "clause_id_invalid_type", aid, clause=i)
            statuses.append(c.get("status"))
            texts.append(c.get("text") if isinstance(c.get("text"), str) else "")
        listed = a.get("clause_statuses")
        if not isinstance(listed, list) or any(not _valid_status(s) for s in listed):
            _add(problems, "clause_statuses_missing_or_invalid", aid)
        elif listed != statuses:
            _add(problems, "clause_statuses_differ_from_clauses", aid)
        if isinstance(a.get("note"), str) and "".join(texts) != a["note"]:
            _add(problems, "clause_texts_do_not_rebuild_the_note", aid)
        combined = a.get("combined_status")
        if not _valid_status(combined):
            _add(problems, "combined_status_invalid", aid)
        elif all_ok and all(_valid_status(s) for s in statuses):
            if RL.combine_clause_statuses(statuses) != combined:
                _add(problems, "combined_status_differs_from_clauses", aid)
            if r is not None and r.get("note_status") != combined:
                _add(problems, "combined_status_differs_from_run_record", aid)
    return {"run_records": len(run), "annotation_records": len(ann), "clauses": clauses_total}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--data", required=True)
    ap.add_argument("--rationales", required=True)
    ap.add_argument("--private-errors")
    args = ap.parse_args(argv)

    if args.private_errors:
        out_real = os.path.realpath(args.private_errors)
        if out_real in {os.path.realpath(args.data), os.path.realpath(args.rationales)}:
            print(json.dumps({"ok": False, "error": "private_errors_path_equals_an_input"}))
            return 2
        if os.path.lexists(args.private_errors):
            print(json.dumps({"ok": False, "error": "private_errors_path_already_exists"}))
            return 2

    problems: dict = {}
    run_rows = _read_jsonl(args.data, "run", problems)
    ann_rows = _read_jsonl(args.rationales, "annotation", problems)
    counts = validate(run_rows, ann_rows, problems)

    data_sha256 = _safe_sha(args.data, "run", problems)
    rationales_sha256 = _safe_sha(args.rationales, "annotation", problems)
    summary = {code: {"records": len(p["records"]), "clauses": p["clauses"], "lines": p["lines"]} for code, p in sorted(problems.items())}
    result = {"ok": not problems, "data_sha256": data_sha256,
              "rationales_sha256": rationales_sha256, **counts, "problems": summary,
              "note": "structure and binding only; not a semantic review"}
    if args.private_errors and problems:
        try:
            fd = os.open(args.private_errors, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                for code, p in sorted(problems.items()):
                    for rec_key, clause, line in p["detail"]:
                        f.write(json.dumps({"code": code, "id": rec_key, "clause_index": clause, "line": line}, ensure_ascii=False) + "\n")
        except OSError:
            result["ok"] = False
            result["error"] = "private_errors_write_failed"
            print(json.dumps(result, indent=1))
            return 2
        result["private_errors_written"] = True
    print(json.dumps(result, indent=1))
    return 0 if not problems else 1


if __name__ == "__main__":
    raise SystemExit(main())
