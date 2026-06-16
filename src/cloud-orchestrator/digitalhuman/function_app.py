import json
import os
import datetime
import azure.functions as func
from openai import AzureOpenAI
from azure.storage.blob import generate_account_sas, ResourceTypes, AccountSasPermissions

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="assets/auth", methods=["POST", "GET"])
def get_sas_token(req: func.HttpRequest) -> func.HttpResponse:
  """
  Module Alpha: 动态向前端签发 60秒 极短时效只读 SAS 令牌，完全越过 RBAC 权限限制
  """
  try:
    # 🟩 降维打击：从 Bicep 动态灌入的宿主机加密内存中直接索要凭证
    ACCOUNT_NAME = os.environ.get("AZURE_STORAGE_ACCOUNT_NAME")
    ACCOUNT_KEY = os.environ.get("AZURE_STORAGE_ACCOUNT_KEY")

    if not ACCOUNT_KEY or not ACCOUNT_NAME:
      return func.HttpResponse(
        json.dumps({"error": "Missing Private Storage Credentials in Runtime Application Settings."}),
        status_code=500,
        mimetype="application/json"
      )

    # 动态算解专属私网数据面通行证
    sas_token = generate_account_sas(
      account_name=ACCOUNT_NAME,
      account_key=ACCOUNT_KEY,
      resource_types=ResourceTypes(object=True, container=True),
      permission=AccountSasPermissions(read=True),
      expiry=datetime.datetime.utcnow() + datetime.timedelta(seconds=60)
    )

    payload = {
      "sasToken": sas_token,
      "blobEndpoint": f"https://{ACCOUNT_NAME}.blob.core.windows.net"
    }
    return func.HttpResponse(body=json.dumps(payload), mimetype="application/json", status_code=200)
  except Exception as e:
    return func.HttpResponse(body=json.dumps({"error": f"Internal Core Error: {str(e)}"}), mimetype="application/json",
                             status_code=500)


@app.route(route="chat/stream", methods=["POST"])
def chat_proxy(req: func.HttpRequest) -> func.HttpResponse:
  """
  大模型分流中转代理
  """
  try:
    req_body = req.get_json()
    user_message = req_body.get("message", "")

    MOCK_MODE = os.environ.get("LOCAL_MOCK_MODE", "true").lower() == "true"
    if MOCK_MODE:
      return func.HttpResponse(
        json.dumps({"choices": [{"message": {"role": "assistant", "content": f"[Mock]: {user_message}"}}]}),
        mimetype="application/json")

    OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
    OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")

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