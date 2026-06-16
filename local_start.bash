
cd src/cloud-orchestrator
source .venv/bin/activate
# 启动本地 Functions 核心运行时（默认霸占 7071 端口）
func start


# 绝杀：启动虚拟边缘代理，横向绑定静态前端目录与本地 7071 计算端口
npx @azure/static-web-apps-cli start src/client-edge --api-port 7071
