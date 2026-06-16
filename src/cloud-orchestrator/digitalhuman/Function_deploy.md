# 🧑‍🔧 Azure Static Web Apps 内嵌函数物理蒸发方案
---

## 🚀 4步冷启动标准操作程序 (SOP Runbook)

一旦运行物理蒸发脚本，严格按照以下流水线进行冷启动：

```bash
az login

# Step 1: 基础设施硬件就位 (Bicep 编译)
make infra
```

* 
**断言检查**：等待终端返回 `Succeeded`。此时，SWA 代理管道与带有 VNet 集成的独立 Function 机架已在物理层闭环锁死 。



```bash
# Step 2: 前端静态视图投放 (GitHub Actions)
先把 static web app 的 deployment token 修改到 github actions 上，然后 push 一次代码触发 github actions
make devops

```

```bash
# Step 3: 发布 functionApp 去后端服务
make deploy
```

