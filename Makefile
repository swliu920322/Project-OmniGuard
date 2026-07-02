# =========================================================================
# 🛠️ Project-OmniGuard 统一控制总线
# =========================================================================
.PHONY: provision whatif start-backend start-frontend destroy deploy-aca trigger-ci help add-device research

help:
	@echo "======================================================"
	@echo "Project-OmniGuard 快速命令"
	@echo "======================================================"
	@echo "make provision       - 部署 Azure 基础设施"
	@echo "make whatif          - 预检 (What-If/Dry-run) 基础设施变更"
	@echo "make start-backend   - 启动后端 (Azure Functions, 端口 7071)"
	@echo "make start-frontend  - 启动前端 (Next.js, 端口 3000)"
	@echo "make destroy         - 销毁所有 Azure 资源"
	@echo "make deploy-aca      - 部署 容器 到 Azure Container Apps"
	@echo "make trigger-ci      - 触发 GitHub CI/CD 流水线"
	@echo "======================================================"
	@echo "💡 提示: 分别在两个终端中运行 make start-backend 和 make start-frontend"

provision:
	@chmod +x ./sh/provision.sh
	./sh/provision.sh

whatif:
	@chmod +x ./sh/provision-whatif.sh
	./sh/provision-whatif.sh

start-backend:
	@chmod +x ./sh/start-backend.sh
	./sh/start-backend.sh

start-frontend:
	@chmod +x ./sh/start-frontend.sh
	./sh/start-frontend.sh

destroy:
	@chmod +x ./sh/destroy.sh
	./sh/destroy.sh

deploy-aca:
	@chmod +x ./sh/deploy-aca.sh
	./sh/deploy-aca.sh

trigger-ci:
	@chmod +x ./sh/trigger-ci.sh
	./sh/trigger-ci.sh

add-device:
	@bash sh/add-device.sh $(DEV)

research:
	@echo "🚀 [CLI] 正在启动增量推文数据采集、双语翻译与投研分析..."
	@cd src/cloud-orchestrator && ./.venv/bin/python run_analysis.py
