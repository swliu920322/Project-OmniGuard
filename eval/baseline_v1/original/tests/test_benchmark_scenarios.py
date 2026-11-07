from pathlib import Path
import sys


CLOUD_ORCHESTRATOR = Path(__file__).resolve().parents[1] / "src" / "cloud-orchestrator"
sys.path.insert(0, str(CLOUD_ORCHESTRATOR))

from embodied_brain.benchmark_scenarios import (  # noqa: E402
    MIN_SAFE_DISTANCE_CM,
    generate_scenarios,
)


def test_default_manifest_has_fixed_class_counts():
    scenarios = generate_scenarios()
    counts = {
        scenario_type: sum(s["type"] == scenario_type for s in scenarios)
        for scenario_type in ("normal", "critical", "sensor_error")
    }

    assert len(scenarios) == 200
    assert counts == {"normal": 100, "critical": 50, "sensor_error": 50}


def test_ground_truth_matches_static_safety_policy():
    scenarios = generate_scenarios()

    assert all(
        scenario["obstacle"] < MIN_SAFE_DISTANCE_CM
        for scenario in scenarios
        if scenario["type"] == "critical"
    )
    assert all(
        scenario["temperature"] > 60
        for scenario in scenarios
        if scenario["type"] == "sensor_error"
    )


def test_manifest_is_reproducible_for_the_same_seed():
    assert generate_scenarios(seed=42) == generate_scenarios(seed=42)
    assert generate_scenarios(seed=42) != generate_scenarios(seed=43)
