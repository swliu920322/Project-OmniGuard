# =========================================================================
# 🛠️ Project-OmniGuard 统一控制总线
# =========================================================================
.PHONY: provision start-backend start-frontend destroy deploy-function trigger-ci help

help:
	@echo "======================================================"
	@echo "Project-OmniGuard 快速命令"
	@echo "======================================================"
	@echo "make provision       - 部署 Azure 基础设施"
	@echo "make start-backend   - 启动后端 (Azure Functions, 端口 7071)"
	@echo "make start-frontend  - 启动前端 (Next.js, 端口 3000)"
	@echo "make destroy         - 销毁所有 Azure 资源"
	@echo "make deploy-function - 部署 Function 到 serverless"
	@echo "make trigger-ci      - 触发 GitHub CI/CD 流水线"
	@echo "======================================================"
	@echo "💡 提示: 分别在两个终端中运行 make start-backend 和 make start-frontend"

provision:
	@chmod +x ./sh/provision.sh
	./sh/provision.sh

start-backend:
	@chmod +x ./sh/start-backend.sh
	./sh/start-backend.sh

start-frontend:
	@chmod +x ./sh/start-frontend.sh
	./sh/start-frontend.sh

destroy:
	@chmod +x ./sh/destroy.sh
	./sh/destroy.sh

deploy-function:
	@chmod +x ./sh/deploy-function.sh
	./sh/deploy-function.sh

trigger-ci:
	@chmod +x ./sh/trigger-ci.sh
	./sh/trigger-ci.sh
