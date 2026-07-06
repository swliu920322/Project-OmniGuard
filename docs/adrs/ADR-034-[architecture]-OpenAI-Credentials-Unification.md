# Architectural Decision Record (ADR 034)
# 架构决策记录 (ADR 034)

## Title / 标题
Consolidation and Unification of Azure OpenAI Client Instantiation and Credential Loading
Azure OpenAI 客户端实例化与凭证加载的规范化与统一

## Status / 状态
**Approved / 已批准**

## Context / 背景
Prior to this decision, the backend Python codebase resolved Azure OpenAI credentials and endpoints using three different sets of environment variables (`OPENAI_*`, `AZURE_OPENAI_*`, and `OPENAI_API_*`) scattered across three separate modules (`digitalhuman/router.py`, `embodied_brain/utils.py`, `kol_analysis/inference_engine.py`). 

This resulted in redundant configuration in Bicep templates and deployment scripts, as well as inconsistent error handling and settings-loading logic (e.g. `digitalhuman` lacked fallback resolution, and `kol_analysis` had duplicated code for parsing `local.settings.json`).

在此决策之前，后端 Python 代码库分散地在三个不同模块（`digitalhuman/router.py`、`embodied_brain/utils.py`、`kol_analysis/inference_engine.py`）中，使用三套不同的环境变量名（`OPENAI_*`、`AZURE_OPENAI_*` 和 `OPENAI_API_*`）来解析 Azure OpenAI 凭证和端点。这导致了 Bicep 模板和部署脚本的冗余配置，以及不一致的错误处理和配置加载逻辑（例如 `digitalhuman` 缺少回退解析，且 `kol_analysis` 具有重复解析 `local.settings.json` 的冗余代码）。

## Decision Drivers / 决策驱动因素
- **DRY Principle (Don't Repeat Yourself)**: Eliminate duplicate logic for resolving keys, endpoints, and model deployments.
- **Resilience**: Ensure all backend modules benefit from the same robust environment variable fallback and settings-loading mechanisms.
- **Maintainability**: Simplify the IaC layer and the deployment script (`sh/deploy-aca.sh`) by providing a single source of truth for LLM client generation.

- **DRY 原则**：消除解析密钥、端点和模型部署的重复逻辑。
- **高弹性**：确保所有后端模块都能从相同的环境变量回退和本地配置文件加载机制中受益。
- **易维护性**：通过为 LLM 客户端生成提供单一可信源，简化 IaC 层和部署脚本。

## Decision / 决策
1. **Created `openai_config.py`**: Introduced a centralized module `src/cloud-orchestrator/openai_config.py` that:
   - Automatically loads `local.settings.json` into `os.environ` if present (centralizing local development support).
   - Resolves OpenAI credentials using a single prioritized fallback hierarchy: `AZURE_OPENAI_*` standard names first, falling back to `OPENAI_*` variants, and defaulting the model deployment to `gpt-5.4-mini` (or `gpt-4o-mini` as overridden by the caller).
   - Exposes standard constructor functions `get_azure_openai_client()` and `get_async_azure_openai_client()`.
2. **Refactored Backend Modules**: Updated `digitalhuman/router.py`, `embodied_brain/utils.py`, and `kol_analysis/inference_engine.py` to import and utilize the helper functions from `openai_config.py`, deleting all duplicate parsing, file loading, and instantiation code.

1. **创建 `openai_config.py`**：引入了中央配置与客户端生成工具，其具备：
   - 自动在本地读取 `local.settings.json` 并注入环境变量；
   - 统一按照标准优先级（优先解析 `AZURE_OPENAI_*` 变量，回退解析 `OPENAI_*` 变量）解析凭证并提供默认模型；
   - 暴露 `get_azure_openai_client()` 和 `get_async_azure_openai_client()` 函数。
2. **重构后端模块**：更新三个核心模块以直接导入并使用该配置文件，彻底删除所有重复的密钥解析、文件读取和客户端实例化代码。

## Consequences / 后果

### Positive / 正向
- **Cognitive Load Reduction**: Developers only need to look at a single file to understand how LLM clients are initialized.
- **Guaranteed Consistency**: Eliminates silent failures in components like `digitalhuman` when missing certain variable names.
- **Simpler Backlog/Cleanup**: Prepares the repository for a future cleanup of redundant Bicep template variables since all code now runs off a unified fallback mechanism.

### Negative / 负向
- Adds a new shared internal import (`openai_config`) across backend subfolders.

### Positive / 正向
- **降低认知负荷**：开发者只需查看单个文件即可了解 LLM 客户端是如何初始化的。
- **保障一致性**：消除了由于缺少某些变量名而在 `digitalhuman` 等组件中发生的静默失败。
- **简化后续清理**：由于所有代码都运行在统一的回退机制上，为未来清理 Bicep 模板中的冗余变量打下了坚实基础。

### Negative / 负向
- 在后端子文件夹之间增加了一个新的共享内部导入。
