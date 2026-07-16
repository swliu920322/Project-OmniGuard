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


def resolve_llm_config(service_name: str = "") -> LLMConfig:
    """Resolve LLM provider configuration from env vars.

    Provider selection (priority):
      1. {SERVICE}_LLM_PROVIDER (e.g., BRAIN_LLM_PROVIDER)
      2. LLM_PROVIDER
      3. default: azure

    Azure provider:
      Endpoint: AZURE_OPENAI_ENDPOINT | OPENAI_BASE_URL
      Key:      AZURE_OPENAI_API_KEY | OPENAI_API_KEY
      Model:    {SERVICE}_DEPLOYMENT_NAME | AZURE_OPENAI_DEPLOYMENT_NAME | OPENAI_DEPLOYMENT_NAME -> gpt-4o-mini
      Version:  AZURE_OPENAI_API_VERSION -> 2024-10-01-preview

    OpenAI-compatible (DeepSeek, Together, etc.):
      Endpoint: {SERVICE}_LLM_ENDPOINT | OPENAI_BASE_URL -> https://api.deepseek.com
      Key:      {SERVICE}_LLM_API_KEY | OPENAI_API_KEY
      Model:    {SERVICE}_MODEL_NAME | OPENAI_MODEL_NAME -> deepseek-chat
    """
    provider_str = ""
    if service_name:
        provider_str = os.environ.get(f"{service_name}_LLM_PROVIDER", "").strip()
    if not provider_str:
        provider_str = os.environ.get("LLM_PROVIDER", "azure").strip()

    provider = (
        LLMProviderType.OPENAI_COMPATIBLE
        if provider_str.lower() in ("openai", "deepseek")
        else LLMProviderType.AZURE_OPENAI
    )

    if provider == LLMProviderType.AZURE_OPENAI:
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
        return LLMConfig(provider, endpoint, api_key, model_name, api_version)

    else:
        endpoint = ""
        if service_name:
            endpoint = os.environ.get(f"{service_name}_LLM_ENDPOINT", "").strip()
        if not endpoint:
            endpoint = os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com").strip()

        api_key = ""
        if service_name:
            api_key = os.environ.get(f"{service_name}_LLM_API_KEY", "").strip()
        if not api_key:
            api_key = os.environ.get("OPENAI_API_KEY", "").strip()

        model_name = ""
        if service_name:
            model_name = os.environ.get(f"{service_name}_MODEL_NAME", "").strip()
        if not model_name:
            model_name = os.environ.get("OPENAI_MODEL_NAME", "deepseek-chat").strip()

        return LLMConfig(provider, endpoint, api_key, model_name)


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
            raise ValueError("Missing OPENAI_BASE_URL and OPENAI_API_KEY")
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
            raise ValueError("Missing OPENAI_BASE_URL and OPENAI_API_KEY")
        return AsyncOpenAI(base_url=config.endpoint, api_key=config.api_key)


def ensure_model_keyword(config: LLMConfig) -> str:
    """Return the appropriate 'model' kwarg for chat.completions.create() calls.
    For Azure this is the deployment name; for OpenAI-compatible it's the model name."""
    return config.model_name
