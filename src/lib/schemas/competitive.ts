import { z } from "zod";

// ── Stage 5: CompetitiveInsights ───────────────────────

/**
 * S5 竞争判断输出 Schema
 *
 * 对应 Stage 5 Convergence Prompt 的 JSON Schema。
 * S5 复用 Search Intelligence Layer（覆盖矩阵 8 维度）。
 *
 * 竞品卡片包含 13 个字段，每个竞品含用户好评/差评原文摘录。
 * competitiveGap.marketOpportunity 可追溯到具体竞品差评原文或产品缺口。
 * competitiveGap 供 S6 强制引用。
 */

// ── 竞争格局维度 ───────────────────────────────────────

export const competitionDimensionSchema = z.object({
  /** 竞争类型名称 */
  type: z.string().min(2, "dimension.type 至少 2 个字"),
  /** 代表品牌列表（可选） */
  representativeBrands: z.array(z.string()).optional(),
  /** 该类型品牌的核心打法描述 */
  coreStrategy: z.string().min(4, "dimension.coreStrategy 至少 4 个字"),
  /** 该类型品牌满足的消费者需求 */
  consumerNeed: z.string().min(4, "dimension.consumerNeed 至少 4 个字"),
});

export const competitiveLandscapeSchema = z.object({
  /** 竞争方向维度，至少 2 个 */
  dimensions: z
    .array(competitionDimensionSchema)
    .min(2, "competitiveLandscape.dimensions 至少 2 个"),
  /** 品类趋同点与本品牌的分化点描述 */
  convergenceAndDivergence: z
    .string()
    .min(10, "convergenceAndDivergence 至少 10 个字"),
});

// ── 竞品视觉体系 ───────────────────────────────────────

export const visualSystemSchema = z.object({
  /** Logo 特征描述，信息不足时标注"信息不足" */
  logo: z.string().default("信息不足"),
  /** 色彩体系描述 */
  color: z.string().default("信息不足"),
  /** 字体风格描述 */
  typography: z.string().default("信息不足"),
  /** 包装风格描述 */
  packaging: z.string().default("信息不足"),
});

// ── 竞品传播分析 ───────────────────────────────────────

export const userFeedbackSchema = z.object({
  /** 好评/差评主题总结 */
  theme: z.string().min(1, "theme 不能为空"),
  /** 用户原文摘录 */
  excerpt: z.string().min(10, "excerpt 至少 10 个字（保留用户原文）"),
});

export const communicationSchema = z.object({
  /** 主要传播平台 */
  platforms: z.array(z.string()),
  /** 内容方向与营销话术特征 */
  contentDirection: z.array(z.string()),
  /** 用户好评（至少 2 条，含原文摘录） */
  userPraise: z.array(userFeedbackSchema).min(2, "userPraise 至少 2 条"),
  /** 用户差评（至少 2 条，含原文摘录） */
  userComplaints: z.array(userFeedbackSchema).min(2, "userComplaints 至少 2 条"),
});

// ── 竞品来源 ───────────────────────────────────────────

export const competitorSourceSchema = z.object({
  url: z.string(),
  title: z.string(),
  type: z.enum(["full_text", "snippet"]),
});

// ── 竞品明星产品 ───────────────────────────────────────

export const heroProductSchema = z.object({
  /** 产品名称 */
  name: z.string().min(1, "产品名称不能为空"),
  /** 差异化卖点 */
  sellingPoint: z.string().min(1, "sellingPoint 不能为空"),
});

// ── 竞品卡片 ───────────────────────────────────────────

export const competitorSchema = z.object({
  /** 品牌名称 */
  name: z.string().min(1, "competitor.name 不能为空"),
  /** 品牌定位（一句话，标注来源） */
  positioning: z.string().min(4, "competitor.positioning 至少 4 个字"),
  /** 品牌 Slogan 或核心主张 */
  slogan: z.string().default(""),
  /** 价格带描述（高端/中端/平价，含具体价格区间） */
  priceRange: z.string().min(2, "competitor.priceRange 至少 2 个字"),
  /** 明星产品列表（至少 1 个） */
  heroProducts: z.array(heroProductSchema).min(1, "heroProducts 至少 1 个"),
  /** 视觉体系特征 */
  visualSystem: visualSystemSchema,
  /** 传播分析 */
  communication: communicationSchema,
  /** 竞品核心优势 */
  strengths: z.array(z.string()).min(1, "strengths 至少 1 条"),
  /**
   * 竞品短板或局限
   * 禁止使用比较级评价词：更好、更差、不如、更高级
   */
  weaknesses: z.array(z.string()).min(1, "weaknesses 至少 1 条"),
  /**
   * 该竞品没有覆盖的需求或场景
   * 这是竞品卡片最重要的字段 — 直接为 S6 的差异化方向提供输入
   */
  opportunityGap: z.string().min(8, "opportunityGap 至少 8 个字"),
  /** 信息来源 */
  sources: z.array(competitorSourceSchema).min(1, "sources 至少 1 个"),
});

// ── 竞争空位 ───────────────────────────────────────────

export const competitiveGapSchema = z.object({
  /** 跨竞品共同未满足的消费者需求 */
  unmetNeeds: z.array(z.string()).min(1, "unmetNeeds 至少 1 条"),
  /**
   * 基于竞品空位分析的市场机会总结
   * 现有格局给了什么但没给什么、消费者还需要什么、本品牌可能在哪里填补
   * 可追溯到具体竞品差评原文或产品缺口
   */
  marketOpportunity: z.string().min(10, "marketOpportunity 至少 10 个字"),
});

// ── dataSources 单条 ───────────────────────────────────

export const dataSourceSchema = z.object({
  url: z.string(),
  title: z.string(),
  type: z.enum(["full_text", "snippet"]),
  summary: z.string(),
});

// ── 组合 Schema ────────────────────────────────────────

export const competitiveInsightsSchema = z.object({
  competitiveLandscape: competitiveLandscapeSchema,
  competitors: z.array(competitorSchema).min(1, "competitors 至少 1 个（建议 3+）"),
  competitiveGap: competitiveGapSchema,
  dataSources: z.array(dataSourceSchema).min(1, "dataSources 至少 1 条"),
  /**
   * AI 顾问确认总结的原文段落，按 section 名存储。
   * 供报告直接引用，保留精炼的叙述性语言。
   * 预期 key：竞争方向 / 竞品分析
   */
  sectionSummaries: z.record(z.string(), z.string()).optional(),
});

export type CompetitiveInsights = z.infer<typeof competitiveInsightsSchema>;
export type CompetitiveLandscape = z.infer<typeof competitiveLandscapeSchema>;
export type Competitor = z.infer<typeof competitorSchema>;
export type CompetitionDimension = z.infer<typeof competitionDimensionSchema>;
export type VisualSystem = z.infer<typeof visualSystemSchema>;
export type Communication = z.infer<typeof communicationSchema>;
export type UserFeedback = z.infer<typeof userFeedbackSchema>;
export type HeroProduct = z.infer<typeof heroProductSchema>;
