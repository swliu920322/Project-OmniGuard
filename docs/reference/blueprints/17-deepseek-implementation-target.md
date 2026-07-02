# DeepSeek V4 开发任务规范：API 侧网络网段校验与预检执行器设计

> **任务目标**: 实现配置台后端（API 侧）的 CIDR 安全校验、非破坏性干跑（Dry-Run）机制，以及云端预飞行自动校验脚本。
> **目标分支**: `feat/scenario-configurator`

---

## 🛠️ 任务 1：API 路由（`route.ts`）防越权与网段自愈校验

### 1.1 背景与需求
目前我们在 `page.tsx` 前端页面中实现了 IP 段重叠与大小校验。但根据企业开发规范，前端校验可以被绕过，**后端 API 必须作为第二道安全防线**，对提交的网络参数进行强制拦截校验。如果校验失败，API 必须拒绝写盘并返回 `422 Unprocessable Entity`。

### 1.2 待修改文件
* 👉 `src/client-edge/src/app/api/save-iac-config/route.ts`

### 1.3 实现要求
在 `route.ts` 的 `POST` 处理函数开头，提取 `parameters` 中的 `vnetAddressPrefix`、`backendSubnetPrefix`、`storageSubnetPrefix` 和 `prefix`，实现以下逻辑：

1. **合法性正则校验**:
   * 前缀 `prefix` 必须满足 `/^[a-z0-9]{2,8}$/`。
   * 网段必须符合标准 CIDR 格式（例如：`^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$`）。
2. **网段数学解析与防撞逻辑**:
   * 用 JavaScript 实现 IP 解析函数（使用乘法避免 32 位有符号位移溢出）：
     ```typescript
     function parseCidr(cidr: string) {
       const parts = cidr.split('/');
       const mask = parseInt(parts[1], 10);
       const ipParts = parts[0].split('.').map(x => parseInt(x, 10));
       const start = ipParts[0] * 16777216 + ipParts[1] * 65536 + ipParts[2] * 256 + ipParts[3];
       const end = start + Math.pow(2, 32 - mask) - 1;
       return { start, end, mask };
     }
     ```
   * **校验项 A**：容器子网（`backendSubnetPrefix`）掩码字长必须 `<= 23`（即包含至少 512 个 IP），否则拒绝。
   * **校验项 B**：容器子网与存储子网必须完全包含在虚拟网络（`vnetAddressPrefix`）范围内：
     `(sub.start >= vnet.start) && (sub.end <= vnet.end)`
   * **校验项 C**：容器子网与存储子网绝对不能重合：
     `!((backend.start <= storage.end) && (storage.start <= backend.end))`
3. **拦截机制**:
   * 如果上述任何一项不满足，直接返回 `NextResponse.json`：
     ```json
     {
       "success": false,
       "error": "ValidationError",
       "message": "详细的错误原因描述"
     }
     ```
     并且**不写入**本地磁盘的 `.parameters.json`，保障物理文件安全。

---

## 🛠️ 任务 2：实现非破坏性干跑模式（Dry-Run）

### 2.1 需求说明
架构师可能只想在界面上“跑一次编译测试”，而不希望把当前测试的草稿参数覆盖写到主开发 parameters 文件中。我们需要支持 `dryRun` 标记。

### 2.2 实现逻辑
1. 客户端在发送 `POST` 请求时，如果带有参数 `dryRun: true`：
2. API 侧依然接收数据并执行 Bicep 组装器（`iac-assembler.py`）进行语法编译。
3. **关键区别**：如果编译成功，由于是 `dryRun`，**跳过** `fs.writeFileSync(paramFilePath, ...)` 的实体写盘动作，不修改本地的 `.parameters.json`。
4. 返回 `success: true` 与组装器日志，告知预检通过。

---

## 🛠️ 任务 3：编写本地预飞行部署校验器（`sh/preflight-validate.py`）

### 3.1 背景与需求
目前我们的 Python 脚本只跑了 `az bicep build`（语法测试）。我们希望新建一个自动化脚本，真正把合并后的参数包送往 Azure 校验（实现云端 API 预飞行测试）。

### 3.2 待创建文件
* 👉 `sh/preflight-validate.py`

### 3.3 实现细节
编写一个 Python 脚本，执行以下逻辑：
1. 读取 `.azure/main.parameters.json` 与 `.azure/main.bicep` 文件。
2. 校验文件是否存在。
3. 从 parameters 中提取主区域参数（`location`）。
4. 运行 Azure CLI 的远程预检命令：
   ```bash
   az deployment sub validate --location <location> --template-file .azure/main.bicep --parameters @.azure/main.parameters.json
   ```
5. **异常捕获与解析**：
   * 如果报错中包含 `SubscriptionNotRegistered`，提示租户未注册。
   * 如果报错中包含 `RoleAssignmentCreationFailed` / `AuthorizationFailed`，高亮提示：“当前登录账号在订阅级别缺乏分配 Managed Identity 权限，请在配置台中切换为【经典密钥（受限账号）】模式”。
   * 如果 `az` 未登录，捕获并提示：“未检测到活跃的 Azure 登录状态，请先执行 `az login`，或者本项云端预飞行已自动忽略”。
6. 赋予可执行权限：`chmod +x sh/preflight-validate.py`。
