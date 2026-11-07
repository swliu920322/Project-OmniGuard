"""Executable form of LABEL_SPEC.md: the deterministic rules of the experiment, as code.

Experimental conventions for a cloud-edge AGV *simulation*; none of the thresholds, priorities or
dispositions claims to come from real industrial equipment. The code labels a record from its numbers
(and, for the note layer, from an AI-annotated and AI-reviewed note status) so a gold label never depends on an LLM.
Thresholds live in THRESHOLDS: changing one is a new spec version.
"""
from __future__ import annotations

import re

SPEC_VERSION = "1.0"
MAX_NOTE_CHARS = 500  # a longer note is out of contract (INVALID_INPUT), not truncated
FAULTS = ("TIMEOUT", "RATE_LIMIT", "API_ERROR")  # interface faults: no reply at all

# "below" means <, "above" means >. All values are experimental conventions (see LABEL_SPEC.md).
THRESHOLDS = {
    "distance_below_cm": 30,      # the simulation's configured minimum safe distance
    "temperature_above_c": 60,    # the simulation's configured temperature maximum
    "velocity_above_ms": 2.5,     # the simulation's configured maximum velocity
    "battery_below_pct": 20,      # experimental: lowest value the original generator called normal
    "hp_below": 50,               # experimental: lowest value the original generator called normal
    "gate_battery_below_pct": 5,  # the simulator's physical gate (brain.py): battery < 5
    "gate_hp_at_or_below": 0,     # the simulator's physical gate (brain.py): HP <= 0
}

DOMAIN = {  # outside this: INVALID_INPUT, rejected before any classifier
    "distance_cm": (0, 2000),
    "velocity_ms": (0, 5),
    "hp": (0, 100),
    "battery_pct": (0, 100),
    "temperature_c": (-40, 150),
}

CLASSES = ["NORMAL_NAV", "CRITICAL_OBSTACLE", "LOW_BATTERY", "OVERHEAT", "LOW_HEALTH", "OVERSPEED"]
# Experimental convention for which risk names the primary route when several fire.
PRIORITY = ["CRITICAL_OBSTACLE", "OVERHEAT", "LOW_HEALTH", "LOW_BATTERY", "OVERSPEED"]
HALT_RISKS = ("CRITICAL_OBSTACLE", "OVERHEAT", "LOW_HEALTH")  # these stop the vehicle
LEGACY3 = {"CRITICAL_OBSTACLE": "CRITICAL_OBSTACLE", "NORMAL_NAV": "NORMAL_NAV",
           "LOW_BATTERY": "SENSOR_ERROR", "OVERHEAT": "SENSOR_ERROR", "LOW_HEALTH": "SENSOR_ERROR",
           "OVERSPEED": None}  # the old task had no such class: excluded from the compatibility check

# Annotated status (AI annotation and AI review) of an operator note about "a person or obstacle ahead" (the only topic).
NOTE_STATUSES = ["AFFIRMED_CURRENT", "NEGATED", "HISTORICAL", "HYPOTHETICAL", "UNCERTAIN", "IRRELEVANT"]
NOTE_RISK_STATUSES = ("AFFIRMED_CURRENT", "UNCERTAIN")  # these add CRITICAL_OBSTACLE (an uncertain report halts: conservative)
# Clause combination, strictest first. A clause about the CURRENT state outranks one about the past, a condition or an
# unrelated matter; among current-state clauses the stricter wins. See LABEL_SPEC.md section 8.
CURRENT_STATE_ORDER = ["AFFIRMED_CURRENT", "UNCERTAIN", "NEGATED"]
OTHER_ORDER = ["HISTORICAL", "HYPOTHETICAL", "IRRELEVANT"]


def combine_clause_statuses(clauses: list[str]) -> str:
    """Overall status of a multi-clause note from the statuses of its clauses about the topic."""
    for status in clauses:
        if status not in NOTE_STATUSES:
            raise ValueError(f"unknown clause status {status!r}")
    for status in CURRENT_STATE_ORDER + OTHER_ORDER:
        if status in clauses:
            return status
    return "IRRELEVANT"


def validate(rec: dict) -> str | None:
    for key, (lo, hi) in DOMAIN.items():
        v = rec.get(key)
        if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v:  # also rejects NaN
            return f"{key} missing or not a number"
        if not lo <= v <= hi:
            return f"{key}={v} outside [{lo}, {hi}]"
    return None


def risk_set(rec: dict) -> list[str]:
    """Layer 1: telemetry risks, from the numbers only."""
    t = THRESHOLDS
    risks = []
    if rec["distance_cm"] < t["distance_below_cm"]:
        risks.append("CRITICAL_OBSTACLE")
    if rec["temperature_c"] > t["temperature_above_c"]:
        risks.append("OVERHEAT")
    if rec["hp"] < t["hp_below"]:
        risks.append("LOW_HEALTH")
    if rec["battery_pct"] < t["battery_below_pct"]:
        risks.append("LOW_BATTERY")
    if rec["velocity_ms"] > t["velocity_above_ms"]:
        risks.append("OVERSPEED")
    return [r for r in PRIORITY if r in risks]


