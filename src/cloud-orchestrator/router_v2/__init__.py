"""Extended router (spec 1.0, prompt B-1.0) for the backend. Opt-in per tenant: legacy tenants never load it."""
from .pipeline import ModelReply, decide, openai_model_call  # noqa: F401
