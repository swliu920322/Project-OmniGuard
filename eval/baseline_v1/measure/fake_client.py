"""A fake LLM client for the offline rehearsal. It never opens a socket.

It behaves like the reasoning model seen in the real canary: it ignores max_completion_tokens,
honours max_tokens (reasoning tokens count), and spends reasoning tokens before the text reply.
It mimics the parts of the OpenAI SDK the runner uses: with_options(), the max_retries property,
chat.completions.create() and chat.completions.with_raw_response.create(). Its answers come from a
trivial rule plus scripted faults, so a run against it proves the harness works and says NOTHING
about any real model.
"""
from __future__ import annotations

import os
import re
import signal


class RateLimitError(Exception):
    """Same name as the SDK's error, so the recorded error type looks like a real one."""

    status_code = 429


class APITimeoutError(Exception):
    status_code = None


# Scripted faults, keyed by the 1-based number of the request that reaches the fake.
#   rate_limit / timeout   the call raises, like the SDK's errors
#   malformed / empty      the reply is not a label
#   no_usage               the response carries no usage field
#   truncate               the reasoning is longer than max_tokens: finish_reason "length", empty reply
#   truncate_label         cut off at max_tokens but the text so far IS a valid label (must still score invalid)
#   usage_over             the reported prompt tokens are far above any sane bound
#   long_reply             the provider ignores every cap: completion tokens far above max_tokens
#   interrupt              Ctrl+C arrives while the request is in flight (KeyboardInterrupt)
#   sigterm                the process receives SIGTERM while the request is in flight
DEFAULT_FAULTS = {
    7: "rate_limit",
    15: "timeout",
    21: "malformed",  # a sentence that contains SENSOR_ERROR but is not a label
    29: "empty",
    40: "no_usage",
    50: "truncate",
    55: "truncate_label",
}
REASONING_TOKENS = 60  # what the fake "thinks" before every reply (the real canary: 58)
MODEL_SWITCH_AT = 330  # from this request on the fake reports a different model string


class _Response:
    def __init__(self, content, model, usage, request_no, finish_reason="stop"):
        self.id = f"fake-{request_no:05d}"
        self.model = model
        self.usage = usage
        self._content = content
        self._finish = finish_reason
        self.choices = [type("Choice", (), {"message": type("Message", (), {"content": content})(), "finish_reason": finish_reason})()]

    def model_dump(self) -> dict:
        return {
            "id": self.id,
            "object": "chat.completion",
            "created": 0,
            "model": self.model,
            "choices": [{
                "index": 0,
                "finish_reason": self._finish,
                "message": {"role": "assistant", "content": self._content, "reasoning_content": "fake reasoning"},
            }],
            "usage": self.usage,
        }


class _RawResponse:
    status_code = 200

    def __init__(self, parsed, request_no):
        self._parsed = parsed
        self.headers = {"x-request-id": f"fake-req-{request_no:05d}", "date": "Thu, 01 Jan 1970 00:00:00 GMT"}

    def parse(self):
        return self._parsed


def _toy_rule(user_text: str) -> str:
    """A throwaway classifier, only so that replies vary."""

    def grab(pattern):
        m = re.search(pattern, user_text)
        return float(m.group(1)) if m else None

    dist, temp, bat, hp = grab(r"Distance: ([\d.]+)cm"), grab(r"Temp: ([\d.]+)C"), grab(r"Battery: ([\d.]+)%"), grab(r"HP: ([\d.]+)")
    if (temp or 0) > 60 or (bat if bat is not None else 100) < 10 or (hp if hp is not None else 100) < 20:
        return "SENSOR_ERROR"
    if dist is not None and dist < 50:
        return "CRITICAL_OBSTACLE"
    return "NORMAL_NAV"


class _Completions:
    def __init__(self, owner):
        self._owner = owner

    def create(self, **kwargs):
        return self._owner._respond(kwargs)


class _RawCompletions:
    def __init__(self, owner):
        self._owner = owner

    def create(self, **kwargs):
        parsed = self._owner._respond(kwargs)
        return _RawResponse(parsed, self._owner.requests_received)


class _Chat:
    def __init__(self, owner):
        self.completions = _Completions(owner)
        self.completions.with_raw_response = _RawCompletions(owner)


class FakeClient:
    def __init__(self, faults: dict | None = None, model: str = "fake-model-1", switch_model: bool = True):
        self.faults = DEFAULT_FAULTS if faults is None else faults
        self.model = model
        self.switch_model = switch_model
        self.requests_received = 0  # every request that reached the fake, retries included
        self.last_request = None
        self.max_retries = 2  # like the SDK default; with_options() lowers it
        self.timeout = 600.0
        self.options_applied: list[dict] = []
        self.chat = _Chat(self)

    def with_options(self, **options):
        self.options_applied.append(options)
        self.max_retries = options.get("max_retries", self.max_retries)
        self.timeout = options.get("timeout", self.timeout)
        return self

    def _respond(self, kwargs: dict):
        self.requests_received += 1
        n = self.requests_received
        self.last_request = kwargs
        fault = self.faults.get(n)
        if fault == "rate_limit":
            raise RateLimitError("fake 429: rate limit exceeded (scripted fault)")
        if fault == "timeout":
            raise APITimeoutError("fake timeout (scripted fault)")
        if fault == "interrupt":
            raise KeyboardInterrupt("scripted Ctrl+C")
        if fault == "sigterm":
            os.kill(os.getpid(), signal.SIGTERM)  # the runner turns this into KeyboardInterrupt
        content = _toy_rule(kwargs["messages"][-1]["content"])
        if fault == "malformed":
            content = "The label is SENSOR_ERROR, because the battery looks low."
        elif fault == "empty":
            content = ""
        prompt_tokens = sum(len(m["content"]) for m in kwargs["messages"]) // 3 + 8
        reasoning = REASONING_TOKENS * (40 if fault == "truncate" else 1)
        text_tokens = max(1, len(content) // 3)
        completion = reasoning + text_tokens
        finish = "stop"
        cap = kwargs.get("max_tokens")  # max_completion_tokens is ignored, like the real model
        if cap is not None and completion > cap:
            completion, finish, content = cap, "length", ""  # cut off before the reply: reasoning ate the budget
        if fault == "truncate_label":
            completion, finish = kwargs.get("max_tokens", 1024), "length"  # keeps the valid label it had produced
        if fault == "long_reply":
            completion = 5000  # a provider that ignores every cap
        usage = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion,
            "total_tokens": prompt_tokens + completion,
            "completion_tokens_details": {"reasoning_tokens": min(reasoning, completion)},
        }
        if fault == "no_usage":
            usage = None
        elif fault == "usage_over":
            usage = {"prompt_tokens": 10_000_000, "completion_tokens": 3, "total_tokens": 10_000_003}
        model = self.model + "-b" if (self.switch_model and n >= MODEL_SWITCH_AT) else self.model
        return _Response(content, model, usage, n, finish)
