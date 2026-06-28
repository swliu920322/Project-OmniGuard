import os
from typing import List, Dict, Optional
from openai import AzureOpenAI
from dotenv import load_dotenv

class AzureChatEngine:
    """
    标准化核心推理引擎（直连 Azure OpenAI，使用 API Key 鉴权，避免 Tenant 冲突）
    """

    def __init__(self, default_system_prompt: Optional[str] = None):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        load_dotenv(dotenv_path=os.path.join(parent_dir, ".env"))

        # 尝试从 local.settings.json 读取环境参数
        settings_path = os.path.join(parent_dir, "local.settings.json")
        if os.path.exists(settings_path):
            try:
                import json
                with open(settings_path, "r", encoding="utf-8") as f:
                    settings = json.load(f)
                values = settings.get("Values", {})
                for k, v in values.items():
                    if k not in os.environ:
                        os.environ[k] = str(v)
            except Exception as e:
                print(f"Warning: Failed to load local.settings.json: {e}")

        # 使用 API Key 直接连接，不再使用 Entra ID/DefaultAzureCredential 防止租户(Tenant)冲突
        endpoint = os.environ.get("OPENAI_BASE_URL", "").strip()
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        self.model_deployment = os.environ.get("OPENAI_API_DEPLOYMENT_NAME", "gpt-5.4-mini").strip()

        if not endpoint or not api_key:
            # 兼容备份配置
            endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip()
            api_key = os.environ.get("AZURE_OPENAI_API_KEY", "").strip()
            self.model_deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", self.model_deployment).strip()

        if not endpoint or not api_key:
            raise ValueError("Missing critical environment variables: OPENAI_BASE_URL (endpoint) or OPENAI_API_KEY")

        print(f"[🤖 AI ENGINE] 直连 Azure OpenAI Endpoint: {endpoint} | Deployment: {self.model_deployment}")
        
        self.client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version="2024-10-01-preview"
        )

        self.default_system_prompt = default_system_prompt or os.getenv(
            "DEFAULT_SYSTEM_PROMPT",
            "You are a helpful AI assistant."
        )

    def generate_response(
            self,
            user_prompt: str,
            system_prompt: Optional[str] = None,
            history_messages: Optional[List[Dict[str, str]]] = None
    ) -> str:
        active_system_prompt = system_prompt or self.default_system_prompt
        messages = [{"role": "system", "content": active_system_prompt}]
        if history_messages:
            messages.extend(history_messages)
        messages.append({"role": "user", "content": user_prompt})

        try:
            response = self.client.chat.completions.create(
                model=self.model_deployment,
                messages=messages
            )
            return response.choices[0].message.content
        except Exception as e:
            raise RuntimeError(f"Engine inference failed: {str(e)}")
