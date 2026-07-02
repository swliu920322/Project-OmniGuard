# DeepSeek V4 开发任务规范：隔离影子环境 E2E 部署与网络自愈测试脚本

> **任务目标**: 编写自动化集成测试脚本 `sh/shadow-e2e-test.py`。该脚本需读取现有参数，动态将其前缀修改为隔离的 `omnitest`，安全地在云端拉起影子环境资源组，验证内网 Private Endpoint 及 DNS 解析连通性后，自动清退销毁资源组以防费用泄露。
> **目标分支**: `feat/scenario-configurator`

---

## 🛠️ 任务 1：编写影子环境测试脚本

### 1.1 待创建文件
* 👉 `sh/shadow-e2e-test.py`

### 1.2 核心实现逻辑与步骤
请使用 Python 编写该脚本，具体流程如下：

#### 步骤 1：前置条件检查与 OIDC/SP 登录校验
1. 校验本地是否存在 `.azure/main.bicep` 以及 `.azure/main.parameters.json`。
2. 调用 `az account show` 检查当前是否已有活跃的 Azure 登录会话。若未登录，直接报错并提示用户先执行 `az login` 登录。

#### 步骤 2：生成影子测试参数集 (Prefix Overwrite)
1. 读取 `.azure/main.parameters.json`。
2. **参数重写策略**：
   * 将 `prefix` 值的 `value` 强行修改为 `"omnitest"`。
   * 将 `customResourceGroupName` 值的 `value` 强行修改为 `"omnitest-guard-infra-sea-rg"`。
   * 如果 `openAiKey` 留空，请给出警告，但允许继续测试经典密钥降级轨。
3. 将修改后的参数结构保存为临时文件：`.azure/shadow-test.parameters.json`。

#### 步骤 3：影子环境部署拉起 (az deployment)
1. 提取参数中的部署区域（`location`，若无则默认为 `southeastasia`）。
2. 在终端打印高亮的启动信息，并执行 Azure 订阅级部署命令：
   ```bash
   az deployment sub create --name "omnitest-shadow-deployment" --location <location> --template-file .azure/main.bicep --parameters @.azure/shadow-test.parameters.json
   ```
3. 捕获部署结果。若部署失败，**不直接退出**，而是记录失败状态并立即跳转到“步骤 5（资源清理）”，防止失败后留下收费资源垃圾。

#### 步骤 4：云端网络连通性深度审计
如果部署成功，开始通过 Azure CLI 执行以下断言（Assert）校验：
1. **Cosmos DB 私网 A 记录审计**：
   * 执行 `az network private-dns record-set a list -g omnitest-guard-infra-sea-rg -z privatelink.documents.azure.net`。
   * 验证是否为 Cosmos DB 自动生成了指向 `StorageSubnet` 内网 IP（形如 `10.1.2.x`）的 A 记录。
2. **Key Vault 私网 A 记录审计**：
   * 执行 `az network private-dns record-set a list -g omnitest-guard-infra-sea-rg -z privatelink.vaultcore.azure.net`。
   * 验证是否生成了 Key Vault 指向 `10.1.2.x` 的私网 A 记录。
3. **ACA 容器健康状态审计**：
   * 执行 `az containerapp show -g omnitest-guard-infra-sea-rg -n omnitest-backend --query properties.provisioningState -o tsv`。
   * 断言返回的状态是否为 `Succeeded`。如果网络或身份授权有错，容器状态通常会是 `Failed` / `Degraded`。

#### 步骤 5：自愈清退与销毁 (Teardown)
这是整个测试的核心安全防线，**无论步骤 3 和 4 的测试成功与否，都必须执行此清理动作**：
1. 打印高亮信息：`[*] 正在执行自愈销毁，清退影子资源组 'omnitest-guard-infra-sea-rg' ...`
2. 调用 Azure CLI 异步删除临时资源组（防止脚本挂起等待过久）：
   ```bash
   az group delete --name omnitest-guard-infra-sea-rg --yes --no-wait
   ```
3. 清理生成的临时参数文件 `.azure/shadow-test.parameters.json`。
4. 打印最终测试报告（包含网络审计通过项、部署总耗时等）。
5. 脚本根据测试断言结果，返回对应的系统退出码（成功为 `0`，失败为 `1`）。

---

## 🛠️ 任务 2：赋予执行权限并加入蓝图索引

### 2.1 执行要求
1. 在编写完脚本后，赋予可执行权限：`chmod +x sh/shadow-e2e-test.py`。
2. 确保在测试过程中，如果中途触发 `Ctrl+C` 信号，脚本能够捕获该信号并**强制在退出前调用销毁逻辑**，防止产生未清理垃圾。
