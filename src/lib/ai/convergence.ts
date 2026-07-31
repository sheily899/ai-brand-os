/**
 * Convergence 调用管理器
 *
 * 职责：
 * - 读取完整阶段对话 + Stage Schema
 * - 调用 LLM 输出结构化 JSON
 * - 返回原始文本（由 normalizer + validator 后续处理）
 */

import { getLLMProvider } from "./provider";
import { loadPrompt, buildMessages } from "./loader";

export interface ConvergenceInput {
  stage: number;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  variables?: Record<string, string>;
  decisionMemoryContext?: string;
}

/** 执行 Convergence — 返回 LLM 原始输出 */
export async function runConvergence(input: ConvergenceInput): Promise<string> {
  const provider = getLLMProvider();

  const systemPrompt = loadPrompt({
    stage: input.stage,
    mode: "converge",
    variables: input.variables ?? {},
    decisionMemoryContext: input.decisionMemoryContext,
  });

  // Convergence 的系统提示就是提取规则，在最后追加一句指令
  const fullSystemPrompt =
    systemPrompt +
    "\n\n下面是从 Stage 1 访谈中收集的全部对话记录。请严格按照上述规则提取结构化数据。" +
    "\n\n**重要：只输出 JSON，不要输出任何解释文字。**";

  const messages = buildMessages(
    fullSystemPrompt,
    input.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    // 最后一条用户消息：要求输出 JSON
    "请基于以上对话，输出结构化 JSON。"
  );

  return provider.chat(messages, {
    temperature: 0.3,
    maxTokens: 4096,
    responseFormat: "json_object",
  });
}
