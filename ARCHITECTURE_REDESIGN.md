# 🎯 Project-OmniGuard 架构重新设计总结

## 问题背景

之前的设计存在以下问题：

1. **OpenAI 配置暴露**: 前端页面包含 OpenAI Base URL 和 API Key 的动态配置表单，存在安全风险
2. **脚本混乱**: `infra-up.sh` 过于复杂，包含凭证注入逻辑；`Makefile` 有多个冗余命令
3. **前后端耦合**: 后端接受前端发来的 `deploymentName` 覆盖，增加了复杂性
4. **不清晰的启动流程**: 用户不知道什么时候应该执行什么脚本
5. **网络配置混在一起**: 基础设施部署混入了凭证管理逻辑

## 新架构设计

### ✨ 核心原则

1. **职责分离**: 前端只负责 Azure 基础配置，后端完全从环境变量读取
2. **安全第一**: OpenAI 凭证永不进入前端，仅存储在 `local.settings.json`
3. **脚本清晰**: 4 个简单的脚本处理 4 种独立的任务
4. **本地优先**: 开发全在本地完成，上云是可选的
5. **幂等设计**: 脚本可以重复执行而不出错

### 📊 架构流程图

```
┌─────────────────────────────────────────────────────────────┐
│                    用户工作流                                 │
└─────────────────────────────────────────────────────────────┘
           ↓
   1. 准备凭证 (local.settings.json)
           ↓
   ┌─────────────────────────┐     ┌───────────────────────┐
   │ ./sh/provision.sh       │ ─→  │ Azure 基础设施就绪     │
   │ 部署 Azure 基础设施      │     │ (Function + Storage) │
   └─────────────────────────┘     └───────────────────────┘
           ↓                               ↓
   ┌─────────────────────────┐     
   │ ./sh/start.sh           │ 
   │ 启动本地开发环境 ────────────→ 前端 (3000) + 后端 (7071)
   └─────────────────────────┘     
           ↓                        
   ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐     
   │ (可选) 在前端创建配置    │     
   └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘     
           ↓                        
   ┌─────────────────────────┐     
   │ ./sh/deploy-function.sh │ ─→  Function 部署到 Azure
   │ 上传 Function 到云端    │     
   └─────────────────────────┘     
           ↓
   ┌─────────────────────────┐
   │ ./sh/trigger-ci.sh      │ ─→  GitHub Actions 流水线
   │ 触发 CI/CD              │
   └─────────────────────────┘
           ↓
   ┌─────────────────────────┐
   │ ./sh/destroy.sh         │ ─→  清理所有 Azure 资源
   │ 销毁资源                │
   └─────────────────────────┘
```

## 具体改动

### 1. 前端改动

#### 移除了什么？

- ❌ 前端表单中的 `OpenAI Base URL` 字段
- ❌ 前端表单中的 `OpenAI Model` 字段
- ❌ `LaunchConfig` 中的 `openaiBaseUrl` 属性
- ❌ `LaunchConfig` 中的 `openaiModel` 属性

#### 留下了什么？

- ✅ Azure 订阅配置
- ✅ Azure 资源组配置
- ✅ Azure OpenAI 账户名配置
- ✅ Azure Deployment Name 配置

#### 代码位置

```typescript
// src/client-edge/src/lib/launchProfile.ts
export interface LaunchConfig {
  profileId: LaunchProfileId;
  aiProvider: 'azure' | 'openai-compatible';
  azureDeploymentName: string;
  azureSubscription: string;
  azureResourceGroup: string;
  azureOpenAiAccountName: string;
  // ❌ 下面的已删除:
  // openaiBaseUrl: string;
  // openaiModel: string;
}
```

### 2. 后端改动

#### 移除了什么？

- ❌ `build_llm_client()` 中的 `deployment_override` 参数被删除
- ❌ `/api/chat/stream` 中接受 `deploymentName` 参数
- ❌ `/api/chat/stream` 中接受 `profile` 参数

#### 改变了什么？

```python
# 之前
def build_llm_client(deployment_override: str = ""):
    model = deployment_override.strip() or common_model or os.environ.get(...)

# 之后
def build_llm_client(deployment_override: str = ""):
    model = common_model or os.environ.get(...)
    # 不再接受前端的覆盖！
```

#### 请求体简化

```javascript
// 之前
{
  message: "...",
  context: "/",
  profile: "local-sub-azure-openai",
  deploymentName: "gpt-4o"  // ❌ 删除
}

// 之后
{
  message: "...",
  context: "/"
}
```

### 3. 脚本重新设计

#### 新脚本结构

| 脚本 | 功能 | 何时使用 |
|-----|------|--------|
| `provision.sh` | 部署 Azure 基础设施 | 首次部署，或需要重建基础设施 |
| `start.sh` | 启动本地开发环境 | 日常开发，启动前后端 |
| `deploy-function.sh` | 部署 Function 到 Azure | 代码完成，需要上云 |
| `trigger-ci.sh` | 触发 GitHub Actions | 需要自动化流程 |
| `destroy.sh` | 销毁所有 Azure 资源 | FinOps 止血，不再需要 |

#### 原来的脚本

