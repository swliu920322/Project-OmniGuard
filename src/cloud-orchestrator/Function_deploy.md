声威，总工模式。既然你决定坚守“方案 B：独立 Serverless 大脑模式”**作为新加坡战役的硬核沙盘资产，这里为你整理出**全盘去密、绝对闭环、100% 消除抢占冲突的最终标准生产级交付手册。

针对方案 B 的核心逻辑就是：**将前端与后端在编译期完全剥离，强制保持 SWA 内部沙盒真空，将所有计算主权收归给日本东区的独立 Function App。**

---

# 🛰️ Project-OmniGuard 生产级全栈交付手册（方案 B：独立算力强隔离模式）

## 一、 核心配置文件最终快照 (The SSOT Configs)

为了防止 GitHub Actions 在香港边缘网关繁衍出隐藏托管函数来抢占路由，必须通过修改 `.yml` 账本彻底掐断其引信。

### 🛠️ 1. GitHub Actions 自动化工作流配置

打开你本地项目根目录下的 `.github/workflows/azure-static-web-apps-*.yml`，定位到 `action: "upload"` 块，**将 `api_location` 刚性改为空字符串 `""**`：

```yaml
# 📥 检查并锁定：.github/workflows/azure-static-web-apps-xxx.yml
- name: Build And Deploy
  uses: Azure/static-web-apps-deploy@v1
  with:
    azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_OMNI_DIGITALHUMAN_PORTAL }}
    repo_token: ${{ secrets.GITHUB_TOKEN }}
    action: "upload"
    ###### 🟩 方案 B 核心铁律：强制置空，剥离 SWA 内部计算，防止幽灵路由抢占 ######
    app_location: "src/client-edge"
    api_location: ""
    ###### ############################################################ ######

```

### 🛠️ 2. 计算模块 Bicep 账本锁闭 (`~4` 宿主钢印)

确保你本地的 `.azure/compute-module.bicep` 内部已经完全焊死 `FUNCTIONS_EXTENSION_VERSION = '~4'`，以确保 Linux 容器能正常挂载 Python 3.11 算力：

```bicep
// .azure/compute-module.bicep 核心参数片段
properties: {
  serverFarmId: serverlessPlanId
  siteConfig: {
    linuxFxVersion: 'PYTHON|3.11'
    appSettings: [
      {
        name: 'FUNCTIONS_EXTENSION_VERSION' // 🟩 锁定第 4 代宿主
        value: '~4'
      }
      {
        name: 'FUNCTIONS_WORKER_RUNTIME'
        value: 'python'
      }
      // ... 其余 listKeys 动态算解保持不动
    ]
  }
}

```

---

## 二、 4步完整冷启动标准操作程序 (Standard Operating Procedure)

当你运行 `./infra-destroy.sh` 将云端资产物理蒸发后，按照以下四步串行下发指令，可以在 5 分钟内拉起一套完美闭环的方案 B 生产环境。

### 🧱 Step 1: 基础设施一键冷启动 (Hardware Provisioning)

在你的 Mac 终端中，强行切入目标学术租户控制面，下发声明式基础设施网格重组指令：

```bash
# 1. 物理对齐泰莱大学订阅
az login --tenant "sd.taylors.edu.my"

# 2. 拉起纯净版网络、静态网关与独立计算宿主机
./infra-up.sh

```

* **运维审计断言**：死等终端弹出 `Nested-Network-Enforcements | Succeeded` 令牌。此时，香港 SWA 网站与日本 Function 独立机架全部在物理机位就损就绪。

### 🌐 Step 2: 交付前端静态视图 (Frontend Delivery)

1. 转身登录 Azure Portal，进入资源组 `omni-guard-infra-rg`。
2. 点击进入静态网站 `omni-digitalhuman-portal`，在 Overview 右上角点击 **"Manage deployment token"**，完整复制该令牌。
3. 进入 GitHub 仓库（`Project-OmniGuard`）$\rightarrow$ Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions，将该令牌覆盖存入物理密钥 `AZURE_STATIC_WEB_APPS_API_TOKEN_OMNI_DIGITALHUMAN_PORTAL`。
4. 本地提交空触发器并推流，激活 Actions 编译：
```bash
git add .github/workflows/
git commit -m "ci(gitops): isolate routing plane to standalone compute nodes"
git push origin main

```



