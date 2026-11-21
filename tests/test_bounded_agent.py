"""bounded_agent.ask_agent_bounded: one request, retries off, fixed timeout, no cache, classified faults. Fake client only; no network, no key."""
import pathlib
import sys
from unittest.mock import MagicMock, patch

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src/cloud-orchestrator"))
from embodied_brain import bounded_agent as B  # noqa: E402


class FakeSDK:
    def __init__(self, content="PASS", exc=None, honour=True):
        self.content, self.exc, self.honour = content, exc, honour
        self.requests, self.max_retries, self.timeout, self.kwargs = 0, 2, 600.0, []
        self.chat = type("Chat", (), {"completions": type("C", (), {"create": staticmethod(self._create)})()})()

    def with_options(self, **o):
        if self.honour:
            self.max_retries, self.timeout = o["max_retries"], o["timeout"]
        return self

    def _create(self, **kw):
        self.requests += 1
        self.kwargs.append(kw)
        if self.exc:
            raise self.exc
        return MagicMock(choices=[MagicMock(message=MagicMock(content=self.content))])


class APITimeoutError(Exception):
    pass


class RateLimitError(Exception):
    status_code = 429


def ask(sdk, **kw):
    with patch.object(B, "get_llm_client_and_model", lambda: (sdk, "m")):
        return B.ask_agent_bounded("system", "user", **kw)


def test_one_request_with_retries_off_and_the_fixed_timeout():
    sdk = FakeSDK(content="  PASS \n")
    assert ask(sdk, max_completion_tokens=50) == "PASS"
    assert sdk.requests == 1 and sdk.max_retries == 0 and sdk.timeout == B.BOUND_TIMEOUT_S
    assert sdk.kwargs[0]["max_completion_tokens"] == 50 and sdk.kwargs[0]["temperature"] == 0.0


def test_if_retries_cannot_be_confirmed_off_nothing_is_sent():
    sdk = FakeSDK(honour=False)
    with pytest.raises(B.AgentFault) as e:
        ask(sdk)
    assert e.value.kind == "API_ERROR" and sdk.requests == 0


@pytest.mark.parametrize("exc,kind", [(APITimeoutError("t"), "TIMEOUT"), (RateLimitError("r"), "RATE_LIMIT"), (RuntimeError("x"), "API_ERROR")])
def test_a_failed_request_is_a_classified_fault_and_is_not_retried(exc, kind):
    sdk = FakeSDK(exc=exc)
    with pytest.raises(B.AgentFault) as e:
        ask(sdk)
    assert e.value.kind == kind and sdk.requests == 1


@pytest.mark.parametrize("content", [None, "", "   \n"])
def test_an_empty_reply_is_a_bad_reply(content):
    with pytest.raises(B.AgentFault) as e:
        ask(FakeSDK(content=content))
    assert e.value.kind == "BAD_REPLY"


def test_there_is_no_result_cache():
    sdk = FakeSDK()
    ask(sdk), ask(sdk)
    assert sdk.requests == 2


def test_a_client_lookup_failure_is_a_fault_not_a_crash():
    with patch.object(B, "get_llm_client_and_model", side_effect=RuntimeError("no client")):
        with pytest.raises(B.AgentFault) as e:
            B.ask_agent_bounded("s", "u")
    assert e.value.kind == "API_ERROR"
