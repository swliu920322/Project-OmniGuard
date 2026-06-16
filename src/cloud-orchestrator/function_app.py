import json
import os
import azure.functions as func
# 💡 绝杀更正：导入标准的 get_bearer_token_provider 令牌解算器
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="assets/auth", methods=["POST", "GET"])
def get_sas_token(req: func.HttpRequest) -> func.HttpResponse:
  try:
    ACCOUNT_NAME = "omnistjavzwzvip3pce"  # 👈 保持对齐云端真实存储名
    ACCOUNT_KEY = "BzQo3d5ewNK3wKl1RwxRB9B2XjU8sMJAvJldRCspHMfNWbRihNPZQYPczvsIjRfw2eh9Nu/wWgx2+AStFEuONw=="  #

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

    # 🟩 完美的环境灵活性：从应用环境变量中提取非敏感配置
    OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")

    # ⚡ 开启运行时无密钥凭证链
    credential = DefaultAzureCredential()

    # 💡 正确的SDK姿态：利用标准助手将凭证封装为符合OpenAI协议的动态Token生成器
    token_provider = get_bearer_token_provider(
      credential,
      "https://cognitiveservices.azure.com/.default"
    )

    # 呼叫官方SDK客户端，通过零密钥令牌环直线挂载
    client = AzureOpenAI(
      azure_endpoint=OPENAI_ENDPOINT,
      azure_ad_token_provider=token_provider,  # 👈 灌入合规生成的提供商
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