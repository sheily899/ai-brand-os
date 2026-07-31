/**
 * Knowledge Retriever — 混合搜索（向量相似度 + 关键词过滤）
 *
 * 职责：
 * - 接收查询文本，生成 embedding
 * - 在 pgvector 中执行向量相似度搜索
 * - 支持关键词过滤和阶段过滤
 * - 空库不阻塞流程（返回空结果）
 *
 * MVP 阶段：使用 hash-based 向量（非真正语义搜索）。
 * 未来替换为专门的 embedding 模型后，无需修改此模块接口。
 */

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getEmbeddingProvider } from "./embeddings";
import type { RetrievalOptions, RetrievalResult, KnowledgeDocument } from "./types";

/**
 * 检索知识文档
 *
 * @param query - 查询文本
 * @param options - 检索选项
 * @returns 按相似度降序排列的检索结果
 */
export async function retrieve(
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievalResult[]> {
  const {
    topK = 5,
    threshold = 0.1,
    stageFilter,
    hybridSearch = false,
  } = options;

  const provider = getEmbeddingProvider();
  const queryEmbedding = await provider.embed(query);

  // 如果 embedding 为空（API 不可用），退化为关键词搜索
  if (queryEmbedding.length === 0) {
    if (hybridSearch) {
      return keywordSearch(query, { topK, stageFilter });
    }
    return [];
  }

  try {
    // 向量相似度搜索（raw SQL via Drizzle）
    // pgvector 使用 <=> 操作符计算余弦距离
    const vectorStr = `[${queryEmbedding.join(",")}]`;

    const rows = await db.execute(
      sql`SELECT id, title, content, source_type, stage_relevance, metadata, status,
                 embedding <=> ${vectorStr}::vector AS similarity,
                 created_at, updated_at
          FROM knowledge_document
          WHERE status = 'active'
            AND embedding IS NOT NULL
            ${stageFilter != null ? sql`AND stage_relevance = ${stageFilter}` : sql``}
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${topK}`
    );

    // 注意：rows 类型是 QueryResult，需要手动映射
    const results: RetrievalResult[] = [];
    // Drizzle postgres-js driver returns rows as an array
    const rowArray = rows as unknown as any[];

    if (rowArray && rowArray.length > 0) {
      for (const row of rowArray) {
        // pgvector <=> 返回余弦距离（越小越相似），转为相似度分数 0-1
        const distance = typeof row.similarity === "number" ? row.similarity : 1;
        const score = Math.max(0, 1 - distance);

        if (score >= threshold) {
          results.push({
            document: {
              id: row.id as string,
              title: row.title as string,
              content: row.content as string,
              sourceType: row.source_type as string,
              stageRelevance: row.stage_relevance as number | undefined,
              metadata: row.metadata as Record<string, any> | undefined,
              status: row.status as "active" | "archived",
              createdAt: new Date(row.created_at as string),
              updatedAt: new Date(row.updated_at as string),
            },
            score: Math.round(score * 100) / 100,
          });
        }
      }
    }

    return results;
  } catch (e: any) {
    // pgvector 扩展未安装或表不存在 → 返回空
    console.warn(`[retriever] 向量搜索失败: ${e.message}`);
    return [];
  }
}

/**
 * 关键词搜索（退化方案 — 无向量支持时使用）
 */
async function keywordSearch(
  query: string,
  options: { topK?: number; stageFilter?: number }
): Promise<RetrievalResult[]> {
  const { topK = 5, stageFilter } = options;

  try {
    const keywords = query.split(/\s+/).filter(Boolean);

    if (keywords.length === 0) return [];

    // 使用 ILIKE 做简单的关键词匹配
    const conditions = keywords.map(
      (kw) => sql`(title ILIKE ${"%" + kw + "%"} OR content ILIKE ${"%" + kw + "%"})`
    );

    const rows = await db.execute(
      sql`SELECT id, title, content, source_type, stage_relevance, metadata, status,
                  created_at, updated_at
          FROM knowledge_document
          WHERE status = 'active'
            ${stageFilter != null ? sql`AND stage_relevance = ${stageFilter}` : sql``}
            AND (${sql.join(conditions, sql` OR `)})
          LIMIT ${topK}`
    );

    const rowArray = rows as unknown as any[];
    if (!rowArray || rowArray.length === 0) return [];

    return rowArray.map((row: any) => ({
      document: {
        id: row.id as string,
        title: row.title as string,
        content: row.content as string,
        sourceType: row.source_type as string,
        stageRelevance: row.stage_relevance as number | undefined,
        metadata: row.metadata as Record<string, any> | undefined,
        status: row.status as "active" | "archived",
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
      },
      score: 0.5, // 关键词匹配默认分数
    }));
  } catch (e: any) {
    console.warn(`[retriever] 关键词搜索失败: ${e.message}`);
    return [];
  }
}

/**
 * 格式化检索结果为 Context 文本（可注入 Consultation system prompt）
 */
export function formatRetrievalContext(results: RetrievalResult[]): string {
  if (results.length === 0) return "";

  const lines: string[] = ["## 知识库检索结果\n"];

  for (const r of results) {
    lines.push(
      `### ${r.document.title}（相似度: ${r.score}）`,
      `来源类型: ${r.document.sourceType}`,
      `${r.document.content.slice(0, 500)}`,
      ""
    );
  }

  return lines.join("\n");
}
