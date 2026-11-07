"""The R1/R2 dev report is regenerable and consistent with an independent recount."""
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
RC = ROOT / "eval/dev/rule_control"
for sub in ("eval/spec", "eval/dev/rule_control"):
    sys.path.insert(0, str(ROOT / sub))
import make_report as M  # noqa: E402
import rule_control as C  # noqa: E402

REPORT = json.loads((RC / "report.json").read_text())
DEV = [json.loads(line) for line in (ROOT / "eval/dev/dev_set.jsonl").read_text().splitlines()]


def test_the_report_is_regenerated_identically():
    assert subprocess.run([sys.executable, str(RC / "make_report.py"), "--check"], capture_output=True, text=True).returncode == 0
    assert M.build() == REPORT


def test_an_independent_recount_of_r1_and_r2_on_the_dev_set():
    for variant in ("R1", "R2"):
        note_ok = prim_ok = 0
        for r in DEV:
            pred = C.predict(r["rendered_input"], variant)
            prim_ok += pred["primary"] == r["gold"]["primary"]
            note_ok += bool(r["note"]) and pred["note_status"] == r["note_status"]
        c = REPORT["controls"][variant]["dev_all"]
        assert (c["primary_correct"], c["note_correct"]) == (prim_ok, note_ok), variant


def test_the_controls_reproduce_the_gold_on_telemetry_only_records_and_the_report_says_it_is_informational():
    for v in ("R1", "R2"):
        t = REPORT["controls"][v]["dev_telemetry_only_primary"]
        assert t["correct"] == t["n"] == 108
    text = (RC / "REPORT.md").read_text()
    assert "offline results of the rule controls on dev material" in text and "not formal independent-test results" in text and "do not show generalisation" in text
    assert "not a result" not in text and "does not miss" not in text
    assert "can still miss a stop when no keyword matches" in text and REPORT["controls"]["R2"]["stress_scored_types"]["missed_halt"] == 1
    assert REPORT["rule_control_sha256"] and REPORT["controls"]["R2"]["dev_all"]["needless_halt"] > REPORT["controls"]["R1"]["dev_all"]["needless_halt"]
