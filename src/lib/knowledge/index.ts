/**
 * Knowledge Base — 统一入口
 *
 * Task 2.7：仅建基础设施管道，不做数据播种。
 */

export { createEmbeddingProvider, getEmbeddingProvider } from "./embeddings";
export { retrieve, formatRetrievalContext } from "./retriever";
export type {
  KnowledgeDocument,
  RetrievalResult,
  RetrievalOptions,
  EmbeddingProvider,
} from "./types";
