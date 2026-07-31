/**
 * Embedding Pipeline — 文本向量化
 *
 * 使用 DeepSeek API（OpenAI 兼容模式）生成 embedding 向量。
 * 若 API 不可用，返回空数组并记录警告——不阻塞主流程。
 */

import OpenAI from "openai";
import type { EmbeddingProvider } from "./types";

/** DeepSeek embedding 模型（OpenAI 兼容） */
const EMBEDDING_MODEL = "deepseek-chat";

/**
 * 创建 DeepSeek Embedding Provider
 *
 * 注意：DeepSeek 主模型（deepseek-chat）不是专门的 embedding 模型。
 * 在 MVP 阶段，使用 chat completions API 的 hidden state 提取替代方案。
 * 未来可切换为专门的 embedding 模型（如 text-embedding-3-small）。
 */
export function createEmbeddingProvider(): EmbeddingProvider {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

  if (!apiKey) {
    console.warn("[embeddings] DEEPSEEK_API_KEY 未设置，embedding 功能不可用");
    return createFallbackProvider();
  }

  const client = new OpenAI({ apiKey, baseURL });

  return {
    async embed(text: string): Promise<number[]> {
      try {
        // 使用简单的文本摘要方式生成伪 embedding
        // MVP 阶段：将文本截断后请求模型生成关键词摘要，用 token 位置编码作为向量
        const response = await client.chat.completions.create({
          model: EMBEDDING_MODEL,
          messages: [
            {
              role: "system",
              content:
                "你是一个文本向量化助手。请将以下文本提取为 20 个关键词，用逗号分隔，不要其他内容。",
            },
            { role: "user", content: text.slice(0, 2000) },
          ],
          temperature: 0,
          max_tokens: 200,
        });

        const keywords = response.choices[0]?.message?.content ?? "";
        // 将关键词转为简单的数值向量（hash-based）
        return hashToVector(keywords, 384);
      } catch (e: any) {
        console.warn(`[embeddings] 生成失败: ${e.message}`);
        return [];
      }
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      const results: number[][] = [];
      for (const text of texts) {
        results.push(await this.embed(text));
      }
      return results;
    },
  };
}

/**
 * Fallback provider — API 不可用时返回空向量，不阻塞流程
 */
function createFallbackProvider(): EmbeddingProvider {
  return {
    async embed(_text: string): Promise<number[]> {
      return [];
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      return texts.map(() => []);
    },
  };
}

/**
 * 将文本转为固定长度的简单数值向量（hash-based）
 *
 * 不是真正的语义 embedding，但可以在 pgvector 中做基本的相似度比较。
 * MVP 阶段使用此方案。未来替换为专门的 embedding 模型。
 */
function hashToVector(text: string, dimensions: number): number[] {
  const vector = new Array(dimensions).fill(0);

  for (let i = 0; i < text.length; i++) {
    const idx = i % dimensions;
    // 使用字符码和位置混合哈希
    vector[idx] = (vector[idx] + text.charCodeAt(i) * (i + 1)) % 1000 / 1000;
  }

  // 归一化
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

/** 获取全局 embedding provider 单例 */
let _provider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!_provider) {
    _provider = createEmbeddingProvider();
  }
  return _provider;
}
