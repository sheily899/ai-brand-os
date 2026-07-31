import type { LLMProvider } from "./interface";
import { createDeepSeekProvider } from "./deepseek";

export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "deepseek";
  switch (provider) {
    case "deepseek":
      return createDeepSeekProvider();
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

export type { LLMProvider, ChatMessage, StreamChunk } from "./interface";
