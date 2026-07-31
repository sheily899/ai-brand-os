import { z } from "zod";

// ── Stage 8: ContentStrategy ───────────────────────────

/**
 * S8 内容规划输出 Schema
 *
 * 对应 Stage 8 Convergence Prompt 的 JSON Schema。
 * S8 复用 Search Intelligence Layer（覆盖矩阵 7 维度）。
 * contentPillars 服务于 S6 的品牌目标。
 */

// ── 用户阶段枚举 ───────────────────────────────────────

export const userStageEnum = z.enum([
  "awareness",
  "interest",
  "trust",
  "decision",
]);

// ── 平台枚举 ───────────────────────────────────────────

export const platformEnum = z.enum([
  "xiaohongshu",
  "douyin",
  "wechat",
]);

// ── 内容价值体系 ───────────────────────────────────────

export const contentValueEntrySchema = z.object({
  /** 用户阶段：awareness/interest/trust/decision */
  userStage: userStageEnum,
  /** 该阶段用户面临的问题 */
  userProblem: z.string().min(4, "userProblem 至少 4 个字"),
  /** 内容为该阶段提供的价值 */
  contentValue: z.string().min(4, "contentValue 至少 4 个字"),
});

// ── 内容主题方向 ───────────────────────────────────────

export const themeDirectionSchema = z.object({
  /** 内容支柱名称 */
  pillar: z.string().min(2, "pillar 至少 2 个字"),
  /** 该支柱的核心目的 */
  corePurpose: z.string().min(4, "corePurpose 至少 4 个字"),
  /** 选题方向列表（至少 1 项） */
  topicDirections: z.array(z.string()).min(1, "topicDirections 至少 1 项"),
});

// ── 渠道表达策略 ───────────────────────────────────────

export const channelStrategyEntrySchema = z.object({
  /** 平台：xiaohongshu/douyin/wechat */
  platform: platformEnum,
  /** 该平台适合的内容形式 */
  contentFormat: z.string().min(4, "contentFormat 至少 4 个字"),
  /** 该平台的表达重点 */
  expressionFocus: z.string().min(4, "expressionFocus 至少 4 个字"),
});

// ── 组合 Schema ────────────────────────────────────────

export const contentStrategySchema = z.object({
  /** 一句话内容核心方向 */
  coreDirection: z.string().min(10, "coreDirection 至少 10 个字"),
  /** 内容价值体系，恰好 4 条（awareness/interest/trust/decision） */
  contentValueSystem: z
    .array(contentValueEntrySchema)
    .length(4, "contentValueSystem 必须恰好 4 条"),
  /** 内容主题方向，2-4 个 */
  themeDirections: z
    .array(themeDirectionSchema)
    .min(2, "themeDirections 至少 2 个")
    .max(4, "themeDirections 最多 4 个"),
  /** 渠道表达策略，恰好 3 条（xiaohongshu/douyin/wechat） */
  channelStrategy: z
    .array(channelStrategyEntrySchema)
    .length(3, "channelStrategy 必须恰好 3 条"),
  /** 搜索数据来源记录（S8 复用 Search Intelligence Layer） */
  dataSources: z
    .array(
      z.object({
        url: z.string(),
        title: z.string(),
        type: z.enum(["full_text", "snippet"]),
        summary: z.string(),
      })
    )
    .optional(),
});

export type ContentStrategy = z.infer<typeof contentStrategySchema>;
export type ContentValueEntry = z.infer<typeof contentValueEntrySchema>;
export type ThemeDirection = z.infer<typeof themeDirectionSchema>;
export type ChannelStrategyEntry = z.infer<typeof channelStrategyEntrySchema>;
