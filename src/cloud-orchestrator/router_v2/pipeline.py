"""One decision: telemetry (+ optional operator note, + emergency-stop flag) -> executed action, with the model injected.

The same steps as the baseline-B evaluation (eval/baseline_b): check the input contract in code BEFORE any model call, render the exact
numbers, ask the model once with the B-1.0 prompt, parse the reply strictly, then let rules.execute() build the one executed action
(code floor + model, nothing can remove a risk, anything unusable halts). tests/test_router_v2.py checks that this path and the evaluation
path give identical results for the same replies.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from . import prompt as P
from . import rules as R

MAX_TOKENS = 2048   # same output bound as the evaluation runs
TEMPERATURE = 0     # sent, but the provider's default reasoning mode ignores it (see eval/baseline_b/DIAGNOSTIC_PLAN.md)


@dataclass
class ModelReply:
    content: str | None = None
    finish_reason: str | None = None
    fault: str | None = None          # TIMEOUT / RATE_LIMIT / API_ERROR when no reply exists
    usage: dict | None = None


def fault_of(exc: BaseException) -> str:
    name = type(exc).__name__ + " " + str(getattr(exc, "status_code", None))
    if "Timeout" in name:
        return "TIMEOUT"
    if "RateLimit" in name or "429" in name:
        return "RATE_LIMIT"
    return "API_ERROR"


def openai_model_call(client, model_name: str, max_tokens: int = MAX_TOKENS, temperature: float = TEMPERATURE):
    """Adapter for an OpenAI-compatible client; one request, no retry, errors become faults, never exceptions."""

    def call(system_prompt: str, user_input: str) -> ModelReply:
        try:
            resp = client.chat.completions.create(model=model_name, messages=[{"role": "system", "content": system_prompt},
                                                  {"role": "user", "content": user_input}], temperature=temperature, max_tokens=max_tokens)
        except Exception as exc:  # noqa: BLE001 - an API failure is a fault, the vehicle halts
            return ModelReply(fault=fault_of(exc))
        choice = resp.choices[0]
        usage = getattr(resp, "usage", None)
        return ModelReply(content=choice.message.content, finish_reason=choice.finish_reason,
                          usage=usage.model_dump() if hasattr(usage, "model_dump") else usage)

    return call


def no_retry_client(client, timeout: float = 60.0):
    """The client with SDK retries off and a fixed timeout, or RuntimeError if that cannot be confirmed (so a retry can never hide a failure)."""
    limited = client.with_options(max_retries=0, timeout=timeout)
    if getattr(limited, "max_retries", None) != 0 or getattr(limited, "timeout", None) != timeout:
        raise RuntimeError("could not confirm that SDK retries are disabled and the timeout is fixed")
    return limited


def precheck(rec: dict, note) -> str | None:
    """Everything decide() rejects before a model call, so a caller can refuse a request before touching any external service."""
    reason = R.check_input(rec, note)
    if reason is None:
        try:
            R.render_telemetry(rec, (note or "").strip() or None)
        except ValueError as exc:
            reason = str(exc)
    return reason


MAX_SPEED_CM_S = 250  # 2.5 m/s, the OVERSPEED threshold, in the cm/s unit of the action schema
DEFAULT_ALLOWED_ACTIONS = ("stop", "turn", "move")
MAX_TURN_DEGREE = 180  # simulation convention for the schema's `degree: int`: a turn is -180..180 degrees; nothing here is a real vehicle's limit


def _finite_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def validate_actions(actions, decision_action: dict, target_speed, allowed=DEFAULT_ALLOWED_ACTIONS) -> list[str]:
    """Violations of the fixed action contract by an action list (empty = acceptable). The router's decision is never loosened.

    The contract (a simulation convention matching the tenant schema `[{'action': 'stop'|'turn'|'move', 'degree': int, 'speed': int}]`):
    - `stop`: no speed, or a speed of exactly 0 (a stop with a positive speed contradicts itself);
    - `move`: a finite numeric `speed` is REQUIRED (without it the code cannot check the cap);
    - `turn`: an integer `degree` in -180..180 and a finite numeric `speed` are both REQUIRED;
    - every speed is between 0 and the cap: the request's `target_speed`, and at most 250 cm/s (2.5 m/s) while the decision has a speed cap;
    - a halting decision allows only `stop`;
    - the list must be non-empty, every item a dict with an allowed, known action; anything missing, malformed or contradictory is a violation.
    """
    if not isinstance(actions, list) or not actions:
        return ["the action list is missing, empty or not a list"]
    cap = target_speed if _finite_number(target_speed) else MAX_SPEED_CM_S
    if decision_action.get("speed_cap"):
        cap = min(cap, MAX_SPEED_CM_S)
    problems = []
    for i, a in enumerate(actions):
        if not isinstance(a, dict) or a.get("action") not in allowed or a.get("action") not in DEFAULT_ALLOWED_ACTIONS:
            problems.append(f"action {i}: {a!r} is not an allowed action {list(allowed)}")
            continue
        kind = a["action"]
        if decision_action.get("motion") == "HALT" and kind != "stop":
            problems.append(f"action {i}: {kind!r} while the decision is HALT")
        speed = a.get("speed", None)
        if kind == "stop":
            if "speed" in a and not (_finite_number(speed) and speed == 0):
                problems.append(f"action {i}: stop with speed {speed!r} (must have none or 0)")
            continue
        if kind == "turn":
            deg = a.get("degree")
            if isinstance(deg, bool) or not isinstance(deg, int) or not -MAX_TURN_DEGREE <= deg <= MAX_TURN_DEGREE:
                problems.append(f"action {i}: turn needs an integer degree in -{MAX_TURN_DEGREE}..{MAX_TURN_DEGREE}, got {deg!r}")
        if "speed" not in a:
            problems.append(f"action {i}: {kind} needs a numeric speed")
        elif not _finite_number(speed) or speed < 0 or speed > cap:
            problems.append(f"action {i}: speed {speed!r} outside 0..{cap}")
    return problems


def decide(rec: dict, note: str | None, call_model, estop: bool = False) -> dict:
    """Returns {"executed": rules.execute(...), "model_called": bool, "prediction": ..., "parse_error": ..., "user_input": ...}."""
    base = {"model_called": False, "prediction": None, "parse_error": None, "user_input": None, "fault": None}
    reason = R.check_input(rec, note)
    if reason is None:
        clean_note = (note or "").strip() or None
        try:
            user = R.render_telemetry(rec, clean_note)
        except ValueError as exc:  # more than 2 decimals: the model could not see the exact numbers the code compares
            reason = str(exc)
    if reason is not None:
        # one INVALID_INPUT halt for every out-of-contract case, including the precision limit that only the renderer knows
        return {**base, "executed": R._halted(["INVALID_INPUT"], estop, reason=reason), "invalid_reason": reason}
    reply = call_model(P.SYSTEM_PROMPT, user)
    out = {**base, "model_called": True, "user_input": user, "fault": reply.fault, "finish_reason": reply.finish_reason, "usage": reply.usage}
    if reply.fault:
        return {**out, "executed": R.execute(rec, None, clean_note, estop, fault=reply.fault)}
    if reply.finish_reason != "stop":
        return {**out, "parse_error": f"finish_reason {reply.finish_reason!r} is not 'stop'", "executed": R.execute(rec, None, clean_note, estop)}
    prediction, err = P.parse_reply(reply.content)
    return {**out, "prediction": prediction, "parse_error": err, "executed": R.execute(rec, prediction, clean_note, estop)}
