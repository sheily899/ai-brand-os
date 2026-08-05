/**
 * Search Intent Generator
 *
 * 职责：
 * - 根据阶段+品牌+品类+Decision Memory Context 生成搜索意图
 * - 读取 shared-search-protocol.md 获取覆盖维度定义
 * - 使用 AI 生成结构化搜索关键词
 * - 为权威来源自动注入 site: 直达搜索，避免转载站中介
 *
 * 搜索规则完全读取 shared-search-protocol.md，代码中不重复维护覆盖矩阵。
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { getLLMProvider } from "@/lib/ai/provider";
import type { SearchIntent, CoverageDimension } from "./types";

const PROTOCOL_PATH = resolve(process.cwd(), "reference/shared-search-protocol.md");

// ── 权威来源域名映射 ──────────────────────────────────

/**
 * 将 shared-search-protocol.md 中定义的优先搜索来源映射到域名。
 * 用于生成 site: 直达搜索，确保数据来自原始权威源而非转载站。
 *
 * 映射规则：
 * - 优先使用官方主域名
 * - 对于无独立域名的平台（如"小红书聚光平台"），映射到平台主站
 * - 对于品牌官网等非固定域名（如"品牌官网"），不在此映射
 */
export const AUTHORITATIVE_DOMAINS: Record<string, string> = {
  "艾瑞咨询": "iresearch.cn",
  "CBNData": "cbndata.com",
  "CBNData第一财经商业数据中心": "cbndata.com",
  "国家统计局": "stats.gov.cn",
  "QuestMobile": "questmobile.com",
  "36氪": "36kr.com",
  "亿欧网": "iyiou.com",
  "中商产业研究院": "askci.com",
  "前瞻产业研究院": "qianzhan.com",
  "百度指数": "index.baidu.com",
  "小红书": "xiaohongshu.com",
  "小红书聚光平台": "xiaohongshu.com",
  "数英DIGITALING": "digitaling.com",
  "SocialBeta": "socialbeta.com",
  "巨量引擎": "oceanengine.com",
  "微信公众平台": "mp.weixin.qq.com",
  "B站营销中心": "bilibili.com",
  "知乎": "zhihu.com",
  "天猫": "tmall.com",
  "京东": "jd.com",
  "Google Trends": "trends.google.com",
};

/** 已知域名 → 权威源名称的反向映射 */
function matchAuthorityFromURL(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    for (const [name, domain] of Object.entries(AUTHORITATIVE_DOMAINS)) {
      if (hostname === domain || hostname.endsWith("." + domain)) {
        return name;
      }
    }
  } catch {
    // URL 无效，忽略
  }
  return undefined;
}

/** 判断域名是否匹配权威源 */
export function isAuthoritativeDomain(url: string, authorityName: string): boolean {
  const expectedDomain = AUTHORITATIVE_DOMAINS[authorityName];
  if (!expectedDomain) return false;
  try {
    const hostname = new URL(url).hostname;
    return hostname === expectedDomain || hostname.endsWith("." + expectedDomain);
  } catch {
    return false;
  }
}

// ── Protocol 文件读取 ──────────────────────────────────

let _protocolCache: string | null = null;

/** 读取共享搜索协议全文（缓存） */
function loadProtocol(): string {
  if (!_protocolCache) {
    try {
      _protocolCache = readFileSync(PROTOCOL_PATH, "utf8");
    } catch {
      console.error("[search-intent] 无法加载 shared-search-protocol.md");
      _protocolCache = "";
    }
  }
  return _protocolCache;
}

