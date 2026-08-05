/**
 * Cost Analysis — Token 消耗分析与成本洞察
 *
 * 职责：
 * - 查询 token_consumption 表，按阶段/调用类型/Prompt 结构聚合分析
 * - 识别成本热点（System Prompt 过大、历史上下文冗余、重复注入）
 * - 输出结构化分析报告
 *
 * 纯查询模块，不写入数据。
 */

import { db } from "@/lib/db";
import { tokenConsumption } from "@/lib/db/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { identifyRedundancy } from "./redundancy-detector";

// ── 类型定义 ──────────────────────────────────────────────

export interface StageCost {
  stageNumber: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  /** 平均每次调用 total tokens */
  avgTokensPerCall: number;
  /** 按 callType 细分 */
  breakdown: CallTypeBreakdown[];
}

export interface CallTypeBreakdown {
  callType: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CallTypeCost {
  callType: string;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  /** 占总 Token 的百分比 */
  percentage: number;
  /** 涉及阶段数 */
  stageCount: number;
}

export interface PromptOverhead {
  stageNumber: number;
  callType: string;
  /** systemPromptTokens / inputTokens 比值 */
  systemRatio: number;
  /** conversationTokens / inputTokens 比值 */
  conversationRatio: number;
  /** 平均 system prompt tokens */
  avgSystemPromptTokens: number;
  /** 平均 conversation tokens */
  avgConversationTokens: number;
  /** 平均 input tokens */
  avgInputTokens: number;
  /** 样本数 */
  sampleCount: number;
}

export interface RedundancyFlag {
  type: "large_system_prompt" | "high_conversation_ratio" | "duplicate_injection";
  severity: "high" | "medium" | "low";
  stageNumber?: number;
  callType?: string;
  detail: string;
  /** 预估可节省的 token 百分比 */
  estimatedSavingPct: number;
  recommendation: string;
}

export interface CostAnalysisReport {
  generatedAt: string;
  projectId?: string;
  /** 分析的时间范围 */
  since?: string;
  /** 全局汇总 */
  summary: {
    totalCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    /** 估算成本（DeepSeek 价格：输入 $0.27/1M tokens, 输出 $1.10/1M tokens） */
    estimatedCostUSD: number;
  };
  /** 各阶段成本 */
  stageCosts: StageCost[];
  /** 按调用类型成本 */
  callTypeCosts: CallTypeCost[];
  /** Prompt 结构开销分析 */
  promptOverheads: PromptOverhead[];
  /** 成本优化机会（冗余/浪费标记） */
  redundancyFlags: RedundancyFlag[];
}

// ── DeepSeek 定价（2024 年标准价格） ─────────────────────

const DEEPSEEK_PRICING = {
  inputPer1M: 0.27,   // $0.27 / 1M input tokens
  outputPer1M: 1.10,  // $1.10 / 1M output tokens
} as const;

function estimateCostUSD(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * DEEPSEEK_PRICING.inputPer1M +
         (outputTokens / 1_000_000) * DEEPSEEK_PRICING.outputPer1M;
}

// ── 阶段成本分析 ─────────────────────────────────────────

/**
 * 查询各阶段 Token 消耗。
 * 按 stageNumber 聚合，输出每个阶段的调用次数、Token 用量、callType 细分。
 */
export async function analyzeStageCosts(
  projectId?: string,
  since?: Date,
): Promise<StageCost[]> {
  const rows = await db
    .select({
      stageNumber: tokenConsumption.stageNumber,
      callType: tokenConsumption.callType,
      calls: sql<number>`count(*)::int`,
      inputTokens: sql<number>`sum(${tokenConsumption.inputTokens})::int`,
      outputTokens: sql<number>`sum(${tokenConsumption.outputTokens})::int`,
      totalTokens: sql<number>`sum(${tokenConsumption.totalTokens})::int`,
    })
    .from(tokenConsumption)
    .where(and(
      ...(projectId ? [eq(tokenConsumption.projectId, projectId)] : []),
      ...(since ? [gte(tokenConsumption.createdAt, since)] : []),
    ))
    .groupBy(tokenConsumption.stageNumber, tokenConsumption.callType)
    .orderBy(tokenConsumption.stageNumber);

  // 按阶段聚合
  const stageMap = new Map<number, StageCost>();
  for (const row of rows) {
    let stage = stageMap.get(row.stageNumber);
    if (!stage) {
      stage = {
        stageNumber: row.stageNumber,
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        avgTokensPerCall: 0,
        breakdown: [],
      };
      stageMap.set(row.stageNumber, stage);
    }

    const bt: CallTypeBreakdown = {
      callType: row.callType,
      calls: row.calls,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
    };
    stage.breakdown.push(bt);
    stage.totalCalls += row.calls;
    stage.totalInputTokens += row.inputTokens;
    stage.totalOutputTokens += row.outputTokens;
    stage.totalTokens += row.totalTokens;
  }

  const result = Array.from(stageMap.values()).sort((a, b) => a.stageNumber - b.stageNumber);

  // 计算平均值
  for (const stage of result) {
    stage.avgTokensPerCall = stage.totalCalls > 0
      ? Math.round(stage.totalTokens / stage.totalCalls)
      : 0;
  }

  return result;
}

// ── 调用类型成本分析 ─────────────────────────────────────

/**
 * 按调用类型聚合成本。
 * 识别 consultation/convergence/audit/reoptimize 各自占比。
 */
export async function analyzeCallTypeCosts(
  projectId?: string,
  since?: Date,
): Promise<CallTypeCost[]> {
  const rows = await db
    .select({
      callType: tokenConsumption.callType,
      calls: sql<number>`count(*)::int`,
      inputTokens: sql<number>`sum(${tokenConsumption.inputTokens})::int`,
      outputTokens: sql<number>`sum(${tokenConsumption.outputTokens})::int`,
      totalTokens: sql<number>`sum(${tokenConsumption.totalTokens})::int`,
      stages: sql<number>`count(distinct ${tokenConsumption.stageNumber})::int`,
    })
    .from(tokenConsumption)
    .where(and(
      ...(projectId ? [eq(tokenConsumption.projectId, projectId)] : []),
      ...(since ? [gte(tokenConsumption.createdAt, since)] : []),
    ))
    .groupBy(tokenConsumption.callType)
    .orderBy(sql`sum(${tokenConsumption.totalTokens}) desc`);

  const grandTotal = rows.reduce((s, r) => s + r.totalTokens, 0);

  return rows.map((row) => ({
    callType: row.callType,
    totalCalls: row.calls,
    totalInputTokens: row.inputTokens,
    totalOutputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    percentage: grandTotal > 0 ? Math.round((row.totalTokens / grandTotal) * 1000) / 10 : 0,
    stageCount: row.stages,
  }));
}

// ── Prompt 开销分析 ──────────────────────────────────────

/**
 * 分析 system prompt vs conversation 的 Token 占比。
 * 按 stage + callType 分组，计算 systemPromptTokens / inputTokens 比值。
 */
export async function analyzePromptOverhead(
  projectId?: string,
  since?: Date,
): Promise<PromptOverhead[]> {
  const rows = await db
    .select({
      stageNumber: tokenConsumption.stageNumber,
      callType: tokenConsumption.callType,
      avgSystemPromptTokens: sql<number>`avg(${tokenConsumption.systemPromptTokens})::float`,
      avgConversationTokens: sql<number>`avg(${tokenConsumption.conversationTokens})::float`,
      avgInputTokens: sql<number>`avg(${tokenConsumption.inputTokens})::float`,
      sampleCount: sql<number>`count(*)::int`,
    })
    .from(tokenConsumption)
    .where(and(
      ...(projectId ? [eq(tokenConsumption.projectId, projectId)] : []),
      ...(since ? [gte(tokenConsumption.createdAt, since)] : []),
    ))
    .groupBy(tokenConsumption.stageNumber, tokenConsumption.callType)
    .orderBy(tokenConsumption.stageNumber, tokenConsumption.callType);

  return rows
    .filter((row) => row.avgInputTokens > 0)
    .map((row) => ({
      stageNumber: row.stageNumber,
      callType: row.callType,
      systemRatio: Math.round((row.avgSystemPromptTokens / row.avgInputTokens) * 1000) / 10,
      conversationRatio: Math.round((row.avgConversationTokens / row.avgInputTokens) * 1000) / 10,
      avgSystemPromptTokens: Math.round(row.avgSystemPromptTokens),
      avgConversationTokens: Math.round(row.avgConversationTokens),
      avgInputTokens: Math.round(row.avgInputTokens),
      sampleCount: row.sampleCount,
    }));
}

// ── 冗余识别（委托给纯函数模块） ────────────────────────

export { identifyRedundancy } from "./redundancy-detector";

// ── 综合报告 ─────────────────────────────────────────────

/**
 * 生成完整的成本分析报告。
 * 一站式调用，返回所有维度的分析结果。
 */
export async function generateCostReport(
  projectId?: string,
  since?: Date,
): Promise<CostAnalysisReport> {
  const stageCosts = await analyzeStageCosts(projectId, since);
  const callTypeCosts = await analyzeCallTypeCosts(projectId, since);
  const promptOverheads = await analyzePromptOverhead(projectId, since);
  const redundancyFlags = identifyRedundancy(promptOverheads, stageCosts);

  const totalCalls = callTypeCosts.reduce((s, c) => s + c.totalCalls, 0);
  const totalInput = callTypeCosts.reduce((s, c) => s + c.totalInputTokens, 0);
  const totalOutput = callTypeCosts.reduce((s, c) => s + c.totalOutputTokens, 0);
  const totalTokens = callTypeCosts.reduce((s, c) => s + c.totalTokens, 0);

  return {
    generatedAt: new Date().toISOString(),
    projectId,
    since: since?.toISOString(),
    summary: {
      totalCalls,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalTokens,
      estimatedCostUSD: Math.round(estimateCostUSD(totalInput, totalOutput) * 10000) / 10000,
    },
    stageCosts,
    callTypeCosts,
    promptOverheads,
    redundancyFlags,
  };
}
