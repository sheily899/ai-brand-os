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

// 博查 Web Search API
export { bochaSearch, bochaSearchBatch } from "./bocha-search";
export type { BochaSearchOptions } from "./bocha-search";

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

import { generateSearchIntent, isAuthoritativeDomain } from "./search-intent";
import { bochaSearch } from "./bocha-search";
import { rankURLs } from "./url-ranking";
import { retrieveBatch } from "./retrieval";
import { formatSearchContext } from "./search-context";
import { AUTHORITATIVE_DOMAINS } from "./search-intent";
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
 * Intent → 博查 Search → URL Ranking → Web Retrieval → Context Formatting
 *
 * 每个步骤独立容错，单步失败不中断后续步骤。
 */
export async function runSearch(input: RunSearchInput): Promise<RunSearchOutput> {
  const { stage, brandName, category, decisionMemoryContext } = input;

  // Step 1: 生成搜索意图
  const intent = await generateSearchIntent({ stage, brandName, category, decisionMemoryContext });

  // Step 2: 执行搜索（site: 直达查询优先，通用查询兜底）
  const allResults: SearchResult[] = [];
  const isSiteQuery = (kw: string) => kw.startsWith("site:");
  const parseSiteDomain = (kw: string) => kw.match(/^site:(\S+)/)?.[1];

  // 查询间延迟（避免触发 API 限流，博查默认 QPS 较低）
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // 2a: 先执行 site: 直达查询（权威源优先）
  const siteQueries = intent.queries.filter((q) => isSiteQuery(q.keyword));
  const generalQueries = intent.queries.filter((q) => !isSiteQuery(q.keyword));

  for (const q of siteQueries) {
    const domain = parseSiteDomain(q.keyword);
    const cleanQuery = q.keyword.replace(/^site:\S+\s+/, "");
    const results = await bochaSearch(cleanQuery);
    // 标注 sourceMatch：匹配域名的是 direct，否则是 reprint
    for (const r of results) {
      if (domain && isAuthoritativeDomain(r.url, q.preferredSources[0] ?? "")) {
        r.sourceMatch = "direct";
        r.matchedAuthority = q.preferredSources[0];
      } else {
        r.sourceMatch = "reprint";
      }
    }
    allResults.push(...results);
    await delay(300); // 300ms 间隔避免触发限流
  }

  // 2b: 再执行通用查询（site: 未覆盖的维度）
  for (const q of generalQueries) {
    const results = await bochaSearch(q.keyword);
    // 对通用查询结果也检查是否命中权威源域名
    for (const r of results) {
      for (const [name, domain] of Object.entries(AUTHORITATIVE_DOMAINS)) {
        if (isAuthoritativeDomain(r.url, name)) {
          r.sourceMatch = "direct";
          r.matchedAuthority = name;
          break;
        }
      }
      if (!r.sourceMatch) {
        r.sourceMatch = "reprint";
      }
    }
    allResults.push(...results);
    await delay(300); // 300ms 间隔避免触发限流
  }

  // 去重（按 URL），保留 sourceMatch="direct" 的版本优先
  const seen = new Set<string>();
  const directResults = allResults.filter((r) => r.sourceMatch === "direct");
  const reprintResults = allResults.filter((r) => r.sourceMatch !== "direct");
  const uniqueResults: SearchResult[] = [];

  for (const r of directResults) {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      uniqueResults.push(r);
    }
  }
  for (const r of reprintResults) {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      uniqueResults.push(r);
    }
  }

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
