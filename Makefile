# =========================================================================
# 🛠️ Project-OmniGuard 统一控制总线
# =========================================================================
.PHONY: provision start destroy deploy-function trigger-ci help

help:
	@echo "======================================================"
	@echo "Project-OmniGuard 快速命令"
	@echo "======================================================"
	@echo "make provision       - 部署 Azure 基础设施"
	@echo "make start           - 启动前后端本地开发环境"
	@echo "make destroy         - 销毁所有 Azure 资源"
	@echo "make deploy-function - 部署 Function 到 serverless"
	@echo "make trigger-ci      - 触发 GitHub CI/CD 流水线"
	@echo "======================================================"

provision:
	@chmod +x ./sh/provision.sh
	./sh/provision.sh

start:
	@chmod +x ./sh/start.sh
	./sh/start.sh

destroy:
	@chmod +x ./sh/destroy.sh
	./sh/destroy.sh

deploy-function:
	@chmod +x ./sh/deploy-function.sh
	./sh/deploy-function.sh

trigger-ci:
	@chmod +x ./sh/trigger-ci.sh
	./sh/trigger-ci.sh
