# 蓝图 24: 多场景交叉验证与云端排障手册 (E2E Testing & Troubleshooting Playbook)

> **文档目的**: 指导架构师在全新云端订阅中，跑通“Sandbox 沙箱”与“Secure-IoT 零信任”两大场景的交叉验证，故意制造并捕捉各种边界报错，实现对系统网络与身份防线的全覆盖测试。

---

## 1. 测试场景矩阵与设计对照

在测试前，先明确两套标准场景和三个交叉报错场景的参数对照：

| 测试场景编号 | 场景定位 | 托管身份开关 | 虚拟网段设置 | 预期结果与验证重点 |
|:---|:---|:---|:---|:---|
| **场景 01** | Sandbox 极速测试 | 禁用 (`false`) | VNet: `10.1.0.0/16`<br>ACA: `10.1.4.0/23`<br>Storage: `10.1.2.0/24` | **秒级部署成功**。回退到经典密钥通信，Key Vault 开启公网访问，不创建任何 RBAC 角色指派。 |
| **场景 02** | Secure-IoT 零信任 | 启用 (`true`) | VNet: `10.2.0.0/16`<br>ACA: `10.2.4.0/23`<br>Storage: `10.2.2.0/24` | **零信任部署成功**。托管身份建立，Key Vault 禁用公网，通过 Private Endpoint 与私网 DNS 解析（`10.2.2.x`）实现内网安全读取。 |
| **交叉 A (网段重合)**| 边界碰撞测试 | 任意 | VNet: `10.1.0.0/16`<br>ACA: `10.1.4.0/24`<br>Storage: `10.1.4.128/24` | **配置台保存拦截**。服务端校验抛出 `422` 错误，阻止写入 `.azure/`。 |
| **交叉 B (越界划分)**| 边界越界测试 | 任意 | VNet: `10.1.0.0/16`<br>ACA: `10.1.4.0/23`<br>Storage: `192.168.1.0/24` | **配置台保存拦截**。服务端校验提示 Storage 子网未被包含在 VNet 范围内。 |
| **交叉 C (越权测试)**| 权限不足回退 | 启用 (`true`) | 任意合法网段 | **云端预检或影子测试挂掉**。若部署账号不是订阅 Owner，抛出 `RoleAssignmentCreationFailed`，验证系统是否能优雅降级回退。 |

---

## 2. 场景 01：Sandbox 极速开发轨（手动部署与验收）

### 2.1 网页端配置要点
1. 选择场景预设为 `Sandbox`。
2. 基础标识标签页中将 `prefix` 设为 `omnisand`。
3. 网络拓扑标签页中保持默认网段。
4. 安全与托管标签页中**关闭【托管身份】**。
5. 点击 **【一键生成拓扑并验证 .azure/】** 保存。

### 2.2 部署命令
在本地终端执行部署命令：
```bash
az deployment sub create --location southeastasia --template-file .azure/main.bicep --parameters @.azure/main.parameters.json
```

### 2.3 物理验收指标 (验明“降级回退”有效性)
* **检查 1：容器环境变量**
  打开 Azure Portal，查看容器应用 `omnisand-backend` 的环境变量：
  * `USE_MANAGED_IDENTITY` 应为 `"false"`。
  * `COSMOS_KEY` 与 `AzureWebJobsStorage` 应直接以明文连接串和密钥注入，无 Key Vault Reference 引用。
* **检查 2：角色指派裁剪**
  在资源组 `omnisand-guard-infra-sea-rg` 的 Access Control (IAM) ➔ Role Assignments 中，**不应存在任何**指向 `${prefix}-backend-identity` 的角色记录。

---

## 3. 场景 02：Secure-IoT 零信任生产轨（影子 E2E 与物理验收）

### 3.1 网页端配置要点
1. 选择场景预设为 `Secure-IoT`。
2. 基础标识标签页中将 `prefix` 设为 `omnisec`。
3. 填入有效的 `openAiKey` 密文。
4. 安全与托管标签页中**勾选启用【托管身份】**。
5. 点击 **【一键生成拓扑并验证 .azure/】** 保存。

### 3.2 影子安全测试验证 (Shadow E2E)
在终端运行我们的影子集成测试，不影响现有部署：
```bash
python3 sh/shadow-e2e-test.py
```
* **审计重点**：脚本会自动断言 Cosmos DB 与 Key Vault 私网 DNS 的 A 记录是否成功注册为 `10.1.2.x`（影子默认网段）。测试结束后，脚本应异步清退销毁资源组 `omnitest-guard-infra-sea-rg`。

### 3.3 物理部署与验收 (验明“身网双锁”完备性)
如果手动部署：
```bash
az deployment sub create --location southeastasia --template-file .azure/main.bicep --parameters @.azure/main.parameters.json
```
* **验收 1：Key Vault 网络隔离**
  * 在 Portal 中打开 Key Vault `omnisec-kv-...` ➔ Networking，其 Public Access 必须为 **Disabled**。
  * 在您本地浏览器中尝试访问该 Vault 的 Secret，应被弹回 **403 Forbidden**，证明公网拦截成功。
* **验收 2：Key Vault Reference 零泄露**
  * 检查容器应用 `omnisec-backend` 环境变量，`OPENAI_API_KEY` 的值必须是以 `@Microsoft.KeyVault(SecretUri=...)` 表示的引用格式，无法从容器定义中查看到密钥本体。
