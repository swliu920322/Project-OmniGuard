import json
import os
import azure.functions as func
from openai import AzureOpenAI

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="assets/auth", methods=["POST", "GET"])
def get_sas_token(req: func.HttpRequest) -> func.HttpResponse:
  try:
    ACCOUNT_NAME = "omnistjavzwzvip3pce"
    ACCOUNT_KEY = "BzQo3d5ewNK3wKl1RwxRB9B2XjU8sMJAvJldRCspHMfNWbRihNPZQYPczvsIjRfw2eh9Nu/wWgx2+AStFEuONw=="

    from azure.storage.blob import generate_account_sas, ResourceTypes, AccountSasPermissions
    import datetime
    sas_token = generate_account_sas(
      account_name=ACCOUNT_NAME,
      account_key=ACCOUNT_KEY,
      resource_types=ResourceTypes(object=True, container=True),
      permission=AccountSasPermissions(read=True),
      expiry=datetime.datetime.utcnow() + datetime.timedelta(seconds=60)
    )
    payload = {"sasToken": sas_token, "blobEndpoint": f"https://{ACCOUNT_NAME}.blob.core.windows.net"}
    return func.HttpResponse(body=json.dumps(payload), mimetype="application/json", status_code=200)
  except Exception as e:
    return func.HttpResponse(body=json.dumps({"error": str(e)}), mimetype="application/json", status_code=500)


@app.route(route="chat/stream", methods=["POST"])
def chat_proxy(req: func.HttpRequest) -> func.HttpResponse:
  try:
    req_body = req.get_json()
    user_message = req_body.get("message", "")

    MOCK_MODE = os.environ.get("LOCAL_MOCK_MODE", "true").lower() == "true"
    if MOCK_MODE:
      return func.HttpResponse(
        json.dumps({"choices": [{"message": {"role": "assistant", "content": f"[Mock]: {user_message}"}}]}),
        mimetype="application/json")

    # 🟩 环境灵活性核心：代码只向宿主机内存要配置与密钥
    OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
    OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "") # 👈 运行时容器内网单向解密读取

    # 呼叫标准工业级客户端，实现零密钥落盘的实弹撞击
    client = AzureOpenAI(
      azure_endpoint=OPENAI_ENDPOINT,
      api_key=OPENAI_API_KEY,
      api_version="2024-02-15-preview"
    )

    response = client.chat.completions.create(
      model=DEPLOYMENT_NAME,
      messages=[
        {"role": "system", "content": "You are Shengwei's Clean Avatar."},
        {"role": "user", "content": user_message}
      ],
      max_tokens=800,
      temperature=0.7
    )

    return func.HttpResponse(body=response.to_json(), mimetype="application/json", status_code=200)
  except Exception as e:
    return func.HttpResponse(body=json.dumps({"error": f"Runtime Exception: {str(e)}"}), mimetype="application/json",
                             status_code=500)