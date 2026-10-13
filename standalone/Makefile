# =========================================================================
# 🏗️ Project-OmniGuard — standalone 统一构建入口
#
#   make build          # 构建全部模块
#   make aiapp          # 只构建 aiapp（内容解释器）
#   make prediction     # 只构建 prediction（大V预测）
#   make research       # 触发推文采集与投研分析，并自动同步数据源
#   make sync-data      # 仅从 daily_cache 同步最新数据到 prediction
#   make serve          # 本地预览 aiapp（http://localhost:8765）
#   make serve-prediction # 本地预览 prediction（http://localhost:8766）
#   make clean          # 清空全部模块产物
#
# 每个模块目录内保留自己的 build.sh（模块专属打包逻辑），Makefile 统一在此调度。
# 前端架构已解耦：前端页面在运行时动态 fetch kol/*.json。
# 数据更新：运行 make research 即可自动采集并同步数据源，无需重新构建前端。
# =========================================================================
.PHONY: build aiapp prediction research sync-data serve serve-aiapp serve-prediction clean

MODULES = aiapp prediction

build: $(MODULES)

aiapp:
	cd aiapp && ./build.sh

prediction:
	cd prediction && ./build.sh

research:
	@$(MAKE) -C .. research

sync-data:
	@mkdir -p prediction/kol
	@cp ../src/cloud-orchestrator/daily_cache/report_translated_*.json prediction/kol/ 2>/dev/null || true
	@if [ -d "prediction/dist/kol" ]; then cp prediction/kol/*.json prediction/dist/kol/ 2>/dev/null || true; fi
	@echo "✅ [CLI] KOL 数据源已成功同步至 standalone/prediction"

serve-aiapp:
	cd aiapp/dist && python3 -m http.server 8765

serve-prediction:
	cd prediction/dist && python3 -m http.server 8766

serve: serve-aiapp

clean:
	rm -rf aiapp/dist prediction/dist