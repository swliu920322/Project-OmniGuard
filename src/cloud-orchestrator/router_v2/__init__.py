"""Extended router (spec 1.0, prompt B-1.0) for the backend. Opt-in per tenant: legacy tenants never load it."""
from .pipeline import (DEFAULT_ALLOWED_ACTIONS, MAX_SPEED_CM_S, ModelReply, decide, no_retry_client, openai_model_call, precheck,  # noqa: F401
                       validate_actions)
