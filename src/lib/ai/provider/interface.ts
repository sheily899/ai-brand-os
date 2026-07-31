export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface LLMProvider {
  /** 流式对话 — 返回 AsyncGenerator，SSE 消费 */
  chatStream(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /** 非流式对话 — Convergence 用 */
  chat(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number; responseFormat?: "json_object" }
  ): Promise<string>;
}

export interface LLMInfo {
  provider: string;
  model: string;
}
