/**
 * Convergence 调用管理器
 *
 * 职责：
 * - 读取完整阶段对话 + Stage Schema
 * - 调用 LLM 输出结构化 JSON
 * - 返回原始文本（由 normalizer + validator 后续处理）
 *
 * S3 特殊处理（拆分收敛）：
 * - Convergence A：搜索数据结构化（marketOverview / industryTrend /
 *   channelAnalysis / regulatoryEnvironment / dataSources）
 * - Convergence B：咨询分析提取（categoryStatus / experienceGaps /
 *   opportunityDirections）
 * - 两次调用各自独立校验 + 独立重试，互不影响
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { getLLMProvider } from "./provider";
import { loadPrompt, buildMessages } from "./loader";
import { recordUsageFromProvider, estimateCharCount } from "./token-tracker";
import { normalizeJSON, fixCommonJSONErrors } from "@/lib/stage/normalizer";
import { validate, buildRetryFeedback } from "@/lib/stage/schema-validator";
import {
  marketInsightsSearchDataSchema,
  marketInsightsAnalysisSchema,
} from "@/lib/schemas/market-insights";
import type { ZodSchema } from "zod";

const PROMPTS_DIR = resolve(process.cwd(), "src/lib/ai/prompts");

export interface ConvergenceInput {
  stage: number;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  variables?: Record<string, string>;
  decisionMemoryContext?: string;
  /** 搜索上下文（S3 拆分时，Convergence A 额外注入） */
  searchContext?: string;
  /** Token 追踪上下文（可选，提供后自动记录） */
  tracking?: {
    projectId: string;
  };
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

  const chatFn = provider.chatSafe ?? (async (msgs: any, opts: any) => {
    try { return { content: await provider.chat(msgs, opts) }; }
    catch (e: any) { return { content: "", error: e.message }; }
  });

  const safeResult = await chatFn(messages, {
    temperature: 0.3,
    maxTokens: 4096,
    responseFormat: "json_object",
  });

  if (safeResult.error) {
    throw new Error(`Convergence LLM 调用失败: ${safeResult.error}`);
  }

  // ── Token 追踪 ──────────────────────────────────────
  if (input.tracking?.projectId && provider.lastUsage) {
    const { systemChars, conversationChars } = estimateCharCount(messages);
    recordUsageFromProvider(provider, {
      projectId: input.tracking.projectId,
      stageNumber: input.stage,
      callType: "convergence",
      systemPromptChars: systemChars,
      conversationChars,
    }).catch(() => {});
  }

  return safeResult.content;
}

// ── S3 拆分收敛 ──────────────────────────────────────────

export interface SplitConvergenceResult {
  /** Convergence A 输出的搜索数据层 */
  searchData?: Record<string, any>;
  /** Convergence B 输出的 AI 分析层 */
  analysis?: Record<string, any>;
  /** A 的校验错误 */
  searchDataErrors?: string[];
  /** B 的校验错误 */
  analysisErrors?: string[];
  /** A 使用的重试次数 */
  searchDataRetries: number;
  /** B 使用的重试次数 */
  analysisRetries: number;
}

/**
 * S3 拆分收敛：两次独立 LLM 调用 + 各自独立校验/重试
 *
 * 调用 A（搜索数据结构化）：
 *   - 输入：对话历史 + 搜索上下文
 *   - 输出：marketOverview / industryTrend / channelAnalysis /
 *           regulatoryEnvironment / dataSources
 *   - Prompt：stage3-converge-a.md
 *
 * 调用 B（咨询分析提取）：
 *   - 输入：对话历史（含 AI 确认总结）
 *   - 输出：categoryStatus / experienceGaps / opportunityDirections
 *   - Prompt：stage3-converge-b.md
 */
export async function runConvergenceSplit(
  input: ConvergenceInput
): Promise<SplitConvergenceResult> {
  // ── 调用 A：搜索数据结构化 ──────────────────────────
  const resultA = await runSingleConvergenceWithRetry({
    promptFile: "stage3-converge-a.md",
    schema: marketInsightsSearchDataSchema,
    history: input.history,
    variables: input.variables,
    decisionMemoryContext: input.decisionMemoryContext,
    searchContext: input.searchContext,
    tracking: input.tracking ? { projectId: input.tracking.projectId, stageNumber: input.stage } : undefined,
  });

  // ── 调用 B：咨询分析提取 ──────────────────────────
  const resultB = await runSingleConvergenceWithRetry({
    promptFile: "stage3-converge-b.md",
    schema: marketInsightsAnalysisSchema,
    history: input.history,
    variables: input.variables,
    decisionMemoryContext: input.decisionMemoryContext,
    tracking: input.tracking ? { projectId: input.tracking.projectId, stageNumber: input.stage } : undefined,
  });

  return {
    searchData: resultA.data,
    analysis: resultB.data,
    searchDataErrors: resultA.errors,
    analysisErrors: resultB.errors,
    searchDataRetries: resultA.retriesUsed,
    analysisRetries: resultB.retriesUsed,
  };
}

