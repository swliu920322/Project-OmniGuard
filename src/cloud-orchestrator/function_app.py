import azure.functions as func
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import json

# 1. 实例化 FastAPI 容器
fastapi_app = FastAPI(
    title="Project-OmniGuard Serverless API Hub",
    description="Modular & Scoped Azure Functions Backend",
    version="1.0.0"
)

# 2. 跨域中转支持，全面赋能前端安全访问
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 模块化：优雅加载各独立作用域下的子路由组件
from digitalhuman import digital_human_router
from kol_analysis import kol_analysis_router

# 注册数字人子模块路由
fastapi_app.include_router(digital_human_router)

# 注册大 V 预测时序管线路由
fastapi_app.include_router(kol_analysis_router)

# 4. 🏁 顶级合拢：将 FastAPI 包裹并交付给 Azure Functions ASGI 运行时
app = func.AsgiFunctionApp(
    app=fastapi_app,
    http_auth_level=func.AuthLevel.ANONYMOUS
)


# 绑定云端大脑的事件监听总线
@app.event_hub_message_trigger(
    arg_name="azeventhub",
    event_hub_name="messages/events",  # IoT Hub 默认的内部事件流名称
    connection="IotHubEventHubConnectionString"  # 绑定 local.settings.json 中的变量
)
def iot_telemetry_processor(azeventhub: func.EventHubEvent):
    """
    大脑脑干：拦截并反序列化物理设备的高频遥测数据
    """
    # 1. 物理层解包
    raw_data = azeventhub.get_body().decode('utf-8')
    device_id = azeventhub.iothub_metadata.get('connection-device-id', 'Unknown-Device')

    logging.info(f"[⚡️ 脑干激活] 接收到来自物理探针 {device_id} 的神经信号。")

    try:
        # 2. 状态降维
        payload = json.loads(raw_data)
        x_coord = payload.get("location", {}).get("x", "N/A")
        obstacle = payload.get("obstacle_distance_cm", "N/A")

        logging.info(f"[📊 状态解析] X坐标: {x_coord} | 障碍物距离: {obstacle}cm")

        # 3. TODO: 挂载 Azure OpenAI，组装 Prompt，下发 C2D 动作指令
        # (下一阶段实现)

    except json.JSONDecodeError:
        logging.error(f"[FATAL] 探针数据污染，无法反序列化: {raw_data}")