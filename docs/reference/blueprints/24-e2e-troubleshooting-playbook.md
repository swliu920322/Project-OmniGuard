# 蓝图 24: 场景预设与功能包交叉测试手册 (Feature Pack Cross-Testing Playbook)

> **文档目的**: 指导架构师针对“极简沙箱 (Sandbox)”、“内网隔离 (Secure-IoT)”、“全球门户 (Global Portal)”三大场景预设，与四个核心“功能包 (Feature Packs)”进行深度交叉组合测试，定义其在 IaC 模板与参数文件中的期望输出和验证规程，为每个物理资源提供基于动态前缀的 Azure CLI 验收测试链。

---

## 1. 功能包与拓扑底座设计映射

配置台中提供的 4 个功能包（Feature Packs）分别控制 Bicep 模板中不同层级的资源部署与参数开关：

| 功能包标识 | UI 中文名称 | Bicep 参数映射 | 激活时触发的 IaC 变更 |
|:---|:---|:---|:---|
| **`packZeroTrust`** | 零信任托管身份包 | `deployManagedIdentities: true` | 创建 User-Assigned MI、Key Vault；容器挂载 MI 权限，环境变量采用 Key Vault Reference 密文引用。 |
| **`packGlobalWaf`** | 全球流量清洗与安全防护包 | `deployStaticWebApp: true` / `deployFrontDoorWaf: true` | 在计算层前置部署 Azure Static Web App (SWA) 或 Front Door Premium，并激活防火墙 (WAF) 拦截规则。 |
| **`packScaleToZero`** | 绿能自动休眠包 | `minReplicas: 0`<br>`maxReplicas: 2` | 修改 ACA 容器规格最小副本数为 0。关闭计算资源的“常驻模式”，触发闲时缩容自愈。 |
| **`packIoTDps`** | 物联网自动注册分发包 | `deployIotDps: true` | 动态部署 Azure Device Provisioning Service (DPS)，将其与 IoT Hub 绑定，建立硬件零接触注册通道。 |

---

## 2. 交叉测试用例与 IaC 期望验证

通过自由勾选/去勾选功能包，测试以下 4 个典型交叉场景，并在部署成功后使用终端命令进行深度验收：

```text
               【 交叉组合测试拓扑图 】
               
   ┌────────────────────────────────────────────────────────┐
   │ 预设 Preset: Sandbox / Secure-IoT / Global Portal       │
   └───────────────────────────┬────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     【 身份与安全面 】                    【 计算与网络面 】
   ┌──────────────────────┐              ┌──────────────────────┐
   │ ▢ packZeroTrust      │              │ ▢ packScaleToZero    │
   │ ▢ packGlobalWaf      │              │ ▢ packIoTDps         │
   └──────────────────────┘              └──────────────────────┘
```

---

## 3. 每一个测试案例的手把手物理验收指南 (E2E Verification Guide)

> 💡 **重要说明**：在以下终端验收命令中，我们使用了 `PREFIX` Shell 变量。默认前缀为 `omni`。如果您在网页配置台中修改了前缀，请在复制执行第一行命令时，将 `"omni"` 修改为您在 UI 中设置的实际前缀值。

### 🧪 案例 1: 极简沙箱 (Sandbox) ➔ 验证“降级回退与公网可用性”
> **测试参数**：`deployManagedIdentities: false`（禁用托管身份），`publicNetworkAccess: 'Enabled'`

#### 🔍 验证步骤与命令行：

```bash
# 0. 声明您在配置台使用的实际前缀（默认是 omni，如果修改了请在此处替换）
PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"
VNET_NAME="${PREFIX}-spoke-vnet"
BACKEND_APP="${PREFIX}-backend"
```

1. **虚拟网络 (VNet) 及子网划分校验**
   确认 VNet 和子网被正确拉起，且无重叠冲突：
   ```bash
   # 查询 VNet 下的所有子网网段及关联的 NSG 状态
   az network vnet subnet list \
     -g "$RG" \
     --vnet-name "$VNET_NAME" \
     --query "[].{Subnet:name, Prefix:addressPrefix, NSG:networkSecurityGroup.id}" \
     -o table
   ```
   *期望输出*：`BackendSubnet` 分配到 `10.1.4.0/23`，`StorageSubnet` 分配到 `10.1.2.0/24`。

