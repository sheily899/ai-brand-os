import { z } from "zod";

// ── Stage 6: BrandStrategy ─────────────────────────────

/**
 * S6 品牌核心战略输出 Schema（战略枢纽）
 *
 * 对应 Stage 6 Convergence Prompt 的 JSON Schema。
 * S6 不依赖搜索，但依赖 S3/S4/S5 的完整输出。
 *
 * reasoning 字段显式记录对前序阶段的引用关系：
 * - marketOpportunityReference → S3 MarketInsights
 * - consumerInsightReference   → S4 ConsumerInsight
 * - competitiveGapReference    → S5 CompetitiveInsights
 *
 * reasoning 不存入 Decision Memory（仅用于 Cross Stage Check）。
 */

// ── 价值主张 ───────────────────────────────────────────

export const valuePropositionLevelEnum = z.enum([
  "functional",
  "emotional",
  "social",
]);

export const valuePropositionSchema = z.object({
  /** 价值主张，10-15字，不含推导过程 */
  proposition: z.string().min(8, "proposition 至少 8 个字"),
  /** 价值层级 */
  level: valuePropositionLevelEnum,
  /** 两层 So What 推导逻辑 */
  soWhatDerivation: z.string().min(10, "soWhatDerivation 至少 10 个字"),
});

// ── 品牌故事 ───────────────────────────────────────────

export const brandStorySchema = z.object({
  /** 消费者面临的困境 */
  struggleMoment: z.string().min(10, "struggleMoment 至少 10 个字"),
  /** 品牌的战略行动 */
  brandAction: z.string().min(10, "brandAction 至少 10 个字"),
  /** 品牌与消费者建立的互动关系（推断性） */
  brandRelationship: z.string().min(10, "brandRelationship 至少 10 个字"),
});

// ── 品牌人格 ───────────────────────────────────────────

export const brandPersonalityTraitSchema = z.object({
  /** 人格关键词（Aaker 五维框架或平实中文人格词） */
  trait: z.string().min(1, "trait 不能为空"),
  /** 会如何行动与沟通 */
  dos: z.string().min(4, "dos 至少 4 个字"),
  /** 绝不如何行动与表达 */
  donts: z.string().min(4, "donts 至少 4 个字"),
});

// ── 引用追溯 ───────────────────────────────────────────

export const reasoningSchema = z.object({
  /**
   * 对 S3 MarketInsights 的引用
   * 格式：「引用自 S3 [字段名]：[具体判断内容]」
   * 无法追溯时标注"未追溯到前序数据——该定位要素可能为AI独立推断，需人工复核"
   */
  marketOpportunityReference: z
    .string()
    .min(10, "marketOpportunityReference 至少 10 个字"),
  /**
   * 对 S4 ConsumerInsight 的引用
   * 格式：「引用自 S4 [字段名]：[具体判断内容]」
   * 无法追溯时标注"未追溯到前序数据"
   */
  consumerInsightReference: z
    .string()
    .min(10, "consumerInsightReference 至少 10 个字"),
  /**
   * 对 S5 CompetitiveInsights 的引用
   * 格式：「引用自 S5 [字段名]：[具体判断内容]」
   * 无法追溯时标注"未追溯到前序数据"
   */
  competitiveGapReference: z
    .string()
    .min(10, "competitiveGapReference 至少 10 个字"),
});

// ── 组合 Schema ────────────────────────────────────────

export const brandStrategySchema = z.object({
  /**
   * 完整定位陈述句
   * 格式：「对于[目标消费者]而言，本品牌是[品类/场景]中能够实现[核心价值]的选择，因为[支撑理由]」
   */
  positioning: z.string().min(15, "positioning 至少 15 个字"),
  /**
   * 价值主张，恰好 3 条
   * level 分别为 functional / emotional / social
   */
  valuePropositions: z
    .array(valuePropositionSchema)
    .length(3, "valuePropositions 必须恰好 3 条"),
  /** 品牌故事（起因→问题冲突→品牌理念→品牌行动） */
  brandStory: brandStorySchema,
  /**
   * 品牌人格特质，5-7 个
   * 每个 trait 配 dos（会如何做）和 donts（绝不做）
   */
  brandPersonality: z
    .array(brandPersonalityTraitSchema)
    .min(5, "brandPersonality 至少 5 个")
    .max(7, "brandPersonality 最多 7 个"),
  /**
   * 引用追溯（不存入 Decision Memory）
   * 记录 S6 定位对 S3/S4/S5 具体字段的引用关系
   * 供 Phase 3 Cross Stage Context Check 验证推导链
   */
  reasoning: reasoningSchema,
  /**
   * AI 顾问确认总结的原文段落，按 section 名存储。
   * 供报告直接引用，保留精炼的叙述性语言。
   * 预期 key：品牌定位 / 价值主张 / 品牌故事 / 品牌人格
   */
  sectionSummaries: z.record(z.string(), z.string()).optional(),
});

export type BrandStrategy = z.infer<typeof brandStrategySchema>;
export type ValueProposition = z.infer<typeof valuePropositionSchema>;
export type ValuePropositionLevel = z.infer<typeof valuePropositionLevelEnum>;
export type BrandStory = z.infer<typeof brandStorySchema>;
export type BrandPersonalityTrait = z.infer<typeof brandPersonalityTraitSchema>;
export type Reasoning = z.infer<typeof reasoningSchema>;
