import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GITHUB_WORKFLOW_YAML = `name: Deploy Azure IaC Landing Zone

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
          creds: \${{ secrets.AZURE_CREDENTIALS }}

      - name: Bicep Syntax Validation
        run: |
          az bicep build --file .azure/main.bicep

      - name: Preflight Validate (Azure ARM API Check)
        run: |
          LOCATION=$(jq -r '.parameters.location.value // "southeastasia"' .azure/main.parameters.json)
          az deployment sub validate \\
            --location "$LOCATION" \\
            --template-file .azure/main.bicep \\
            --parameters @.azure/main.parameters.json

      - name: Create Azure Subscription Deployment (Deploy)
        run: |
          LOCATION=$(jq -r '.parameters.location.value // "southeastasia"' .azure/main.parameters.json)
          az deployment sub create \\
            --name "omni-guard-gitops-$(date +%Y%m%d%H%M%S)" \\
            --location "$LOCATION" \\
            --template-file .azure/main.bicep \\
            --parameters @.azure/main.parameters.json
`;

const README_MD = `# OmniGuard 导出的 IaC 部署包 (GitOps Ready)

本项目包含通过 OmniGuard 配置台生成的高内聚 Azure 基础架构模板。

## 📂 目录结构说明
* \`.azure/\`：包含 Bicep 模块设计以及合并后的参数文件。
* \`.github/workflows/\`：包含一键自动部署的 GitOps CI/CD 流水线。

## 🚀 一键接入 GitOps 部署指南
1. 将本压缩包解压后的所有文件，推送到您的 GitHub 个人或企业私有仓库 \`main\` 分支。
2. 创建一个 Azure 服务主体 (Service Principal) 用于凭据托管，在本地终端运行：
   \`\`\`bash
   az ad sp create-for-rbac --name "omni-guard-github-deployer" --role contributor --scopes /subscriptions/<您的订阅ID> --sdk-auth
   \`\`\`
3. 复制终端输出的完整的 JSON 字符串。
4. 打开您的 GitHub 仓库设置 ➔ **Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ 新建密钥：
   * 名称：\`AZURE_CREDENTIALS\`
   * 内容：粘贴上述步骤 2 的 JSON。
5. 之后，只要您在 \`.azure/\` 下修改任何参数，推送至 \`main\` 分支时，GitHub 就会自动运行编译校验、云端预检并执行部署！
`;

export async function GET() {
  const projectRoot = path.join(process.cwd(), '..');
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
    // Clean up any previous export
    await execAsync(`rm -rf "${tmpDir}"`);
    fs.mkdirSync(tmpAzureDir, { recursive: true });
    fs.mkdirSync(tmpWorkflowsDir, { recursive: true });

    // Copy allowed .azure files into temp tree
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

    // Write .github/workflows/deploy-iac.yml
    fs.writeFileSync(path.join(tmpWorkflowsDir, 'deploy-iac.yml'), GITHUB_WORKFLOW_YAML, 'utf-8');

    // Write README.md
    fs.writeFileSync(path.join(tmpDir, 'README.md'), README_MD, 'utf-8');

    // Zip the entire temp directory
    await execAsync(`cd "${tmpDir}" && zip -r "${tmpZip}" .`);

    const fileBuffer = fs.readFileSync(tmpZip);

    // Clean up temp files
    await execAsync(`rm -rf "${tmpDir}" "${tmpZip}"`);

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=omni-guard-iac.zip'
      }
    });
  } catch (err: any) {
    console.error('[Download IaC] Failed to create package:', err);
    // Best-effort cleanup
    try { execAsync(`rm -rf "${tmpDir}" "${tmpZip}"`); } catch {}
    return NextResponse.json({ error: 'Failed to create package', message: err.message }, { status: 500 });
  }
}
