/**
 * Stage Engine — 单阶段执行协调器 + Stage Orchestrator
 *
 * Phase 1 流程：Consultation → Convergence → Normalization → Validation → Save
 * Phase 2 新增：Orchestrator（自动推进 + 搜索 + 开场触发的完整编排）
 */

import { runConvergence } from "@/lib/ai/convergence";
import { normalizeJSON, fixCommonJSONErrors } from "./normalizer";
import { validate, buildRetryFeedback } from "./schema-validator";
import { saveStructuredOutput, saveConsultationMessages, getStageRecord } from "@/lib/db/stage-repo";
import { getLLMProvider } from "@/lib/ai/provider";
import { stageExtractors, saveStageEntries, buildMemoryContext } from "@/lib/memory/decision-memory";
import { handleGateDecision, initStageRecord, setStageStatus, canEnterStage } from "@/lib/workflow/workflow";
import { isSearchStage } from "@/lib/ai/loader";
import { runRuleCheck, STAGE_REQUIRED_FIELDS } from "@/lib/audit/rule-check";
import { getProjectById } from "@/lib/db/project-repo";
import { sendMessage } from "@/lib/ai/consultation";
import type { ZodSchema } from "zod";
import type { GateDecision } from "@/lib/workflow/workflow";

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

// ── Phase 1: 完整 Stage Pipeline ──────────────────────

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

    const provider = getLLMProvider();
    rawOutput = await provider.chat(
      [{ role: "user", content: feedback }],
      { temperature: 0.3, maxTokens: 4096, responseFormat: "json_object" }
    );

    jsonText = normalizeJSON(rawOutput);
    jsonText = fixCommonJSONErrors(jsonText);
    result = validate(schema, jsonText, retryCount + 1);
  }

  // ── Step 4: Save + Decision Memory ────────────────
  if (result.success && result.data) {
    await saveStructuredOutput(ctx.projectId, ctx.stage, result.data);

    // 保存完整对话历史
    const messages = ctx.history.map((m, i) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(Date.now() - (ctx.history.length - i) * 1000).toISOString(),
    }));
    await saveConsultationMessages(ctx.projectId, ctx.stage, messages);

    // 提取战略资产
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

// ── Phase 2: Stage Orchestrator ────────────────────────

export interface AdvanceToNextStageInput {
  projectId: string;
  currentStage: number;
  /** 当前阶段的收敛输出 */
  stageOutput: Record<string, any>;
  /** 品牌名 */
  brandName: string;
  /** 品类 */
  category: string;
}

export interface AdvanceResult {
  /** 是否成功推进 */
  advanced: boolean;
  /** 门禁决策 */
  gateDecision: GateDecision;
  /** 新阶段（如果 advanced） */
  nextStage?: number;
  /** AI 的第一条回复（自动触发的开场白） */
  openingMessage?: string;
  /** 搜索是否已执行 */
  searchExecuted: boolean;
  /** Rule Check 结果 */
  ruleCheck: RuleCheckResult;
}

/**
 * Stage Orchestrator — 阶段确认后的自动编排
 *
 * 流程：
 * Step 1: Rule Check（轻量版）
 * Step 2: Gate Decision
 * Step 3: Advance → 推进到 N+1
 * Step 4: 判断是否需要搜索 → 自动搜索
 * Step 5: 构建 Context → 自动触发第一条 Consultation
 */
