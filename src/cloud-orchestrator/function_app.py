import json
import datetime
import os  # 👈 刚性补齐：消灭 NameError 猝死
import requests  # 👈 刚性补齐：消灭 NameError 猝死
import azure.functions as func
from azure.storage.blob import generate_account_sas, ResourceTypes, AccountSasPermissions

# 1. 初始化计算大脑实例
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="assets/auth", methods=["POST", "GET"])
def get_sas_token(req: func.HttpRequest) -> func.HttpResponse:
  try:
    ACCOUNT_NAME = "omnistjavzwzvip3pce"  # 👈 对齐你云端的真实存储名
    ACCOUNT_KEY = "BzQo3d5ewNK3wKl1RwxRB9B2XjU8sMJAvJldRCspHMfNWbRihNPZQYPczvsIjRfw2eh9Nu/wWgx2+AStFEuONw=="  # 👈 对齐你真实的物理 Key1

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

    # 🟩 Level 3 军工级无密钥核心路由激活
    OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")

    # ⚡ 刷脸引信：运行时自动探测当前环境。本地调试自动抓取 az login 态；云端自动抓取 Managed Identity
    credential = DefaultAzureCredential()

    # 呼叫标准客户端，利用 token_provider 代替明文 api_key
    client = AzureOpenAI(
      azure_endpoint=OPENAI_ENDPOINT,
      azure_ad_token_provider=credential.get_login_token_provider("https://cognitiveservices.azure.com/.default"),
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
    return func.HttpResponse(body=json.dumps({"error": f"Zero-Secret Runtime Exception: {str(e)}"}),
                             mimetype="application/json", status_code=500)
