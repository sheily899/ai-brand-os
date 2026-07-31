/**
 * URL Ranking — AI 驱动的搜索结果筛选
 *
 * 职责：
 * - 根据来源权威性、内容相关度、数据密度对搜索结果评分
 * - 筛选 Top 3-5 高价值 URL 进入 Web Retrieval
 * - 使用 AI（DeepSeek）进行排名判断
 *
 * 不负责：
 * - 实际抓取内容（由 retrieval.ts 负责）
 * - 来源可信度配置（读取 source-credibility.ts）
 */

import { getLLMProvider } from "@/lib/ai/provider";
import { classifySource } from "./source-credibility";
import type { SearchResult, RankedURL } from "./types";

export interface RankInput {
  stage: number;
  /** 原始搜索结果 */
  results: SearchResult[];
  /** 品牌名 + 品类（用于判断相关度） */
  brandName: string;
  category: string;
  /** 搜索目标（来自 Search Intent） */
  objective?: string;
  /** 最多返回几个排名结果 */
  topK?: number;
}

/**
 * AI 对搜索结果进行权威性/相关度/数据密度三维评分
 * 返回 Top K 个 URL
 */
export async function rankURLs(input: RankInput): Promise<RankedURL[]> {
  const { stage, results, brandName, category, objective, topK = 5 } = input;

  if (results.length === 0) return [];

  // ── 少量结果直接用 AI 评分 ─────────────────────────
  if (results.length <= topK) {
    return rankWithAI(results, stage, brandName, category, objective);
  }

  // ── 多结果：预筛选 → AI 评分 ───────────────────────
  // 预筛选：去除非相关 + 根据来源可信度加分
  const preScored = results.map((r) => {
    const credibility = classifySource(r.url, stage);
    const credibilityBonus =
      credibility.trustLevel === "high" ? 3 : credibility.trustLevel === "medium" ? 1 : 0;

    return { result: r, preScore: credibilityBonus };
  });

  // 排序取 Top K*2 给 AI 精细判断
  preScored.sort((a, b) => b.preScore - a.preScore);
  const candidates = preScored.slice(0, topK * 2).map((p) => p.result);

  return rankWithAI(candidates, stage, brandName, category, objective);
}

// ── AI 评分核心 ──────────────────────────────────────

async function rankWithAI(
  results: SearchResult[],
  stage: number,
  brandName: string,
  category: string,
  objective?: string
): Promise<RankedURL[]> {
  if (results.length === 0) return [];

  const provider = getLLMProvider();

  // 构建评分 prompt
  const resultsList = results
    .map(
      (r, i) =>
        `[${i + 1}] 标题: ${r.title}\n    URL: ${r.url}\n    来源: ${r.source}\n    摘要: ${r.snippet.slice(0, 200)}`
    )
    .join("\n\n");

  const prompt = `你是一个搜索质量评估专家。请对以下搜索结果进行三维评分。

## 评分维度

- **权威性 (authorityScore, 0-10)**：来源是否可靠？是否为官方/行业报告/知名媒体？
- **相关度 (relevanceScore, 0-10)**：内容是否与"${brandName} ${category}"相关？是否匹配搜索目标"${objective ?? `Stage ${stage} 市场分析`}"？
- **数据密度 (dataDensityScore, 0-10)**：摘要中是否包含具体数据/年份/百分比/案例？信息量是否丰富？

## 评分指引

- 官方报告 ≥ 政府/统计局 ≥ 上市公司财报：authority 8-10
- 知名行业媒体/咨询机构：authority 6-8
- 自媒体/论坛/个人博客：authority 0-4
- 含具体数字（如"250亿""18%）→ dataDensity 7-10
- 仅描述性内容无数据 → dataDensity 0-3

## 搜索结果

${resultsList}

## 输出要求

严格输出 JSON 数组，每个元素对应一条结果：

\`\`\`json
[
  {
    "index": 1,
    "authorityScore": 8,
    "relevanceScore": 7,
    "dataDensityScore": 6,
    "compositeScore": 7.0,
    "rationale": "该来源为艾瑞咨询报告，权威性高，包含市场规模数据，与宠物食品品类高度相关"
  }
]
\`\`\`

按 compositeScore 降序排列。compositeScore = (authorityScore + relevanceScore + dataDensityScore) / 3。
只输出 JSON 数组，不要任何解释文字。`;

  try {
    const response = await provider.chat(
      [{ role: "user", content: prompt }],
      { temperature: 0.1, maxTokens: 2048, responseFormat: "json_object" }
    );

    // 解析 AI 评分结果
    const parsed = JSON.parse(response);
    const rankings: RankedURL[] = [];

    // 支持数组格式和包装对象格式
    const items = Array.isArray(parsed) ? parsed : parsed.rankings ?? parsed.results ?? [];

    for (const item of items) {
      const idx = (item.index ?? 0) - 1;
      if (idx < 0 || idx >= results.length) continue;

      const r = results[idx];
      rankings.push({
        url: r.url,
        title: r.title,
        snippet: r.snippet,
        source: r.source,
        authorityScore: clamp(item.authorityScore, 0, 10),
        relevanceScore: clamp(item.relevanceScore, 0, 10),
        dataDensityScore: clamp(item.dataDensityScore, 0, 10),
        compositeScore:
          item.compositeScore ??
          (clamp(item.authorityScore, 0, 10) +
            clamp(item.relevanceScore, 0, 10) +
            clamp(item.dataDensityScore, 0, 10)) /
            3,
        rationale: item.rationale ?? "",
      });
    }

    // 按综合分降序
    rankings.sort((a, b) => b.compositeScore - a.compositeScore);
    return rankings;
  } catch (e: any) {
    console.error(`[url-ranking] AI 评分失败: ${e.message}`);

    // 降级：按来源可信度简单排序
    return results.map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
      source: r.source,
      authorityScore: 5,
      relevanceScore: 5,
      dataDensityScore: 5,
      compositeScore: 5,
      rationale: "AI 评分失败，使用默认排名",
    }));
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value ?? 5));
}
