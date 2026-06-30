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

# 2.5. 日志监视中转站，监控运行时所有请求的状态方法
@fastapi_app.middleware("http")
async def log_requests(request, call_next):
    logging.info(f"[🔬 API HIT] Method: {request.method} | Path: {request.url.path} | Query: {request.url.query}")
    try:
        response = await call_next(request)
        logging.info(f"[🔬 API RESPONSE] Status: {response.status_code}")
        return response
    except Exception as e:
        logging.error(f"[🔬 API ERROR] {str(e)}")
        raise e


# 3. 模块化：优雅加载各独立作用域下的子路由组件
from digitalhuman import digital_human_router
from kol_analysis import kol_analysis_router

# 注册数字人子模块路由
fastapi_app.include_router(digital_human_router)

# 注册大 V 预测时序管线路由
fastapi_app.include_router(kol_analysis_router)

# 注册具身智能脑干大盘模拟器路由
from embodied_brain import brain_router
fastapi_app.include_router(brain_router)

# 4. 🏁 顶级合拢：将 FastAPI 包裹并交付给 Azure Functions ASGI 运行时
app = func.AsgiFunctionApp(
    app=fastapi_app,
    http_auth_level=func.AuthLevel.ANONYMOUS
)

# Register Embodied AI brain blueprint
from embodied_brain import brain_bp
app.register_blueprint(brain_bp)