- ❌ `infra-up.sh` - 太复杂，混入凭证管理 → 拆分为 `provision.sh` + `deploy-function.sh`
- ❌ `infra-destroy.sh` - 改为 `destroy.sh`
- ❌ `deploy-core.sh` - 功能并入 `deploy-function.sh`
- ❌ `empty_push.sh` - 改为 `trigger-ci.sh`
- ❌ `local_start.bash` - 改为 `start.sh`

### 4. 凭证管理流程

#### local.settings.json 结构

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "LOCAL_MOCK_MODE": "false",
    
    // 🔴 Azure 基础配置（Function 自动处理）
    "AZURE_STORAGE_ACCOUNT_NAME": "...",
    "AZURE_STORAGE_ACCOUNT_KEY": "...",
    
    // 🟡 LLM 配置（用户应凭证）
    "LLM_PROVIDER": "azure",  // 或 "openai-compatible"
    
    // 选项 A: Azure OpenAI
    "AZURE_OPENAI_ENDPOINT": "https://xxx.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "xxx",
    "AZURE_OPENAI_DEPLOYMENT_NAME": "gpt-4o",
    
    // 或选项 B: 第三方 OpenAI
    // "OPENAI_BASE_URL": "https://api.openai.com/v1",
    // "OPENAI_API_KEY": "sk-...",
    // "OPENAI_MODEL": "gpt-4o-mini"
  }
}
```

#### 凭证流向

```
┌────────────────────────────────────┐
│ local.settings.json (本地文件)      │
│ ✅ 安全：不进入版本控制             │
└─────────────┬──────────────────────┘
              │
              ├─→ func start             (本地开发)
              │   ↓
              │   func 读取环境变量
              │   ↓
              │   启动 Function 进程
              │
              ├─→ ./sh/deploy-function.sh (上云)
              │   ↓
              │   解析 local.settings.json
              │   ↓
              │   az functionapp config appsettings set
              │   ↓
              │   上传到 Azure Function App Settings
              │
              └─ 前端 (3000)
                 ❌ OpenAI 凭证永远不进入前端！
```

## Makefile 简化

### 之前

```makefile
fe: # 定义了两次！
	cd src/client-edge && npm install
	cd src/client-edge && npm run dev

infra: provision
up: devops deploy
provision: # 执行 infra-up.sh
deploy: # 执行 deploy-core.sh
destroy: # 执行 infra-destroy.sh
devops: # 执行 empty_push.sh
dev: # 启动 func start
```

### 之后

```makefile
help:                    # 显示帮助
provision:               # 部署基础设施
start:                   # 启动开发环境
destroy:                 # 销毁资源
deploy-function:         # 部署到云端
trigger-ci:              # 触发 CI/CD
```

## 工作流示例

### 开发场景 1: 本地开发（推荐）

```bash
# 1. 一次性配置
cp src/cloud-orchestrator/digitalhuman/local.settings.example.json \
   src/cloud-orchestrator/digitalhuman/local.settings.json
# 编辑 local.settings.json，填入 OpenAI 凭证

# 2. 部署 Azure 基础设施
make provision

# 3. 每次开发时启动本地环境
make start
# 访问 http://localhost:3000
# 访问 http://localhost:7071/api

# 4. 不再需要时清理
make destroy
```

### 开发场景 2: 开发后部署到生产

```bash
# 前面同上 (1-3 步)

# 4. 代码完成，部署到 Azure
make deploy-function

# 5. 触发 GitHub Actions 流水线
make trigger-ci

# 6. 清理（可选）
make destroy
```

## 安全性提升

| 方面 | 之前 | 之后 |
|-----|------|------|
| OpenAI 密钥位置 | 前端页面表单 | 仅本地 local.settings.json |
| 前端暴露信息 | API Key, Base URL | 仅 Azure 配置 |
| 版本控制 | 有风险 | 安全（.gitignore local.settings.json） |
| 密钥传输 | 前端 → 后端 → Azure | 直接从本地上传到 Azure |

## 升级指南

如果你使用了旧版本，需要：

1. **删除旧脚本**
   ```bash
   rm sh/infra-up.sh sh/empty_push.sh sh/local_start.bash sh/deploy-core.sh
   ```

2. **更新工作流**
   ```bash
   # 旧的
   ./sh/infra-up.sh
   make dev
   ./sh/deploy-core.sh
   
   # 新的
   make provision
   make start
   make deploy-function
   ```

3. **检查 local.settings.json**
   确保格式符合新结构

4. **清理前端代码**
   - 前端不再需要读取 `azureDeploymentName` 和发送给后端
   - 前端表单中不再显示 OpenAI 配置字段

## 文档和资源

- **快速开始**: `QUICKSTART.md`
- **脚本帮助**: `make help` 或查看各脚本的注释
- **前端配置**: `src/client-edge/src/lib/launchProfile.ts`
- **后端配置**: `src/cloud-orchestrator/digitalhuman/function_app.py`
- **基础设施**: `.azure/main.bicep` 等

---

**最后更新**: 2026-06-28
**设计者**: Shengwei Liu
**版本**: 2.0 (重新设计)

