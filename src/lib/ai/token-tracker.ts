/**
 * TokenTracker — LLM 调用 Token 消耗记录服务
 *
 * 职责：
 * - 在 LLM Provider 层自动记录每次调用的 Token 消耗
 * - 估算 system prompt vs conversation tokens（非精确，用于成本分析）
 * - 持久化到 token_consumption 表
 *
 * 设计原则：
 * - 不侵入业务代码（在 provider 调用方埋点，不在 provider 内部）
 * - 异步保存，不阻塞主流程
 * - 保存失败静默降级（不影响 LLM 调用本身）
 */

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { tokenConsumption } from "@/lib/db/schema";
import type { TokenUsage, LLMProvider } from "@/lib/ai/provider/interface";

// ── 类型 ──────────────────────────────────────────────────

export type CallType =
  | "consultation"
  | "convergence"
  | "audit"
  | "reoptimize"
  | "search_intent"
  | "search_ranking"
  | "opening"
  | "other";

export interface TokenRecordInput {
  projectId: string;
  stageNumber: number;
  callType: CallType;
  model?: string;
  usage: TokenUsage;
  /** 预估 system prompt token 数（将中文字符数 / 2 作为近似） */
  systemPromptChars?: number;
  /** 预估对话历史 token 数（将中文字符数 / 2 作为近似） */
  conversationChars?: number;
  /** 端到端延迟 (ms) */
  latencyMs?: number;
  /** 实验分组: baseline | cache */
  experimentGroup?: string;
  /** 额外元数据 */
  metadata?: Record<string, any>;
}

// ── 中文 Token 估算（粗略：中文字符 ≈ 1.5-2 tokens，取 2 为保守估计）──

/** 中文字符数 → token 数近似转换 */
function estimateTokens(chars: number): number {
  return Math.ceil(chars / 2);
}

// ── 核心函数 ──────────────────────────────────────────────

/**
 * 记录一次 LLM 调用的 Token 消耗。
 * 异步保存，失败静默降级。
 */
export async function recordTokenUsage(input: TokenRecordInput): Promise<void> {
  const {
    projectId,
    stageNumber,
    callType,
    model = "deepseek-chat",
    usage,
    systemPromptChars,
    conversationChars,
    latencyMs,
    experimentGroup,
    metadata,
  } = input;

  // 计算 billable tokens（总 prompt - 缓存命中）
  const cacheHit = usage.cacheHitTokens ?? 0;
  const billableTokens = Math.max(0, usage.promptTokens - cacheHit);

  try {
    await db.insert(tokenConsumption).values({
      id: randomUUID(),
      projectId,
      stageNumber,
      callType,
      model,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      systemPromptTokens: systemPromptChars != null ? estimateTokens(systemPromptChars) : 0,
      conversationTokens: conversationChars != null ? estimateTokens(conversationChars) : 0,
      cacheCreationTokens: 0, // DeepSeek auto-cache: creation cost bundled into prompt_tokens
      cacheReadTokens: cacheHit, // 从缓存命中的 tokens
      billableTokens, // 实际计费 input tokens
      latencyMs: latencyMs ?? null,
      experimentGroup: experimentGroup ?? null,
      metadata: metadata ?? null,
    });
  } catch (e: any) {
    // 静默降级：Token 记录失败不影响业务流程
    console.error(`[token-tracker] 记录失败 (${callType} stage=${stageNumber}): ${e.message}`);
  }
}

/**
 * 从 ChatMessage 数组估算中文字符数。
 * 用于拆分 system prompt tokens 和 conversation tokens。
 */
export function estimateCharCount(messages: Array<{ role: string; content: any }>): {
  systemChars: number;
  conversationChars: number;
  totalChars: number;
} {
  let systemChars = 0;
  let conversationChars = 0;

  for (const msg of messages) {
    const text = typeof msg.content === "string"
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content
            .filter((p: any) => p.type === "text")
            .map((p: any) => p.text)
            .join("")
        : "";

    if (msg.role === "system") {
      systemChars += text.length;
    } else {
      conversationChars += text.length;
    }
  }

  return {
    systemChars,
    conversationChars,
    totalChars: systemChars + conversationChars,
  };
}

/**
 * 从 provider.lastUsage 读取最近一次调用用量并持久化。
 * 调用方在 LLM 调用完成后调用此函数。
 * 异步保存，失败静默降级。
 */
export async function recordUsageFromProvider(
  provider: LLMProvider,
  input: Omit<TokenRecordInput, "usage">,
): Promise<void> {
  if (!provider.lastUsage) return;
  await recordTokenUsage({ ...input, usage: provider.lastUsage });
}