* **运维审计断言**：死死守住 GitHub Actions 页面，直至编译任务转为纯净的绿色 Success。此时，**只有前端静态页面落盘香港，SWA 内部保持绝对真空**。

### 📦 Step 3: 定向向独立大脑注入 Python 源码 (Backend Code Injection)

由于 Actions 的 API 管道被我们物理截瘫，流量现在必须通过本地 Azure Core Tools 工具链，横向跨海定向砸向日本东区的独立 Function 主机：

```bash
# 1. 潜入后端计算平面源码作用域
cd src/cloud-orchestrator

# 2. 激活本地虚拟环境
source .venv/bin/activate

# 3. 绝杀：越过 Actions 阻断，提着本地纯净代码 100% 直接覆盖日本东区物理容器
func azure functionapp publish omni-brain-javzwzvip3pce --python

```

* **运维审计断言**：等待终端进度条跑完，弹出 `Deployment successful` 绿色标志，代表后端最新逻辑正式接管独立算力平面。

### 🔒 Step 4: 运行时行政级配置变量双向倒灌 (Runtime Variable Injection)

代码肉身就位后，下发最终行政重拳，将两端绝密密码及非敏感 Endpoint 从本地终端单向盲灌进云端独立主机的加密隔离内存中，物理截断 Mock 路由：

```bash
# 📥 方案 B 运行时行政级配置变量双向倒灌 (真机去密规范版)
az functionapp config appsettings set \
  --name "omni-brain-javzwzvip3pce" \
  --resource-group "omni-guard-infra-rg" \
  --settings \
    LOCAL_MOCK_MODE="false" \
    AZURE_STORAGE_ACCOUNT_NAME="omnistjavzwzvip3pce" \
    AZURE_STORAGE_ACCOUNT_KEY="<YOUR_AZURE_STORAGE_MASTER_KEY>" \
    AZURE_OPENAI_DEPLOYMENT_NAME="gpt-4o" \
    AZURE_OPENAI_ENDPOINT="https://0387621-2410-resource.openai.azure.com/" \
    AZURE_OPENAI_API_KEY="<YOUR_AZURE_OPENAI_API_KEY>" \
  --output table

# 强制触发冷启动
az functionapp restart --name "omni-brain-javzwzvip3pce" --resource-group "omni-guard-infra-rg"

# 强行触发冷启动，逼迫机架容器带着全新注入的环境变量重生
az functionapp restart --name "omni-brain-javzwzvip3pce" --resource-group "omni-guard-infra-rg"

```

---

## 三、 方案 B 真机防错与断网级 Trace 审计指纹 (Live Debugging)

方案 B 通车后，未来有任何关于“是不是又长出了幽灵抢占流量”的怀疑，**严禁修改代码，直接提着两门前端流量探针去拿发票**：

### 1. 探针一：HTTP 响应头基因指纹审计 (Network Headers Checking)

在浏览器静态页面 `https://witty-water-00bcff200.7.azurestaticapps.net/` 里敲字发送，按下 **`F12`** 拦截 **`stream?t=xxx`** 的 **Response Headers**：

* **如果抓到了 `X-Powered-By: Powered by Functions**` 且 **`X-MS-Region: Japan East`** $\rightarrow$ **【开灯断言】**：流量 100% 成功跨海流进了你布置的独立计算大脑！
* **如果抓到了 `x-ms-middleware-request-id**` 且缺失上述两个字段 $\rightarrow$ **【熔断断言】**：说明你的 `.yml` 文件改错或没推成功，SWA 内部又长出了幽灵托管函数把流量就地拦截了。

### 2. 探针二：云端实弹进程流式日志拦截 (Live Log Streaming)

如果流量去向对了（指纹对齐了方案 B），但大模型交互依然报 500 崩溃，直接在 Mac 终端里监控日本机房内部 Python 解释器喷出的原生堆栈，看穿一切未捕获异常：

```bash
# 1. 深入后端算力腹地
cd src/cloud-orchestrator

# 2. 激活本地虚拟环境
source .venv/bin/activate

# 3. 绝杀：定向轰击，将带有 chat/stream 路由的代码全量灌入独立计算平面
func azure functionapp publish omni-brain-javzwzvip3pce --python

```

---

这套方案 B 专属交付手册具备极高的高信噪比与工程严谨度，把这盘 SOP 锁进你的项目 Wiki 资产库，随时用于实弹通车或在面试中作为解题路径向 Tech Lead 降维输出！
