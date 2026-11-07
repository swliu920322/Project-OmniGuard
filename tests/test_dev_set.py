"""The dev set: counts, coverage, family split, regenerability and the absence of any model or test-set access."""
import hashlib
import importlib.util
import json
import pathlib
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEV = ROOT / "eval" / "dev"
SPEC = ROOT / "eval" / "spec"
for p in (str(SPEC), str(DEV)):
    if p not in sys.path:
        sys.path.insert(0, p)
import family as F  # noqa: E402
import reference_labeler as R  # noqa: E402
import make_dev_set as M  # noqa: E402

RECORDS = [json.loads(line) for line in (DEV / "dev_set.jsonl").read_text().splitlines()]
FAMS = json.loads((DEV / "families.json").read_text())
REPORT = json.loads((DEV / "dev_report.json").read_text())


def test_the_files_on_disk_are_exactly_what_the_seed_regenerates():
    records, fams = M.generate()
    assert (DEV / "dev_set.jsonl").read_text() == M.jsonl(records)
    assert json.loads((DEV / "families.json").read_text()) == fams
    again, _ = M.generate()
    assert M.jsonl(again) == M.jsonl(records)                      # same seed, same bytes
    other, _ = M.generate(seed=M.DEV_SEED + 1)
    assert M.jsonl(other) != M.jsonl(records)                      # the seed really drives it


def test_counts_are_180_and_30_per_class_recomputed_from_the_telemetry():
    assert len(RECORDS) == 180 and len({r["id"] for r in RECORDS}) == 180
    got = Counter(R.compose(r["telemetry"], r["note_status"])["primary"] for r in RECORDS)
    assert got == {c: 30 for c in R.CLASSES}
    assert all(r["gold"]["primary"] == R.compose(r["telemetry"], r["note_status"])["primary"] for r in RECORDS)


def test_notes_meet_the_floors_in_every_status_and_language():
    noted = [r for r in RECORDS if r["note"]]
    assert len(noted) >= 60
    by = Counter((r["note_status"], r["language"]) for r in noted)
    for s in R.NOTE_STATUSES:
        assert sum(v for (st, _), v in by.items() if st == s) >= 10
        assert all(by[(s, lang)] >= 4 for lang in ("en", "zh", "mixed"))
    assert all(R.combine_clause_statuses([c["status"] for c in r["clauses"]]) == r["note_status"] for r in noted)
    assert all(c["basis"] and c["text"] for r in noted for c in r["clauses"])
    assert all(len(r["note"]) <= R.MAX_NOTE_CHARS for r in noted)
    assert sum(1 for r in noted if r["multi_clause"]) >= 18


def test_every_family_is_a_dev_family_and_none_belongs_to_test_or_reserve():
    dev = set(F.pool_by_split()["dev"])
    assert {r["family_id"] for r in RECORDS} <= dev and set(FAMS["families"]) <= dev
    test = set(F.pool_by_split()["test"]) | set(F.pool_by_split()["reserve"])
    assert not {r["family_id"] for r in RECORDS} & test
    assert F.check_records([{"family_id": r["family_id"], "text": r["rendered_input"]} for r in RECORDS], "dev") == []
    for fid, fam in FAMS["families"].items():
        assert sorted(fam["records"]) == sorted(r["id"] for r in RECORDS if r["family_id"] == fid), fid
    assert sum(len(f["records"]) for f in FAMS["families"].values()) == 180


def test_no_duplicate_text_and_nothing_equals_a_public_example():
    texts = [r["rendered_input"] for r in RECORDS]
    assert len({F.fingerprint(t) for t in texts}) == 180
    public = [{"text": R.render_telemetry(e["input"], e["note"])} for e in json.loads((SPEC / "ambiguous_examples.json").read_text())
              if R.validate(e["input"]) is None]
    assert F.cross_duplicates(public, [{"text": t} for t in texts]) == []


def test_the_model_sees_the_exact_numbers_and_no_value_has_more_than_two_decimals():
    for r in RECORDS:
        assert R.parse_rendered(r["rendered_input"].split(" Operator note:")[0]) == r["telemetry"]
        assert r["rendered_input"] == R.render_telemetry(r["telemetry"], r["note"])


def test_coverage_thresholds_pairs_triples_gate_and_decimal_boundaries():
    t = REPORT["thresholds"]
    for field in ("distance_cm", "temperature_c", "velocity_ms", "battery_pct", "hp"):
        assert t[field]["safe_side"] > 0 and t[field]["exactly_at"] > 0 and t[field]["violating"] > 0
        assert len(t[field]["decimal_boundaries_present"]) == 2
    assert all(v >= 2 for v in REPORT["risk_pairs"].values()) and len(REPORT["risk_pairs"]) == 10
    assert sum(v for k, v in REPORT["risks_per_record"].items() if int(k) >= 3) >= 6
    assert any(r["telemetry"]["hp"] <= 0 for r in RECORDS) and any(r["telemetry"]["battery_pct"] < 5 for r in RECORDS)
    assert REPORT["all_checks_pass"] is True


def test_each_class_only_contains_what_its_primary_allows():
    for r in RECORDS:
        risks, primary = r["gold"]["risk_set"], r["gold"]["primary"]
        assert primary == (risks[0] if risks else "NORMAL_NAV")
        assert (primary == "NORMAL_NAV") == (risks == [])
    assert all(len(r["gold"]["risk_set"]) == 1 for r in RECORDS if r["gold"]["primary"] == "OVERSPEED")


def test_the_generator_has_no_network_model_or_test_set_access():
    for name in ("make_dev_set.py", "dev_report.py"):
        src = (DEV / name).read_text()
        for banned in ("import openai", "import requests", "import socket", "urllib", "httpx", "ask_agent", "get_llm_client"):
            assert banned not in src, (name, banned)
    assert not [p for p in DEV.iterdir() if "test_set" in p.name or "frozen" in p.name]


def test_the_hash_manifest_matches_the_files():
    for line in (DEV / "SHA256SUMS").read_text().splitlines():
        digest, name = line.split("  ", 1)
        assert hashlib.sha256((DEV / name).read_bytes()).hexdigest() == digest, name
