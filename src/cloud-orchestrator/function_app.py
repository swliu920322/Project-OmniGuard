import azure.functions as func
import json
import os
import logging
from openai import AzureOpenAI

# 📥 初始化 Azure Functions v2 核心计算引擎，配置匿名公网贯穿权限
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="chat/stream", methods=["POST"])
def chat_proxy(req: func.HttpRequest) -> func.HttpResponse:
  logging.info("[OmniGuard Brain] 🚀 Compute core intercepted an incoming HTTP request.")

  # 1. 刚性构建统一出港响应头（包含反劫持验证特征码）
  response_headers = {
    "Content-Type": "application/json",
    # 🟩 自审计核心：该自定义字段将直接穿透 SWA 代理层，向浏览器宣告独立主机的物理存在
    "X-OmniGuard-Engine-Identity": "Standalone-FunctionApp-JapanEast"
  }

  try:
    # 2. 提取并解算前端请求数据包
    req_body = req.get_json()
    user_message = req_body.get("message", "")
    if not user_message:
      logging.warning("[OmniGuard Brain] Empty payload received.")
      return func.HttpResponse(
        json.dumps({"error": "Payload missing 'message' field"}),
        status_code=400,
        headers=response_headers
      )

    # 3. 动态抓取云端运行时控制面变量字典
    mock_mode_env = os.environ.get("LOCAL_MOCK_MODE", "true").lower()
    is_mock_mode = (mock_mode_env == "true")

    # 🔄 路由分支 A：沙盒拦截模拟分流 (Mock Mode Branch)
    if is_mock_mode:
      logging.info(f"[OmniGuard Brain] 沙盒安全大闸处于激活状态。动态处理词包: {user_message}")
      mock_payload = {
        "choices": [
          {
            "message": {
              "role": "assistant",
              "content": f"[Mock]: {user_message}"
            }
          }
        ]
      }
      return func.HttpResponse(
        json.dumps(mock_payload),
        status_code=200,
        headers=response_headers
      )

    # ⚡ 路由分支 B：击穿大模型实弹战区 (Production Azure OpenAI Branch)
    logging.info("[OmniGuard Brain] 击穿大闸！正在跨网络调拨 Azure OpenAI 大模型联邦算力...")

    # 从容器上下文中横向解算绝密凭证
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    deployment_name = os.environ.get("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")

    if not api_key or not endpoint:
      logging.error("[OmniGuard Brain] Missing required OpenAI environment variables in appsettings.")
      raise ValueError("Runtime environment variables (API_KEY/ENDPOINT) are not populated.")

    # 实例化实弹大模型客户端
    client = AzureOpenAI(
      api_key=api_key,
      api_version="2024-02-15-preview",
      azure_endpoint=endpoint
    )

    # 同步撞击算力矩阵（为确保流式解析器兼容性，封装为标准单发 JSON 块）
    completion = client.chat.completions.create(
      model=deployment_name,
      messages=[
        {"role": "system", "content": "You are OmniGuard Digital Human, an expert cloud architect assistant."},
        {"role": "user", "content": user_message}
      ],
      temperature=0.7
    )

    # 提取真实令牌文本
    real_content = completion.choices[0].message.content
    logging.info(f"[OmniGuard Brain] 算力矩阵响应通车成功。吐出文本长度: {len(real_content)}")

    production_payload = {
      "choices": [
        {
          "message": {
            "role": "assistant",
            "content": real_content
          }
        }
      ]
    }

    return func.HttpResponse(
      json.dumps(production_payload),
      status_code=200,
      headers=response_headers
    )

  except Exception as e:
    # 🚨 恶性运行时熔断全面拦截捕获
    error_message = f"Internal Compute Exception: {str(e)}"
    logging.critical(f"[OmniGuard Brain] Fatal Breakdown: {error_message}")

    # 将原始死因直接打包抛给前端，不留任何调试黑箱死角
    return func.HttpResponse(
      json.dumps({"error": error_message}),
      status_code=500,
      headers=response_headers
    )