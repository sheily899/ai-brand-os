/**
 * Search Intelligence Layer — 统一导出
 *
 * 共享基础能力，S2/S3/S5/S8 复用。
 */

// Types
export type {
  SearchIntent,
  SearchQuery,
  SearchResult,
  RankedURL,
  RetrievedContent,
  RetrievalSourceType,
  CoverageDimension,
  CoverageStatus,
  SourceConfig,
  StageCredibilityConfig,
  SearchContextInput,
  FormattedSearchContext,
} from "./types";

// Search Intent Generator
export { generateSearchIntent } from "./search-intent";
export type { GenerateIntentInput } from "./search-intent";

// Brave Search API
export { braveSearch, braveSearchBatch } from "./brave-search";
export type { BraveSearchOptions } from "./brave-search";

// URL Ranking
export { rankURLs } from "./url-ranking";
export type { RankInput } from "./url-ranking";

// Web Retrieval
export { retrieveOne, retrieveBatch } from "./retrieval";
export type { RetrieveOptions } from "./retrieval";

// Source Credibility
export {
  classifySource,
  getCredibilityConfig,
  STAGE_CREDIBILITY,
} from "./source-credibility";

// Search Context Injection
export { formatSearchContext, injectSearchContext } from "./search-context";

// ── 高级编排 ──────────────────────────────────────────

import { generateSearchIntent } from "./search-intent";
import { braveSearch } from "./brave-search";
import { rankURLs } from "./url-ranking";
import { retrieveBatch } from "./retrieval";
import { formatSearchContext } from "./search-context";
import type {
  SearchIntent,
  SearchResult,
  RankedURL,
  RetrievedContent,
  FormattedSearchContext,
} from "./types";

export interface RunSearchInput {
  stage: number;
  brandName: string;
  category: string;
  decisionMemoryContext?: string;
}

export interface RunSearchOutput {
  intent: SearchIntent;
  results: SearchResult[];
  ranked: RankedURL[];
  retrieved: RetrievedContent[];
  formatted: FormattedSearchContext;
}

/**
 * 一键执行完整搜索流程：
 * Intent → Brave Search → URL Ranking → Web Retrieval → Context Formatting
 *
 * 每个步骤独立容错，单步失败不中断后续步骤。
 */
export async function runSearch(input: RunSearchInput): Promise<RunSearchOutput> {
  const { stage, brandName, category, decisionMemoryContext } = input;

  // Step 1: 生成搜索意图
  const intent = await generateSearchIntent({ stage, brandName, category, decisionMemoryContext });

  // Step 2: 执行搜索（每个 query 逐条搜索）
  const allResults: SearchResult[] = [];
  for (const q of intent.queries) {
    const results = await braveSearch(q.keyword);
    allResults.push(...results);
  }

  // 去重（按 URL）
  const seen = new Set<string>();
  const uniqueResults = allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // 更新覆盖维度状态
  const updatedCoverage = intent.coverageDimensions.map((dim) => {
    const hasResults = intent.queries.some(
      (q) => q.dimension === dim.name && allResults.some((r) => r.snippet.length > 0)
    );
    return hasResults
      ? { ...dim, status: "covered" as const, note: "已获取搜索结果" }
      : { ...dim, status: "missing" as const, note: "搜索范围内未找到相关信息" };
  });

  // Step 3: URL Ranking
  const ranked = uniqueResults.length > 0
    ? await rankURLs({
        stage,
        results: uniqueResults,
        brandName,
        category,
        objective: intent.objective,
        topK: 5,
      })
    : [];

  // Step 4: Web Retrieval
  const retrieved = await retrieveBatch(ranked);

  // Step 5: Format Context
  const formatted = formatSearchContext({
    stage,
    searchResults: uniqueResults,
    rankedURLs: ranked,
    retrievedContents: retrieved,
    coverage: updatedCoverage,
    brandName,
    category,
  });

  return { intent, results: uniqueResults, ranked, retrieved, formatted };
}
