import json
import os
import datetime
import azure.functions as func
from openai import AsyncAzureOpenAI
from azure.storage.blob import generate_account_sas, ResourceTypes, AccountSasPermissions
# 🟩 核心引入：拉入标准 Response 契约，彻底将旧时代 HttpResponse 物理驱逐
from azurefunctions.extensions.http.fastapi import Request, StreamingResponse
from fastapi import Response

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="assets/auth", methods=["POST", "GET"])
def get_sas_token(req: Request) -> Response:  # 👈 1. 刚性更正返回类型注解为新版 Response
  """
  Module Alpha: 动态向前端签发 60秒 极短时效只读 SAS 令牌
  """
  try:
    ACCOUNT_NAME = os.environ.get("AZURE_STORAGE_ACCOUNT_NAME")
    ACCOUNT_KEY = os.environ.get("AZURE_STORAGE_ACCOUNT_KEY")

    if not ACCOUNT_KEY or not ACCOUNT_NAME:
      # 2. 刚性更正：改用标准 Response 实体反弹错误
      return Response(
        content=json.dumps({"error": "Missing Private Storage Credentials in Runtime Application Settings."}),
        status_code=500,
        media_type="application/json"
      )

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

    # 3. 刚性更正：全量对齐新模型，安全返回标准的 Response 实例
    return Response(
      content=json.dumps(payload),
      media_type="application/json",
      status_code=200
    )

  except Exception as e:
    return Response(
      content=json.dumps({"error": f"Internal Core Error: {str(e)}"}),
      media_type="application/json",
      status_code=500
    )


@app.route(route="chat/stream", methods=["POST"])
async def chat_proxy(req: Request) -> StreamingResponse:
  try:
    req_body = await req.json()
    user_message = req_body.get("message", "")

    OPENAI_ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    DEPLOYMENT_NAME = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
    OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", "")

    client = AsyncAzureOpenAI(
      azure_endpoint=OPENAI_ENDPOINT,
      api_key=OPENAI_API_KEY,
      api_version="2024-02-15-preview"
    )

    async def stream_factory():
      response = await client.chat.completions.create(
        model=DEPLOYMENT_NAME,
        messages=[
          {"role": "system", "content": "You are Shengwei's Streaming Avatar."},
          {"role": "user", "content": user_message}
        ],
        max_tokens=800,
        temperature=0.7,
        stream=True
      )

      async for chunk in response:
        if chunk.choices and len(chunk.choices) > 0:
          text = chunk.choices[0].delta.content or ""
          if text:
            yield text

    return StreamingResponse(
      stream_factory(),
      media_type="text/event-stream",  # 1. 👈 升级为事件流媒体类型，暗示代理不要拦截
      headers={
        "Cache-Control": "no-cache",  # 2. 👈 斩断浏览器本地缓存
        "Connection": "keep-alive",  # 3. 👈 保持长连接通道不被中途掐断
        "X-Accel-Buffering": "no"  # 4. 🎯 【绝杀】强制通知 Azure/Nginx 代理层：关闭 4KB 缓冲，出厂一字立刻冲刷外扔！
      }
    )

  except Exception as e:
    async def error_handler():
      yield json.dumps({"error": str(e)})

    return StreamingResponse(error_handler(), media_type="application/json", status_code=500)