import os
import logging

# 尝试自动从 local.settings.json 加载本地开发环境变量 (仅在本地开发且环境变量未定义时生效)
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
        logging.warning(f"Failed to load local.settings.json in openai_config: {e}")

from openai import AzureOpenAI, AsyncAzureOpenAI

def get_openai_credentials():
    """
    统一解析 Azure OpenAI 凭证，解决命名空间冗余与历史遗留变量命名不一致问题。
    优先解析标准 Azure OpenAI 环境变量，回退解析 OpenAI 兼容变量。
    """
    endpoint = (os.environ.get("AZURE_OPENAI_ENDPOINT") or os.environ.get("OPENAI_BASE_URL") or "").strip()
    api_key = (os.environ.get("AZURE_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip()
    deployment_name = (os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME") or 
                       os.environ.get("OPENAI_DEPLOYMENT_NAME") or 
                       os.environ.get("OPENAI_API_DEPLOYMENT_NAME") or 
                       "gpt-5.4-mini").strip()
    return endpoint, api_key, deployment_name

def get_azure_openai_client() -> AzureOpenAI:
    """
    获取同步的 Azure OpenAI 客户端。
    """
    endpoint, api_key, _ = get_openai_credentials()
    if not endpoint or not api_key:
        raise ValueError("Missing critical environment variables: AZURE_OPENAI_ENDPOINT (or OPENAI_BASE_URL) and AZURE_OPENAI_API_KEY (or OPENAI_API_KEY)")
    return AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version="2024-10-01-preview"
    )

def get_async_azure_openai_client() -> AsyncAzureOpenAI:
    """
    获取异步的 Azure OpenAI 客户端。
    """
    endpoint, api_key, _ = get_openai_credentials()
    if not endpoint or not api_key:
        raise ValueError("Missing critical environment variables: AZURE_OPENAI_ENDPOINT (or OPENAI_BASE_URL) and AZURE_OPENAI_API_KEY (or OPENAI_API_KEY)")
    return AsyncAzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version="2024-10-01-preview"
    )
