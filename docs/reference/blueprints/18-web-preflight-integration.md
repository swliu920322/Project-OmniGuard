# DeepSeek V4 开发任务规范：配置台一键云端预检与 Web 控制台日志联调

> **任务目标**: 将 `sh/preflight-validate.py` 命令深度集成到配置台的 Web 界面，实现“一键云端预检并在 Web 页面实时输出编译/订阅权限审计日志”的 DevOps 闭环。
> **目标分支**: `feat/scenario-configurator`

---

## 🛠️ 任务 1：API 路由（`route.ts`）执行预检命令支持

### 1.1 待修改文件
* 👉 `src/client-edge/src/app/api/save-iac-config/route.ts`

### 1.2 实现细节
1. 在 `POST` 接收体中，除了支持读取 parameters 之外，增加判断可选的 `action` 参数。
   ```typescript
   const { parameters, uiState, action } = body;
   ```
2. 如果 `action === 'preflight'`：
   * 接口直接跳过常规的参数序列化，直接在服务器端异步执行先前建立的校验脚本：
     ```typescript
     const preflightScriptPath = path.join(projectRoot, 'sh', 'preflight-validate.py');
     const command = `python3 "${preflightScriptPath}"`;
     ```
   * 使用 `execAsync` 执行该脚本。
   * 捕获执行结果。如果脚本退出码为 0，返回：
     ```json
     {
       "success": true,
       "message": "Azure Sub Cloud Preflight Check Passed!",
       "output": stdout
     }
     ```
     如果执行失败（退出码非0，抛出 Error），捕获 error 结构中的 `stdout` 和 `stderr`，返回：
     ```json
     {
       "success": false,
       "error": "PreflightCheckFailed",
       "message": "Azure Sub Cloud Preflight Check failed.",
       "output": stdout + "\n" + stderr
     }
     ```

---

## 🛠️ 任务 2：前端 Web 交互与控制台日志对接

### 2.1 待修改文件
* 👉 `src/client-edge/src/app/iac/configurator/components/CostCalculatorPanel.tsx`
* 👉 `src/client-edge/src/app/iac/configurator/page.tsx`

### 2.2 实现细节
1. **[CostCalculatorPanel.tsx](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/client-edge/src/app/iac/configurator/components/CostCalculatorPanel.tsx) 组件改造**:
   * 在 Props 接口中，增加 `onPreflightValidate: () => Promise<void>` 和 `isValidatingCloud: boolean`。
   * 在【保存并组装】按钮的左侧，新增一个按钮：
     * **文案**：`☁️ 云端预检` (Cloud Check)
     * **样式**：采用带有透明度的 Slate/Cyan 边框的按钮（与保存按钮区分开），在 `isValidatingCloud` 为 `true` 时显示 Loading 动画或禁用点击。
     * **点击事件**：触发 `onPreflightValidate`。

2. **[page.tsx](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/client-edge/src/app/iac/configurator/page.tsx) 核心页联调**:
   * 声明两个新状态：
     * `const [isValidatingCloud, setIsValidatingCloud] = useState<boolean>(false);`
   * 编写事件回调 `handlePreflightValidate`：
     * 设置 `isValidatingCloud` 为 `true`。
     * 清空当前控制台日志，并将控制台前置提示设为：`[*] Connecting to Azure API... Submitting validation parameters to subscription...`。
     * 发送 POST 请求到 `/api/save-iac-config`，Body 结构为：
       ```json
       {
         "action": "preflight"
       }
       ```
     * 获取返回的 `output` 日志（包括 Python 脚本运行产生的颜色终端输出字符）。
     * 将其塞入 `setAssemblerConsole(data.output || data.message)`，以呈现在 [ConsoleOutputPanel.tsx](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/client-edge/src/app/iac/configurator/components/ConsoleOutputPanel.tsx) 终端区域。
     * 若成功，将 `saveMessage` 设置为绿色成功条：“云端预飞行校验成功通过，网段与权限 100% 兼容！”。若失败，设置为红色提示。
     * 恢复 `isValidatingCloud` 状态。
   * 将 `onPreflightValidate={handlePreflightValidate}` 以及 `isValidatingCloud={isValidatingCloud}` 传给 `<CostCalculatorPanel ... />`。
