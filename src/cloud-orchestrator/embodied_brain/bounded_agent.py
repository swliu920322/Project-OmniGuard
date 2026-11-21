# file: src/cloud-orchestrator/embodied_brain/bounded_agent.py
"""Safety and Compiler requests of the extended tenant: one request, SDK retries off, a fixed timeout, no cache, a classified fault.

`ask_agent` (utils.py) uses the shared client with the SDK defaults (2 retries, 600 s read timeout) and has a 5 s result cache; the
legacy tenants and the benchmarks still use it and are left as they are. The extended flow uses this function instead, with the same
limits the Router has (router_v2.pipeline.no_retry_client). A failure is not an exception that ends as INTERNAL_ERROR: it is an AgentFault
with the kind the Router uses (TIMEOUT / RATE_LIMIT / API_ERROR) or BAD_REPLY, and the caller turns it into a stop.

The timeout is a placeholder equal to the Router's: no latency has been measured for these two roles yet (eval/DESIGN_SAFETY_COMPILER_EVAL.md).
Design and reasons: eval/DESIGN_BOUNDED_RETRY.md.
"""
from .utils import get_llm_client_and_model

BOUND_TIMEOUT_S = 60.0


class AgentFault(Exception):
    """A Safety or Compiler request that gave no usable reply. `kind` is one of TIMEOUT / RATE_LIMIT / API_ERROR / BAD_REPLY."""

    def __init__(self, kind: str, detail: str = ""):
        super().__init__(f"{kind}: {detail}" if detail else kind)
        self.kind, self.detail = kind, detail


def ask_agent_bounded(system_prompt: str, user_input: str, max_completion_tokens: int = 100, temperature: float = 0.0, *, timeout: float = BOUND_TIMEOUT_S) -> str:
    from router_v2.pipeline import fault_of, no_retry_client
    try:
        client, model_name = get_llm_client_and_model()
        limited = no_retry_client(client, timeout)  # RuntimeError if retries cannot be confirmed off: nothing is sent
    except Exception as exc:  # noqa: BLE001 - no usable client: the caller stops the vehicle
        raise AgentFault("API_ERROR", f"model client unavailable or retries cannot be disabled: {type(exc).__name__}") from exc
    try:
        response = limited.chat.completions.create(
            model=model_name,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_input}],
            max_completion_tokens=max_completion_tokens,
            temperature=temperature,
        )
    except Exception as exc:  # noqa: BLE001
        raise AgentFault(fault_of(exc), type(exc).__name__) from exc
    content = response.choices[0].message.content
    if not isinstance(content, str) or not content.strip():
        raise AgentFault("BAD_REPLY", "empty reply")
    return content.strip()
