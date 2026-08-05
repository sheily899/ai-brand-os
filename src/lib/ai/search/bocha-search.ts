/**
 * 博查 Web Search API 封装
 *
 * 职责：
 * - 调用博查 Web Search API
 * - 返回结构化 SearchResult[]
 * - 无 API Key 时优雅降级
 *
 * 博查 API 文档：https://bocha-ai.feishu.cn/wiki/RXEOw02rFiwzGSkd9mUcqoeAnNK
 */

import type { SearchResult } from "./types";

const BOCHA_API_URL = "https://api.bocha.cn/v1/web-search";

function getApiKey(): string {
  return process.env.BOCHA_API_KEY ?? "";
}

export interface BochaSearchOptions {
  /** 返回结果数量（默认 10，最大 50） */
  count?: number;
  /** 时间范围：noLimit | oneDay | oneWeek | oneMonth | oneYear */
  freshness?: string;
  /** 是否返回文本摘要 */
  summary?: boolean;
}

interface BochaWebResult {
  name: string;
  url: string;
  snippet: string;
  summary?: string;
  siteName?: string;
  siteIcon?: string;
  datePublished?: string;
}

interface BochaSearchResponse {
  code: number;
  msg?: string;
  data?: {
    webPages?: {
      value?: BochaWebResult[];
      totalEstimatedMatches?: number;
    };
  };
}

/**
 * 调用博查 Web Search API
 * 无 API Key 时返回空数组（不抛错，由上层决定是否阻塞流程）
 */
export async function bochaSearch(
  query: string,
  options: BochaSearchOptions = {}
): Promise<SearchResult[]> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn("[bocha-search] BOCHA_API_KEY 未设置，跳过搜索。请在 .env.local 中添加 BOCHA_API_KEY。");
    return [];
  }

  const body = {
    query,
    freshness: options.freshness ?? "noLimit",
    summary: options.summary ?? true,
    count: options.count ?? 10,
  };

  try {
    const response = await fetch(BOCHA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        `[bocha-search] API 错误 (${response.status}): ${errorText.slice(0, 200)}`
      );
      return [];
    }

    const json: BochaSearchResponse = await response.json();
    const results = json.data?.webPages?.value ?? [];

    return results.map((r, i) => ({
      title: r.name ?? "",
      url: r.url ?? "",
      snippet: r.snippet ?? "",
      source: r.siteName ?? new URL(r.url ?? "").hostname,
      position: i + 1,
    }));
  } catch (e: any) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      console.error(`[bocha-search] 请求超时: ${query.slice(0, 60)}`);
    } else {
      console.error(`[bocha-search] 网络错误: ${e.message}`);
    }
    return [];
  }
}

/**
 * 批量搜索 — 逐个执行避免触发 API 限流
 * 每个查询独立容错，单个失败不影响其他
 */
export async function bochaSearchBatch(
  queries: string[],
  options: BochaSearchOptions = {}
): Promise<Map<string, SearchResult[]>> {
  const results = new Map<string, SearchResult[]>();

  for (const query of queries) {
    const result = await bochaSearch(query, options);
    results.set(query, result);
  }

  return results;
}
