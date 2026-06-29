# file: src/cloud-orchestrator/embodied_brain/utils.py
import os
import json
import time
import base64
import hmac
import hashlib
import logging
import requests
from urllib.parse import quote
from openai import AzureOpenAI
from azure.cosmos import CosmosClient

SCENARIO_REGISTRY_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scenario_registry.json")

# Lazy Cosmos Client
_cosmos_container = None

def get_cosmos_container():
    global _cosmos_container
    if _cosmos_container is None:
        endpoint = os.getenv("COSMOS_ENDPOINT")
        key = os.getenv("COSMOS_KEY")
        if not endpoint or not key:
            raise ValueError("Cosmos DB environment variables missing.")
        client = CosmosClient(endpoint, credential=key)
        database = client.get_database_client("OmniGuardDB")
        _cosmos_container = database.get_container_client("DeviceTwins")
    return _cosmos_container

def load_scenario_config(tenant_id: str) -> dict:
    try:
        if not os.path.exists(SCENARIO_REGISTRY_PATH):
            return None
        with open(SCENARIO_REGISTRY_PATH, "r", encoding="utf-8") as f:
            registry = json.load(f)
        return registry.get(tenant_id) or registry.get("Tenant-Alpha")
    except Exception as e:
        logging.error(f"Error loading scenario config: {e}")
        return None

def generate_sas_token(uri, key, policy_name, expiry=3600):
    ttl = int(time.time()) + expiry
    sign_key = base64.b64decode(key.encode("utf-8"))
    to_sign = f"{quote(uri)}\n{ttl}"
    signature = hmac.new(sign_key, to_sign.encode("utf-8"), hashlib.sha256).digest()
    raw_token = {
        "sr": uri,
        "sig": base64.b64encode(signature).decode("utf-8"),
        "se": str(ttl),
        "skn": policy_name
    }
    return "SharedAccessSignature " + "&".join([f"{k}={quote(v)}" for k, v in raw_token.items()])

def send_c2d_message(device_id: str, message_body: str):
    iot_hub_conn = os.getenv("IotHubServiceConnectionString")
    if not iot_hub_conn:
        logging.warning("IotHubServiceConnectionString not configured. Skipping C2D.")
        return
        
    parts = dict(x.split("=", 1) for x in iot_hub_conn.split(";"))
    resource_uri = f"{parts['HostName']}/devices/{device_id}"
    shared_access_key = parts["SharedAccessKey"]
    policy_name = parts["SharedAccessKeyName"]
    
    sas_token = generate_sas_token(resource_uri, shared_access_key, policy_name)
    url = f"https://{parts['HostName']}/devices/{device_id}/messages/devicebound?api-version=2020-09-30"
    headers = {
        "Authorization": sas_token,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(url, data=message_body, headers=headers, timeout=5)
        if response.status_code in [200, 204]:
            logging.info(f"C2D message successfully sent to device {device_id}.")
        else:
            logging.error(f"Failed to send C2D. Code: {response.status_code}, Body: {response.text}")
    except Exception as e:
        logging.error(f"Error calling IoT Hub C2D API: {e}")

_openai_client = None

def get_openai_client():
    global _openai_client
    if _openai_client is None:
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        if not api_key or not endpoint:
            raise ValueError("Azure OpenAI credentials missing.")
        _openai_client = AzureOpenAI(
            api_key=api_key,
            api_version="2024-02-15-preview",
            azure_endpoint=endpoint
        )
    return _openai_client

def ask_agent(system_prompt: str, user_input: str, max_completion_tokens: int = 100) -> str:
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5.4-mini")
    client = get_openai_client()
    
    response = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input}
        ],
        max_completion_tokens=max_completion_tokens
    )
    return response.choices[0].message.content.strip()
