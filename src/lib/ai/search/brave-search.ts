/**
 * Brave Search API 封装
 *
 * 职责：
 * - 调用 Brave Search API
 * - 返回结构化 SearchResult[]
 * - 无 API Key 时优雅降级
 *
 * Brave Search API docs: https://api.search.brave.com/app/documentation/web-search
 */

import type { SearchResult } from "./types";

const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search";

function getApiKey(): string {
  return process.env.BRAVE_API_KEY ?? "";
}

export interface BraveSearchOptions {
  /** 每页结果数（默认 10，最大 20） */
  count?: number;
  /** 结果偏移 */
  offset?: number;
  /** 国家代码（默认 "CN"） */
  country?: string;
  /** 安全搜索：off | moderate | strict */
  safesearch?: "off" | "moderate" | "strict";
}

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  profile?: { name: string };
  meta_url?: { hostname: string };
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

/**
 * 调用 Brave Search API
 * 无 API Key 时返回空数组（不抛错，由上层决定是否阻塞流程）
 */
export async function braveSearch(
  query: string,
  options: BraveSearchOptions = {}
): Promise<SearchResult[]> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn("[brave-search] BRAVE_API_KEY 未设置，跳过搜索。请在 .env.local 中添加 BRAVE_API_KEY。");
    return [];
  }

  const params = new URLSearchParams({
    q: query,
    count: String(options.count ?? 10),
    offset: String(options.offset ?? 0),
    country: options.country ?? "CN",
    safesearch: options.safesearch ?? "moderate",
  });

  try {
    const response = await fetch(`${BRAVE_API_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[brave-search] API 错误 (${response.status}): ${errorText.slice(0, 200)}`
      );
      return [];
    }

    const data: BraveSearchResponse = await response.json();
    const results = data.web?.results ?? [];

    return results.map((r, i) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      snippet: r.description ?? "",
      source: r.meta_url?.hostname ?? r.profile?.name ?? new URL(r.url ?? "").hostname,
      position: i + 1,
    }));
  } catch (e: any) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      console.error(`[brave-search] 请求超时: ${query.slice(0, 60)}`);
    } else {
      console.error(`[brave-search] 网络错误: ${e.message}`);
    }
    return [];
  }
}

/**
 * 批量搜索 — 并发执行多个查询
 * 每个查询独立容错，单个失败不影响其他
 */
export async function braveSearchBatch(
  queries: string[],
  options: BraveSearchOptions = {}
): Promise<Map<string, SearchResult[]>> {
  const results = new Map<string, SearchResult[]>();

  // 逐个执行避免触发 API 限流
  for (const query of queries) {
    const result = await braveSearch(query, options);
    results.set(query, result);
  }

  return results;
}
