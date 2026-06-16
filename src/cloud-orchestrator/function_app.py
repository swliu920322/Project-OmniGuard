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
      mock_payload = {
        "choices": [{
          "message": {
            "role": "assistant",
            "content": f"[Local Simulation]: 已接收指令「{user_message}」。刘胜伟 (LIU SHENGWEI) 的 WebGPU 渲染管线与 Azure 骨干网合拢测试成功！"
          }
        }]
      }
      return func.HttpResponse(body=json.dumps(mock_payload), mimetype="application/json", status_code=200)

    OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    OPENAI_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")
    DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")

    if not OPENAI_ENDPOINT or not OPENAI_KEY:
      raise ValueError("Missing true cloud credentials. Toggle LOCAL_MOCK_MODE=true to debug offline.")

    url = f"{OPENAI_ENDPOINT}openai/deployments/{DEPLOYMENT_NAME}/chat/completions?api-version=2024-02-15-preview"
    payload = {
      "messages": [
        {"role": "system", "content": "You are Shengwei's AI Digital Avatar."},
        {"role": "user", "content": user_message}
      ],
      "max_tokens": 800,
      "temperature": 0.7
    }
    response = requests.post(url, json=payload, headers={"Content-Type": "application/json", "api-key": OPENAI_KEY})
    return func.HttpResponse(body=response.text, mimetype="application/json", status_code=response.status_code)
  except Exception as e:
    return func.HttpResponse(body=json.dumps({"error": f"Backend Runtime Crash: {str(e)}"}),
                             mimetype="application/json", status_code=500)
