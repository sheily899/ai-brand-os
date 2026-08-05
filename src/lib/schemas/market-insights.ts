import { z } from "zod";

// ── Stage 3: MarketInsights ────────────────────────────

/**
 * S3 市场机会分析输出 Schema
 *
 * 两层结构：
 * 1. 搜索数据层 — 从 Search Intelligence Layer 搜索结果中提取的客观数据
 * 2. AI 分析层   — AI 基于对话 + 搜索数据进行的分析判断
 *
 * 对应 Stage 3 Convergence Prompt 的 JSON Schema
 */

// ── 搜索数据层 ──────────────────────────────────────────

export const marketOverviewSchema = z.object({
  /** 市场规模描述（含数据来源），未搜到标注"搜索范围内未找到" */
  marketSize: z.string().min(4, "marketSize 至少 4 个字"),
  /** 近3年增速描述（含趋势方向），未搜到标注"搜索范围内未找到" */
  growthRate: z.string().min(4, "growthRate 至少 4 个字"),
  /** 赛道发展阶段判断 */
  marketStage: z.enum(["萌芽期", "增长期", "成熟期", "红海衰退期", "信息不足"]),
  /**
   * 渠道结构描述
   * 无下游依赖，放宽为 optional — 搜索未覆盖时不阻塞校验
   */
  channelStructure: z.array(z.string()).optional(),
});

export const industryTrendSchema = z.object({
  /** 当前流行趋势 */
  currentTrends: z.array(z.string()).min(1, "currentTrends 至少 1 条"),
  /** 长期演变趋势（可为空） */
  longTermTrends: z.array(z.string()),
});

export const channelAnalysisSchema = z.object({
  /** 主流售卖渠道及特征 */
  mainChannels: z.array(z.string()),
  /**
   * 流量获取方式、平台规则要点
   * 无下游依赖，放宽为 optional — 搜索未覆盖时不阻塞校验
   */
  trafficRules: z.array(z.string()).optional(),
  /**
   * 同赛道新品牌起盘路径案例
   * 无下游依赖，放宽为 optional — 搜索未覆盖时不阻塞校验
   */
  acquisitionPatterns: z.array(z.string()).optional(),
});

export const regulatoryEnvironmentSchema = z.object({
  /** 行业监管要求、准入限制 */
  policies: z.array(z.string()).min(1, "policies 至少 1 条，未搜到填'搜索范围内未找到相关政策信息'"),
  /**
   * 合规红线、政策风险点
   * 无下游依赖，放宽为 optional — 未搜到时可不填
   */
  risks: z.array(z.string()).optional(),
});

/** dataSources 单条记录 */
export const dataSourceEntrySchema = z.object({
  url: z.string(),
  title: z.string(),
  type: z.enum(["full_text", "snippet"]),
  summary: z.string(),
});

// ── AI 分析层 ──────────────────────────────────────────

export const categoryStatusSchema = z.object({
  /** 品类明确定义与边界描述 */
  definition: z.string().min(10, "categoryStatus.definition 至少 10 个字"),
  /** 供给格局特征描述（不列具体竞品名称） */
  currentState: z.string().min(10, "categoryStatus.currentState 至少 10 个字"),
  /** 趋势变化，2-5 条 */
  trends: z
    .array(z.string())
    .min(2, "categoryStatus.trends 至少 2 条")
    .max(5, "categoryStatus.trends 最多 5 条"),
});

export const experienceGapSchema = z.object({
  /** 具体的供需错配点 */
  gap: z.string().min(8, "gap 至少 8 个字"),
  /** 用户当前的替代或变通解决方案 */
  currentAlternative: z.string().min(4, "currentAlternative 至少 4 个字"),
  /**
   * 严重程度
   * 无下游依赖，放宽为 optional — AI 无法判断时默认 major
   */
  severity: z.enum(["critical", "major", "minor"]).optional().default("major"),
});

export const opportunityDirectionSchema = z.object({
  /** 可选择占据的差异化空间 */
  direction: z.string().min(8, "direction 至少 8 个字"),
  /** 战略判断依据 */
  rationale: z.string().min(8, "rationale 至少 8 个字"),
  /** 证据可信度 */
  evidenceLevel: z.enum(["verified", "inferred", "hypothesis"]),
});

// ── 拆分 Schema（S3 拆分收敛用）────────────────────────

/** Convergence A 输出：搜索数据层 */
export const marketInsightsSearchDataSchema = z.object({
  marketOverview: marketOverviewSchema,
  industryTrend: industryTrendSchema,
  channelAnalysis: channelAnalysisSchema,
  regulatoryEnvironment: regulatoryEnvironmentSchema,
  dataSources: z.array(dataSourceEntrySchema).min(1, "dataSources 至少 1 条"),
});

/** Convergence B 输出：AI 分析层 */
export const marketInsightsAnalysisSchema = z.object({
  categoryStatus: categoryStatusSchema,
  experienceGaps: z.array(experienceGapSchema).min(2, "experienceGaps 至少 2 个"),
  opportunityDirections: z
    .array(opportunityDirectionSchema)
    .min(1, "opportunityDirections 至少 1 个"),
});

// ── 组合 Schema ────────────────────────────────────────

export const marketInsightsSchema = z.object({
  // 搜索数据层
  marketOverview: marketOverviewSchema,
  industryTrend: industryTrendSchema,
  channelAnalysis: channelAnalysisSchema,
  regulatoryEnvironment: regulatoryEnvironmentSchema,
  dataSources: z.array(dataSourceEntrySchema).min(1, "dataSources 至少 1 条"),

  // AI 分析层
  categoryStatus: categoryStatusSchema,
  experienceGaps: z.array(experienceGapSchema).min(2, "experienceGaps 至少 2 个"),
  opportunityDirections: z
    .array(opportunityDirectionSchema)
    .min(1, "opportunityDirections 至少 1 个"),

  /**
   * AI 顾问确认总结的原文段落，按 section 名存储。
   * 供报告直接引用，保留精炼的叙述性语言。
   * 预期 key：品类现状 / 当前体验不足 / 品牌机会方向
   */
  sectionSummaries: z.record(z.string(), z.string()).optional(),
});

export type MarketInsights = z.infer<typeof marketInsightsSchema>;
export type MarketOverview = z.infer<typeof marketOverviewSchema>;
export type IndustryTrend = z.infer<typeof industryTrendSchema>;
export type ChannelAnalysis = z.infer<typeof channelAnalysisSchema>;
export type RegulatoryEnvironment = z.infer<typeof regulatoryEnvironmentSchema>;
export type CategoryStatus = z.infer<typeof categoryStatusSchema>;
export type ExperienceGap = z.infer<typeof experienceGapSchema>;
export type OpportunityDirection = z.infer<typeof opportunityDirectionSchema>;