def gate(rec: dict) -> str:
    """SKIP: the simulator's physical gate halts the vehicle before the router is asked."""
    t = THRESHOLDS
    return "SKIP" if rec["hp"] <= t["gate_hp_at_or_below"] or rec["battery_pct"] < t["gate_battery_below_pct"] else "PASS"


def note_effect(note_status: str | None, telemetry_risks: list[str]) -> dict:
    """Layer 2: what an annotated note does. It can add CRITICAL_OBSTACLE; it can never remove a risk."""
    if note_status is not None and note_status not in NOTE_STATUSES:
        raise ValueError(f"unknown note status {note_status!r}")
    adds = note_status in NOTE_RISK_STATUSES
    telemetry_obstacle = "CRITICAL_OBSTACLE" in telemetry_risks
    return {
        "adds_critical_obstacle": adds,
        # the two sources disagree (they may observe different ranges, so this is not a factual contradiction);
        # the stricter reading always wins
        "source_disagreement": (adds and not telemetry_obstacle) or (note_status == "NEGATED" and telemetry_obstacle),
    }


def resolve_action(risks: list[str], gate_state: str, estop: bool = False) -> dict:
    """Layer 3b: ONE executable motion state. Union of actions is NOT the rule.

    Any halt reason (emergency stop, physical gate, obstacle, overheat, low health) means the vehicle does not move:
    no return-to-charge, no speed-limited travel. Charging and the speed cap are kept as deferred follow-ups.
    """
    halt_reasons = (["ESTOP"] if estop else []) + (["GATE"] if gate_state == "SKIP" else []) + [r for r in risks if r in HALT_RISKS]
    holds = [h for h, r in (("COOL", "OVERHEAT"), ("LOCK", "LOW_HEALTH")) if r in risks]
    if halt_reasons:
        deferred = [d for d, r in (("RETURN_TO_CHARGE", "LOW_BATTERY"), ("LIMIT_SPEED_ON_RESUME", "OVERSPEED")) if r in risks]
        return {"motion": "HALT", "goal": "NONE", "speed_cap": False, "halt_reasons": halt_reasons, "holds": holds, "deferred": deferred}
    return {
        "motion": "MOVE_LIMITED" if "OVERSPEED" in risks else "MOVE",
        "goal": "CHARGER" if "LOW_BATTERY" in risks else "CONTINUE",
        "speed_cap": "OVERSPEED" in risks, "halt_reasons": [], "holds": [], "deferred": [],
    }


def label(rec: dict) -> dict:
    """Telemetry layer only (what the baseline-A task knows): risks, primary, gate, legacy3, action."""
    return compose(rec)


def compose(rec: dict, note_status: str | None = None, estop: bool = False) -> dict:
    """Code-side synthesis: gold labels and the executable action from telemetry + annotated note + e-stop flag.

    `estop` is a structured flag from a separate deterministic entry. Text in a note is never read as a stop command.
    """
    reason = validate(rec)
    if reason:
        return {"valid": False, "reason": reason, "primary": None, "risk_set": [], "gate": None, "legacy3": None,
                "note": None, "action": {"motion": "HALT", "goal": "NONE", "speed_cap": False,
                                          "halt_reasons": ["INVALID_INPUT"] + (["ESTOP"] if estop else []), "holds": [], "deferred": []}}
    tele = risk_set(rec)
    note = note_effect(note_status, tele)
    risks = [r for r in PRIORITY if r in tele or (r == "CRITICAL_OBSTACLE" and note["adds_critical_obstacle"])]
    g = gate(rec)
    primary = risks[0] if risks else "NORMAL_NAV"
    return {
        "valid": True,
        "primary": primary,
        "telemetry_risks": tele,
        "risk_set": risks,
        "gate": g,
        "note": {"status": note_status, **note},
        "legacy3": LEGACY3[primary] if note_status is None else None,  # a compatibility view of telemetry-only records
        "action": resolve_action(risks, g, estop),
    }


# --- from a model reply to the executed action ---------------------------------------------------------------------

def check_input(rec: dict, note) -> str | None:
    """Input contract for a record plus its optional note. An empty or whitespace-only note counts as no note."""
    reason = validate(rec)
    if reason:
        return reason
    if note is not None and not isinstance(note, str):
        return "note is not text"
    if note is not None and len(note) > MAX_NOTE_CHARS:
        return f"note longer than {MAX_NOTE_CHARS} characters"
    return None