export async function advanceToNextStage(
  input: AdvanceToNextStageInput
): Promise<AdvanceResult> {
  const { projectId, currentStage, stageOutput, brandName, category } = input;

  // ── Step 1: Rule Check（轻量版）─────────────────────
  const requiredFields = STAGE_REQUIRED_FIELDS[currentStage] ?? [];
  // Rule check 只需要检查非空，schema 验证在 convergence 时已完成
  const ruleCheckResult: RuleCheckResult = {
    passed: true,
    issues: [],
  };

  for (const field of requiredFields) {
    const value = getNestedValue(stageOutput, field);
    if (value === undefined || value === null || value === "") {
      ruleCheckResult.issues.push({
        field,
        message: `必填字段 "${field}" 为空`,
        severity: "error",
      });
    }
  }

  if (ruleCheckResult.issues.filter((i) => i.severity === "error").length > 0) {
    ruleCheckResult.passed = false;
  }

  // ── Step 2: Gate Decision ─────────────────────────
  const gateDecision: GateDecision = ruleCheckResult.passed ? "advance" : "block";

  if (gateDecision !== "advance") {
    await handleGateDecision(projectId, currentStage, gateDecision);
    return {
      advanced: false,
      gateDecision,
      ruleCheck: ruleCheckResult,
      searchExecuted: false,
    };
  }

  // ── Step 3: Advance → 推进到下一阶段 ──────────────
  const { nextStage } = await handleGateDecision(projectId, currentStage, "advance");

  if (!nextStage || nextStage > 8) {
    return {
      advanced: true,
      gateDecision: "advance",
      nextStage: undefined,
      ruleCheck: ruleCheckResult,
      searchExecuted: false,
      openingMessage: "恭喜！您已完成全部八个阶段的品牌战略咨询。可以在报告中查看完整战略成果。",
    };
  }

  // 验证下一阶段依赖
  const canEnter = await canEnterStage(projectId, nextStage);
  if (!canEnter.allowed) {
    return {
      advanced: false,
      gateDecision: "block",
      ruleCheck: {
        passed: false,
        issues: [{ field: "dependency", message: canEnter.reason ?? "依赖未满足", severity: "error" }],
      },
      searchExecuted: false,
    };
  }

  // 初始化下一阶段
  await initStageRecord(projectId, nextStage);
  await setStageStatus(projectId, nextStage, "active");

  // ── Step 4: 自动搜索（如需要）─────────────────────
  let searchContext: string | undefined;
  let searchExecuted = false;

  if (isSearchStage(nextStage)) {
    try {
      // 动态导入避免循环依赖
      const { runSearch } = await import("@/lib/ai/search");
      const memoryCtx = await buildMemoryContext(projectId, nextStage);

      const searchOutput = await runSearch({
        stage: nextStage,
        brandName,
        category,
        decisionMemoryContext: memoryCtx || undefined,
      });

      searchContext = searchOutput.formatted.contextText;
      searchExecuted = searchOutput.retrieved.length > 0;
    } catch (e: any) {
      console.error(`[orchestrator] 搜索失败 (Stage ${nextStage}): ${e.message}`);
      searchContext = `⚠️ 自动搜索未能完成：${e.message}。请基于已有信息继续分析，或手动触发搜索。`;
      searchExecuted = false;
    }
  }

  // ── Step 5: 自动触发第一条 Consultation ───────────
  let openingMessage: string | undefined;

  try {
    const memoryCtx = await buildMemoryContext(projectId, nextStage);

    // 构造初始对话上下文（空历史）
    const ctx = {
      stage: nextStage,
      history: [] as Array<{ role: "user" | "assistant"; content: string }>,
      variables: { 品牌名: brandName, 品类: category },
      decisionMemoryContext: memoryCtx || undefined,
      searchContext,
      includeSearchProtocol: isSearchStage(nextStage),
    };

    // 发送空白触发消息让 AI 主动开口
    const triggerMessage = searchExecuted
      ? "（系统自动触发）请基于以上搜索发现，先向用户展示搜索成果覆盖情况，然后提出本阶段的第一个咨询问题。"
      : "（系统自动触发）请基于前序阶段的战略资产，向用户总结当前阶段的目标和已知信息，然后提出本阶段的第一个咨询问题。";

    openingMessage = await sendMessage(ctx, triggerMessage);
  } catch (e: any) {
    console.error(`[orchestrator] 开场消息生成失败: ${e.message}`);
    openingMessage = `欢迎进入 Stage ${nextStage}。请描述您对本阶段的理解和需求。`;
  }

  return {
    advanced: true,
    gateDecision: "advance",
    nextStage,
    openingMessage,
    searchExecuted,
    ruleCheck: ruleCheckResult,
  };
}

// ── 工具 ──────────────────────────────────────────────

import type { RuleCheckResult } from "@/lib/audit/rule-check";

function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}
