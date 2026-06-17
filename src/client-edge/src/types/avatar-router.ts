export interface KnowledgeVectorNode {
  id: string;
  text: string;
  embedding: number[]; // 预编译好的 384 维 MiniLM 向量
}

export interface RoutingDecision {
  target: 'local' | 'cloud';
  similarity: number;
  matchedText: string;
}