2. **Cosmos DB 公网连接与密钥自愈校验**
   验证 Cosmos DB 可正常被公网解析并获取明文连接串：
   ```bash
   # 获取 Cosmos DB 的 Primary Connection String
   COSMOS_NAME=$(az cosmosdb list -g "$RG" --query "[0].name" -o tsv)
   az cosmosdb keys list \
     -g "$RG" \
     -n "$COSMOS_NAME" \
     --type connection-strings \
     --query "connectionStrings[0].connectionString" -o tsv
   ```
   *期望输出*：成功返回以 `AccountEndpoint=...;AccountKey=...` 开头的标准连接字符串。

3. **容器应用 (ACA) 运行日志与降级环境变量校验**
   验证后台容器成功以经典密钥模式启动，且未发生 CrashLoop：
   ```bash
   # 1. 检查容器当前的预配状态与环境变量
   az containerapp show \
     -g "$RG" \
     -n "$BACKEND_APP" \
     --query "{State:properties.provisioningState, MI:identity.type, Env:properties.template.containers[0].env}"
   ```
   *期望输出*：`State` 为 `Succeeded`，`MI` 为 `null`（无托管身份），环境变量 `USE_MANAGED_IDENTITY` 的值为 `"false"`。
   
   ```bash
   # 2. 查看容器应用启动实时日志，检查有无数据库连接握手报错
   az containerapp logs show \
     -g "$RG" \
     -n "$BACKEND_APP" \
     --follow
   ```
   *期望输出*：无数据库连通性握手超时和认证错误，显示后台 HTTP 监听器已就绪。

---

### 🧪 案例 2: 内网隔离 (Secure-IoT) ➔ 验证“身网双锁与私网自愈解析”
> **测试参数**：`deployManagedIdentities: true`（启用托管身份），Key Vault/Cosmos `publicNetworkAccess: 'Disabled'`

#### 🔍 验证步骤与命令行：

```bash
# 0. 声明前缀
PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"
BACKEND_APP="${PREFIX}-backend"
```

1. **托管身份 (User-Assigned MI) 创建验证**
   确认用户分配托管身份已被物理创建，并拥有正确 ObjectID：
   ```bash
   az identity list \
     -g "$RG" \
     --query "[].{Name:name, Principal:principalId}" -o table
   ```
   *期望输出*：成功列出 `${PREFIX}-backend-identity` 及其安全对象 ID (PrincipalID)。

2. **Key Vault 安全网络锁及 RBAC 只读权限校验**
   * **网络锁验证**：
     确认 Key Vault 阻断了公网流量：
     ```bash
     KV_NAME=$(az keyvault list -g "$RG" --query "[0].name" -o tsv)
     az keyvault secret list --vault-name "$KV_NAME"
     ```
     *期望输出*：如果您是在普通网络下执行此命令，必须返回 **`(PublicAccessDisabled)` Access denied** 报错。这证明公网已经被 100% 阻断，符合“网络锁”安全规范。
   * **RBAC 授权验证**：
     确认刚才的 MI 拥有 Key Vault Secrets User（`4633458b-17de-408a-b874-0445c86b69e6`）读取权限：
     ```bash
     az role assignment list \
       --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KV_NAME" \
       --query "[].{Role:roleDefinitionName, Assignee:principalName}" -o table
     ```
     *期望输出*：有一条记录显示 `Key Vault Secrets User` 成功分配给了服务主体 `${PREFIX}-backend-identity`。

3. **私有端点 (Private Endpoint) 与内网 DNS 自愈解析校验**
   确认私网端点网卡成功生成，并在私有 DNS 中自动注册了内网 A 记录：
   ```bash
   # 1. 检查 Key Vault 私网 DNS 解析记录
   az network private-dns record-set a list \
     -g "$RG" \
     -z privatelink.vaultcore.azure.net \
     --query "[].{Host:name, IP:aRecords[0].ipv4Address}" -o table
   ```
   *期望输出*：返回您的 Key Vault 主机名，其映射的 IP 地址必须位于 `StorageSubnet (10.x.2.x)` 内网网段中（例如 `10.1.2.5` 或 `10.2.2.5`）。
   
   ```bash
   # 2. 检查 Cosmos DB 私网 DNS 解析记录
   az network private-dns record-set a list \
     -g "$RG" \
     -z privatelink.documents.azure.net \
     --query "[].{Host:name, IP:aRecords[0].ipv4Address}" -o table
   ```
   *期望输出*：返回您的 Cosmos DB 域名，对应的 IP 解析地址同样位于 `10.x.2.x` 网段内。

