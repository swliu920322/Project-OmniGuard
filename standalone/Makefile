# Content Interpreter — standalone 静态 demo 构建命令
#
#   make build   # 打包 React + interpreter → dist/（单 HTML + 单 JS，可手动部署）
#   make serve   # 本地预览（http://localhost:8765）
#   make check   # 构建 + Chrome headless 截图验证（可选依赖 Chrome）
#   make clean   # 清空产物
#
# 部署方式：dist/index.html + dist/demo.js 拷贝到你的 GitHub Pages 仓库即可，
# 两个文件保持同目录即可运行（demo.js 用相对路径 ./demo.js 引用）。

.PHONY: build serve check clean

build:
	./build.sh

serve:
	cd dist && python3 -m http.server 8765

check: build
	python3 -m http.server 8765 > /dev/null 2>&1 & \
	  sleep 2; \
	  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
	    --headless --disable-gpu --screenshot=preview.png --window-size=1200,900 \
	    --virtual-time-budget=3000 http://localhost:8765/index.html 2>/dev/null; \
	  pkill -f "http.server 8765" || true; \
	  echo "已生成 preview.png，请人工确认渲染正确。"

clean:
	rm -rf dist
