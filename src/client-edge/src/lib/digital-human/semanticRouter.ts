import { pipeline } from '@huggingface/transformers';
import { KnowledgeVectorNode, RoutingDecision } from '@/types/avatar-router';

let embeddingPipelineInstance: any = null;

/**
 * 核心原子函数：初始化本地 23MB 向量雷达
 */
export async function initEdgeEmbeddingRadar(): Promise<void> {
  if (embeddingPipelineInstance) return;
  // 刚性加载轻量级量化 MiniLM 模型，仅 23MB 内存占用
  embeddingPipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
}

/**
 * 核心原子函数：执行数学级余弦相似度对账
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 🚦 智能多活调度大脑：基于本地知识资产可用性进行向量解算
 * @param userPrompt 用户原始输入
 * @param localDataset 本地预编译的死数据向量表
 */
export async function executeSemanticRouting(
  userPrompt: string,
  localDataset: KnowledgeVectorNode[]
): Promise<RoutingDecision> {
  if (!embeddingPipelineInstance) {
    return { target: 'cloud', similarity: 0, matchedText: '向量引擎未就绪，强制分流' };
  }

  // 1. 4ms 内将 Prompt 物理转化为 384 维浮点向量
  const output = await embeddingPipelineInstance(userPrompt, { pooling: 'mean', normalize: true });
  const promptVector = Array.from(output.data) as number[];

  let maxSimilarity = -1;
  let optimalNode: KnowledgeVectorNode | null = null;

  // 2. 与本地资产卡片进行矩阵对账
  for (const node of localDataset) {
    const similarity = calculateCosineSimilarity(promptVector, node.embedding);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      optimalNode = node;
    }
  }

  // 3. 刚性分流断言
  const HARD_THRESHOLD = 0.72;
  const hasKnowledge = maxSimilarity >= HARD_THRESHOLD;

  return {
    target: hasKnowledge ? 'local' : 'cloud',
    similarity: maxSimilarity,
    matchedText: optimalNode ? optimalNode.text : ''
  };
}