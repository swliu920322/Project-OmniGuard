/**
 * MODULE ALPHA // COGNITIVE COMPUTE KERNEL // PERSISTENT SANDBOX
 */

let globalLLMEngine: any = null;
let globalLLMInitPromise: Promise<any> | null = null;
let globalEmbeddingPipeline: any = null;
let globalEmbeddingInitPromise: Promise<any> | null = null;

const LOCAL_MODEL_NAME = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

export interface LocalKnowledgeNode {
  tags: string;
  text: string;
  vector?: number[];
}

export const LOCAL_KNOWLEDGE_BASE: LocalKnowledgeNode[] = [
  { tags: "你好，最近怎么样？日常打招呼与寒暄问候。hello hi greeting", text: "你好！我是胜伟的本地边缘算力分身。检测到这是一发高频寒暄，已通过您 Mac 浏览器原生的 WebGPU 硬件加速通道完成就地解算，零云端资费秒回！" },
  { tags: "刘胜伟目前的学历是什么？他在哪家学校读硕士？什么时候毕业？Taylor University Master Computing AI", text: "刘胜伟目前在马来西亚泰莱大学（Taylor's University）攻读应用计算硕士（AI方向），主攻企业级 RAG 沙盘与多智能体编排，预计 2026 年 8 月底满血毕业。" },
  { tags: "介绍一下他的工作履历和经验年限。他在埃森哲带过团队吗？Accenture Scania Lead Engineer Manager", text: "他具备 10 年以上的全栈工程交付与核心架构底蕴。曾任埃森哲（Accenture）技术交付主管，精通微前端隔离与运行时复杂状态机的研发，擅长攻坚高负载系统。" },
  { tags: "他考取了哪些微软官方专家认证和认证证书？az305 az104 ai102 Solutions Architect Microsoft Certified", text: "他已满血斩获微软官方顶级证书矩阵：AZ-305 (Azure Solutions Architect Expert) 专家架构师、AZ-104 (微软系统管理员) 以及 AI-102 (Azure AI 工程师专家认证)。" }
];

function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0; let normA = 0; let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]; normA += vecA[i] * vecA[i]; normB += vecB[i] * vecB[i];
  }
  return normA === 0 || normB === 0 ? 0 : dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 自动化系统核心开机引导引信
 */
export async function bootEdgeComputeKernel(onProgress: (progress: number) => void): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
  try {
    const transformersModule = await import('@huggingface/transformers');
    const webLLMModule = await import('@mlc-ai/web-llm');

    if (!globalEmbeddingPipeline) {
      if (!globalEmbeddingInitPromise) {
        globalEmbeddingInitPromise = transformersModule.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      }
      globalEmbeddingPipeline = await globalEmbeddingInitPromise;
      for (const node of LOCAL_KNOWLEDGE_BASE) {
        if (!node.vector) {
          const res = await globalEmbeddingPipeline(node.tags, { pooling: 'mean', normalize: true });
          node.vector = Array.from(res.data) as number[];
        }
      }
    }

    if (!globalLLMEngine) {
      if (!globalLLMInitPromise) {
        globalLLMInitPromise = webLLMModule.CreateMLCEngine(LOCAL_MODEL_NAME, {
          initProgressCallback: (report) => onProgress(Math.round(report.progress * 100))
        });
      }
      globalLLMEngine = await globalLLMInitPromise;
    }
    return true;
  } catch (err) {
    console.error("[Kernel Boot Interrupted]", err);
    return false;
  }
}

/**
 * 语义分流路由器
 */
export async function evaluateLocalRAGContext(prompt: string): Promise<{ hasKnowledge: boolean; localContext: string }> {
  const lower = prompt.toLowerCase().trim();
  const fastPassTokens = ["你好", "hello", "hi", "嗨", "最近怎么样"];
  if (fastPassTokens.some(token => lower === token || lower.startsWith(token))) {
    return { hasKnowledge: true, localContext: LOCAL_KNOWLEDGE_BASE[0].text };
  }
  if (!globalEmbeddingPipeline) return { hasKnowledge: false, localContext: '' };

  try {
    const output = await globalEmbeddingPipeline(prompt, { pooling: 'mean', normalize: true });
    const promptVector = Array.from(output.data) as number[];
    let maxSimilarity = -1; let matchedAsset = "";

    for (const node of LOCAL_KNOWLEDGE_BASE) {
      if (!node.vector) continue;
      const similarity = computeCosineSimilarity(promptVector, node.vector);
      if (similarity > maxSimilarity) { maxSimilarity = similarity; matchedAsset = node.text; }
    }

    console.log(`[Semantic Router] Max Similarity: ${maxSimilarity.toFixed(4)}`);
    return { hasKnowledge: maxSimilarity >= 0.72, localContext: maxSimilarity >= 0.72 ? matchedAsset : '' };
  } catch (err) {
    return { hasKnowledge: false, localContext: '' };
  }
}

/**
 * 流式解算管道 A：本地显存大模型
 */
export async function runLocalGPUPipeline(prompt: string, context: string, onToken: (token: string) => void): Promise<void> {
  if (!globalLLMEngine) throw new Error("Local GPU Kernel Absent");
  const chunks = await globalLLMEngine.chat.completions.create({
    messages: [
      { role: "system", content: `You are Shengwei's local assistant. Answer strictly based on this fact: ${context}` },
      { role: "user", content: prompt }
    ],
    stream: true,
  });
  for await (const chunk of chunks) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) onToken(delta);
  }
}

/**
 * 流式解算管道 B：新加坡云端 ASGI 网桥
 */
export async function cloudInferencePipeline(prompt: string, pathname: string, onToken: (token: string) => void): Promise<void> {
  const response = await fetch(`/api/chat/stream/?t=${Date.now()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: prompt,
      context: pathname,
    })
  });
  if (!response.ok || !response.body) throw new Error(`Remote API Aborted: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    const token = decoder.decode(value, { stream: true }); if (token) onToken(token);
  }
}