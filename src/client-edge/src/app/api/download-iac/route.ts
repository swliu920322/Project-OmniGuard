import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GITHUB_WORKFLOW_OIDC_YAML = `name: Deploy Azure IaC (OIDC Passwordless)

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

      - name: Azure CLI Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: \${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: \${{ secrets.AZURE_TENANT_ID }}
          subscription-id: \${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Bicep Syntax Validation
        run: |
          az bicep build --file .azure/main.bicep

      - name: Preflight Validate (Azure ARM API Check)
        run: |
          LOCATION=\$(jq -r '.parameters.location.value // "southeastasia"' .azure/main.parameters.json)
          az deployment sub validate \\
            --location "\$LOCATION" \\
            --template-file .azure/main.bicep \\
            --parameters @.azure/main.parameters.json

      - name: Create Azure Subscription Deployment (Deploy)
        run: |
          LOCATION=\$(jq -r '.parameters.location.value // "southeastasia"' .azure/main.parameters.json)
          az deployment sub create \\
            --name "omni-guard-gitops-oidc-\$(date +%Y%m%d%H%M%S)" \\
            --location "\$LOCATION" \\
            --template-file .azure/main.bicep \\
            --parameters @.azure/main.parameters.json
`;

const GITHUB_WORKFLOW_SECRET_YAML = `name: Deploy Azure IaC (SP Secret Connection)

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

      - name: Azure CLI Login (Secret)
        uses: azure/login@v2
        with:
          creds: \${{ secrets.AZURE_CREDENTIALS }}

      - name: Bicep Syntax Validation
        run: |
          az bicep build --file .azure/main.bicep

      - name: Preflight Validate (Azure ARM API Check)
        run: |
          LOCATION=\$(jq -r '.parameters.location.value // "southeastasia"' .azure/main.parameters.json)
          az deployment sub validate \\
            --location "\$LOCATION" \\
            --template-file .azure/main.bicep \\
            --parameters @.azure/main.parameters.json

      - name: Create Azure Subscription Deployment (Deploy)
        run: |
          LOCATION=\$(jq -r '.parameters.location.value // "southeastasia"' .azure/main.parameters.json)
          az deployment sub create \\
            --name "omni-guard-gitops-secret-\$(date +%Y%m%d%H%M%S)" \\
            --location "\$LOCATION" \\
            --template-file .azure/main.bicep \\
            --parameters @.azure/main.parameters.json
`;

