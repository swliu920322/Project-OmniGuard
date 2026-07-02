# 蓝图 24: 场景预设与功能包交叉测试手册 (Feature Pack Cross-Testing Playbook)

> **文档目的**: 指导架构师针对“极简沙箱 (Sandbox)”、“内网隔离 (Secure-IoT)”、“全球门户 (Global Portal)”三大场景预设，与四个核心“功能包 (Feature Packs)”进行深度交叉组合测试，定义其在 IaC 模板与参数文件中的期望输出和校验点。

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

## 2. 三大基础场景（Presets）功能基线

在执行交叉测试前，先确保三大基线预设行为正确：

### 01. 极简沙箱 (Sandbox) ➔ 极简按量计费轨
* **基线状态**：
  * 计算：ACA 副本可休眠（`minReplicas: 0`）。
  * 网络：VNet 开放公网路由，Storage/Cosmos DB 开启公网访问 (`publicNetworkAccess: 'Enabled'`)。
  * 身份：禁用托管身份，回退到经典 Connection String 通信。

### 02. 内网隔离 (Secure-IoT) ➔ 身网双锁轨
* **基线状态**：
  * 网络：VNet 禁用 Storage/Cosmos DB/Key Vault 公网访问，强制使用 Private Endpoint，在 StorageSubnet 分配内网 IP，绑定 Private DNS 区域自愈解析。
  * 身份：默认启用托管身份与 RBAC 授权。

### 03. 全球门户 (Global Portal) ➔ 全球边缘加速防护轨
* **基线状态**：
  * 计算：前端切换为全球分布式 Static Web App (SWA) 并挂载边缘防火墙。
  * 身份：默认启用托管身份。
  * 网络：开启 Front Door Premium 边缘专线，限制后端 ACA 仅接受来自 Front Door 的加密流量（通过注入 Header 校验）。

---

## 3. 交叉场景测试用例与 IaC 期望验证

通过自由勾选/去勾选功能包，测试以下 4 个典型交叉场景，验证产物参数的自愈性：

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

### 🧪 交叉用例 1: Sandbox (极简沙箱) + 升级 ZeroTrust (零信任托管身份)
> **测试目的**：验证极简开发环境下，如果不做复杂的内网隔离（无 PE），是否也能独立使用托管身份进行安全改造。

* **配置操作**：
  1. 选择 `Sandbox` 预设。
  2. 勾选 **【零信任托管身份包】**（手动开启 `packZeroTrust`）。
  3. 保存参数。
* **IaC 产物校验点** (`.azure/main.parameters.json`)：
  * `deployManagedIdentities` 必须被改写为 `true`。
  * `openAiKey` 必须被存入 Key Vault，且生成了角色指派 `roleAssignments`。
  * **网络边界验证**：`.azure/nested-infra.bicep` 中，Key Vault 与 Storage 的 `publicNetworkAccess` 必须保持为 `'Enabled'`。这证明托管身份可以与公网资源共存，未被内网 PE 强制锁死。

---

### 🧪 交叉用例 2: Secure-IoT (内网隔离) + 禁用 ZeroTrust (降级为经典密钥)
> **测试目的**：验证在高度隔离的网络中，针对没有订阅 Owner 权限的受限账户，如何降级为对称密钥安全连接。

* **配置操作**：
  1. 选择 `Secure-IoT` 预设。
  2. 去勾选 **【零信任托管身份包】**（强制将 `deployManagedIdentities` 设为 `false`）。
  3. 保存参数。
* **IaC 产物校验点**：
  * `deployManagedIdentities` 必须为 `false`。
  * **安全边界验证**：`.azure/main.bicep` 和 `nested-infra.bicep` 中没有创建任何 `Microsoft.Authorization/roleAssignments`。
  * **连接边界验证**：容器 `backend` 的环境变量中，`COSMOS_KEY` 依然是明文提取 `listKeys(cosmosAccount.id).primaryMasterKey`。虽然使用密钥连接，但网络上依然被限制在 Private Endpoint 内，流量未出 VNet。

---

### 🧪 交叉用例 3: Global Portal (全球门户) + 绿能 ScaleToZero (自动休眠)
> **测试目的**：针对面向公网的业务门户，在开发测试阶段开启闲时休眠，测试前端边缘加速与后端冷启动休眠的共存。

* **配置操作**：
  1. 选择 `Global Portal` 预设。
  2. 勾选 **【绿能自动休眠包】**（开启 `packScaleToZero`）。
  3. 保存参数。
* **IaC 产物校验点**：
  * `deployStaticWebApp` 必须为 `true`（前端部署 SWA）。
  * 检查 `.azure/compute-module.bicep`，`backendApp` 容器的 `scale` 配置项：
    * `minReplicas` 必须为 `0`。
    * `maxReplicas` 必须为 `2`。
  * **验证**：当前端通过 SWA 访问后端 API 时，如果无流量，后端 ACA 会缩容至 0 节省费用；当新请求从边缘到达时，自动冷启动拉起。

---

### 🧪 交叉用例 4: Secure-IoT (内网隔离) + 激活 IoTDps (物联网自动分发包)
> **测试目的**：测试在内网闭环中加入大规模硬件零接触分发模块（DPS）。

* **配置操作**：
  1. 选择 `Secure-IoT` 预设。
  2. 勾选 **【物联网自动注册分发包】**（开启 `packIoTDps`）。
  3. 保存参数。
* **IaC 产物校验点**：
  * 检查参数 JSON，`deployIotDps` 必须为 `true`。
  * 检查 `.azure/nested-infra.bicep`，必须成功声明了 `Microsoft.Devices/provisioningServices` (DPS) 资源：
    ```bicep
    resource iotDps 'Microsoft.Devices/provisioningServices@2022-12-15' = if (deployIotDps) {
      name: '${prefix}-dps'
      location: location
      ...
    }
    ```
  * 验证 DPS 与 IoT Hub 的关联授权指派资源是否被条件编译拉起。

---

## 4. 交叉测试快速排障与断言验证清单

在您运行 `sh/shadow-e2e-test.py` 或 `make provision` 时，如果混合配置了不同的功能包，请使用以下清单进行一致性诊断：

1. **托管身份包 (`packZeroTrust`) 与 部署账号权限**：
   * *冲突表现*：勾选了 `packZeroTrust`，但部署账号没有 Owner 权限，云端预检报错：`RoleAssignmentCreationFailed`。
   * *恢复策略*：去勾选 `packZeroTrust`，再次执行 `make provision` 即可自愈通过。
2. **全球WAF包 (`packGlobalWaf`) 与 静态网页部署**：
   * *冲突表现*：如果启用了 WAF 但后端 ACA 域名发生变动，导致 Front Door 的 Backend Pool 路由指向了旧域名。
   * *恢复策略*：检查部署输出的 `REAL_FE_URL`，确认 Front Door 的自定义探测头（Host Header Override）已经刷新指向新的 ACA 内网 FQDN。
