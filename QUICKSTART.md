# 🚀 Project-OmniGuard 快速开始指南

## 新架构说明

这个项目已经重新设计，采用了更清晰的分离方式：

- **前端配置**: 只处理 Azure 基础配置（订阅、资源组、账户名、部署名）
- **OpenAI 凭证**: 完全存储在 `local.settings.json`，不暴露给前端
- **脚本简化**: 清晰的 4 个核心脚本处理不同的任务

## 前置条件

1. **Azure CLI**: 已登录并有权限创建资源
   ```bash
   az login
   az account set --subscription "<your-subscription>"
   ```

2. **Azure Functions Core Tools**: 用于本地开发
   ```bash
   brew tap azure/azure
   brew install azure-functions-core-tools@4
   ```

3. **Node.js & npm**: 前端开发
   ```bash
   node --version  # >= 18.x
   npm --version   # >= 9.x
   ```

4. **Python 3.11+**: 后端 Function 开发
   ```bash
   python3 --version
   ```

## 快速开始步骤

### 1️⃣ 准备 OpenAI 凭证

复制配置模板：
```bash
cp src/cloud-orchestrator/digitalhuman/local.settings.example.json \
   src/cloud-orchestrator/digitalhuman/local.settings.json
```

编辑 `local.settings.json`，填入你的 OpenAI 凭证：

**选项 A: Azure OpenAI**
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "LOCAL_MOCK_MODE": "false",
    "LLM_PROVIDER": "azure",
    "AZURE_OPENAI_ENDPOINT": "https://your-instance.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "your-key-here",
    "AZURE_OPENAI_DEPLOYMENT_NAME": "gpt-4o"
  }
}
```

**选项 B: 第三方 OpenAI 兼容**
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "LOCAL_MOCK_MODE": "false",
    "LLM_PROVIDER": "openai-compatible",
    "OPENAI_BASE_URL": "https://api.openai.com/v1",
    "OPENAI_API_KEY": "sk-...",
    "OPENAI_MODEL": "gpt-4o-mini"
  }
}
```

### 2️⃣ 部署 Azure 基础设施

```bash
make provision
# 或
./sh/provision.sh
```

这会创建：
- Resource Group: `omni-guard-infra-sea-rg`
- Function App (Azure Functions Serverless)
- Storage Account (用于 Function App 存储)
- VNet 和必要的网络配置

### 3️⃣ 启动本地开发环境

```bash
make start
# 或
./sh/start.sh
```

这会启动：
- **后端**: Azure Functions (端口 7071)
- **前端**: Next.js 开发服务器 (端口 3000)

访问 `http://localhost:3000` 即可看到启动台。

### 4️⃣ 选择（可选）部署到云端

当本地开发完成后，将 Function 部署到 Azure：

```bash
make deploy-function
# 或
./sh/deploy-function.sh
```

这会：
1. 读取 `local.settings.json` 中的 OpenAI 配置
2. 同步配置到 Azure Function App Settings
3. 部署 Python 代码到云端

### 5️⃣ 销毁资源（FinOps 止血）

当不再需要时，可以清理所有 Azure 资源：

```bash
make destroy
# 或
./sh/destroy.sh
```

## 前端启动台说明

访问 `http://localhost:3000` 后，你会看到一个启动台，其中包含：

1. **启动模式选择**:
   - 本地订阅 + 第三方 OpenAI
   - 本地订阅 + Azure OpenAI
   - 云端订阅 + Azure OpenAI

2. **Azure 基础配置字段**:
   - Azure 订阅
   - Azure 资源组
   - Azure OpenAI 账户名
   - Azure Deployment 名称

3. **启动命令预览**: 显示当前选择下要执行的脚本命令

4. **销毁命令**: 一键查看销毁命令

## 关键改动说明

### ✅ 已移除

- ❌ 前端的 OpenAI Base URL 和 Model 动态配置表单
- ❌ 后端 `/api/chat/stream` 中的 `deploymentName` 覆盖逻辑
- ❌ infra-up.sh 中复杂的凭证注入逻辑
- ❌ 混乱的 Makefile 和脚本

### ✅ 已添加

- ✨ 清晰的 4 个核心脚本：`provision.sh`, `start.sh`, `deploy-function.sh`, `trigger-ci.sh`
- ✨ 简化的 Makefile（仅 5 个目标）
- ✨ 完整的 `local.settings.json` 配置管理
- ✨ 自动从 `local.settings.json` 读取 OpenAI 凭证上传到云端

## 故障排除

### 问题：`local.settings.json` 未找到

**解决**: 
```bash
cp src/cloud-orchestrator/digitalhuman/local.settings.example.json \
   src/cloud-orchestrator/digitalhuman/local.settings.json
```

### 问题：后端 Function 404 错误

**检查项**:
1. `local.settings.json` 中的 `AZURE_OPENAI_ENDPOINT` 是否正确
2. `AZURE_OPENAI_DEPLOYMENT_NAME` 是否与 Azure 中的实际部署名一致
3. `AZURE_OPENAI_API_KEY` 是否有效

### 问题：前端无法连接到后端

**检查项**:
1. 后端是否在运行（`func start` 是否成功）
2. 端口 7071 是否被占用：`lsof -i :7071`
3. Next.js 是否在 3000 端口运行：`lsof -i :3000`

## GitHub CI/CD

触发流水线：

```bash
make trigger-ci
# 或
./sh/trigger-ci.sh
```

这会创建一个空提交并推送，自动触发 GitHub Actions 流程。

## 常用命令速查

```bash
# 首次部署
make provision
make start

# 开发中
./sh/start.sh

# 部署到生产
./sh/deploy-function.sh

# 清理资源
./sh/destroy.sh

# CI 流程
./sh/trigger-ci.sh

# 查看帮助
make help
```

## 更多信息

- 前端源码：`src/client-edge/`
- 后端源码：`src/cloud-orchestrator/digitalhuman/`
- 基础设施代码：`.azure/`
- 脚本：`./sh/`

---

**最后更新**: 2026-06-27
**维护者**: Shengwei Liu

