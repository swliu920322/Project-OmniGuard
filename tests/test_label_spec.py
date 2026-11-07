"""The reference labeler must agree with the examples written in LABEL_SPEC.md."""
import importlib.util
import json
import pathlib

SPEC = pathlib.Path(__file__).resolve().parents[1] / "eval" / "spec"
_s = importlib.util.spec_from_file_location("reference_labeler", SPEC / "reference_labeler.py")
R = importlib.util.module_from_spec(_s)
_s.loader.exec_module(R)
EXAMPLES = json.loads((SPEC / "ambiguous_examples.json").read_text())
DOC = (SPEC / "LABEL_SPEC.md").read_text()
OK = {"distance_cm": 300, "velocity_ms": 1, "hp": 80, "battery_pct": 60, "temperature_c": 35}


def test_every_example_matches_the_reference_rules():
    for e in EXAMPLES:
        assert R.label(e["input"])["primary"] == e["expected_primary"], e["id"]


def test_every_example_is_in_the_document():
    for e in EXAMPLES:
        assert f"| {e['id']} |" in DOC


def test_every_threshold_is_exclusive_at_the_boundary():
    for field, edge in [("distance_cm", 30), ("temperature_c", 60), ("velocity_ms", 2.5), ("battery_pct", 20), ("hp", 50)]:
        assert R.label({**OK, field: edge})["primary"] == "NORMAL_NAV", field


def test_disposition_keeps_every_risk_not_only_the_primary():
    out = R.label({**OK, "distance_cm": 10, "temperature_c": 75, "velocity_ms": 3})
    assert out["primary"] == "CRITICAL_OBSTACLE"
    assert out["disposition"] == ["STOP", "STOP_AND_COOL", "LIMIT_SPEED"]


def test_invalid_input_is_not_a_class_and_fails_safe():
    for bad in ({**OK, "hp": None}, {**OK, "battery_pct": float("nan")}, {**OK, "hp": True}, {**OK, "distance_cm": -1}):
        out = R.label(bad)
        assert out["valid"] is False and out["primary"] is None and out["disposition"] == ["STOP"]
    assert R.label({k: v for k, v in OK.items() if k != "hp"})["valid"] is False


def test_gate_matches_the_production_short_circuit():
    assert R.label({**OK, "hp": 0})["gate"] == "SKIP"
    assert R.label({**OK, "battery_pct": 4.9})["gate"] == "SKIP"
    assert R.label({**OK, "battery_pct": 5})["gate"] == "PASS"


def test_legacy_view_and_class_list_are_consistent():
    assert set(R.CLASSES) == set(R.LEGACY3) and R.LEGACY3["OVERSPEED"] is None
    assert set(R.PRIORITY) | {"NORMAL_NAV"} == set(R.CLASSES)
