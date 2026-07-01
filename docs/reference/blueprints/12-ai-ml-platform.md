# 蓝图 12: AI/ML 平台 (预留)

> **领域**: AI | **优先级**: P2 | **复杂度**: 高 | **预估工时**: 待定

---

## 1. 说明

当前 OmniGuard 的 OpenAI 功能使用第三方账号, 不在本 Azure 订阅中。此蓝图暂不实施, 仅作为架构规划预留。

当 Azure AI 资源统一纳入本项目订阅后, 可参考以下架构。

---

## 2. 预留架构概览

```
┌─────────────────────────────────────────────────────────┐
│                  Azure AI Platform                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────┐                  │
│  │  Azure AI Foundry (Hub + Project)   │                  │
│  │  ├─ OpenAI (GPT-4o / o3)           │                  │
│  │  ├─ AI Search (Knowledge Index)    │                  │
│  │  ├─ AI Content Safety              │                  │
│  │  └─ AI Agent Service               │                  │
│  └────────────────────────────────────┘                  │
│                                                          │
│  ┌────────────────────────────────────┐                  │
│  │  Azure AI Services                  │                  │
│  │  ├─ Azure Speech (TTS/STT)         │                  │
│  │  ├─ Azure Translator               │                  │
│  │  └─ Azure Document Intelligence    │                  │
│  └────────────────────────────────────┘                  │
│                                                          │
│  ┌────────────────────────────────────┐                  │
│  │  ML Ops (Azure Machine Learning)    │                  │
│  │  ├─ Fine-tuning Pipeline           │                  │
│  │  ├─ Model Registry                 │                  │
│  │  └─ Model Deployment (Managed Endpoint) │              │
│  └────────────────────────────────────┘                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 可能的应用场景

| 场景 | 服务 | 优先级 |
|------|------|--------|
| 数字人对话 + TTS/STT | Azure OpenAI + Speech | 高 |
| IoT 设备异常检测 | 自定义 ML 模型 | 高 |
| KOL 推文内容分析 | Azure OpenAI | 中 |
| AI Agent (已有 embodied_brain) | Azure AI Agent Service | 中 |
| 多语言翻译 (Dashboard) | Azure Translator | 低 |
| 表单/文档 OCR | Document Intelligence | 低 |

---

## 4. 实施前提

- [ ] Azure AI Foundry 资源创建 (Hub + Project)
- [ ] OpenAI 模型部署 (通过本订阅)
- [ ] Azure AI Services 多服务账户创建
- [ ] Managed Identity 授权 AI 服务访问

---

## 5. 参考链接

- [Azure AI Foundry](https://learn.microsoft.com/en-us/azure/ai-studio/)
- [Azure OpenAI Service](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- [Azure Machine Learning](https://learn.microsoft.com/en-us/azure/machine-learning/)
