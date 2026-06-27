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


def build_llm_client(deployment_override: str = ""):
  provider = os.environ.get("LLM_PROVIDER", os.environ.get("OPENAI_PROVIDER", "azure")).strip().lower()
  common_model = os.environ.get("LLM_MODEL", "").strip()

  # 🟩 轨道一：标准 OpenAI 或第三方中转网桥
  if provider in {"openai", "openai-compatible", "thirdparty", "third-party"}:
    base_url = os.environ.get("OPENAI_BASE_URL", "").strip()
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    model = common_model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()

    print(f"[🔥 KERNEL SIGN] 激活标准 OpenAI 客户端 // MODEL: {model} // BASE: {base_url}")
    if not base_url or not api_key:
      raise ValueError("Missing OPENAI_BASE_URL or OPENAI_API_KEY for third-party provider mode.")

    from openai import AsyncOpenAI
    return AsyncOpenAI(base_url=base_url, api_key=api_key), model, "openai-compatible"

  # 🟩 轨道二：正统 Azure OpenAI 专家计算平面
  endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip()
  api_key = os.environ.get("AZURE_OPENAI_API_KEY", "").strip()
  model = common_model or os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o").strip()

  print(f"[⚡ AZURE SIGN] 激活 Azure OpenAI 专属客户端 // DEPLOYMENT_NAME: {model} // ENDPOINT: {endpoint}")
  if not endpoint or not api_key:
    raise ValueError("Missing AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY for Azure provider mode.")

  from openai import AsyncAzureOpenAI
  return AsyncAzureOpenAI(
    azure_endpoint=endpoint,
    api_key=api_key,
    api_version="2024-10-01-preview"
  ), model, "azure"


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
      expiry=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=60)
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

    client, DEPLOYMENT_NAME, provider = build_llm_client()

    # 🟩 动态神经元系统：根据前端发送过来的物理路由，动态追加大模型的专业限定词
    system_prompt = "You are Shengwei's Streaming Avatar. "
    if page_context == "/":
        system_prompt += "The user is browsing the startup console. Help them configure Bicep launch modes, deployment names, and destroy commands."
    elif "resume" in page_context:
        system_prompt += "The user is browsing Shengwei's resume page. Prioritize explaining his 10+ years full-stack expert experience, Accenture lead outcomes, Scania engineering history, and Azure Expert certificates."
    elif "canvas" in page_context:
        system_prompt += "The user is browsing the Architecture Canvas page. Focus on providing architectural explanations for VNet setup, Private Endpoints, Bicep automation, and secure enterprise cloud configurations."
    else:
        system_prompt += f"The active LLM provider is {provider}."

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
    error_text = str(e)
    status_code = 400
    if "Resource not found" in error_text or "404" in error_text:
      error_text = (
        "Azure OpenAI deployment not found. Check local.settings.json: "
        "AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT_NAME, AZURE_OPENAI_API_KEY."
      )
      status_code = 502
    return Response(content=json.dumps({"error": error_text, "traceback": traceback.format_exc()}), status_code=status_code,
                    media_type="application/json")


# 顶级主权全量合拢
app = func.AsgiFunctionApp(
  app=fastapi_app,
  http_auth_level=func.AuthLevel.ANONYMOUS
)