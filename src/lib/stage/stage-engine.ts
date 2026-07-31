/**
 * Stage Engine — 单阶段执行协调器
 *
 * 流程：Consultation → Convergence → Normalization → Validation → Save
 *
 * 注意：
 * - Consultation 由 API 路由逐条处理（SSE 流式）
 * - 此文件处理 Convergence 触发后的完整流水线
 */

import { runConvergence } from "@/lib/ai/convergence";
import { normalizeJSON, fixCommonJSONErrors } from "./normalizer";
import { validate, buildRetryFeedback } from "./schema-validator";
import { saveStructuredOutput, saveConsultationMessages } from "@/lib/db/stage-repo";
import { getLLMProvider } from "@/lib/ai/provider";
import { stageExtractors, saveStageEntries } from "@/lib/memory/decision-memory";
import type { ZodSchema } from "zod";

export interface StageContext {
  projectId: string;
  stage: number;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  variables?: Record<string, string>;
  decisionMemoryContext?: string;
}

export interface StageResult {
  success: boolean;
  output?: Record<string, any>;
  errors?: string[];
  retriesUsed: number;
  needsHumanReview: boolean;
}

/** 执行完整 Stage Pipeline（Convergence → Normalization → Validation → Save） */
export async function runStage(
  ctx: StageContext,
  schema: ZodSchema<any>
): Promise<StageResult> {
  // ── Step 1: Convergence ──────────────────────────
  let rawOutput = await runConvergence({
    stage: ctx.stage,
    history: ctx.history,
    variables: ctx.variables,
    decisionMemoryContext: ctx.decisionMemoryContext,
  });

  // ── Step 2: Normalization ────────────────────────
  let jsonText = normalizeJSON(rawOutput);
  jsonText = fixCommonJSONErrors(jsonText);

  // ── Step 3: Validation + Retry Loop ──────────────
  let result = validate(schema, jsonText, 0);

  while (!result.success && result.needsRetry) {
    const retryCount = result.retryCount;
    const feedback = buildRetryFeedback(result.errors ?? [], jsonText);

    // 重试 Convergence（带上错误反馈）
    const provider = getLLMProvider();
    rawOutput = await provider.chat(
      [
        {
          role: "user",
          content: feedback,
        },
      ],
      { temperature: 0.3, maxTokens: 4096, responseFormat: "json_object" }
    );

    jsonText = normalizeJSON(rawOutput);
    jsonText = fixCommonJSONErrors(jsonText);
    result = validate(schema, jsonText, retryCount + 1);
  }

  // ── Step 4: Save + Decision Memory ────────────────
  if (result.success && result.data) {
    await saveStructuredOutput(ctx.projectId, ctx.stage, result.data);

    // 同时保存完整对话历史
    const messages = ctx.history.map((m, i) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(Date.now() - (ctx.history.length - i) * 1000).toISOString(),
    }));
    await saveConsultationMessages(ctx.projectId, ctx.stage, messages);

    // 提取战略资产到 Decision Memory
    const extractor = stageExtractors[ctx.stage];
    if (extractor) {
      const entries = extractor(ctx.projectId, result.data);
      await saveStageEntries(ctx.projectId, ctx.stage, entries);
    }
  }

  return {
    success: result.success,
    output: result.data,
    errors: result.errors,
    retriesUsed: result.retryCount,
    needsHumanReview: !result.success && result.retryCount >= 3,
  };
}
