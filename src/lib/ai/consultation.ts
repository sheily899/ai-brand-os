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
}

/** 流式响应生成器 — 用于 SSE API */
export async function* streamConsultation(
  ctx: ConsultationContext,
  newUserMessage: string
): AsyncGenerator<string, void, unknown> {
  const provider = getLLMProvider();

  const systemPrompt = loadPrompt({
    stage: ctx.stage,
    mode: "consultation",
    variables: ctx.variables,
    decisionMemoryContext: ctx.decisionMemoryContext,
  });

  const messages = buildMessages(
    systemPrompt,
    ctx.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    newUserMessage
  );

  const stream = provider.chatStream(messages, { temperature: 0.7, maxTokens: 2048 });

  for await (const chunk of stream) {
    if (chunk.content) {
      yield chunk.content;
    }
  }
}

/** 非流式对话（用于 run-stage.ts CLI 测试） */
export async function sendMessage(
  ctx: ConsultationContext,
  userMessage: string
): Promise<string> {
  const provider = getLLMProvider();

  const systemPrompt = loadPrompt({
    stage: ctx.stage,
    mode: "consultation",
    variables: ctx.variables,
    decisionMemoryContext: ctx.decisionMemoryContext,
  });

  const messages = buildMessages(
    systemPrompt,
    ctx.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    userMessage
  );

  return provider.chat(messages, { temperature: 0.7, maxTokens: 2048 });
}
