import { z } from "zod";

// ── Stage 4: ConsumerInsight ───────────────────────────

/**
 * S4 消费者洞察输出 Schema
 *
 * 对应 Stage 4 Convergence Prompt 的 JSON Schema。
 * S4 不依赖搜索，但使用 S1-S3 Decision Memory 作为 Context。
 *
 * 关键字段 identityNeed（deepNeeds.identityNeed）供 S6 强制引用。
 */

// ── 目标消费者 ─────────────────────────────────────────

export const targetConsumerSchema = z.object({
  /** 基于决策动机与行为特征的人群画像，非人口标签，须包含场景或行为描述 */
  definition: z.string().min(15, "targetConsumer.definition 至少 15 个字"),
  /** 用户的自我表达与理想意象映射，推断性表述 */
  idealSelfReflection: z.string().min(10, "targetConsumer.idealSelfReflection 至少 10 个字"),
});

// ── 现有解决方案 ───────────────────────────────────────

export const existingSolutionSchema = z.object({
  /** 消费者采用的解决路径（行为层面，非产品名） */
  solutionType: z.string().min(2, "solutionType 至少 2 个字"),
  /** 该路径下具体采用的产品或行为 */
  examples: z.string().min(2, "examples 至少 2 个字"),
  /** 已满足什么 + 缺失什么 + 造成什么摩擦 */
  failReason: z.string().min(8, "failReason 至少 8 个字"),
});

// ── 深层需求 ───────────────────────────────────────────

export const deepNeedsSchema = z.object({
  /** 雇用该品牌完成的功能层任务 */
  functionalNeed: z.string().min(10, "functionalNeed 至少 10 个字"),
  /**
   * 雇用该品牌完成的身份认同层任务
   * 须含推导性质措辞（可能希望、初步判断、据……推测）
   * 若对话中确实缺乏身份层信息，须写明信息缺口，不得留空
   * 这是 S6 品牌核心战略的强制引用字段
   */
  identityNeed: z.string().min(10, "identityNeed 至少 10 个字"),
});

// ── 组合 Schema ────────────────────────────────────────

export const consumerInsightSchema = z.object({
  targetConsumer: targetConsumerSchema,
  existingSolutions: z.array(existingSolutionSchema).min(1, "existingSolutions 至少 1 个"),
  deepNeeds: deepNeedsSchema,
  /**
   * AI 顾问确认总结的原文段落，按 section 名存储。
   * 供报告直接引用，保留精炼的叙述性语言。
   * 预期 key：目标消费者定义 / 当前解决方案与不足 / 深层需求分析
   */
  sectionSummaries: z.record(z.string(), z.string()).optional(),
});

export type ConsumerInsight = z.infer<typeof consumerInsightSchema>;
export type TargetConsumer = z.infer<typeof targetConsumerSchema>;
export type ExistingSolution = z.infer<typeof existingSolutionSchema>;
export type DeepNeeds = z.infer<typeof deepNeedsSchema>;