const README_MD = `# OmniGuard 导出的 IaC 部署包 (GitOps Ready)

本项目包含通过 OmniGuard 配置台生成的高内聚 Azure 基础架构模板，且内置了完整的 GitOps 流水线。

---

## 📂 目录结构说明
* \`.azure/\`：包含 Bicep 模块设计以及合并后的参数文件。
* \`.github/workflows/\`：
  * \`deploy-iac-oidc.yml\`：**企业推荐轨**（无密 OIDC 联邦授权流水线）。
  * \`deploy-iac-secret.yml\`：**快速测试轨**（经典 SP 密钥连接流水线）。

---

## 🚀 部署配置三部曲 (三轨选择指南)

请根据您的 Azure 订阅账号权限，选择最适合您的部署配置轨：

### 轨道 A：企业级生产态 (OIDC 无密钥 + 托管身份安全互通)
> **适用场景**：企业正式 Landing Zone 交付，要求 100% 审计合规，不保留任何持久密钥。
> **前提条件**：您的 Azure 登录账号在订阅级别拥有 Owner 或 User Access Administrator 权限。

1. 在本地终端运行以下命令，为 GitHub 注册无密码信任（将占位符替换为您的 GitHub 仓库）：
   \`\`\`bash
   # 1. 创建 App 登记
   APP_ID=\$(az ad app create --display-name "omni-guard-github-oidc" --query appId -o tsv)

   # 2. 创建服务主体
   az ad sp create --id \$APP_ID

   # 3. 授予订阅级 Contributor 权限
   az role assignment create --assignee \$APP_ID --role contributor --scope /subscriptions/<您的订阅ID>

   # 4. 配置 OIDC 联邦（信任您的 GitHub 仓库 main 分支）
   az ad app federated-credential create --id \$APP_ID --parameters '{
     "name": "github-actions-federated",
     "issuer": "https://token.actions.githubusercontent.com",
     "subject": "repo:<您的GitHub用户名>/<仓库名称>:ref:refs/heads/main",
     "description": "GitHub Actions for OmniGuard Deployments",
     "audiences": ["api://AzureADTokenExchange"]
   }'
   \`\`\`
2. 在 GitHub 仓库的 **Settings** ➔ **Secrets and variables** ➔ **Actions** 中新建三个 **Variables (非密文变量)**：
   * \`AZURE_CLIENT_ID\` = 上述生成的 \`\$APP_ID\`
   * \`AZURE_TENANT_ID\` = 您的 Azure 租户 ID
   * \`AZURE_SUBSCRIPTION_ID\` = 您的订阅 ID
3. 在本地解压目录中，**保留** \`.github/workflows/deploy-iac-oidc.yml\` 并**删除**另一个 yml 文件。
4. 确保在 OmniGuard 界面上配置时，**勾选开启【托管身份】**（即 \`deployManagedIdentities: true\`）。
5. 推送代码至 GitHub \`main\` 分支即可触发自动化零信任部署。

---

### 轨道 B：个人测试态 (SP 密钥登录 + 托管身份安全互通)
> **适用场景**：个人高配测试环境，希望快速接入 CI/CD，但内部资源依然需要 Managed Identity 鉴权。
> **前提条件**：您的 Azure 账号在订阅级别拥有管理员角色分配权。

1. 本地运行一键命令生成凭据包：
   \`\`\`bash
   az ad sp create-for-rbac --name "omni-guard-github-deployer" --role contributor --scopes /subscriptions/<您的订阅ID> --sdk-auth
   \`\`\`
2. 将返回的 JSON 密文原封不动粘贴进 GitHub 仓库 **Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ **New repository secret (密文密钥)**：
   * 名称命名为：\`AZURE_CREDENTIALS\`
3. 确保在配置台界面上，**勾选开启【托管身份】**（即 \`deployManagedIdentities: true\`）。
4. 在本地目录中，**保留** \`.github/workflows/deploy-iac-secret.yml\` 并**删除**另一个 yml 文件，推送至 \`main\` 即可。

---

### 轨道 C：受限降级态 (SP 密钥登录 + 经典密钥连接自愈)
> **适用场景**：学生账号、极受限的开发沙箱。由于没有订阅级管理员权限，无法分配 Role Assignment。
> **前提条件**：仅需目标资源组的 Contributor 权限。

1. 按照"轨道 B"的步骤 1 和 2，生成 \`AZURE_CREDENTIALS\` 并在 GitHub 录入。
2. 确保在 OmniGuard 界面配置时，**关闭【托管身份】（切换为经典密钥模式）**（即参数 \`deployManagedIdentities: false\`）。
3. 本地目录中保留 \`.github/workflows/deploy-iac-secret.yml\`，删除 oidc 工作流。
4. 推送部署。Bicep 会自动裁剪所有特权 roleAssignments 资源，退避使用 Storage Key / Cosmos Master Key，保障 100% 成功部署！
`;

function findProjectRoot(): string {
  const candidates = [
    path.join(process.cwd(), '..', '..'),
    path.join(process.cwd(), '..'),
    process.cwd(),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, '.azure'))) {
      return dir;
    }
  }
  return path.join(process.cwd(), '..', '..');
}

export async function GET() {
  const projectRoot = findProjectRoot();
  const azureDir = path.join(projectRoot, '.azure');

  const allowedFiles = [
    'main.bicep',
    'nested-infra.bicep',
    'compute-module.bicep',
    'main.parameters.json',
    'network-rules.json'
  ];

  const tmpDir = '/tmp/omni-guard-export';
  const tmpAzureDir = path.join(tmpDir, '.azure');
  const tmpWorkflowsDir = path.join(tmpDir, '.github', 'workflows');
  const tmpZip = '/tmp/omni-guard-iac.zip';

  try {
    await execAsync(`rm -rf "${tmpDir}"`);
    fs.mkdirSync(tmpAzureDir, { recursive: true });
    fs.mkdirSync(tmpWorkflowsDir, { recursive: true });

    for (const f of allowedFiles) {
      const src = path.join(azureDir, f);
      const resolved = path.resolve(src);
      if (!resolved.startsWith(path.resolve(azureDir))) {
        return NextResponse.json({ error: 'Path traversal detected' }, { status: 400 });
      }
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(tmpAzureDir, f));
      }
    }

    fs.writeFileSync(path.join(tmpWorkflowsDir, 'deploy-iac-oidc.yml'), GITHUB_WORKFLOW_OIDC_YAML, 'utf-8');
    fs.writeFileSync(path.join(tmpWorkflowsDir, 'deploy-iac-secret.yml'), GITHUB_WORKFLOW_SECRET_YAML, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), README_MD, 'utf-8');

    await execAsync(`cd "${tmpDir}" && zip -r "${tmpZip}" .`);

    const fileBuffer = fs.readFileSync(tmpZip);

    await execAsync(`rm -rf "${tmpDir}" "${tmpZip}"`);

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=omni-guard-iac.zip'
      }
    });
  } catch (err: any) {
    console.error('[Download IaC] Failed to create package:', err);
    try { execAsync(`rm -rf "${tmpDir}" "${tmpZip}"`); } catch {}
    return NextResponse.json({ error: 'Failed to create package', message: err.message }, { status: 500 });
  }
}
