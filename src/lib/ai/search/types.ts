/**
 * Search Intelligence Layer — 共享类型定义
 *
 * 被 search-intent / brave-search / url-ranking / retrieval /
 * source-credibility / search-context 共同使用。
 */

// ── 搜索意图 ──────────────────────────────────────────

export interface SearchIntent {
  /** 搜索阶段 */
  stage: number;
  /** 生成的搜索查询列表 */
  queries: SearchQuery[];
  /** 本阶段必须覆盖的维度（从 shared-search-protocol.md 解析） */
  coverageDimensions: CoverageDimension[];
  /** 搜索目标说明 */
  objective: string;
}

export interface SearchQuery {
  /** 搜索关键词 */
  keyword: string;
  /** 搜索目的（对应覆盖矩阵中哪个维度） */
  dimension: string;
  /** 优先搜索来源（按优先级排序） */
  preferredSources: string[];
}

/** 覆盖维度状态 */
export type CoverageStatus = "covered" | "missing" | "not_searched";

export interface CoverageDimension {
  name: string;
  status: CoverageStatus;
  note?: string;
}

// ── 搜索结果 ──────────────────────────────────────────

export interface SearchResult {
  /** 结果标题 */
  title: string;
  /** 目标 URL */
  url: string;
  /** 搜索摘要（来自搜索引擎） */
  snippet: string;
  /** 来源域名（如 "36kr.com"） */
  source: string;
  /** 排名位置（1-based，搜索引擎返回顺序） */
  position: number;
}

export interface RankedURL {
  url: string;
  title: string;
  snippet: string;
  source: string;
  /** AI 评分：权威性（0-10） */
  authorityScore: number;
  /** AI 评分：内容相关度（0-10） */
  relevanceScore: number;
  /** AI 评分：数据密度（0-10） */
  dataDensityScore: number;
  /** 综合分 */
  compositeScore: number;
  /** 排名理由 */
  rationale: string;
}

// ── Web Retrieval ─────────────────────────────────────

export type RetrievalSourceType = "fulltext" | "snippet";

export interface RetrievedContent {
  /** 抓取的 URL */
  url: string;
  /** 页面标题 */
  title: string;
  /** 正文内容（Markdown 格式 或 纯文本） */
  content: string;
  /** 来源类型：全文抓取 或 摘要兜底 */
  sourceType: RetrievalSourceType;
  /** 抓取失败原因（仅 sourceType=snippet 时） */
  fallbackReason?: string;
  /** 引用来源标注 */
  source: string;
}

// ── Source Credibility ───────────────────────────────

export type TrustLevel = "high" | "medium" | "low";

export interface SourceConfig {
  /** 域名匹配规则（支持 substring 匹配） */
  domainPatterns: string[];
  /** 信任级别 */
  trustLevel: TrustLevel;
  /** 来源类别名称 */
  category: string;
}

export interface StageCredibilityConfig {
  stage: number;
  sources: SourceConfig[];
}

// ── Search Context ────────────────────────────────────

export interface SearchContextInput {
  stage: number;
  /** 原始搜索结果 */
  searchResults: SearchResult[];
  /** 排名后的 URL */
  rankedURLs: RankedURL[];
  /** 抓取的内容 */
  retrievedContents: RetrievedContent[];
  /** 覆盖维度检查结果 */
  coverage: CoverageDimension[];
  /** 品牌信息 */
  brandName: string;
  category: string;
}

export interface FormattedSearchContext {
  /** 注入 Consultation system prompt 的文本 */
  contextText: string;
  /** 搜索覆盖报告（用于 AI 开场白） */
  coverageReport: string;
  /** dataSources 对象（用于阶段 JSON） */
  dataSources: Array<{
    url: string;
    title: string;
    type: "full_text" | "snippet";
    summary: string;
  }>;
}
