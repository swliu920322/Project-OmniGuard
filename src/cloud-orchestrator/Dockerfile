# 强行抛弃纯 Python 镜像，直接挂载微软官方的 Functions 运行时底座
FROM mcr.microsoft.com/azure-functions/python:4-python3.11

# 注入 Azure Functions 运行所需的内部环境变量
ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

WORKDIR /home/site/wwwroot

# 拷贝依赖并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 拷贝全部脑干代码
COPY . .

# 暴露 80 端口 (Functions 容器默认监听 80，而不是 8000)
EXPOSE 80

# 不需要写 CMD 启动 uvicorn。基础镜像自带的底层 Host 会自动加载 function_app.py，
# 既能拉起 FastAPI 路由，又能自动挂载并监听 Event Hub 触发器。