import os
from typing import List, Dict, Optional
from openai_config import get_azure_openai_client, get_llm_config
from dotenv import load_dotenv


class AzureChatEngine:

    def __init__(self, default_system_prompt: Optional[str] = None):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        load_dotenv(dotenv_path=os.path.join(parent_dir, ".env"))

        self._config = get_llm_config("KOL")
        provider_tag = "AZURE" if self._config.is_azure() else self._config.provider.value.upper()
        print(f"[{provider_tag} ENGINE] Endpoint: {self._config.endpoint} | Model: {self._config.model_name}")
        self.client = get_azure_openai_client()
        self.model_deployment = self._config.model_name

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