// ── 单次收敛 + 重试循环（内部） ──────────────────────────

interface SingleConvergenceInput {
  promptFile: string;
  schema: ZodSchema<any>;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  variables?: Record<string, string>;
  decisionMemoryContext?: string;
  searchContext?: string;
  /** Token 追踪上下文 */
  tracking?: {
    projectId: string;
    stageNumber: number;
  };
}

interface SingleConvergenceResult {
  success: boolean;
  data?: Record<string, any>;
  errors?: string[];
  retriesUsed: number;
}

const MAX_RETRIES = 3;

async function runSingleConvergenceWithRetry(
  input: SingleConvergenceInput
): Promise<SingleConvergenceResult> {
  // ── 加载专用 Prompt ─────────────────────────────────
  const filePath = resolve(PROMPTS_DIR, input.promptFile);
  let systemPrompt: string;
  try {
    systemPrompt = readFileSync(filePath, "utf8");
  } catch {
    return {
      success: false,
      errors: [`Prompt 文件缺失: ${input.promptFile}`],
      retriesUsed: 0,
    };
  }

  // 变量注入
  if (input.variables) {
    for (const [key, value] of Object.entries(input.variables)) {
      systemPrompt = systemPrompt.split(`{${key}}`).join(value);
    }
  }

  // Decision Memory Context
  if (input.decisionMemoryContext) {
    systemPrompt += `\n\n## 前序阶段确认的战略资产\n\n${input.decisionMemoryContext}`;
  }

  // 搜索上下文（仅 Convergence A 使用）
  if (input.searchContext) {
    systemPrompt += `\n\n---\n\n## 已执行的搜索及其结果\n\n${input.searchContext}`;
  }

  // 追加最终指令
  const fullSystemPrompt =
    systemPrompt +
    "\n\n下面是从 Stage 3 收集的全部对话记录。请严格按照上述规则提取结构化数据。" +
    "\n\n**重要：只输出 JSON，不要输出任何解释文字。**";

  // ── 第一次调用 ─────────────────────────────────────
  const provider = getLLMProvider();
  const chatOpts = { temperature: 0.3, maxTokens: 4096, responseFormat: "json_object" as const };
  const messages = buildMessages(
    fullSystemPrompt,
    input.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    "请基于以上对话，输出结构化 JSON。"
  );

  // 使用 chatSafe 防止 LLM 异常直接传播到上层
  const chatFn = provider.chatSafe ?? (async (msgs: any, opts: any) => {
    try { return { content: await provider.chat(msgs, opts) }; }
    catch (e: any) { return { content: "", error: e.message }; }
  });

  let safeResult = await chatFn(messages, chatOpts);

  // ── Token 追踪 ──────────────────────────────────────
  if (input.tracking?.projectId && provider.lastUsage) {
    const { systemChars, conversationChars } = estimateCharCount(messages);
    recordUsageFromProvider(provider, {
      projectId: input.tracking.projectId,
      stageNumber: input.tracking.stageNumber,
      callType: "convergence",
      systemPromptChars: systemChars,
      conversationChars,
    }).catch(() => {});
  }

  // LLM 调用失败（超时或服务不可用）→ 直接返回失败，不重试
  if (safeResult.error) {
    return {
      success: false,
      errors: [`LLM 调用失败: ${safeResult.error}`],
      retriesUsed: 0,
    };
  }

  let jsonText = normalizeJSON(safeResult.content);
  jsonText = fixCommonJSONErrors(jsonText);

  // ── 校验 + 重试循环 ─────────────────────────────────
  let result = validate(input.schema, jsonText, 0);
  let retriesUsed = 0;

  while (!result.success && result.needsRetry) {
    retriesUsed = result.retryCount + 1;
    const feedback = buildRetryFeedback(result.errors ?? [], jsonText);

    safeResult = await chatFn(
      [{ role: "user", content: feedback }],
      chatOpts
    );

    // ── Token 追踪（重试） ───────────────────────────
    if (input.tracking?.projectId && provider.lastUsage) {
      recordUsageFromProvider(provider, {
        projectId: input.tracking.projectId,
        stageNumber: input.tracking.stageNumber,
        callType: "convergence",
      }).catch(() => {});
    }

    // 重试期间 LLM 失败 → 停止重试，返回已有结果
    if (safeResult.error) {
      return {
        success: false,
        data: result.data as Record<string, any> | undefined,
        errors: [...(result.errors ?? []), `LLM 重试失败: ${safeResult.error}`],
        retriesUsed,
      };
    }

    jsonText = normalizeJSON(safeResult.content);
    jsonText = fixCommonJSONErrors(jsonText);
    result = validate(input.schema, jsonText, retriesUsed);
  }

  return {
    success: result.success,
    data: result.data as Record<string, any> | undefined,
    errors: result.errors,
    retriesUsed: result.retryCount,
  };
}
