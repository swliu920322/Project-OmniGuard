# DeepSeek V4 开发任务规范：企业标签治理与 IaC 配置包打包下载

> **任务目标**: 支持在配置台中输入企业合规标签，并在 Bicep 层面自动合并；同时开发后端打包 API 与前端下载按钮，使用户能一键将生成的 IaC 架构包打包为 `.zip` 格式下载。
> **目标分支**: `feat/scenario-configurator`

---

## 🛠️ 任务 1：Bicep 模板支持动态标签合并

### 1.1 待修改文件
* 👉 `.azure/templates/sandbox/main.bicep`
* 👉 `.azure/templates/secure-iot/main.bicep`

### 1.2 实现要求
1. 在两个模板文件的参数声明区中，新增两个输入参数：
   ```bicep
   param costCenter string = 'IT-Dept'
   param finOpsOwner string = 'Shengwei'
   ```
2. 将原先写死在 `resource rg 'Microsoft.Resources/resourceGroups...'` 中的 `tags` 对象进行重构。使用 Bicep 内置的 `union` 函数，将默认标签与动态输入的标签进行合并：
   * **Sandbox 模板示例**:
     ```bicep
     var defaultTags = {
       Environment: 'Sandbox'
       Scenario: 'DevSandbox'
       FinOpsOwner: finOpsOwner
       CostCenter: costCenter
     }
     // ...
     resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
       name: resourceGroupName
       location: location
       tags: defaultTags
     }
     ```
   * **Secure-IoT 模板示例**:
     ```bicep
     var defaultTags = {
       Environment: 'Production-Intake'
       Scenario: 'SecureIoTPipeline'
       FinOpsOwner: finOpsOwner
       CostCenter: costCenter
     }
     // ...
     resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
       name: resourceGroupName
       location: location
       tags: defaultTags
     }
     ```

---

## 🛠️ 任务 2：创建一键打包 API (`/api/download-iac`)

### 2.1 待创建文件
* 👉 `src/client-edge/src/app/api/download-iac/route.ts`

### 2.2 实现细节
1. **接口逻辑**:
   * 提供 `GET` 接口。
   * 指定项目根目录下 `.azure/` 路径中的关键部署包文件：
     * `main.bicep`
     * `nested-infra.bicep`
     * `compute-module.bicep`
     * `main.parameters.json`
     * `network-rules.json`（如果存在）
   * **纯 JS 实现 Zip 压缩 (免依赖或极简依赖)**：
     * 由于是在 Node 环境中运行，如果项目没有依赖库，可以使用 Node 内置的 `zlib` 配合 `archiver`（如果 package.json 中有），或使用极简实现。
     * **安全建议**：检查 `src/client-edge/package.json` 中是否有 `adm-zip`、`jszip` 或 `archiver`。
     * 如果没有，可以调用系统的 `zip` 命令行打包，或者使用 Node 自带的 `zlib` 生成压缩包：
       ```typescript
       // 调用系统命令 zip 是一种非常轻量且健壮的方式
       import { exec } from 'child_process';
       // ... 在临时文件夹下打包文件并以流形式输出
       ```
       或者如果 package.json 允许，直接通过命令行在临时目录打包：
       ```bash
       cd ../.azure && zip -r /tmp/omni-guard-iac.zip main.bicep nested-infra.bicep compute-module.bicep main.parameters.json network-rules.json
       ```
       然后用 `fs.readFileSync` 读取并以 `Response` 流返回：
       ```typescript
       const fileBuffer = fs.readFileSync('/tmp/omni-guard-iac.zip');
       return new Response(fileBuffer, {
         headers: {
           'Content-Type': 'application/zip',
           'Content-Disposition': 'attachment; filename=omni-guard-iac.zip'
         }
       });
       ```
       *注：请在 API 路由中确保安全处理路径，仅允许打包 `.azure` 目录下的这 5 个文件，绝对禁止越权读取项目其他敏感代码。*

---

## 🛠️ 任务 3：Web 端界面交互开发

### 3.1 待修改文件
* 👉 `src/client-edge/src/app/iac/configurator/components/GlobalParamsPanel.tsx`
* 👉 `src/client-edge/src/app/iac/configurator/components/CostCalculatorPanel.tsx`
* 👉 `src/client-edge/src/app/iac/configurator/page.tsx`

### 3.2 实现细节
1. **[GlobalParamsPanel.tsx](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/client-edge/src/app/iac/configurator/components/GlobalParamsPanel.tsx) 改造**:
   * 在 Props 中增加 `costCenter`、`setCostCenter`、`finOpsOwner`、`setFinOpsOwner`。
   * 在 **01. 基础标识 (Basics)** 标签页中增加两个输入框：
     * 成本中心 (Cost Center)：默认值 `'IT-Dept'`
     * 负责人 (FinOps Owner)：默认值 `'Shengwei'`
     * 高度限制为 `h-11 px-3.5`，符合像素一致性对齐。
2. **[page.tsx](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/client-edge/src/app/iac/configurator/page.tsx) 状态同步与持久化**:
   * 声明 `costCenter` 和 `finOpsOwner` 的 React State。
   * 在 `generateParametersObj` 以及 `handleSaveConfig` (包括 `uiState` 存盘) 中序列化这两个标签参数，保证点击保存时会写入 `main.parameters.json` 的 `costCenter` 与 `finOpsOwner`。
   * 在 mount 挂载时的 `useEffect` 回填逻辑中读取并填充这两个值。
3. **[CostCalculatorPanel.tsx](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/client-edge/src/app/iac/configurator/components/CostCalculatorPanel.tsx) 新增下载入口**:
   * 增加 `onDownloadPackage: () => void` Props。
   * 在【云端预检】与【保存并组装】按钮正下方，新增一个跨行宽按钮：
     * **文案**：`📦 导出 IaC 压缩包`
     * **样式**：采用带有透明度的 Slate/Amber 按钮，点击时调用 `onDownloadPackage`（可以利用 `window.open('/api/download-iac')` 直接触发下载）。
