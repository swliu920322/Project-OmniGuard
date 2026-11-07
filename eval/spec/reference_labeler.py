"""Executable form of LABEL_SPEC.md: the deterministic gold-label rules for telemetry.

This is the specification written as code, not a model. It labels a record from its numbers
only, so a label never depends on what any LLM said. Thresholds live in THRESHOLDS so that a
change is one visible edit and a new spec version. It is also the rule-based control of the
evaluation (a classifier that needs no model).
"""
from __future__ import annotations

SPEC_VERSION = "0.1-draft"

# Strict inequalities are written into the names: "below" means <, "above" means >.
THRESHOLDS = {
    "distance_below_cm": 30,    # runtime safety rule: minimum safe distance 30 cm
    "temperature_above_c": 60,  # runtime safety rule: temperature maximum 60 C
    "velocity_above_ms": 2.5,   # runtime safety rule: max velocity 2.5 m/s
    "battery_below_pct": 20,    # lowest value the original generator called normal (policy choice)
    "hp_below": 50,             # lowest value the original generator called normal (policy choice)
    "gate_battery_below_pct": 5,  # physical gate in brain.py: battery < 5 never reaches the router
    "gate_hp_at_or_below": 0,     # physical gate in brain.py: HP <= 0 never reaches the router
}

# Valid input domain. Anything outside is INVALID_INPUT, rejected before any classifier.
DOMAIN = {
    "distance_cm": (0, 2000),
    "velocity_ms": (0, 5),
    "hp": (0, 100),
    "battery_pct": (0, 100),
    "temperature_c": (-40, 150),
}

CLASSES = ["NORMAL_NAV", "CRITICAL_OBSTACLE", "LOW_BATTERY", "OVERHEAT", "HARDWARE_FAULT", "OVERSPEED"]
# Primary-route priority, most urgent first (rationale in LABEL_SPEC.md section 5).
PRIORITY = ["CRITICAL_OBSTACLE", "OVERHEAT", "HARDWARE_FAULT", "LOW_BATTERY", "OVERSPEED"]
LEGACY3 = {"CRITICAL_OBSTACLE": "CRITICAL_OBSTACLE", "NORMAL_NAV": "NORMAL_NAV",
           "LOW_BATTERY": "SENSOR_ERROR", "OVERHEAT": "SENSOR_ERROR", "HARDWARE_FAULT": "SENSOR_ERROR",
           "OVERSPEED": None}  # the old task had no such class: excluded from the compatibility check
DISPOSITION = {
    "NORMAL_NAV": "CONTINUE",
    "CRITICAL_OBSTACLE": "STOP",
    "OVERHEAT": "STOP_AND_COOL",
    "HARDWARE_FAULT": "STOP_AND_LOCK",
    "LOW_BATTERY": "RETURN_TO_CHARGE",
    "OVERSPEED": "LIMIT_SPEED",
}


def validate(rec: dict) -> str | None:
    """Return a reason if the record is outside the input contract, else None."""
    for key, (lo, hi) in DOMAIN.items():
        v = rec.get(key)
        if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v:  # also rejects NaN
            return f"{key} missing or not a number"
        if not lo <= v <= hi:
            return f"{key}={v} outside [{lo}, {hi}]"
    return None


def risk_set(rec: dict) -> list[str]:
    t = THRESHOLDS
    risks = []
    if rec["distance_cm"] < t["distance_below_cm"]:
        risks.append("CRITICAL_OBSTACLE")
    if rec["temperature_c"] > t["temperature_above_c"]:
        risks.append("OVERHEAT")
    if rec["hp"] < t["hp_below"]:
        risks.append("HARDWARE_FAULT")
    if rec["battery_pct"] < t["battery_below_pct"]:
        risks.append("LOW_BATTERY")
    if rec["velocity_ms"] > t["velocity_above_ms"]:
        risks.append("OVERSPEED")
    return [r for r in PRIORITY if r in risks]


def gate(rec: dict) -> str:
    """SKIP when the physical gate stops the vehicle before the router (the router label is still defined)."""
    t = THRESHOLDS
    return "SKIP" if rec["hp"] <= t["gate_hp_at_or_below"] or rec["battery_pct"] < t["gate_battery_below_pct"] else "PASS"


def label(rec: dict) -> dict:
    reason = validate(rec)
    if reason:
        return {"valid": False, "reason": reason, "primary": None, "risk_set": [], "gate": None,
                "legacy3": None, "disposition": ["STOP"]}  # fail-safe: unreadable telemetry means stop
    risks = risk_set(rec)
    primary = risks[0] if risks else "NORMAL_NAV"
    return {
        "valid": True,
        "primary": primary,
        "risk_set": risks,
        "gate": gate(rec),
        "legacy3": LEGACY3[primary],
        # the disposition always covers EVERY risk, whichever one was chosen as primary
        "disposition": [DISPOSITION[r] for r in risks] or ["CONTINUE"],
    }