def _halted(reasons: list[str], estop: bool, **extra) -> dict:
    return {"valid": False, "primary": None, "risk_set": [], "added_risks": [], "forced_by": [], "floor_override": None,
            "primary_changed": None,
            "action": {"motion": "HALT", "goal": "NONE", "speed_cap": False, "deferred": [], "holds": [],
                       "halt_reasons": reasons + (["ESTOP"] if estop else [])}, **extra}


def execute(rec: dict, prediction: dict | None, note: str | None = None, estop: bool = False, fault: str | None = None) -> dict:
    """The one deterministic rule that turns a (possibly wrong or missing) model reply into the executed action.

    1. telemetry risks come from the code, never from the model;
    2. the predicted note_status adds CRITICAL_OBSTACLE by the same rule as the gold (AFFIRMED_CURRENT or UNCERTAIN);
    3. the predicted `primary`, if not NORMAL_NAV, is added as one more risk;
    4. the action resolver of section 5 runs once on the merged risks.
    Nothing a model says can remove a risk. HALT, with no model risk counted, when: the input is out of contract
    (INVALID_INPUT); the interface failed (`fault`: TIMEOUT / RATE_LIMIT / API_ERROR); the reply is unparseable, has a
    label or status outside the enums, has NO note_status (missing or null) although the record has a note, or has a
    note_status although it has none (PARSE_FAILURE). "No judgement given" is never read as "no risk".

    floor_override: did the code add anything the model's reply did not already cover? True when `added_risks` is not
    empty (a telemetry risk the model's reply did not name, even if the motion would have been the same) or `forced_by`
    is not empty (the stop flag or the physical gate halted a vehicle the model's reply would have let move). A gate or
    stop flag that only repeats a halt the model already asked for is not counted. `primary_changed` is the old, weaker
    comparison of the executed and the predicted primary, kept for information. `floor_override` and `primary_changed`
    are None (not False) when there was no usable reply: that is a failure, counted separately.
    """
    reason = check_input(rec, note)
    if reason:
        return _halted(["INVALID_INPUT"], estop, reason=reason)
    note = (note or "").strip() or None
    if fault is not None:
        if fault not in FAULTS:
            raise ValueError(f"unknown fault {fault!r}")
        return _halted([fault], estop)
    if not isinstance(prediction, dict):
        return _halted(["PARSE_FAILURE"], estop)
    primary, status = prediction.get("primary"), prediction.get("note_status")
    if primary not in CLASSES or (note is None and status is not None) or (note is not None and status not in NOTE_STATUSES):
        return _halted(["PARSE_FAILURE"], estop)
    tele = risk_set(rec)
    model = {r for r in ([primary] if primary != "NORMAL_NAV" else [])} | ({"CRITICAL_OBSTACLE"} if status in NOTE_RISK_STATUSES else set())
    model_risks = [r for r in PRIORITY if r in model]
    risks = [r for r in PRIORITY if r in model or r in tele]
    g = gate(rec)
    action = resolve_action(risks, g, estop)
    alone = resolve_action(model_risks, "PASS", False)
    forced_by = [] if alone["motion"] == "HALT" else [n for n, on in (("ESTOP", estop), ("GATE", g == "SKIP")) if on]
    added = [r for r in PRIORITY if r in tele and r not in model]
    executed_primary = risks[0] if risks else "NORMAL_NAV"
    return {"valid": True, "primary": executed_primary, "risk_set": risks,
            "added_risks": added, "forced_by": forced_by,
            "floor_override": bool(added or forced_by), "primary_changed": executed_primary != primary,
            "action": action}


# --- numeric precision: the model must see exactly the numbers the label was computed from -------------------------

def _fmt(v) -> str:
    if round(v, 2) != v:
        raise ValueError(f"{v!r} has more than 2 decimals; generated values must not")
    return repr(v)


def render_telemetry(rec: dict, note: str | None = None) -> str:
    """Input text of the extended task. No int() cast (the baseline-A business path casts HP, battery, temperature)."""
    text = (f"Telemetry: Distance: {_fmt(rec['distance_cm'])}cm, Velocity: {_fmt(rec['velocity_ms'])}m/s, "
            f"HP: {_fmt(rec['hp'])}, Battery: {_fmt(rec['battery_pct'])}%, Temp: {_fmt(rec['temperature_c'])}C.")
    return text + (f" Operator note: {note}" if note else "")


_NUM = r"(-?\d+(?:\.\d+)?)"
_RENDERED = re.compile(rf"Distance: {_NUM}cm, Velocity: {_NUM}m/s, HP: {_NUM}, Battery: {_NUM}%, Temp: {_NUM}C\.")


def parse_rendered(text: str) -> dict:
    m = _RENDERED.search(text)
    if not m:
        raise ValueError("not a rendered telemetry string")
    n = [float(g) if "." in g else int(g) for g in m.groups()]
    return dict(zip(("distance_cm", "velocity_ms", "hp", "battery_pct", "temperature_c"), n))
