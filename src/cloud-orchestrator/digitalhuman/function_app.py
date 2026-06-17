import json
import os
import datetime
import traceback
import azure.functions as func

from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# 1. 实例化纯快猫
fastapi_app = FastAPI()

fastapi_app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  # 🎯 【核心绝杀】：关闭无意义的凭证携带，全面释放 * 号通配符的跨域主权， 以后再关掉防止跨域
  allow_credentials=False,
  allow_methods=["*"],
  allow_headers=["*"],
)


@fastapi_app.api_route("/api/assets/auth", methods=["GET", "POST"])
def get_sas_token(request: Request) -> Response:
  try:
    ACCOUNT_NAME = os.environ.get("AZURE_STORAGE_ACCOUNT_NAME")
    ACCOUNT_KEY = os.environ.get("AZURE_STORAGE_ACCOUNT_KEY")

    if not ACCOUNT_KEY or not ACCOUNT_NAME:
      return Response(
        content=json.dumps({"error": "Missing Private Storage Credentials."}),
        status_code=500,
        media_type="application/json"
      )

    from azure.storage.blob import generate_account_sas, ResourceTypes, AccountSasPermissions
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
    return Response(content=json.dumps(payload), media_type="application/json", status_code=200)
  except Exception as e:
    return Response(content=json.dumps({"error": str(e)}), media_type="application/json", status_code=500)


@fastapi_app.post("/api/chat/stream")
async def chat_proxy(request: Request):
  try:
    req_body = await request.json()
    user_message = req_body.get("message", "")
    page_context = req_body.get("context", "/") # 🟩 核心对账：拦截提取前端路由坐标

    OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5.4-mini")
    OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")

    from openai import AsyncAzureOpenAI
    client = AsyncAzureOpenAI(
      azure_endpoint=OPENAI_ENDPOINT,
      api_key=OPENAI_API_KEY,
      api_version="2024-10-01-preview"
    )

    # 🟩 动态神经元系统：根据前端发送过来的物理路由，动态追加大模型的专业限定词
    system_prompt = "You are Shengwei's Streaming Avatar. "
    if page_context == "/":
        system_prompt += "The user is browsing Shengwei's resume page. Prioritize explaining his 10+ years full-stack expert experience, Accenture lead outcomes, Scania engineering history, and Azure Expert certificates."
    elif "canvas" in page_context:
        system_prompt += "The user is browsing the Architecture Canvas page. Focus on providing architectural explanations for VNet setup, Private Endpoints, Bicep automation, and secure enterprise cloud configurations."

    response = await client.chat.completions.create(
      model=DEPLOYMENT_NAME,
      messages=[
        {"role": "developer", "content": system_prompt},
        {"role": "user", "content": user_message}
      ],
      max_completion_tokens=4000,
      stream=True
    )

    async def stream_factory():
      async for chunk in response:
        if chunk.choices and len(chunk.choices) > 0:
          text = chunk.choices[0].delta.content or ""
          if text:
            yield text

    return StreamingResponse(
      stream_factory(),
      media_type="text/event-stream",
      headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    )
  except Exception as e:
    return Response(content=json.dumps({"error": str(e), "traceback": traceback.format_exc()}), status_code=400,
                    media_type="application/json")


# 顶级主权全量合拢
app = func.AsgiFunctionApp(
  app=fastapi_app,
  http_auth_level=func.AuthLevel.ANONYMOUS
)