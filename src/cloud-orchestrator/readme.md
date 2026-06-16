
## 💡 模式对账：传统全栈与当代“边缘同源聚合架构”的断裂级区别

在向新加坡高级云架构师演进的面试沙盘中，你必须能够用三张拓扑网格，一枪击穿传统老旧架构的内耗本质。

### 1. 三代全栈模式演进对比

| 维度 | 模式 A：传统单体/虚拟机模式 | 模式 B：标准前后端分离 (跨域网格) | 模式 C：边缘同源聚合架构 (本项目) |
| --- | --- | --- | --- |
| **拓扑实体** | 用 1 台 Nginx 强行反代挂载本地的 Node/Python 进程。 | 前端托管在 AWS S3/OSS，后端拉起 K8s/ECS 容器集群。 | **前端托管于全球 CDN 边缘，后端托管于 Serverless 算力单元。** |
| **跨域治理 (CORS)** | 本地环回，无需配置。 | **高内耗。** 必须在后端硬编码 `Access-Control-Allow-Origin`，或在 API 网关层死磕跨域头。 | **0-CORS 零跨域。** SWA 在亚太边缘网关层物理劫持 `/api` 相对路径，双端在浏览器侧绝对同源。 |
| **FinOps 闲置成本** | **极高。** 即使半夜 0 流量，虚拟机 CPU 依然在空转计费。 | **较高。** 容器集群必须保留最低限度的 Pod 实例常驻内存。 | **极低。** 边缘静态完全免费，计算层在无人访问时无流量费，资产几乎 0 闲置财务占用。 |
| **运维边界** | 必须人肉维护 Linux 补丁、SSL 证书续签与 Nginx 规则。 | 必须编写复杂的 Dockerfile、K8s Deployment 和网关路由表。 | **0 运维 (NoOps)。** 证书、扩容、路由和安全防护全量托管给云厂商控制面。 |

### 2. 我们的核心优点在哪里？

* **控制面与数据面绝对解耦**：代码库（Codebase）内实现了 0 密钥。配置与凭证全部依赖运行时单向倒灌（Runtime Injection），随时可以在 Dev / Prod 环境之间无缝漂移。
* **亚太网络极速触达**：利用 **香港边缘节点（SWA）** 物理拦截前端静态请求，并通过微软专属的高速内网骨干网（Backbone）穿透到 **日本东区（Function）** 进行大模型算力解算，物理延迟缩减到极限。

---

## 🛰️ 双流图谱：业务流与请求流的微秒级跟踪

### 1. 业务开发流 (Development & CI/CD Flow)

这是你作为研发主宰，代码从本地打入云端的全生命周期：

1. **源码演进**：你在 Mac 上开发前端页面与 Python 代理核心，本地配置完全隔离在 `local.settings.json`（已进 `.gitignore` 铁网）。
2. **GitOps 触发**：执行 `git push`，GitHub Actions 管道瞬间被唤醒。
3. **分道通车**：Oryx 探测引擎将 `src/client-edge` 剥离并推向 SWA 香港存储栈；同时将 `src/cloud-orchestrator` 的 Python 依赖树（Requirements）打包并同步挂载到日本东区的计算容器中。
4. **运行时倒灌**：由于学校订阅（Tenant）的角色裁剪限制，你通过本地 Azure CLI 下发行政命令，将大模型的非敏感 Endpoints 寻址和明文 Key **在系统运行时单向强制塞入云端主机的内存字典中**。

### 2. 用户请求流 (Runtime Request Hopping)

这是当一个真实用户在浏览器输入网址，并敲下发送后的微秒级数据链路跟踪：

1. **静态分发**：用户直撞 `https://*.azurestaticapps.net`，香港 CDN 边缘节点秒级闪击返回脱水后的前端 `index.html` 与 WebGPU 资产。
2. **动态劫持**：用户在聊天框敲字发送。前端发起 POST 请求，目的地指向相对路径 `/api/chat/stream?t=***`。
3. **内网穿透**：SWA 亚太网关识别到 `/api` 路由，控制面瞬间横向劫持流量，不经过公网，直接通过微软高速内网骨干网将词包递交给日本东区的 Function 监听端口。
4. **算力冲锋**：Function 在内存中提取出倒灌的 `AZURE_OPENAI_API_KEY`，跨资源组向同机房的 `gpt-4o` 算力矩阵发起撞击，大模型将解算出的 Token 洪流顺着原路高信噪比地打回前端，点亮 3D 数字人。

---

## 🛠️ 工业级交付：Project-OmniGuard 全栈启动与运维手册

本手册用于规范从零冷启动到生产环境预览的全量确定性步骤。

### 📦 Step 1: 本地环境初始化与鉴权

在本地 Mac 终端中，强行切入目标学术租户控制面，锁定主权：

```bash
# 1. 强制登录指定教育域
az login --tenant "sd.taylors.edu.my"

# 2. 检查当前激活的订阅，确保 a1722efd 凭证就位
az account show --query "{SubscriptionName:name, SubscriptionID:id}" -o table

```

### 🧱 Step 2: 一键拉起亚太网络与计算平面的拓扑树

下发声明式基础设施（IaC）重组指令：

```bash
# 执行幂等性生命周期脚本，在云端克隆出纯净的资源组网格
./infra-up.sh

```

