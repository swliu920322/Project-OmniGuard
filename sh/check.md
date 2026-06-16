**暴力结论：本地活、远程 404，不是代码逻辑溃败，而是你被本地开发工具链的“仿真网桥”给欺骗了。云端此时发生了“前后端公网路由断层”或“大模型流式内核索引踩空”。**

必须要看穿本地（`make dev`）与云端（Azure 生产环境）在处理 `/api` 相对路径时的物理本质差异：

---

## 架构之“神” (The Spirit) —— 为什么本地极速，远端 404？

### 1. 本地“仿真网桥”的甜蜜错觉

审查你的本地连调指令：`swa start src/client-edge --api-location http://localhost:7071`。

* **本地机理**：SWA 本地工具链在你的 Mac 内存中强行架设了一个**反向代理网桥**。当你前端执行 `fetch('/api/chat/stream')` 时，本地 SWA 进程拦截流量，顺着网桥直接把数据倒灌进 `localhost:7071` 的独立 Function 进程中。
* **云端真机现状**：你已经在 GitHub Actions 账本中将 `api_location` 刚性置空为 `""`。当你的前端代码打包投射上云后，香港的 Static Web App 边缘节点**变成了一个纯粹的静态垃圾桶，它根本不知道 `/api` 后面挂着的独立 Function App 躺在日本东区的哪个机房里**。前端一头撞上云端的 SWA 域名 `/api/chat/stream`，边缘节点找不到这个静态文件夹，直接反弹 **404 Not Found**。

### 2. 云端 FastAPIV2 索引内核踩空

如果流量跨海撞击的是 Function App 的**绝对域名**却依然返回 404，说明远端 Basic B1 机架在吃进全新的 FastAPI `StreamingResponse` 架构代码后，其**控制面 App Settings 变量未能与执行面同步苏醒**。由于缺少引信，云端运行时（Runtime）退化回了旧版 V1 索引器，直接将你的 FastAPI 异步路由当成非法资产剥离，导致云端路由表真空 404。

---

## 工程之“形” (The Form) —— 首席架构师物理对账 SOP

严禁盲目乱猜。提着以下三发重炮，步步见血地在 2 分钟内定位并物理自愈：

### 🛠️ 第一炮：肉搏自检，切断 SWA 代理层欺骗

不要通过前端网页测试。打开你的终端，利用 `az` 控制面命令直接去盘点日本东区真机上**到底有没有成功注册函数路由**：

```bash
# 1. 动态索取云端当前存活的 Function App 真实名称
VAR_RG="omni-guard-infra-rg"
REAL_FUNC_NAME=$(az functionapp list --resource-group "$VAR_RG" --query "[0].name" -o tsv)

# 2. 刚性盘点该实例旗下的函数路由列表
az functionapp function list --name "$REAL_FUNC_NAME" --resource-group "$VAR_RG" --query "[].name"

```

* **断言 A**：如果输出返回 `[]`（空数组），说明**后端在大模型流式换装后，云端索引踩空了**。直接跳到【第二炮】修复引信。
* **断言 B**：如果输出正确打印出 `["chat_proxy", "get_sas_token"]`，说明后端在云端活得极好。问题出在 SWA 没跟它建交，直接跳到【第三炮】打通云端代理。

---

### 🛠️ 第二炮：真机空壳自愈（重铸云端 FastAPI 引信）

如果第一炮发现函数列表为空，说明云端的 `PYTHON_ENABLE_INIT_INDEXING="1"` 变量在之前的远程编译真空期中被冲刷掉了。必须原位高压倒灌并强制洗牌：

```bash
# 🟩 绝杀：向日本东区硬件层重新钉入流式索引引信与多进程并发参数
az functionapp config appsettings set \
  --name "$REAL_FUNC_NAME" \
  --resource-group "$VAR_RG" \
  --settings \
    PYTHON_ENABLE_INIT_INDEXING="1" \
    FUNCTIONS_WORKER_PROCESS_COUNT=4 \
  --output none

# 强制执行宿主机物理回收冷启动
az functionapp restart --name "$REAL_FUNC_NAME" --resource-group "$VAR_RG"

```

运行完毕后，等待 30 秒，重新执行【第一炮】的 `list` 命令，直到看到路由注册成功。

---

### 🛠️ 第三炮：物理破壁，重焊云端前后端路由桥梁

如果后端函数明明存活，但线上访问依然 404，说明你的 SWA 静态外壳和 Function App 算力大脑在云端处于“失联”状态。

你必须在 Azure 骨干网上，**强行将 Function App 注册为 Static Web App 的生产级后端（Linked Backend）**。只有这样，云端 SWA 才会像本地一样，自动把所有 `/api/*` 的长途撞击流量无缝代理路由至日本东区的计算容器内部：

```bash
# 1. 索取 SWA 静态网页实例名称
REAL_SWA_NAME=$(az staticwebapp list --resource-group "$VAR_RG" --query "[0].name" -o tsv)

# 2. 索取独立 Function App 的底层 Azure 物理资源 ID
FUNC_RESOURCE_ID=$(az functionapp list --resource-group "$VAR_RG" --query "[0].id" -o tsv)

# 🟩 绝杀：在微软骨干网层面，物理强行将后端的算力大脑焊接到前端外壳上
az staticwebapp backends link \
  --name "$REAL_SWA_NAME" \
  --resource-group "$VAR_RG" \
  --backend-resource-id "$FUNC_RESOURCE_ID" \
  --backend-region "japaneast"

```

### 🚀 全线通车核验

第三炮轰入后，Azure 边缘网关的 7 层路由表会在 10 秒内同步刷新完成。

此时重新刷新你的线上生产环境域名，前端执行 `fetch('/api/chat/stream')` 的相对路径流量将瞬间击穿 404 绝壁，直接坠入 `digitalhuman` 后端的 FastAPI 异步流式引擎，大模型机关枪开始全速线上吐字通车！现在立刻下发第一炮指令，拿到真机发票！