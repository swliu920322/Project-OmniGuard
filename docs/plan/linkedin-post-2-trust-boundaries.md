# LinkedIn Post #2: "Rules Own Certainty, Code Owns Safety"

> **主题**: 工程深度 / 信任边界 / 语法级约束的小模型实战教训  
> **目标字数**: ~500 英文单词 (Word Count: ~495 words)  
> **发布时机**: 周三上午 (针对高级工程师、AI 架构师、CTO)  
> **关联源码**: `packages/interpreter/src/local-gpu.ts`, `trust.test.ts`

---

## 帖子正文 (Full Post Text)

We ran a 0.5B model in the browser with grammar-constrained output. It physically could not produce invalid JSON. Sounds completely safe? 

It wasn't. Here is what that taught us about AI trust boundaries.

**The illusion of structural safety.**
In our document interpreter, we wanted natural language intent ("give me an ops runbook in English") to automatically pick the right document form.

To make it fast, free, and offline, we ran Qwen2.5-0.5B locally via WebGPU. Using GBNF grammar constraints, we locked the output token space strictly to:
`{"preset":"academic"|"playbook"|"narrative"}`

The model could not output Markdown, invalid syntax, or hallucinated enum keys. In unit tests, output validity was 100%.

**The failure mode.**
Syntactic validity is not semantic truth.

Because a 0.5B model has limited reasoning capacity, when faced with subtle or complex user prompts, it developed a stubborn bias: it confidently picked `"academic"` almost every single time. It chose the default path with zero uncertainty. 

The output was mathematically valid JSON, but functionally wrong. If we let the model override our system, we had built an engine that was rigorously type-safe, yet silently broken.

**The architectural pivot: The Cascade of Certainty.**
We restructured the decision pipeline around three strict tiers:

1. **Rules run first (Deterministic Authority):**
If the user intent contains clear operational keywords ("runbook", "ops", "audit"), deterministic rule matching decides immediately. We never consult the model. Why spend GPU cycles and risk probabilistic errors when certainty is free?

2. **Models resolve ambiguity (Probabilistic Consultation):**
We only consult the model when deterministic rules have zero confidence. We try the local grammar-locked SLM first (<500ms), fall back to cloud LLM if needed, and fallback to neutral defaults if both fail.

3. **Code owns the boundary (Sanitization & Defaults):**
Even if a cloud model returns arbitrary JSON, our sanitizer strips unknown keys, blocks prototype pollution, and validates against strict Zod enums. The render engine never receives raw model output.

**The core principle.**
This gave us an engineering rule we now apply across our systems:

> **Rules own certainty.**  
> **Models own ambiguity.**  
> **Code owns safety.**

It is the exact same architectural primitive we use in cyber-physical edge computing: when cloud inference exceeds the kinematic braking deadline, edge reflexes take over. When a model is unreliable, deterministic rules take over.

The pattern is never "AI or no AI." It is a cascade of decreasing intelligence with increasing reliability.

Where is the trust boundary in your AI architecture? How do you handle models that are syntactically flawless, yet confidently wrong?

👉 [Demo link / GitHub repository]

#AIEngineering #SoftwareArchitecture #EdgeAI #WebGPU #LLM #SystemDesign

---

## Word Count & Structure Breakdown

- **Total Word Count**: ~495 words (Word / Google Docs 统计标准)
- **Reading Time**: ~2 minutes
- **Key Takeaways for Interview / Technical Readers**:
  1. 解释了为什么单纯依靠 JSON mode / Grammar 并不能解决小模型的语义偏差。
  2. 提出了可落地的“三层确定性分级”（Rules → SLM/LLM → Sanitize）。
  3. 呼应了机器人安全与边缘计算的同构性（Kinematic deadline fallback ↔ Rules fallback）。
