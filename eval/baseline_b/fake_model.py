"""A fake chat client for the offline rehearsal of the baseline-B runner. It never opens a socket.

It behaves like a reasoning model that obeys the JSON contract, with scripted faults to exercise every failure path.
Its answers come from the reference rules plus the R1 note rule, so a rehearsal proves the pipeline, never a model.
"""
from __future__ import annotations

import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "spec"))
import reference_labeler as R  # noqa: E402
import rule_control as C  # noqa: E402


class RateLimitError(Exception):
    status_code = 429


class APITimeoutError(Exception):
    status_code = None


# 1-based request number -> fault
DEFAULT_FAULTS = {3: "rate_limit", 8: "timeout", 13: "prose", 17: "fence", 21: "missing_key", 26: "bad_label",
                  31: "truncate", 36: "truncate_valid", 41: "no_usage", 46: "note_null", 51: "usage_over", 56: "empty"}
REASONING_TOKENS = 90


class _Resp:
    def __init__(self, content, finish, usage, n):
        self.id, self.model, self.usage = f"fake-{n:05d}", "fake-model-b", usage
        self._d = {"id": self.id, "object": "chat.completion", "created": 0, "model": self.model, "usage": usage,
                   "choices": [{"index": 0, "finish_reason": finish, "message": {"role": "assistant", "content": content}}]}
        self.choices = [type("C", (), {"message": type("M", (), {"content": content})(), "finish_reason": finish})()]

    def model_dump(self):
        return self._d


class _Raw:
    status_code = 200

    def __init__(self, parsed, n):
        self._p, self.headers = parsed, {"x-request-id": f"fake-req-{n:05d}"}

    def parse(self):
        return self._p


class FakeClient:
    def __init__(self, faults: dict | None = None):
        self.faults = DEFAULT_FAULTS if faults is None else faults
        self.requests_received, self.max_retries, self.timeout = 0, 2, 600.0
        owner = self
        self.chat = type("Chat", (), {"completions": type("Comp", (), {
            "create": staticmethod(owner._respond),
            "with_raw_response": type("Raw", (), {"create": staticmethod(lambda **kw: _Raw(owner._respond(**kw), owner.requests_received))})()})()})()

    def with_options(self, **opts):
        self.max_retries, self.timeout = opts.get("max_retries", self.max_retries), opts.get("timeout", self.timeout)
        return self

    def _respond(self, **kw):
        self.requests_received += 1
        n, fault = self.requests_received, self.faults.get(self.requests_received)
        if fault == "rate_limit":
            raise RateLimitError("fake 429 (scripted)")
        if fault == "timeout":
            raise APITimeoutError("fake timeout (scripted)")
        if fault == "interrupt":
            raise KeyboardInterrupt("scripted Ctrl+C")
        user = kw["messages"][-1]["content"]
        head, note = C.split_note(user)
        rec = R.parse_rendered(head)
        status = C.note_status_r1(note)
        primary = R.compose(rec, status)["primary"]
        body = {"primary": primary, "note_status": status}
        content = json.dumps(body)
        if fault == "prose":
            content = f"The class is {primary}."
        elif fault == "fence":
            content = "```json\n" + content + "\n```"
        elif fault == "missing_key":
            content = json.dumps({"primary": primary})
        elif fault == "bad_label":
            content = json.dumps({"primary": "HARDWARE_FAULT", "note_status": status})
        elif fault == "note_null":
            content = json.dumps({"primary": primary, "note_status": None})
        elif fault == "empty":
            content = ""
        prompt_tokens = sum(len(m["content"].encode()) for m in kw["messages"]) // 3 + 8
        completion = REASONING_TOKENS + len(content) // 3
        finish, cap = "stop", kw.get("max_tokens")
        if fault == "truncate":
            content, completion, finish = "", cap, "length"
        elif fault == "truncate_valid":
            completion, finish = cap, "length"  # a valid JSON that was cut off at the cap must still score invalid
        usage = {"prompt_tokens": prompt_tokens, "completion_tokens": completion, "total_tokens": prompt_tokens + completion,
                 "completion_tokens_details": {"reasoning_tokens": min(REASONING_TOKENS, completion)}}
        if fault == "no_usage":
            usage = None
        elif fault == "usage_over":
            usage = {"prompt_tokens": 10_000_000, "completion_tokens": 3, "total_tokens": 10_000_003}
        return _Resp(content, finish, usage, n)
