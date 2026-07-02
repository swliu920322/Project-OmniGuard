# DeepSeek V4 开发任务规范：动态注入 GitOps 流水线与一键部署 README 引导

> **任务目标**: 在用户导出 IaC 压缩包时，动态往 Zip 包内注入符合企业安全规范的 GitHub Actions 工作流定义文件与 README 使用指南，实现从“界面配置”到“GitOps 代码化部署”的一键连通。
> **目标分支**: `feat/scenario-configurator`

---

## 🛠️ 任务 1：接口升级——动态在 Zip 包中注入 `.github/workflows/`

### 1.1 待修改文件
* 👉 `src/client-edge/src/app/api/download-iac/route.ts`

### 1.2 实现细节
1. 在 `/api/download-iac/route.ts` 执行 `zip` 命令打包之前，利用 `fs` 模块在临时文件夹中动态创建以下目录和文件：
   * 临时目录路径：`/tmp/omni-guard-export` (或类似隔离文件夹)
2. **文件 A**：在 `/tmp/omni-guard-export/.github/workflows/deploy-iac.yml` 下写入标准 GitHub Actions 工作流代码：
   ```yaml
   name: Deploy Azure IaC Landing Zone

   on:
     push:
       branches:
         - main
       paths:
         - '.azure/**'
     workflow_dispatch:

   permissions:
     id-token: write
     contents: read

   jobs:
     validate-and-deploy:
       runs-on: ubuntu-latest
       steps:
         - name: Checkout Code
           uses: actions/checkout@v4

         - name: Azure CLI Login
           uses: azure/login@v2
           with:
             creds: ${{ secrets.AZURE_CREDENTIALS }}

         - name: Bicep Syntax Validation
           run: |
             az bicep build --file .azure/main.bicep

         - name: Preflight Validate (Azure ARM API Check)
           run: |
             LOCATION=$(jq -r '.parameters.location.value // "southeastasia"' .azure/main.parameters.json)
             az deployment sub validate \
               --location "$LOCATION" \
               --template-file .azure/main.bicep \
               --parameters @.azure/main.parameters.json

         - name: Create Azure Subscription Deployment (Deploy)
           run: |
             LOCATION=$(jq -r '.parameters.location.value // "southeastasia"' .azure/main.parameters.json)
             az deployment sub create \
               --name "omni-guard-gitops-$(date +%Y%m%d%H%M%S)" \
               --location "$LOCATION" \
               --template-file .azure/main.bicep \
               --parameters @.azure/main.parameters.json
   ```

3. **文件 B**：在 `/tmp/omni-guard-export/README.md` 下写入引导文档：
   ```markdown
   # OmniGuard 导出的 IaC 部署包 (GitOps Ready)

   本项目包含通过 OmniGuard 配置台生成的高内聚 Azure 基础架构模板。

   ## 📂 目录结构说明
   * `.azure/`：包含 Bicep 模块设计以及合并后的参数文件。
   * `.github/workflows/`：包含一键自动部署的 GitOps CI/CD 流水线。

   ## 🚀 一键接入 GitOps 部署指南
   1. 将本压缩包解压后的所有文件，推送到您的 GitHub 个人或企业私有仓库 `main` 分支。
   2. 创建一个 Azure 服务主体 (Service Principal) 用于凭据托管，在本地终端运行：
      ```bash
      az ad sp create-for-rbac --name "omni-guard-github-deployer" --role contributor --scopes /subscriptions/<您的订阅ID> --sdk-auth
      ```
   3. 复制终端输出的完整的 JSON 字符串。
   4. 打开您的 GitHub 仓库设置 ➔ **Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ 新建密钥：
      * 名称：`AZURE_CREDENTIALS`
      * 内容：粘贴上述步骤 2 的 JSON。
   5. 之后，只要您在 `.azure/` 下修改任何参数，推送至 `main` 分支时，GitHub 就会自动运行编译校验、云端预检并执行部署！
   ```

4. **压缩包打包优化**:
   * 将上述 `/tmp/omni-guard-export/` 目录下的所有结构一并打包进入 Zip 文件的根目录。
   * 确保生成的 Zip 解压后可以直接以如下路径排布：
     ```text
     ├── .azure/
     │   ├── main.bicep
     │   ├── nested-infra.bicep
     │   ├── compute-module.bicep
     │   └── main.parameters.json
     ├── .github/
     │   └── workflows/
     │       └── deploy-iac.yml
     └── README.md
     ```
   * *提示：可以先在临时目录创建完整的文件树，再整体调用系统 `zip -r` 压缩该目录，随后清除临时文件夹。*
