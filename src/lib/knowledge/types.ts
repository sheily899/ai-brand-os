/**
 * Knowledge Base — 类型定义
 *
 * Task 2.7：仅建基础设施管道，不做数据播种。
 * knowledge-docs/ 目录为空。
 */

/** 知识文档状态 */
export type KnowledgeDocStatus = "active" | "archived";

/** 知识文档记录 */
export interface KnowledgeDocument {
  id: string;
  /** 文档标题 */
  title: string;
  /** 文档内容（原始文本） */
  content: string;
  /** 来源标签（如 "行业报告"、"品牌案例"、"政策法规"） */
  sourceType: string;
  /** 相关阶段编号（1-8），可选 */
  stageRelevance?: number;
  /** 元数据（JSON） */
  metadata?: Record<string, any>;
  /** 状态 */
  status: KnowledgeDocStatus;
  /** embedding 向量（pgvector halfvec 或单精度浮点数组） */
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

/** 检索结果 */
export interface RetrievalResult {
  /** 匹配文档 */
  document: KnowledgeDocument;
  /** 相似度分数（0-1） */
  score: number;
}

/** 检索选项 */
export interface RetrievalOptions {
  /** 最大返回数量 */
  topK?: number;
  /** 相似度阈值（0-1），低于此分数的结果被过滤 */
  threshold?: number;
  /** 过滤特定阶段的文档 */
  stageFilter?: number;
  /** 是否启用关键词混合搜索 */
  hybridSearch?: boolean;
}

/** Embedding 生成器接口 */
export interface EmbeddingProvider {
  /** 生成 embedding 向量 */
  embed(text: string): Promise<number[]>;
  /** 批量生成 */
  embedBatch(texts: string[]): Promise<number[][]>;
}
