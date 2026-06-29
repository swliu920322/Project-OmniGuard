# 🎯 快速命令参考

## 📌 一句话总结

```bash
# 准备凭证 → 部署基础设施 → 启动开发 → (可选)上云 → (可选)清理
make provision  # 运行一次
make start      # 日常开发
make deploy-function  # 需要时上云
make destroy    # 不再需要时
```

## 🚀 常用命令

### 首次使用

```bash
# 1. 复制凭证模板
cp src/cloud-orchestrator/digitalhuman/local.settings.example.json \
   src/cloud-orchestrator/digitalhuman/local.settings.json

# 2. 编辑凭证（填入 OpenAI 相关配置）
# vim 或你喜欢的编辑器

# 3. 部署 Azure 基础设施
make provision
# 或手动运行
./sh/provision.sh
```

### 日常开发

```bash
# 启动前后端开发环境
make start
# 或手动运行
./sh/start.sh

# 访问
# 前端: http://localhost:3000
# 后端: http://localhost:7071/api
```

### 上云部署

```bash
# 部署 Function 代码到 Azure
make deploy-function
# 或
./sh/deploy-function.sh

# 触发 GitHub Actions
make trigger-ci
# 或
./sh/trigger-ci.sh
```

### 清理资源

```bash
# 删除所有 Azure 资源
make destroy
# 或
./sh/destroy.sh
```

## 📋 完整 Makefile 目标

```bash
make help               # 显示帮助
make provision          # 部署 Azure 基础设施
make start              # 启动本地开发 (前端+后端)
make destroy            # 销毁 Azure 资源
make deploy-function    # 上传 Function 到 Azure
make trigger-ci         # 创建空提交并推送 (触发 GitHub Actions)
```

## 🔧 脚本速查

| 脚本 | 功能 | 何时用 | 参数 |
|-----|------|-------|------|
| `./sh/provision.sh` | 部署基础设施 | 初次部署 | 无 |
| `./sh/start.sh` | 启动开发环境 | 日常开发 | 无 |
| `./sh/deploy-function.sh` | 部署代码 | 上云时 | 无 |
| `./sh/trigger-ci.sh` | 触发 CI | GitHub Actions | 无 |
| `./sh/destroy.sh` | 销毁资源 | 不需要时 | 无 |

## 🎯 场景化操作

### 场景 A：本地开发（推荐）

```bash
# 一次性
make provision
make start

# 之后每天
make start

# 完成后
make destroy
```

### 场景 B：开发 + 上云部署

```bash
# 一次性
make provision
make start
# 本地开发...
make deploy-function

# 完成后
make destroy
```

### 场景 C：GitHub Actions CI/CD

```bash
# 本地开发
make start
# 写代码...
git add .
git commit -m "feature: xxx"
make trigger-ci  # 自动上云

# 完成后
make destroy
```

## 🔐 凭证配置

### Azure OpenAI

```json
{
  "LLM_PROVIDER": "azure",
  "AZURE_OPENAI_ENDPOINT": "https://xxx.openai.azure.com/",
  "AZURE_OPENAI_API_KEY": "key-xxx",
  "AZURE_OPENAI_DEPLOYMENT_NAME": "gpt-4o"
}
```

### 第三方 OpenAI

```json
{
  "LLM_PROVIDER": "openai-compatible",
  "OPENAI_BASE_URL": "https://api.openai.com/v1",
  "OPENAI_API_KEY": "sk-xxx",
  "OPENAI_MODEL": "gpt-4o-mini"
}
```

## 🐛 常见问题

| 问题 | 解决 |
|-----|------|
| `local.settings.json` 找不到 | `cp local.settings.example.json local.settings.json` |
| 后端无法启动 | 检查 `local.settings.json` 配置是否完整 |
| 前端无法连接后端 | 确保 `func start` 成功启动 (7071) |
| Azure 权限不足 | 运行 `az login` 重新登录 |
| 脚本无权限执行 | 运行 `chmod +x sh/*.sh` |

## 📊 资源检查

```bash
# 查看 Functions 状态
az functionapp list --resource-group omni-guard-infra-sea-rg

# 查看 Function 设置
az functionapp config appsettings list \
  --name <func-name> \
  --resource-group omni-guard-infra-sea-rg

# 查看日志（需要 Azure CLI）
az functionapp logs tail \
  --name <func-name> \
  --resource-group omni-guard-infra-sea-rg
```

## 📚 文档速查

| 文档 | 内容 |
|-----|------|
| `QUICKSTART.md` | 快速开始（新手推荐） |
| `ARCHITECTURE_REDESIGN.md` | 架构改动详解 |
| `CHANGES_CHECKLIST.md` | 完整改动清单 |
| `README.md` | 项目总体介绍 |
| `sh/*.sh` | 脚本内有详细注释 |

## 💡 Pro 提示

### 并行开发

```bash
# 终端 1：启动后端
cd src/cloud-orchestrator/digitalhuman
func start

# 终端 2：启动前端
cd src/client-edge
npm run dev

# 这样可以独立调试前后端
```

### 快速重启后端

```bash
# 修改 .py 文件后，func start 会自动重启
# 如果没有，Ctrl+C 停止，再运行 func start
```

### 查看实时日志

```bash
# 后端日志直接在终端显示
# 访问 http://localhost:7071 可查看 Functions 诊断

# 前端日志在 Next.js 终端显示
```

### 远程调试

```bash
# 部署后可以查看 Azure Portal 中的 Function 日志
# 或使用 Azure CLI：
az functionapp logs tail --name <name> --resource-group omni-guard-infra-sea-rg
```

---

**⏱️ 估计时间**

| 操作 | 时间 |
|-----|------|
| provision | 5-10 分钟 |
| start | 1 分钟 |
| 本地开发 | ⏰|
| deploy-function | 2-3 分钟 |
| destroy | 3-5 分钟 |

---

**需要帮助？**
- 查看 `QUICKSTART.md`
- 查看脚本内的注释
- 检查 `ARCHITECTURE_REDESIGN.md`

