import os
import logging
from enum import Enum
from dataclasses import dataclass
from typing import Union, Optional

from openai import OpenAI, AsyncOpenAI, AzureOpenAI, AsyncAzureOpenAI


class LLMProviderType(Enum):
    AZURE_OPENAI = "azure"
    OPENAI_COMPATIBLE = "openai"


@dataclass
class LLMConfig:
    provider: LLMProviderType
    endpoint: str
    api_key: str
    model_name: str
    api_version: str = ""

    def is_azure(self) -> bool:
        return self.provider == LLMProviderType.AZURE_OPENAI


def _load_local_settings():
    _parent_dir = os.path.dirname(os.path.abspath(__file__))
    _settings_path = os.path.join(_parent_dir, "local.settings.json")
    if os.path.exists(_settings_path):
        try:
            import json
            with open(_settings_path, "r", encoding="utf-8") as f:
                _settings = json.load(f)
            _values = _settings.get("Values", {})
            for k, v in _values.items():
                if k not in os.environ:
                    os.environ[k] = str(v)
        except Exception as e:
            logging.warning(f"Failed to load local.settings.json: {e}")


_load_local_settings()


# OpenAI-compatible services share one client; presets only supply default URL and model.
# Separate presets avoid sending an OpenAI key to DeepSeek when the URL is left unset.
OPENAI_COMPATIBLE_PRESETS = {
    "openai": {"endpoint": "https://api.openai.com/v1", "model": "gpt-4o-mini"},
    "deepseek": {"endpoint": "https://api.deepseek.com", "model": "deepseek-chat"},
}
AZURE_ALIASES = {"azure", "azure_openai", "azure-openai"}
GENERIC_COMPATIBLE_ALIASES = {"openai-compatible", "compatible"}


def _resolve_provider_name(service_name: str) -> str:
    """Pick the provider name: {SERVICE}_LLM_PROVIDER, then LLM_PROVIDER, then infer.
    """
    name = ""
    if service_name:
        name = os.environ.get(f"{service_name}_LLM_PROVIDER", "").strip()
    if not name:
        name = os.environ.get("LLM_PROVIDER", "").strip()
    if not name:
        # Keeps old Azure setups working: an Azure endpoint means Azure, otherwise DeepSeek.
        name = "azure" if os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip() else "deepseek"
    return name.lower()


def resolve_llm_config(service_name: str = "") -> LLMConfig:
    """Resolve LLM provider configuration from env vars.

    Provider (LLM_PROVIDER, or {SERVICE}_LLM_PROVIDER for one service):
      azure     Azure OpenAI. Uses AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY,
                {SERVICE}_DEPLOYMENT_NAME | AZURE_OPENAI_DEPLOYMENT_NAME (default gpt-4o-mini),
                AZURE_OPENAI_API_VERSION.
      openai    OpenAI. Defaults: https://api.openai.com/v1, gpt-4o-mini.
      deepseek  DeepSeek. Defaults: https://api.deepseek.com, deepseek-chat.
      openai-compatible  Any other OpenAI-compatible service; OPENAI_BASE_URL is required.
    For openai / deepseek / openai-compatible:
      Endpoint: {SERVICE}_LLM_ENDPOINT | OPENAI_BASE_URL | preset default
      Key:      {SERVICE}_LLM_API_KEY | OPENAI_API_KEY
      Model:    {SERVICE}_MODEL_NAME | OPENAI_MODEL_NAME | preset default
    If no provider is set: azure when AZURE_OPENAI_ENDPOINT is set, otherwise deepseek.
    """
    provider_name = _resolve_provider_name(service_name)

    if provider_name in AZURE_ALIASES:
        endpoint = (os.environ.get("AZURE_OPENAI_ENDPOINT") or os.environ.get("OPENAI_BASE_URL") or "").strip()
        api_key = (os.environ.get("AZURE_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip()

        model_name = ""
        if service_name:
            model_name = os.environ.get(f"{service_name}_DEPLOYMENT_NAME", "").strip()
        if not model_name:
            model_name = (
                os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME")
                or os.environ.get("OPENAI_DEPLOYMENT_NAME")
                or os.environ.get("OPENAI_API_DEPLOYMENT_NAME")
                or "gpt-4o-mini"
            ).strip()

        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-01-preview").strip()
        return LLMConfig(LLMProviderType.AZURE_OPENAI, endpoint, api_key, model_name, api_version)

    # Fail on unknown names instead of silently falling back to Azure (e.g. a typo like "azur").
    if provider_name not in OPENAI_COMPATIBLE_PRESETS and provider_name not in GENERIC_COMPATIBLE_ALIASES:
        valid = sorted(AZURE_ALIASES | set(OPENAI_COMPATIBLE_PRESETS) | GENERIC_COMPATIBLE_ALIASES)
        raise ValueError(f"Unknown LLM_PROVIDER '{provider_name}'. Valid values: {', '.join(valid)}")

    preset = OPENAI_COMPATIBLE_PRESETS.get(provider_name, {})

    endpoint = ""
    if service_name:
        endpoint = os.environ.get(f"{service_name}_LLM_ENDPOINT", "").strip()
    if not endpoint:
        endpoint = (os.environ.get("OPENAI_BASE_URL", "").strip() or preset.get("endpoint", ""))

    api_key = ""
    if service_name:
        api_key = os.environ.get(f"{service_name}_LLM_API_KEY", "").strip()
    if not api_key:
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()

    model_name = ""
    if service_name:
        model_name = os.environ.get(f"{service_name}_MODEL_NAME", "").strip()
    if not model_name:
        model_name = (os.environ.get("OPENAI_MODEL_NAME", "").strip() or preset.get("model", ""))

    return LLMConfig(LLMProviderType.OPENAI_COMPATIBLE, endpoint, api_key, model_name)


def create_llm_client(config: LLMConfig) -> Union[OpenAI, AzureOpenAI]:
    if config.is_azure():
        if not config.endpoint or not config.api_key:
            raise ValueError("Missing AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY")
        return AzureOpenAI(
            azure_endpoint=config.endpoint,
            api_key=config.api_key,
            api_version=config.api_version,
        )
    else:
        if not config.endpoint or not config.api_key:
            raise ValueError("Missing OPENAI_API_KEY (and OPENAI_BASE_URL for openai-compatible providers)")
        return OpenAI(base_url=config.endpoint, api_key=config.api_key)


def create_async_llm_client(config: LLMConfig) -> Union[AsyncOpenAI, AsyncAzureOpenAI]:
    if config.is_azure():
        if not config.endpoint or not config.api_key:
            raise ValueError("Missing AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY")
        return AsyncAzureOpenAI(
            azure_endpoint=config.endpoint,
            api_key=config.api_key,
            api_version=config.api_version,
        )
    else:
        if not config.endpoint or not config.api_key:
            raise ValueError("Missing OPENAI_API_KEY (and OPENAI_BASE_URL for openai-compatible providers)")
        return AsyncOpenAI(base_url=config.endpoint, api_key=config.api_key)


def ensure_model_keyword(config: LLMConfig) -> str:
    """Return the appropriate 'model' kwarg for chat.completions.create() calls.
    For Azure this is the deployment name; for OpenAI-compatible it's the model name."""
    return config.model_name
