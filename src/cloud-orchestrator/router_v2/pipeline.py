"""One decision: telemetry (+ optional operator note, + emergency-stop flag) -> executed action, with the model injected.

The same steps as the baseline-B evaluation (eval/baseline_b): check the input contract in code BEFORE any model call, render the exact
numbers, ask the model once with the B-1.0 prompt, parse the reply strictly, then let rules.execute() build the one executed action
(code floor + model, nothing can remove a risk, anything unusable halts). tests/test_router_v2.py checks that this path and the evaluation
path give identical results for the same replies.
"""
from __future__ import annotations

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


def validate_actions(actions, decision_action: dict, target_speed, allowed=DEFAULT_ALLOWED_ACTIONS) -> list[str]:
    """Violations of the code constraints by an action list (empty = acceptable). The router's decision is never loosened:

    - a halting decision allows only `stop`;
    - every action must be a dict whose `action` is in the allowed set; an unparseable or empty list cannot be verified, so it is a violation;
    - `speed` must be a number between 0 and the cap: the request's target speed, and at most 250 cm/s (2.5 m/s) when the decision has a speed cap.
    """
    problems = []
    if not isinstance(actions, list) or not actions:
        return ["the action list is missing, empty or not a list"]
    cap = target_speed if isinstance(target_speed, (int, float)) and not isinstance(target_speed, bool) else MAX_SPEED_CM_S
    if decision_action.get("speed_cap"):
        cap = min(cap, MAX_SPEED_CM_S)
    for i, a in enumerate(actions):
        if not isinstance(a, dict) or a.get("action") not in allowed:
            problems.append(f"action {i}: {a!r} is not an allowed action {list(allowed)}")
            continue
        if decision_action.get("motion") == "HALT" and a["action"] != "stop":
            problems.append(f"action {i}: {a['action']!r} while the decision is HALT")
        if "speed" in a:
            sp = a["speed"]
            if isinstance(sp, bool) or not isinstance(sp, (int, float)) or sp != sp or sp < 0 or sp > cap:
                problems.append(f"action {i}: speed {sp!r} outside 0..{cap}")
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
