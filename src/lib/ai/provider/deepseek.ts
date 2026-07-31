import OpenAI from "openai";
import type { ChatMessage, LLMProvider, StreamChunk } from "./interface";

export function createDeepSeekProvider(): LLMProvider {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

  const client = new OpenAI({ apiKey, baseURL });

  const model = "deepseek-chat";

  return {
    async *chatStream(messages, options) {
      const stream = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield { content: delta, done: false };
        }
      }
      yield { content: "", done: true };
    },

    async chat(messages, options) {
      const response = await client.chat.completions.create({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 4096,
        response_format: options?.responseFormat
          ? { type: options.responseFormat as "json_object" }
          : undefined,
      });

      return response.choices[0]?.message?.content ?? "";
    },
  };
}
