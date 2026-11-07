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
