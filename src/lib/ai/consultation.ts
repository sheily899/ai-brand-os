/**
 * Consultation 调用管理器
 *
 * 职责：
 * - 管理多轮对话上下文
 * - 流式输出（SSE）
 * - "一次一问"约束由 Prompt 模板保证
 */

import { getLLMProvider } from "./provider";
import { loadPrompt, buildMessages } from "./loader";
import { recordUsageFromProvider, estimateCharCount } from "./token-tracker";
import type { TokenUsage } from "./provider/interface";

export interface ConsultationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface ConsultationContext {
  stage: number;
  history: ConsultationMessage[];
  variables: Record<string, string>;
  decisionMemoryContext?: string;
  /** 搜索上下文（Search Intelligence Layer 产出） */
  searchContext?: string;
  /** 是否注入搜索协议（S2/S3/S5/S8 默认开启） */
  includeSearchProtocol?: boolean;
  /** 强制输出确认总结（Exit Condition Checker 判定满足时设置） */
  forceSummary?: boolean;
  /** 缺失信息提示（Exit Condition Checker 产出的引导信息） */
  missingInfo?: string;
  /** Token 追踪上下文（可选，提供后自动记录每次 LLM 调用的 Token 消耗） */
  tracking?: {
    projectId: string;
    callType?: "consultation" | "opening";
  };
}

/** 流式响应生成器 — 用于 SSE API */
export async function* streamConsultation(
  ctx: ConsultationContext,
  newUserMessage: string
): AsyncGenerator<string, void, unknown> {
  const provider = getLLMProvider();

  // 注入轮次信号 + 系统指令
  const currentRound = ctx.history.length / 2 + 1;
  let messageWithSignal = `> 当前为本阶段第 ${currentRound} 轮对话\n\n`;

  if (ctx.forceSummary) {
    messageWithSignal += `[系统指令] 本阶段退出条件已满足，请立即输出确认总结。\n\n`;
  } else if (ctx.missingInfo) {
    messageWithSignal += `[系统提示] 以下信息尚未充分收集：${ctx.missingInfo}\n\n`;
  }
  messageWithSignal += newUserMessage;

  const systemPrompt = loadPrompt({
    stage: ctx.stage,
    mode: "consultation",
    variables: ctx.variables,
    decisionMemoryContext: ctx.decisionMemoryContext,
    searchContext: ctx.searchContext,
    includeSearchProtocol: ctx.includeSearchProtocol,
  });

  const messages = buildMessages(
    systemPrompt,
    ctx.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    messageWithSignal
  );

  const stream = provider.chatStream(messages, { temperature: 0.7, maxTokens: 2048 });

  for await (const chunk of stream) {
    if (chunk.content) {
      yield chunk.content;
    }
  }

  // ── Token 追踪 ──────────────────────────────────────
  if (ctx.tracking?.projectId && provider.lastUsage) {
    const { systemChars, conversationChars } = estimateCharCount(messages);
    recordUsageFromProvider(provider, {
      projectId: ctx.tracking.projectId,
      stageNumber: ctx.stage,
      callType: ctx.tracking.callType ?? "consultation",
      systemPromptChars: systemChars,
      conversationChars,
    }).catch(() => {});
  }
}

/** 非流式对话（用于 run-stage.ts CLI 测试） */
export async function sendMessage(
  ctx: ConsultationContext,
  userMessage: string
): Promise<string> {
  const provider = getLLMProvider();

  // 注入轮次信号 + 系统指令
  const currentRound = ctx.history.length / 2 + 1;
  let messageWithSignal = `> 当前为本阶段第 ${currentRound} 轮对话\n\n`;

  if (ctx.forceSummary) {
    messageWithSignal += `[系统指令] 本阶段退出条件已满足，请立即输出确认总结。\n\n`;
  } else if (ctx.missingInfo) {
    messageWithSignal += `[系统提示] 以下信息尚未充分收集：${ctx.missingInfo}\n\n`;
  }
  messageWithSignal += userMessage;

  const systemPrompt = loadPrompt({
    stage: ctx.stage,
    mode: "consultation",
    variables: ctx.variables,
    decisionMemoryContext: ctx.decisionMemoryContext,
    searchContext: ctx.searchContext,
    includeSearchProtocol: ctx.includeSearchProtocol,
  });

  const messages = buildMessages(
    systemPrompt,
    ctx.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    messageWithSignal
  );

  const result = await provider.chat(messages, { temperature: 0.7, maxTokens: 2048 });

  // ── Token 追踪 ──────────────────────────────────────
  if (ctx.tracking?.projectId && provider.lastUsage) {
    const { systemChars, conversationChars } = estimateCharCount(messages);
    recordUsageFromProvider(provider, {
      projectId: ctx.tracking.projectId,
      stageNumber: ctx.stage,
      callType: ctx.tracking.callType ?? "consultation",
      systemPromptChars: systemChars,
      conversationChars,
    }).catch(() => {});
  }

  return result;
}