4. **容器运行状态与 Key Vault 秘密挂载校验**
   ```bash
   # 检查容器内的环境变量与引用的 KV Secret 解析状态
   az containerapp show \
     -g "$RG" \
     -n "$BACKEND_APP" \
     --query "{State:properties.provisioningState, MI:identity.userAssignedIdentities, Env:properties.template.containers[0].env}"
   ```
   *期望输出*：`State` 为 `Succeeded`，并且绑定的 User-Assigned Identity 正确；环境变量 `OPENAI_API_KEY` 的值指向密文格式 `@Microsoft.KeyVault(...)`，且容器正常工作，未报密钥解析拒绝错误。

---

### 🧪 案例 3: 全球门户 (Global Portal) ➔ 验证“静态 Web 挂载与边缘流量穿透”
> **测试参数**：`deployStaticWebApp: true`

#### 🔍 验证步骤与命令行：

```bash
# 0. 声明前缀
PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"
FRONTEND_SWA="${PREFIX}-frontend-swa"
BACKEND_APP="${PREFIX}-backend"
```

1. **Azure Static Web App (SWA) 部署验证**
   ```bash
   az staticwebapp show \
     -g "$RG" \
     -n "$FRONTEND_SWA" \
     --query "{DefaultDomain:defaultHostname, State:status}" -o table
   ```
   *期望输出*：返回 SWA 全球加速域名（形如 `xxx.azurestaticapps.net`），且状态为 `Ready`。

2. **后端 ACA 安全策略验证 (仅接受来自边缘代理的请求)**
   ```bash
   # 查询 ACA 后端的 Ingress 配置，检查是否配置了内网/公网暴露
   az containerapp ingress show \
     -g "$RG" \
     -n "$BACKEND_APP" \
     --query "{Type:targetPort, Transport:transport}"
   ```
   *检查*：后端 ACA Ingress 应被设置为仅允许同虚拟网络内或指定域名代理透传。

---

### 🧪 案例 4: 内网隔离 + 物联网分发 (Secure-IoT + IoTDps)
> **测试参数**：`deployIotDps: true`

#### 🔍 验证步骤与命令行：

```bash
# 0. 声明前缀
PREFIX="omni"
RG="${PREFIX}-guard-infra-sea-rg"
DPS_NAME="${PREFIX}-dps"
```

1. **IoT Hub 与 DPS 部署完整性验证**
   确认 IoT Hub 与 DPS 资源成功在内网网段建立，且完成提权注册通道配置：
   ```bash
   # 查询资源组下 DPS 状态
   az iot dps show \
     -g "$RG" \
     -n "$DPS_NAME" \
     --query "{State:properties.deviceProvisioningStatus, GlobalEndpoint:properties.globalDeviceEndpoint}"
   ```
   *期望输出*：返回 `Assigned`，且全局注册端点就绪。

2. **验证 DPS 与 IoT Hub 链路绑定**
   DPS 创建后，必须向其关联 IoT Hub 作为分发目的地：
   ```bash
   az iot dps linked-hub list \
     -g "$RG" \
     --dps-name "$DPS_NAME" \
     --query "[].{Hub:connectionString, State:applyAllocationPolicy}" -o table
   ```
   *期望输出*：成功显示已关联的 `${PREFIX}-hub` 域名，策略状态正常。

---

## 5. ACA 绿能休眠与内网隔离专项排障调试技巧 (Special Debugging Tips)

在对 Container Apps 进行连通性验收时，开发者常遇到以下两个网络与副本状态问题，其排查与自愈规程如下：

