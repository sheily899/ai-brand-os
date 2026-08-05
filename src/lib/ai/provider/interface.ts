export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string } };
export type MessageContent = string | Array<TextContent | ImageContent>;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  /** 流式调用结束时的 token 用量（仅在 done=true 时可能填充） */
  usage?: TokenUsage;
}

export interface ChatSafeResult {
  content: string;
  error?: string;
  /** LLM 调用成功时的 token 用量 */
  usage?: TokenUsage;
}

/** LLM 调用的 Token 用量信息 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** DeepSeek disk cache: 命中缓存的 prompt tokens（不收费） */
  cacheHitTokens?: number;
  /** DeepSeek disk cache: 未命中缓存的 prompt tokens（收费） */
  cacheMissTokens?: number;
  /** OpenAI-style: prompt_tokens_details.cached_tokens */
  cachedTokens?: number;
}

export interface LLMProvider {
  /** 上一次成功调用的 token 用量（由 provider 自动设置） */
  lastUsage: TokenUsage | null;

  /** 流式对话 — 返回 AsyncGenerator，SSE 消费 */
  chatStream(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number; model?: string }
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /** 非流式对话 — Convergence 用。异常时抛出错误。 */
  chat(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number; responseFormat?: "json_object"; model?: string; seed?: number }
  ): Promise<string>;

  /**
   * 安全版非流式对话：不抛异常，返回结构化降级结果。
   * 上层可根据 error 字段判断是否需要 fallback 处理。
   */
  chatSafe?(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number; responseFormat?: "json_object"; model?: string }
  ): Promise<ChatSafeResult>;
}

export interface LLMInfo {
  provider: string;
  model: string;
}
