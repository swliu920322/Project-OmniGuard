# =========================================================================
# 🛠️ Project-OmniGuard 统一控制总线 (Makefile)
# =========================================================================
.PHONY: infra up destroy deploy devops fe

VAR_RG=omni-guard-infra-rg

fe:
	cd src/client-edge && npm install
# 1. 一键拉起云端底座并倒灌密钥
infra: provision

up: devops deploy

provision:
	@chmod +x ./sh/infra-up.sh
	./sh/infra-up.sh

# 2. 一键蒸发云端资产（FinOps 止血）
destroy:
	@chmod +x ./sh/infra-destroy.sh
	./sh/infra-destroy.sh

# 3. 本地双端热拔插联动肉搏 (自动同步最新 local.settings.json)
dev:
	cd src/cloud-orchestrator/digitalhuman && func start


# 4. 极致压缩版定向轰击部署
deploy:
	@echo "⚡ 正在切入全新 digitalhuman 后端腹地执行远程编译..."
	cd src/cloud-orchestrator/digitalhuman && func azure functionapp publish $$(az functionapp list --resource-group $(VAR_RG) --query "[0].name" -o tsv) --python --build remote
	@echo "🔄 强行触发云端冷启动，粉碎 Basic 平面幽灵缓存..."
	az functionapp restart --name $$(az functionapp list --resource-group $(VAR_RG) --query "[0].name" -o tsv) --resource-group $(VAR_RG)
devops:
	@chmod +x ./sh/empty_push.sh
	./sh/empty_push.sh

