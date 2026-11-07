import os
import logging
from typing import Tuple, Union

from llm_provider import (
    resolve_llm_config,
    create_llm_client,
    create_async_llm_client,
    LLMConfig,
    LLMProviderType,
    ensure_model_keyword,
)

from openai import OpenAI, AsyncOpenAI, AzureOpenAI, AsyncAzureOpenAI


def get_openai_credentials(model_env_var: str = None) -> Tuple[str, str, str]:
    """
    Backward-compatible credential resolver.
    Returns (endpoint, api_key, model_name).
    If model_env_var is set (e.g. "BRAIN_DEPLOYMENT_NAME"), the service name
    is inferred by stripping the _DEPLOYMENT_NAME suffix.
    """
    service_name = ""
    if model_env_var and model_env_var.endswith("_DEPLOYMENT_NAME"):
        service_name = model_env_var.replace("_DEPLOYMENT_NAME", "")
    config = resolve_llm_config(service_name)
    return config.endpoint, config.api_key, config.model_name


def get_azure_openai_client() -> Union[OpenAI, AzureOpenAI]:
    """Get a synchronous LLM client (Azure OpenAI or OpenAI-compatible)."""
    config = resolve_llm_config()
    return create_llm_client(config)


def get_async_azure_openai_client() -> Union[AsyncOpenAI, AsyncAzureOpenAI]:
    """Get an asynchronous LLM client (Azure OpenAI or OpenAI-compatible)."""
    config = resolve_llm_config()
    return create_async_llm_client(config)


def get_llm_config(service_name: str = "") -> LLMConfig:
    """Get the resolved LLM configuration for a given service."""
    return resolve_llm_config(service_name)
