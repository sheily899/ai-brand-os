import { z } from "zod";

// ── Stage 2: BusinessContext ────────────────────────────

/**
 * S2 商业背景分析输出 Schema
 *
 * 对应 Stage 2 Convergence Prompt 的 JSON Schema：
 * - businessBackground: 行业环境与商业时机
 * - coreChallenges: 外部挑战与内部约束
 * - strategicDirection: 初步战略方向（试探性措辞，供 S6 做最终判断）
 */

export const businessBackgroundSchema = z.object({
  /** 行业宏观背景与趋势，经过归纳的商业语言 */
  marketContext: z.string().min(20, "marketContext 至少 20 个字"),
  /** 市场变化背后的驱动原因，2-5 条 */
  drivingForces: z
    .array(z.string())
    .min(2, "drivingForces 至少 2 条")
    .max(5, "drivingForces 最多 5 条"),
  /** 为什么现在是合适的时机 */
  strategicWindow: z.string().min(10, "strategicWindow 至少 10 个字"),
});

export const coreChallengesSchema = z.object({
  /** 外部环境带来的具体挑战 */
  externalChallenges: z.array(z.string()).min(1, "externalChallenges 至少 1 条"),
  /** 内部能力与资源约束带来的具体挑战 */
  internalChallenges: z.array(z.string()).min(1, "internalChallenges 至少 1 条"),
});

export const strategicDirectionSchema = z.object({
  /**
   * 方向性判断，必须包含试探性措辞（"可能""初步判断""有待验证"等）
   * 必须体现与商业目标的关联
   * 这是留给 S6 品牌核心战略阶段做最终判断的
   */
  directionHypothesis: z
    .string()
    .min(10, "directionHypothesis 至少 10 个字"),
  /** 阶段性工作焦点 */
  workingPriorities: z.array(z.string()).min(1, "workingPriorities 至少 1 条"),
});

export const businessContextSchema = z.object({
  businessBackground: businessBackgroundSchema,
  coreChallenges: coreChallengesSchema,
  strategicDirection: strategicDirectionSchema,
  /**
   * AI 顾问确认总结的原文段落，按 section 名存储。
   * 供报告直接引用，保留精炼的叙述性语言。
   * 预期 key：商业背景 / 核心挑战 / 品牌战略方向
   */
  sectionSummaries: z.record(z.string(), z.string()).optional(),
  /** 搜索数据来源记录（由 Search Intelligence Layer 注入） */
  dataSources: z
    .array(
      z.object({
        dimension: z.string(),
        sourceType: z.enum(["fulltext", "snippet"]),
        url: z.string(),
        title: z.string(),
        retrievedAt: z.string(),
      })
    )
    .optional(),
});

export type BusinessContext = z.infer<typeof businessContextSchema>;
export type BusinessBackground = z.infer<typeof businessBackgroundSchema>;
export type CoreChallenges = z.infer<typeof coreChallengesSchema>;
export type StrategicDirection = z.infer<typeof strategicDirectionSchema>;