* **运维审计断言**：死等终端弹出 `Nested-Network-Enforcements | Succeeded` 令牌。此时，香港 SWA 网站、日本 Function App 宿主机以及私网三叉戟 DNS 矩阵全部在物理机架上就位。

### 🌐 Step 3: 配置 GitHub GitOps 管道钥匙

1. 登录 Azure Portal，进入新创资源组 `omni-guard-infra-rg`。
2. 点击进入静态网站 `omni-digitalhuman-portal`，在 Overview 右上角点击 **"Manage deployment token"**，完整复制该令牌。
3. 转身进入你的 GitHub 仓库（`Project-OmniGuard`）$\rightarrow$ **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**。
4. 新建 Repository Secret：
* **Name**: `AZURE_STATIC_WEB_APPS_API_TOKEN_OMNI_DIGITALHUMAN_PORTAL`
* **Value**: 贴入你刚才复制的 Deployment Token。


5. 在本地执行一发空提交，强行炸开云端编译引擎：
```bash
git commit --allow-empty -m "ci(gitops): re-route code delivery to brand new cloud nodes"
git push origin main

```


* *对账点*：死死盯住 GitHub Actions，直至 `Azure Static Web Apps CI/CD` 转为纯净的绿色 Success。



### 🔒 Step 4: 运行时行政级配置倒灌（激活真实算力）

当代码完全落盘云端后，我们将实弹参数在运行时直接砸入容器内存，彻底解决学校租户无权限角色指派（`RoleDefinitionDoesNotExist`）的环境真空：

```bash
# 1. 向日本东区的计算平面单向灌入绝密配置字典
az functionapp config appsettings set \
  --name "omni-brain-javzwzvip3pce" \
  --resource-group "omni-guard-infra-rg" \
  --settings \
    LOCAL_MOCK_MODE="false" \
    AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o" \
    AZURE_OPENAI_ENDPOINT="https://0387621-2410-resource.openai.azure.com/" \
    AZURE_OPENAI_API_KEY="9t3ITR5Tzns5Zk9XFui7rRdeTMzfaf1gqSfReaZyyFe18Zl6uN5gJQQJ99CCACi0881XJ3w3AAAAACOGLQ7e" \
  --output none

# 2. 强制下发硬重启，逼迫容器重启并挂载新字典
az functionapp restart --name "omni-brain-javzwzvip3pce" --resource-group "omni-guard-infra-rg"

```

### 🎯 Step 5: 实弹线上对账预览

1. 回到 Azure Portal 静态网站主页，抓取微软分发给你的绝对纯净公网域名（`https://witty-water-00bcff200.7.azurestaticapps.net/`）。
2. 在浏览器中斩断缓存刷新，直接敲字发送，大模型 Token 洪流跨海会师成功！

---

## 🧮 FinOps 弹性成本精算公式

在高级云架构师的思维模型中，不能脱离财务账本来谈论完美拓扑。由于本项目的计算大脑采用了 **Basic B1 专属 Linux 计划**（用以承载较为密集的 WebGPU 前置解算与流式代理支撑），我们的月度全栈持有成本模型由“固定底座”**与**“动态算力消耗”二维有向合拢而成。

系统的月度总运营成本公式 $Cost_{total}$ 精算如下：

$$Cost_{total} = Cost_{SWA} + Cost_{ASP} + Cost_{Storage} + Cost_{OpenAI}$$

其中，各分项物理因果指标硬编码如下：

* **$Cost_{SWA}$（边缘网关成本）**：
由于我们使用了 Standard 级别的静态网站来挂载 Linked Backend 路由，其计费标准为固定底座：

$$Cost_{SWA} = \$17.50 / \text{month} \times N_{apps}$$


* **$Cost_{ASP}$（计算大脑专属物理机架月租）**：
由于我们在 `serverlessPlan` 中锁死了 B1 Tier（Basic 专属 Linux 机型），这块资源不计调用次数，实行刚性包月：

$$Cost_{ASP} = \$12.41 / \text{month} \times N_{plans}$$


* **$Cost_{Storage}$（存储三叉戟私网数据面占用）**：
由 Standard_LRS 存储块的总存储量与私网终结点（Private Endpoints）的每小时常驻费用合拢：

$$Cost_{Storage} = (GB_{data} \times \$0.015) + (3 \times \$0.01 \times 24 \times 30)$$


* **$Cost_{OpenAI}$（数据面算力消耗）**：
完全由你对话的实际 Token 吞吐量决定，实行纯粹的按量计费（Consumption Model）：

$$Cost_{OpenAI} = (Tokens_{in} \times \$0.005 / 1K) + (Tokens_{out} \times \$0.015 / 1K)$$



### 💰 终极架构 FinOps 账本断言

当你的数字化系统在半夜或没有任何面试演示任务的**绝对闲置状态下**，$Tokens$ 归零，$GB_{data}$ 趋近于零，整套项目在云端的**全量常驻呼吸成本刚性死锁在 $\approx \$36.31$ 美金/月**。

而一旦你需要进行环境物理拆除，一发 `./infra-destroy.sh` 指令横向轰入，云端物理机架瞬间全量解散湮灭，**后续每小时的持有成本归零，达成绝对的 FinOps 弹性自适应控制！** 全栈大通车，账本全部对齐落袋！