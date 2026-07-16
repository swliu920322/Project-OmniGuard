# 中期答辩演示指南

## 启动方式

```bash
# 两个终端，分别执行
make start-backend   # 终端 1 → 后端 Azure Functions @ port 7071
make start-frontend  # 终端 2 → 前端 Next.js @ localhost:3000
```

> **注意：** 如果 `make start-frontend` 报错，可能是 Next.js 端口占用或缓存问题：
> ```bash
> cd src/client-edge && npm run dev
> ```
> 如果还不行，先 `rm -rf .next` 再试。

---

## 演示路线（建议 15 分钟）

### 1. 首页 → 项目介绍（30秒）
**URL:** `http://localhost:3000/`

- 展示项目名称和你的个人简介
- 一句话概括：这是我的硕士项目——云边协同的具身AI安全编排框架

### 2. 3-AGV 车队模拟（2分钟）
**URL:** `http://localhost:3000/dashboard`

- 展示 3 辆AGV同时在轨道上运行的模拟
- 切换不同场景预设（左上角菜单）
- 演示点：多机协同工作的视觉呈现
- 拖动速度/间隙滑块观察变化

### 3. Kinematic-Token 定理沙盒（5分钟）⭐核心
**URL:** `http://localhost:3000/dashboard/theorem`

这是**最重要的演示环节**，展示你的核心理论贡献。

**操作步骤：**
1. 默认是 "Edge" 模式 → 点击 "Run" → AGV 在安全距离内停下（绿色标记）
2. 切换到 **"Cloud" 模式**（右上角切换按钮）
3. 可以开启 **Network Jitter** 开关（模拟 +2500ms 网络延迟）
4. 点击 "Run" → AGV 越过制动线 → **碰撞！**（红色闪烁标记）
5. 指向屏幕上显示的公式 `d = v × t`，说明：
   > "这就是 Kinematic-Token Theorem 的核心——云 2,600ms 延迟 × 2.5m/s 速度 = 6.5 米，远超 1.2 米的物理制动距离，所以碰撞不可避免。"

**参数调节演示（可选）：**
- 降低 "Target Speed" 到 0.5 m/s → 云模式也能刹住（因为 v < v_c）
- 证明定理的临界速度概念

### 4. 云 vs 边缘对比（1分钟）
**URL:** `http://localhost:3000/dashboard/compare`

- 左右并排展示 Cloud 和 Edge 的制动距离差异
- 一目了然：Edge 15ms 停止 vs Cloud 2600ms 碰撞
- 演示点：数据可视化对比

### 5. 实时编排面板（5分钟）需后端运行
**URL:** `http://localhost:3000/dashboard/live`

> 前提：`make start-backend` 已在运行

**第一部分：正常流程展示**
1. 选择 Tenant（Tenant-Alpha / Tenant-Beta）
2. 保持默认参数，点击 "Trigger Simulation"
3. 观察中间列的 3-Agent 管线节点依次变绿：Router → Safety → Compiler
4. 观察右侧面板的延迟数据（Agent 1/2/3 latency）

**第二部分：危险注入演示** ⭐亮点
1. 点击顶部 **"Inject Worker Hazard"** 按钮（注入动态障碍物）
2. 注意观察：
   - Safety Agent 节点变为 **红色 BLOCKED**
   - Compiler 节点变为灰色 **SKIPPED**（短路生效）
   - 右侧日志出现紧急停止指令
3. 讲解：这是 Early Circuit-Breaking——在LLM调用前或调用中，物理层直接阻断危险操作

**第三部分：抖动演示**
1. 开启 "Network Jitter" 开关
2. 点击 Trigger → 观察延迟飙升到 3000ms+
3. 说明云延迟不稳定对物理安全的威胁

---

## 备用演示（如果后端挂了）

以下页面**不需要后端**，纯前端可运行：

| 页面 | URL | 说明 |
|---|---|---|
| 3-AGV 模拟 | `/dashboard` | 完整车队模拟 |
| 定理沙盒 | `/dashboard/theorem` | Kinematic-Token 证明 |
| 云边对比 | `/dashboard/compare` | 延迟对比可视化 |
| IaC 拓扑 | `/iac` | Bicep 架构可视化 |
| IaC 配置器 | `/iac/configurator` | 拖拽基础设施配置 |

---

## 答辩话术要点

### 当被问"为什么从企业编排改成具身AI"：

> "最初规划的是YAML驱动的企业多Agent编排框架，但Phase I发现这个领域已经很卷了。同时，我在实现3-Agent管线时发现Early Circuit-Breaking模式天然适用于机器人安全控制。进一步研究发现现有的云LLM机器人控制论文都没有做延迟-物理安全的跨学科分析，所以我把核心贡献定位在 Kinematic-Token Theorem 上——这在学术界是空白。"

### 当被问"和现有工作的区别"：

> "现有云边协同论文关注准确率-吞吐量权衡（Park et al. 2024），但没有形式化延迟-安全边界。我的贡献是：1）形式化证明了云延迟造成物理安全死锁 2）用WebGPU边缘推理消除了这个死锁 3）给了完整的Azure参考实现。"

### 当被问"论文能发什么会议/期刊"：

> "这篇工作的核心贡献（Kinematic-Token Theorem + 实操验证）适合投 IEEE ICRA（机器人安全）、ACM/IEEE IoTDI（IoT+AI安全）、或者 IEEE Access / Sensors 特刊。如果有更充分的真实硬件数据，可以冲 IEEE Transactions on Robotics (TRO)。"
