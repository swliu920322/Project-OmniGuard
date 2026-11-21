"""control_check.py: the scoring chain is checked with a perfect, an inverted, a constant and a shuffled answer. Fake records for the logic; the published ones to confirm nothing is changed."""
import hashlib
import importlib.util
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("control_check", ROOT / "eval/experiments/note_vs_rules_v2/control_check.py")
CC = importlib.util.module_from_spec(spec)
spec.loader.exec_module(CC)

NORMAL = {"distance_cm": 300, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}


def fake_records(per_status=4):
    recs, i = [], 0
    for status in CC.R.NOTE_STATUSES:
        for _ in range(per_status):
            i += 1
            recs.append(CC.RF.normalize_test({"id": f"ZZ-ID-{i}", "family_id": f"ZZ-FAM-{i % 3}", "telemetry": NORMAL, "note": f"ZZ-NOTE-{i}", "note_status": status}, i))
    return recs


def test_a_working_scorer_passes_all_controls():
    res = CC.run_controls(fake_records(), n_shuffles=300)
    assert res["oracle"] == 24 and res["anti_oracle"] == 0
    assert set(res["constant"].values()) == {4}
    assert abs(res["shuffle"]["exact_chance"] - 1 / 6) < 1e-9
    assert res["passed"] is True


def test_a_scorer_that_calls_everything_correct_is_caught():
    res = CC.run_controls(fake_records(), scorer=lambda recs, calls: {r["id"]: True for r in recs}, n_shuffles=100)
    assert res["passed"] is False and res["checks"]["anti-oracle scores 0%"] is False


def test_a_scorer_that_calls_everything_wrong_is_caught():
    res = CC.run_controls(fake_records(), scorer=lambda recs, calls: {r["id"]: False for r in recs}, n_shuffles=100)
    assert res["passed"] is False and res["checks"]["oracle scores 100%"] is False


def test_chance_level_follows_the_status_counts():
    assert abs(CC.chance_level(fake_records(per_status=1)) - 1 / 6) < 1e-9  # one record of each of the six statuses
    one_status = fake_records(per_status=4)[:4]  # four records, all of the first status: any shuffle changes nothing
    assert abs(CC.chance_level(one_status) - 1.0) < 1e-9
    mixed = fake_records(per_status=4)[:6]  # four of one status and two of another
    assert abs(CC.chance_level(mixed) - ((4 / 6) ** 2 + (2 / 6) ** 2)) < 1e-9


def test_published_records_pass_and_nothing_is_changed(tmp_path):
    watched = [p for p in CC.DEFAULT_PATHS.values()]
    before = [hashlib.sha256(p.read_bytes()).hexdigest() for p in watched]
    assert CC.main(["--out-dir", str(tmp_path), "--shuffles", "200"]) == 0
    assert [hashlib.sha256(p.read_bytes()).hexdigest() for p in watched] == before
    text = (tmp_path / "CONTROL_CHECK.md").read_text(encoding="utf-8")
    assert "全部通过" in text and "173/180" in text and "77/180" in text
