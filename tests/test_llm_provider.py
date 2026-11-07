import pytest

import llm_provider
from llm_provider import LLMProviderType, resolve_llm_config

ENV_KEYS = [
    "LLM_PROVIDER", "BRAIN_LLM_PROVIDER", "BRAIN_LLM_ENDPOINT", "BRAIN_LLM_API_KEY",
    "BRAIN_MODEL_NAME", "BRAIN_DEPLOYMENT_NAME", "OPENAI_BASE_URL", "OPENAI_API_KEY",
    "OPENAI_MODEL_NAME", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_DEPLOYMENT_NAME", "AZURE_OPENAI_API_VERSION",
]


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    # llm_provider copies local.settings.json into os.environ on import;
    # clear it so results don't depend on the developer's machine.
    for key in ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


def test_deepseek_defaults(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "deepseek")
    monkeypatch.setenv("OPENAI_API_KEY", "k")
    cfg = resolve_llm_config()
    assert cfg.provider == LLMProviderType.OPENAI_COMPATIBLE
    assert cfg.endpoint == "https://api.deepseek.com"
    assert cfg.model_name == "deepseek-chat"


def test_openai_defaults_do_not_point_at_deepseek(monkeypatch):
    # Regression: provider=openai with no URL set must use OpenAI's own default URL.
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "k")
    cfg = resolve_llm_config()
    assert cfg.endpoint == "https://api.openai.com/v1"
    assert cfg.model_name == "gpt-4o-mini"


def test_explicit_values_override_presets(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_BASE_URL", "http://localhost:1234/v1")
    monkeypatch.setenv("OPENAI_MODEL_NAME", "local-model")
    cfg = resolve_llm_config()
    assert cfg.endpoint == "http://localhost:1234/v1"
    assert cfg.model_name == "local-model"


def test_azure_uses_deployment_name_and_api_version(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "azure")
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://x.openai.azure.com")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "k")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT_NAME", "my-deploy")
    cfg = resolve_llm_config()
    assert cfg.is_azure()
    assert cfg.model_name == "my-deploy"
    assert cfg.api_version


def test_provider_inferred_when_unset(monkeypatch):
    # No LLM_PROVIDER: Azure if an Azure endpoint is set, otherwise DeepSeek.
    assert resolve_llm_config().provider == LLMProviderType.OPENAI_COMPATIBLE
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://x.openai.azure.com")
    assert resolve_llm_config().is_azure()


def test_per_service_override(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "deepseek")
    monkeypatch.setenv("OPENAI_API_KEY", "global")
    monkeypatch.setenv("BRAIN_LLM_PROVIDER", "openai")
    monkeypatch.setenv("BRAIN_LLM_API_KEY", "brain-key")
    monkeypatch.setenv("BRAIN_MODEL_NAME", "gpt-4o")
    brain = resolve_llm_config("BRAIN")
    assert (brain.endpoint, brain.api_key, brain.model_name) == ("https://api.openai.com/v1", "brain-key", "gpt-4o")
    assert resolve_llm_config().endpoint == "https://api.deepseek.com"


def test_unknown_provider_is_rejected(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "azur")
    with pytest.raises(ValueError, match="Valid values"):
        resolve_llm_config()


def test_clients_require_credentials(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    with pytest.raises(ValueError):
        llm_provider.create_llm_client(resolve_llm_config())
    monkeypatch.setenv("OPENAI_API_KEY", "k")
    assert llm_provider.create_llm_client(resolve_llm_config()).base_url