/** 提取指定阶段的覆盖矩阵部分 */
function extractStageSection(stage: number): string {
  const protocol = loadProtocol();
  if (!protocol) return "";

  // 按阶段编号匹配对应 section
  const stageNames: Record<number, string> = {
    2: "Stage 2 商业背景分析",
    3: "Stage 3 市场机会分析",
    5: "Stage 5 竞争判断",
    8: "Stage 8 内容规划",
  };

  const heading = stageNames[stage];
  if (!heading) return "";

  // 提取该阶段的覆盖矩阵段落（## 二 下的 ### Stage N 部分）
  const sectionStart = protocol.indexOf(heading);
  if (sectionStart === -1) return "";

  // 查找下一个同级 ### 作为结束标记
  const remaining = protocol.slice(sectionStart + heading.length);
  const nextSectionMatch = remaining.match(/\n###\s/);
  const sectionEnd = nextSectionMatch
    ? sectionStart + heading.length + nextSectionMatch.index!
    : protocol.length;

  return protocol.slice(sectionStart, sectionEnd);
}

// ── AI 搜索意图生成 ───────────────────────────────────

export interface GenerateIntentInput {
  stage: number;
  brandName: string;
  category: string;
  /** Decision Memory Context（前序阶段已确认资产） */
  decisionMemoryContext?: string;
}

/**
 * 使用 AI 根据阶段覆盖矩阵 + 品牌上下文生成搜索意图
 */
export async function generateSearchIntent(
  input: GenerateIntentInput
): Promise<SearchIntent> {
  const { stage, brandName, category, decisionMemoryContext } = input;

  const stageSection = extractStageSection(stage);

  // 构建权威源域名提示（仅包含当前阶段相关的来源）
  const relevantDomains: string[] = [];
  for (const [name, domain] of Object.entries(AUTHORITATIVE_DOMAINS)) {
    if (stageSection.includes(name)) {
      relevantDomains.push(`  - ${name} → ${domain}`);
    }
  }

  // 构建 AI prompt
  const systemPrompt = `你是一个搜索策略专家。你的任务是根据给定的品牌信息和阶段要求，生成结构化的搜索计划。

## 当前阶段覆盖矩阵

以下定义了本阶段必须覆盖的搜索维度。你需要为每个维度生成具体的搜索关键词。

${stageSection || "(搜索协议未加载，请根据常识生成搜索关键词)"}

## 品牌上下文

- 品牌名称：${brandName}
- 品类方向：${category}
${decisionMemoryContext ? `\n### 前序阶段已确认信息\n${decisionMemoryContext}` : ""}

## 权威来源域名速查

以下域名对应搜索协议中的优先来源。生成 site: 查询时使用这些域名：

${relevantDomains.length > 0 ? relevantDomains.join("\n") : "(无特定权威源域名映射，使用通用搜索即可)"}

## 输出要求

严格输出 JSON 对象：

\`\`\`json
{
  "objective": "一句话描述本次搜索的战略目标",
  "queries": [
    {
      "keyword": "具体搜索关键词（包含品牌/品类名以缩小范围）",
      "dimension": "对应覆盖矩阵中的维度名称",
      "preferredSources": ["优先搜索的第一个来源", "第二个"]
    }
  ],
  "coverageDimensions": [
    {
      "name": "维度名（对齐覆盖矩阵）",
      "status": "not_searched"
    }
  ]
}
\`\`\`

规则：
1. 覆盖矩阵中列出的每个"必须覆盖维度"都要在 coverageDimensions 中对应一项
2. 每个维度至少生成 1 个搜索查询（queries），其中至少 1 条使用 site: 语法直达权威源
3. 关键词应包含品类名 + 搜索目的 + 年份（优先 2025，其次 2024）
4. preferredSources 从搜索协议第一节"优先搜索来源"中选择
5. queries 数量：4-7 条（覆盖核心维度即可，site: 查询优先但不超过 3 条）
6. site: 直达查询格式：\`site:域名 品类 关键词\`，如 \`site:iresearch.cn 咖啡 行业报告 2025\`
7. 只有当域名在上方"权威来源域名速查"表中时，才使用 site: 语法
8. 优先搜索当前年份（2025-2026），如无结果再放宽到 2024
9. 只输出 JSON，不要任何解释文字`;

  try {
    const provider = getLLMProvider();
    const response = await provider.chat(
      [{ role: "user", content: systemPrompt }],
      { temperature: 0.3, maxTokens: 2048, responseFormat: "json_object" }
    );

    const parsed = JSON.parse(response);
    let queries = (parsed.queries ?? []) as Array<{
      keyword: string;
      dimension: string;
      preferredSources: string[];
    }>;

    // ── 后处理：确保每个有域名映射的 preferredSource 都有 site: 查询 ──
    queries = ensureSiteQueries(queries, brandName, category);

    return {
      stage,
      objective: parsed.objective ?? `Stage ${stage} 搜索`,
      queries,
      coverageDimensions: parsed.coverageDimensions ?? [],
    };
  } catch (e: any) {
    console.error(`[search-intent] AI 生成失败: ${e.message}`);

    // 回退：从协议中提取基础维度名作为降级方案
    const fallbackDimensions = extractDimensionNames(stage);
    return {
      stage,
      objective: `Stage ${stage} 市场信息搜索`,
      queries: fallbackDimensions.map((d) => ({
        keyword: `${brandName} ${category} ${d}`,
        dimension: d,
        preferredSources: [],
      })),
      coverageDimensions: fallbackDimensions.map((d) => ({
        name: d,
        status: "not_searched",
      })),
    };
  }
}

/**
 * 后处理：确保每个有域名映射的 preferredSource 都有对应的 site: 查询。
 *
 * 逻辑：
 * 1. 扫描 AI 生成的所有 queries，收集已覆盖的权威源名称
 * 2. 对每个未被 site: 覆盖的权威源，补充一条 site: 直达查询
 * 3. 避免重复：如果已有同域名的 site: 查询，不再追加
 */
function ensureSiteQueries(
  queries: Array<{ keyword: string; dimension: string; preferredSources: string[] }>,
  brandName: string,
  category: string
): Array<{ keyword: string; dimension: string; preferredSources: string[] }> {
  const result = [...queries];

  // 收集已有的 site: 查询覆盖的域名
  const coveredDomains = new Set<string>();
  for (const q of result) {
    const siteMatch = q.keyword.match(/^site:(\S+)\s/);
    if (siteMatch) {
      coveredDomains.add(siteMatch[1]);
    }
  }

  // 收集所有 preferredSources 中提到的权威源
  const mentionedAuthorities = new Set<string>();
  for (const q of result) {
    for (const src of q.preferredSources) {
      if (AUTHORITATIVE_DOMAINS[src]) {
        mentionedAuthorities.add(src);
      }
    }
  }

  // 对未被 site: 覆盖的权威源，补充一条 site: 查询（最多补充 3 条，控制总查询量）
  const MAX_SITE_QUERIES = 3;
  let addedSiteQueries = 0;

  for (const authority of mentionedAuthorities) {
    if (addedSiteQueries >= MAX_SITE_QUERIES) break;
    const domain = AUTHORITATIVE_DOMAINS[authority];
    if (!domain || coveredDomains.has(domain)) continue;

    // 找到引用此来源的维度
    const parentQuery = result.find((q) =>
      q.preferredSources.includes(authority)
    );
    const dimension = parentQuery?.dimension ?? "行业数据";

    result.push({
      keyword: `site:${domain} ${category} ${brandName}`,
      dimension,
      preferredSources: [authority],
    });
    coveredDomains.add(domain);
    addedSiteQueries++;
  }

  return result;
}

/**
 * 降级方案：从协议文本中简单提取维度名称
 * 仅在 AI 调用失败时使用
 */
function extractDimensionNames(stage: number): string[] {
  const section = extractStageSection(stage);
  if (!section) return [];

  // 匹配表格中的维度名称（第一列）
  const dimensionMatch = section.match(/\|\s*(.+?)\s*\|/g);
  if (!dimensionMatch) return [];

  const dimensions: string[] = [];
  let inTable = false;
  for (const line of section.split("\n")) {
    if (line.includes("必须覆盖维度")) {
      inTable = true;
      continue;
    }
    if (inTable && line.startsWith("|") && !line.includes("---") && !line.includes("搜索关键词")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 1 && cells[0].length < 30) {
        dimensions.push(cells[0]);
      }
    }
    if (inTable && line.trim() === "") break;
  }

  return dimensions.length > 0 ? dimensions : ["市场规模", "增长趋势", "竞争格局"];
}
