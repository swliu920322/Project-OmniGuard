"""Shared, deterministic scenario definitions for the AGV benchmarks.

Version 3 aligns ground-truth labels with the runtime safety policy and uses
fixed class counts. Historical v2 runs used weighted random sampling and a
5-50 cm CRITICAL_OBSTACLE range; keep those results separate from v3 runs.
"""

import random

SEED = 42
NUM_SCENARIOS = 200
SCENARIO_DEFINITION_VERSION = "v3-policy-aligned"
MIN_SAFE_DISTANCE_CM = 30

SCENARIO_TEMPLATES = {
    "normal": {
        "obstacle_range": (200, 500),
        "velocity_range": (0.5, 2.0),
        "battery_range": (20, 100),
        "hp_range": (50, 100),
        "temperature_range": (25, 45),
        "weight": 0.5,
        "expected_label": "NORMAL_NAV",
    },
    "critical": {
        # A critical obstacle now means the same thing everywhere: it is
        # strictly inside the configured 30 cm minimum safe distance.
        "obstacle_range": (5, MIN_SAFE_DISTANCE_CM - 1),
        "velocity_range": (0.5, 2.5),
        "battery_range": (20, 100),
        "hp_range": (50, 100),
        "temperature_range": (25, 45),
        "weight": 0.25,
        "expected_label": "CRITICAL_OBSTACLE",
    },
    "sensor_error": {
        "obstacle_range": (50, 300),
        "velocity_range": (0.5, 2.0),
        "battery_range": (0, 10),
        "hp_range": (0, 20),
        # Every generated sensor-error case violates the 60 C policy even
        # when its battery and HP happen not to cross their hard limits.
        "temperature_range": (60.1, 100),
        "weight": 0.25,
        "expected_label": "SENSOR_ERROR",
    },
}


def _fixed_type_counts(num: int) -> dict[str, int]:
    """Allocate exact, deterministic counts using largest remainders."""
    raw = {name: num * cfg["weight"] for name, cfg in SCENARIO_TEMPLATES.items()}
    counts = {name: int(value) for name, value in raw.items()}
    remaining = num - sum(counts.values())
    order = sorted(raw, key=lambda name: (raw[name] - counts[name], name), reverse=True)
    for name in order[:remaining]:
        counts[name] += 1
    return counts


def generate_scenarios(num: int = NUM_SCENARIOS, seed: int = SEED) -> list[dict]:
    """Generate a reproducible, stratified scenario manifest."""
    rng = random.Random(seed)
    types = [
        scenario_type
        for scenario_type, count in _fixed_type_counts(num).items()
        for _ in range(count)
    ]
    rng.shuffle(types)

    scenarios = []
    for scenario_id, scenario_type in enumerate(types):
        template = SCENARIO_TEMPLATES[scenario_type]
        scenarios.append({
            "id": scenario_id,
            "type": scenario_type,
            "expected_label": template["expected_label"],
            "obstacle": rng.randint(*template["obstacle_range"]),
            "velocity": round(rng.uniform(*template["velocity_range"]), 2),
            "battery": round(rng.uniform(*template["battery_range"]), 1),
            "hp": rng.randint(*template["hp_range"]),
            "temperature": round(rng.uniform(*template["temperature_range"]), 1),
        })
    return scenarios
