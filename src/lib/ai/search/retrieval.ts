/**
 * Web Retrieval Layer — 三级回退内容抓取
 *
 * 流程：
 * 第一层：Jina Reader（r.jina.ai → Markdown 格式），超时 10s
 * 第二层：fetch + cheerio 提取正文（去导航/广告/脚本）
 * 第三层：搜索摘要兜底（标注"全文抓取不可用，基于摘要判断"）
 *
 * 不创建 Browser Agent，不引入 Puppeteer/Playwright。
 */

import * as cheerio from "cheerio";
import type { RetrievedContent, RankedURL } from "./types";

const JINA_BASE = "https://r.jina.ai";

// ── 第一层：Jina Reader ───────────────────────────────

async function tryJinaReader(url: string): Promise<string | null> {
  try {
    const response = await fetch(`${JINA_BASE}/${url}`, {
      headers: {
        Accept: "text/markdown",
        "User-Agent": "AI-Brand-OS/0.1",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const text = await response.text();
    // Jina 可能返回空内容
    if (!text || text.trim().length < 50) return null;

    return text;
  } catch {
    return null;
  }
}

// ── 第二层：fetch + cheerio ───────────────────────────

async function tryFetchCheerio(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // 去除干扰元素
    $("script, style, nav, footer, header, aside, iframe, noscript, .sidebar, .ad, .advertisement, .nav, .menu, .footer, .header").remove();

    // 提取正文：优先 <article> → <main> → <body>
    const contentSelectors = ["article", "main", ".content", ".article", ".post", "#content", "#article"];
    let bodyText = "";

    for (const sel of contentSelectors) {
      const el = $(sel);
      if (el.length > 0) {
        bodyText = el.text();
        break;
      }
    }

    if (!bodyText) {
      bodyText = $("body").text();
    }

    // 清理空白
    bodyText = bodyText
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (bodyText.length < 100) return null;

    // 截断过长内容（保留前 8000 字符）
    return bodyText.length > 8000 ? bodyText.slice(0, 8000) + "\n\n...(内容已截断)" : bodyText;
  } catch {
    return null;
  }
}

// ── 第三层：搜索摘要兜底 ──────────────────────────────

function snippetFallback(url: string, title: string, snippet: string): string {
  return `⚠️ 全文抓取不可用，以下内容基于搜索摘要判断。

来源: ${url}
标题: ${title}

摘要: ${snippet}`;
}

// ── 公开接口 ──────────────────────────────────────────

export interface RetrieveOptions {
  /** 最大并发数 */
  concurrency?: number;
}

/**
 * 抓取单个 URL 内容
 * 自动走三级回退：Jina → cheerio → snippet
 */
export async function retrieveOne(
  url: string,
  title: string,
  snippet: string
): Promise<RetrievedContent> {
  const hostname = safeHostname(url);

  // L1: Jina Reader
  const jinaContent = await tryJinaReader(url);
  if (jinaContent) {
    return {
      url,
      title,
      content: jinaContent,
      sourceType: "fulltext",
      source: hostname,
    };
  }

  // L2: fetch + cheerio
  const cheerioContent = await tryFetchCheerio(url);
  if (cheerioContent) {
    return {
      url,
      title,
      content: cheerioContent,
      sourceType: "fulltext",
      source: hostname,
    };
  }

  // L3: snippet 兜底
  return {
    url,
    title,
    content: snippetFallback(url, title, snippet),
    sourceType: "snippet",
    fallbackReason: "Jina Reader 和 fetch+cheerio 均无法获取全文，使用搜索摘要",
    source: hostname,
  };
}

/**
 * 批量抓取 Top RankedURLs
 * 串行执行避免触发反爬
 */
export async function retrieveBatch(
  ranked: RankedURL[],
  _options: RetrieveOptions = {}
): Promise<RetrievedContent[]> {
  const results: RetrievedContent[] = [];

  for (const r of ranked) {
    const content = await retrieveOne(r.url, r.title, r.snippet);
    results.push(content);
  }

  return results;
}

// ── 工具函数 ──────────────────────────────────────────

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