* **验收 3：私有 DNS 解析自愈**
  * 登录资源组中的 Spoke 虚拟网络，检查 Private DNS Zones：
    * `privatelink.vaultcore.azure.net`
    * `privatelink.documents.azure.net`
  * 它们必须均包含一个指向 `10.2.2.x`（即您在页面上配置的 StorageSubnet）的 A 记录，且 VNet Link 已成功关联您的 Spoke VNet。

---

## 4. 交叉测试：故意制造报错与安全拦截

通过故意配置错误的参数，验证配置台和服务端校验的稳健性：

### 4.1 制造网段碰撞冲突 (交叉 A)
1. 在网络拓扑页面，将 ACA 子网设为 `10.1.4.0/24`，将 Storage 子网设为 `10.1.4.128/24`（二者在 `/24` 网段内产生物理重叠）。
2. 点击保存。
3. **预期拦截结果**：页面会弹出红色报错，API 拒绝写入文件并返回 `422 Unprocessable Entity`。控制台终端显示：
   `[!] 网络分配重叠：容器子网 (10.1.4.0/24) 与存储子网 (10.1.4.128/24) 的 IP 地址段存在重合冲突！`

### 4.2 制造子网越界冲突 (交叉 B)
1. 将 VNet CIDR 设为 `10.1.0.0/16`。
2. 将 Storage 子网设为 `192.168.1.0/24`（超出了 VNet 网段）。
3. 点击保存。
4. **预期拦截结果**：保存被阻断，API 拦截并报错提示：
   `[!] 存储子网 (192.168.1.0/24) 必须完全包含在 VNet (10.1.0.0/16) 的地址空间范围内。`

---

## 5. 云端真实部署常见报错排障手册 (Troubleshooting Playbook)

### 🚨 报错 1: `RoleAssignmentCreationFailed` (授权失败)
* **典型错误日志**：
  ```text
  The client 'xxx' with object id 'xxx' does not have authorization to perform action 'Microsoft.Authorization/roleAssignments/write' over scope '/subscriptions/xxx/resourceGroups/xxx'.
  ```
* **触发根源**：您的部署账号（或 GitHub Actions 服务主体）在订阅级别仅有 `Contributor` 权限，不具备 `User Access Administrator` 或 `Owner` 权限，无法在 Bicep 中建立托管身份对 Key Vault/Cosmos DB 的 RBAC 角色指派。
* **自愈方案**：
  * *方案一 (安全降级)*：在配置台中**关闭【托管身份】**重新保存。Bicep 会完全裁剪掉 `roleAssignments` 资源，再次部署即可 100% 成功。
  * *方案二 (企业授权)*：联系您的 Azure 管理员，为您的服务主体或账号指派 `User Access Administrator` 角色。

### 🚨 报错 2: Key Vault Reference 状态为 `AccessToKeyVaultDenied`
* **典型错误日志**：
  在 Container App 的 Revision 中，容器无法拉起，查看 System Logs 提示：
  ```text
  Failed to resolve Key Vault Reference: Access to Key Vault denied. System identity does not have secrets/read permissions.
  ```
* **触发根源**：
  1. 您在 Bicep 中**误用**了 System-Assigned Identity，但角色指派生效前容器已经拉起；
  2. 或者 User-Assigned Identity 的 RBAC 授权还没有在 Entra ID 中全球同步完毕（通常需要 1-3 分钟延迟）。
* **自愈方案**：
  * 我们模板已经强制改用 **User-Assigned Identity**，可大幅缓解此问题。若遇到网络延时，请在 Portal 中手动 Restart 容器应用以重新拉取密钥引用。
  * 检查 Key Vault ➔ Access Control (IAM)，确认 `Key Vault Secrets User` 确实指派给了您的 `omnisec-backend-identity`。

### 🚨 报错 3: `InvalidSubnetMask` (子网掩码太长)
* **典型错误日志**：
  ```text
  Subnet 'BackendSubnet' requires a minimum size of /23 for Container App Environment integration.
  ```
* **触发根源**：ACA 容器环境的内网网段规定掩码长度必须小于等于 `/23`（即至少需要 512 个 IP 地址供副本漂移和扩缩容），如果配成 `/24` 或 `/25` 会在 ARM 级别报错。
* **自愈方案**：配置台已经对 ACA 子网掩码做了硬性前端 + 后端双重拦截（限制掩码 $\le 23$），请不要通过手动篡改 parameters.json 绕过此安全校验。

---

## 6. 命令行调试排障技巧

当网络解析出现异常，可利用以下 Azure CLI 命令在内网进行跟踪：

### 6.1 查询私有网卡分配的真实内网 IP
```bash
az network nic list -g <您的资源组> --query "[].ipConfigurations[].privateIpAddress"
```
*检查：是否所有的 Private Endpoint IP 都落在了您规划的 `StorageSubnet (10.x.2.x)` 内。*

### 6.2 在 VNet Link 关联的私网 DNS 区域中查询解析
```bash
az network private-dns record-set a list -g <您的资源组> -z privatelink.vaultcore.azure.net --query "[].{Name:name, IPs:aRecords[].ipv4Address}"
```
*检查：对应的 Key Vault FQDN 是否已正确映射到了上述查出的私网 IP。*
