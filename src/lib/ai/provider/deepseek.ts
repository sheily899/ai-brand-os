import OpenAI from "openai";
import type { ChatMessage, LLMProvider, StreamChunk, TokenUsage } from "./interface";

/** chat() 安全返回结构，用于 LLM 调用失败时的降级 */
export interface ChatSafeResult {
  content: string;
  error?: string;
}

/**
 * 超时设置依据：
 * - deepseek-chat 正常响应: 5-30s（2048-4096 tokens）
 * - deepseek-reasoner 正常响应: 30-120s（含内部推理）
 * - 数值选取 2x 标准差覆盖 99%+ 合法请求
 */
const STANDARD_TIMEOUT_MS = 120_000; // 2 min
const REASONER_TIMEOUT_MS = 180_000; // 3 min

export function createDeepSeekProvider(): LLMProvider {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  const baseURL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

  const client = new OpenAI({ apiKey, baseURL });

  const defaultModel = "deepseek-chat";

  // ── 核心 chat 实现（闭包，chatSafe 通过此引用避免 this 绑定问题）──
  const doChat = async (
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number; responseFormat?: "json_object"; model?: string }
  ): Promise<{ content: string; usage?: TokenUsage }> => {
    const model = options?.model ?? defaultModel;
    const isReasoner = model === "deepseek-reasoner";
    const timeoutMs = isReasoner ? REASONER_TIMEOUT_MS : STANDARD_TIMEOUT_MS;

    const startTime = Date.now();

    try {
      const response = await client.chat.completions.create(
        {
          model,
          messages: messages.map((m) => ({
            role: m.role as any,
            content: m.content as any,
          })),
          ...(isReasoner
            ? { max_tokens: options?.maxTokens ?? 8192 }
            : {
                temperature: options?.temperature ?? 0.3,
                max_tokens: options?.maxTokens ?? 4096,
                response_format: options?.responseFormat
                  ? { type: options.responseFormat as "json_object" }
                  : undefined,
              }),
        },
        { signal: AbortSignal.timeout(timeoutMs) }
      );

      const elapsed = Date.now() - startTime;
      const content = response.choices[0]?.message?.content ?? "";

      // 提取 usage 信息（含 DeepSeek disk cache 字段）
      const rawUsage = response.usage as any;
      const usage: TokenUsage | undefined = response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
            cacheHitTokens: rawUsage?.prompt_cache_hit_tokens ?? rawUsage?.prompt_tokens_details?.cached_tokens ?? undefined,
            cacheMissTokens: rawUsage?.prompt_cache_miss_tokens ?? undefined,
            cachedTokens: rawUsage?.prompt_tokens_details?.cached_tokens ?? undefined,
          }
        : undefined;

      const cacheInfo = usage?.cacheHitTokens != null
        ? ` cache[hit=${usage.cacheHitTokens} miss=${usage.cacheMissTokens ?? "?"}]`
        : "";
      console.log(`[deepseek] chat() 完成: model=${model} 耗时=${elapsed}ms` +
        (usage ? ` tokens: ${usage.promptTokens}+${usage.completionTokens}=${usage.totalTokens}${cacheInfo}` : ""));

      if (!content && isReasoner) {
        try {
          const raw = response as any;
          const reasoningContent = raw.choices?.[0]?.message?.reasoning_content;
          if (reasoningContent) {
            console.log(`[deepseek] reasoner 推理完成（${reasoningContent.length} chars）`);
            return { content: reasoningContent.slice(-3000), usage };
          }
        } catch { /* ignore */ }
        console.warn("[deepseek] reasoner 返回空 content 且无 reasoning_content");
      }

      return { content, usage };
    } catch (e: any) {
      const elapsed = Date.now() - startTime;
      const isTimeout =
        e.name === "AbortError" || e.name === "TimeoutError" ||
        e.code === "ETIMEDOUT" || e.message?.includes("aborted") ||
        e.message?.includes("timeout");

      if (isTimeout) {
        console.error(`[deepseek] chat() 超时: model=${model} 耗时=${elapsed}ms timeout=${timeoutMs}ms`);
        throw new Error(
          `LLM 调用超时（已等待 ${(elapsed / 1000).toFixed(0)} 秒，超时阈值 ${timeoutMs / 1000} 秒）。` +
          `请检查 DeepSeek API 服务状态或稍后重试。`
        );
      }

      console.error(`[deepseek] chat() 失败: model=${model} 耗时=${elapsed}ms status=${e.status ?? "N/A"} message=${e.message}`);
      if (e.error) console.error(`[deepseek] API 详细错误:`, JSON.stringify(e.error).slice(0, 300));
      throw new Error(`LLM 调用失败: ${e.message}`);
    }
  };

  // ── 共享的 lastUsage 引用（所有方法写入）───────────
  let _lastUsage: TokenUsage | null = null;

  const provider: LLMProvider = {
    get lastUsage() { return _lastUsage; },
    set lastUsage(v: TokenUsage | null) { _lastUsage = v; },

    async *chatStream(messages, options) {
      const model = options?.model ?? defaultModel;
      const hasImages = messages.some(
        (m) => Array.isArray(m.content) && m.content.some((p: any) => p.type === "image_url")
      );

      // ── 诊断日志：请求摘要 ──────────────────────────
      console.log(`[deepseek] === 请求开始 ===`);
      console.log(`[deepseek] model=${model} stream=true hasImages=${hasImages}`);
      console.log(`[deepseek] messages 数量=${messages.length}`);
      if (hasImages) {
        const imgMsg = messages.find((m) => Array.isArray(m.content));
        const parts = (imgMsg?.content as any[]) ?? [];
        const imgPart = parts.find((p: any) => p.type === "image_url");
        const imgUrl = imgPart?.image_url?.url ?? "";
        console.log(`[deepseek] 图片 data URL 长度=${imgUrl.length} 前缀=${imgUrl.slice(0, 80)}`);
      }

      try {
        const startTime = Date.now();
        const stream = await client.chat.completions.create({
          model,
          messages: messages.map((m) => ({
            role: m.role as any,
            content: m.content as any,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          stream: true,
          stream_options: { include_usage: true },
        });

        let chunkCount = 0;
        let lastFinishReason: string | null = null;
        let streamUsage: any = null;

        for await (const chunk of stream) {
          chunkCount++;
          const choice = chunk.choices[0];
          const delta = choice?.delta?.content;
          const finishReason = choice?.finish_reason;

          if (finishReason) {
            lastFinishReason = finishReason;
          }
          // OpenAI SDK 在最后一个 chunk 可能有 usage
          if ((chunk as any).usage) {
            streamUsage = (chunk as any).usage;
          }

          if (delta) {
            yield { content: delta, done: false };
          }
        }

        // ── 诊断日志：响应摘要 ──────────────────────────
        const elapsed = Date.now() - startTime;
        console.log(`[deepseek] === 请求结束 ===`);
        console.log(`[deepseek] 耗时=${elapsed}ms chunks=${chunkCount} finish_reason=${lastFinishReason ?? "null"}`);
        if (streamUsage) {
          const rawUsage = streamUsage as any;
          _lastUsage = {
            promptTokens: streamUsage.prompt_tokens,
            completionTokens: streamUsage.completion_tokens,
            totalTokens: streamUsage.total_tokens,
            cacheHitTokens: rawUsage?.prompt_cache_hit_tokens ?? rawUsage?.prompt_tokens_details?.cached_tokens ?? undefined,
            cacheMissTokens: rawUsage?.prompt_cache_miss_tokens ?? undefined,
            cachedTokens: rawUsage?.prompt_tokens_details?.cached_tokens ?? undefined,
          };
          const cacheInfo = _lastUsage.cacheHitTokens != null
            ? ` cache[hit=${_lastUsage.cacheHitTokens} miss=${_lastUsage.cacheMissTokens ?? "?"}]`
            : "";
          console.log(`[deepseek] usage prompt_tokens=${streamUsage.prompt_tokens} completion_tokens=${streamUsage.completion_tokens} total_tokens=${streamUsage.total_tokens}${cacheInfo}`);
        } else {
          _lastUsage = null;
          console.log(`[deepseek] usage=无（stream 模式可能不返回 usage）`);
        }
        if (chunkCount === 0) {
          console.warn(`[deepseek] ⚠️ 流式返回了 0 个 chunk！可能原因:`);
          console.warn(`[deepseek]    1. 模型不支持 vision 多模态输入`);
          console.warn(`[deepseek]    2. API 静默拒绝了请求`);
          console.warn(`[deepseek]    3. max_tokens 不足（被图片 token 占用）`);
        }

        // 最后 yield done chunk，附上 usage
        yield { content: "", done: true, usage: _lastUsage ?? undefined };
      } catch (e: any) {
        _lastUsage = null;
        console.error(`[deepseek] ❌ 错误: status=${e.status} message=${e.message}`);
        if (e.error) {
          console.error(`[deepseek] API 详细错误:`, JSON.stringify(e.error).slice(0, 500));
        }
        yield { content: `（模型调用失败: ${e.message}。请检查 API 配置或稍后重试。）`, done: false };
        yield { content: "", done: true };
      }
    },

    // 委托给闭包 doChat（现在返回 { content, usage }）
    chat: async (messages, options) => {
      const result = await doChat(messages, options);
      _lastUsage = result.usage ?? null;
      return result.content;
    },

    /** 安全版 chat()：不抛异常，返回结构化结果供上层降级处理。通过闭包 doChat 避免 this 绑定问题。 */
    chatSafe: async (messages, options) => {
      try {
        const result = await doChat(messages, options);
        _lastUsage = result.usage ?? null;
        return { content: result.content, usage: result.usage };
      } catch (e: any) {
        console.error(`[deepseek] chatSafe() 降级: ${e.message}`);
        return { content: "", error: e.message };
      }
    },
  };
  return provider;
}