### 5.1 抓取日志时提示 `Could not find a replica for this app`
* **触发机制**：由于极简沙箱或配置中启用了“绿能自动休眠 (Scale-to-Zero)”（`minReplicas: 0`），当容器在一段时间内没有接收到网络流量时，Azure 会自动将其所有运行实例释放归零以省钱。因此在获取日志时，后台因没有运行中的副本而提示找不到实例。
* **自愈排障规程**：
  * **方案 A：通过前端连锁唤醒**：
    由于后端是内网隔离的，您可以先查询公网前端域名，然后向其发起请求，由前端通过内网 VNet 地址向后端中转，实现链路级冷启动唤醒：
    ```bash
    # 获取前端公网域名
    FE_FQDN=$(az containerapp show -g "$RG" -n "${PREFIX}-frontend" --query "properties.configuration.ingress.fqdn" -o tsv)
    # 发送心跳包唤醒链路
    curl -i "https://$FE_FQDN"
    ```
  * **方案 B：临时强制常驻（推荐调试法）**：
    若想彻底规避休眠，可以直接在命令行将容器的最小常驻副本数调整为 1：
    ```bash
    # 强制将最小副本数更新为 1
    az containerapp update -g "$RG" -n "$BACKEND_APP" --min-replicas 1
    # 此时副本常驻，直接抓取运行日志
    az containerapp logs show -g "$RG" -n "$BACKEND_APP" --follow
    # 验收完成后，记得重置回自动休眠（设为 0）以省钱
    az containerapp update -g "$RG" -n "$BACKEND_APP" --min-replicas 0
    ```

### 5.2 访问公网前端时提示 `Error 404 - Stopped or does not exist`
* **触发机制**：
  1. **前后端内网隔离区别**：后端应用为了 API 安全，必须被闭锁为内网应用（`external: false`），公网直接 curl 后端域名一定会秒回 404。前端作为入口则必须设为外网应用（`external: true`）。
  2. **Ingress 端口同步延迟**：当您使用 `az containerapp ingress enable ...` 修改了 Ingress 属性（如修改 `targetPort` 端口或切换内外网类型）后，Azure 边缘网关需要 **1 - 2 分钟** 才能将路由规则全球同步。在同步期内尝试 curl 该地址，会因为网关还未指向新配置而暂时弹出 404 错误。
* **自愈排障规程**：
  * 确保前端 Ingress 被正确声明为公网：`--type external`。
  * 检查 `targetPort` 端口是否与容器内服务监听端口（占位测试镜像默认为 `80`，实际 Next.js 生产镜像默认为 `3000`）完全匹配。
  * 修改 Ingress 属性后，**在本地静置 2 分钟以上**，等待 Azure 路由完全解析完毕，再发起 curl 验证。

### 5.3 Key Vault 身份与网络（双锁）物理隔离测试方法
* **触发机制**：
  在 Secure-IoT 场景下，Key Vault 设置了 `publicNetworkAccess: 'Disabled'` 且启用了 RBAC 授权。当未授权的外部用户访问时，默认会触发 **`ForbiddenByRbac`** 拦截。为了单独测试公网网络防火墙的拦截，需要给当前访问者临时指派读取权限。
* **物理验证与清理规程**：
  ```bash
  # 1. 尝试默认态公网访问（触发未授权拦截）
  KV_NAME=$(az keyvault list -g "$RG" --query "[0].name" -o tsv)
  az keyvault secret list --vault-name "$KV_NAME"
  # => 期望返回 (ForbiddenByRbac) 报错
  
  # 2. 获取当前 Azure CLI 登录用户 ID 并临时授予 Secrets Reader 角色
  MY_USER_ID=$(az ad signed-in-user show --query id -o tsv)
  az role assignment create \
    --assignee "$MY_USER_ID" \
    --role "Key Vault Secrets Reader" \
    --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KV_NAME"
    
  # 3. 等待 20 秒同步后，再次尝试公网访问（触发防火墙拦截）
  az keyvault secret list --vault-name "$KV_NAME"
  # => 期望返回 (PublicAccessDisabled) 报错，证明公网防火墙网络拦截 100% 生效
  
  # 4. 回收临时只读角色，恢复双锁状态
  az role assignment delete \
    --assignee "$MY_USER_ID" \
    --role "Key Vault Secrets Reader" \
    --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KV_NAME"
  ```

