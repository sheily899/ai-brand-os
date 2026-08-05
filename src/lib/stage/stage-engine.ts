/**
 * Stage Engine — 单阶段执行协调器 + Stage Orchestrator
 *
 * Phase 1 流程：Consultation → Convergence → Normalization → Validation → Save
 * Phase 2 新增：Orchestrator（自动推进 + 搜索 + 开场触发的完整编排）
 */

import { runConvergence, runConvergenceSplit } from "@/lib/ai/convergence";
import { normalizeJSON, fixCommonJSONErrors } from "./normalizer";
import { validate, buildRetryFeedback } from "./schema-validator";
import { saveStructuredOutput, saveConsultationMessages, getStageRecord, saveSearchContext } from "@/lib/db/stage-repo";
import { getLLMProvider } from "@/lib/ai/provider";
import { stageExtractors, saveStageEntries, buildMemoryContext } from "@/lib/memory/decision-memory";
import { handleGateDecision, initStageRecord, setStageStatus, canEnterStage } from "@/lib/workflow/workflow";
import { isSearchStage } from "@/lib/ai/loader";
import { runRuleCheck, STAGE_REQUIRED_FIELDS } from "@/lib/audit/rule-check";
import { runStageAudit } from "@/lib/audit/audit-engine";
import type { AuditReport } from "@/lib/audit/audit-engine";
import { getProjectById } from "@/lib/db/project-repo";
import { saveAuditResult } from "@/lib/db/stage-repo";
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
  /** 智能优化产出的自然语言确认内容（对话模板格式） */
  naturalLanguage?: string;
  errors?: string[];
  retriesUsed: number;
  needsHumanReview: boolean;
  /**
   * 是否因 data_gap 类型问题触发了补充搜索。
   * 供调用方判断优化是否获得了新数据支撑。
   */
  supplementarySearchAttempted: boolean;
  /**
   * 补充搜索是否返回了可用结果。
   * false = 搜索无果，属于熔断触发条件。
   */
  supplementarySearchHadResults: boolean;
  /**
   * 本次审计反馈中是否包含 data_gap 类型的问题。
   * 供调用方展示差异化的用户反馈。
   */
  hasDataGapIssues: boolean;
  /**
   * 熔断是否触发 — 当全部为 data_gap 问题、搜索无果、且无 expression 问题可修复时为 true。
   * 此时系统应拒绝无意义的改写，改为引导用户手动补充数据或接受现状。
   */
  circuitBreakerTriggered: boolean;
  /**
   * 熔断原因的用户可读说明。仅在 circuitBreakerTriggered 时填充。
   * 包含问题列表和两个操作建议：手动补充 / 接受现状继续。
   */
  circuitBreakerReason?: string;
}

// ── Phase 1: 完整 Stage Pipeline ──────────────────────

/** 执行完整 Stage Pipeline（Convergence → Normalization → Validation → Save） */
export async function runStage(
  ctx: StageContext,
  schema: ZodSchema<any>
): Promise<StageResult> {
  // ── S3 特殊路径：拆分收敛 ────────────────────────
  if (ctx.stage === 3) {
    return runStageSplit(ctx, schema);
  }

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
    const chatFn = provider.chatSafe ?? (async (msgs: any, opts: any) => {
      try { return { content: await provider.chat(msgs, opts) }; }
      catch (e: any) { return { content: "", error: e.message }; }
    });

    const safeResult = await chatFn(
      [{ role: "user", content: feedback }],
      { temperature: 0.3, maxTokens: 4096, responseFormat: "json_object" }
    );

    // 重试期间 LLM 失败 → 停止重试，保留已有错误信息
    if (safeResult.error) {
      console.error(`[runStage] LLM 重试失败: ${safeResult.error}`);
      break;
    }

    jsonText = normalizeJSON(safeResult.content);
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
    supplementarySearchAttempted: false,
    supplementarySearchHadResults: false,
    hasDataGapIssues: false,
    circuitBreakerTriggered: false,
  };
}

/**
 * S3 拆分收敛：Convergence A + B → 各自独立校验/重试 → 合并 → 保存
 *
 * 与普通 runStage 的关键区别：
 * - 搜索数据层（A）和 AI 分析层（B）各自独立调用 LLM
 * - 各自独立 normalize → validate → retry
 * - A 失败不影响 B，B 失败不影响 A
 * - 合并后做一次完整 Schema 校验（兼容 optional 放宽字段）
 */
async function runStageSplit(
  ctx: StageContext,
  schema: ZodSchema<any>
): Promise<StageResult> {
  const splitResult = await runConvergenceSplit({
    stage: ctx.stage,
    history: ctx.history,
    variables: ctx.variables,
    decisionMemoryContext: ctx.decisionMemoryContext,
  });

  const allErrors: string[] = [];
  let totalRetries = 0;

  if (splitResult.searchDataErrors?.length) {
    allErrors.push(
      ...splitResult.searchDataErrors.map((e) => `[搜索数据层] ${e}`)
    );
  }
  if (splitResult.analysisErrors?.length) {
    allErrors.push(
      ...splitResult.analysisErrors.map((e) => `[AI分析层] ${e}`)
    );
  }
  totalRetries = splitResult.searchDataRetries + splitResult.analysisRetries;

  // ── 合并两次调用结果 ──────────────────────────────
  // 搜索数据层失败不影响整体流程——用空对象兜底，标记状态
  const searchDataAvailable = splitResult.searchData !== undefined;
  const analysisAvailable = splitResult.analysis !== undefined;

  const merged: Record<string, any> = {
    ...(splitResult.searchData ?? {}),
    ...(splitResult.analysis ?? {}),
  };

  // 搜索数据层不可用时注入元数据标记（供 AI Quality Audit 和 report 消费）
  if (!searchDataAvailable && analysisAvailable) {
    merged._searchDataStatus = "unavailable";
    merged._searchDataNote = "搜索数据层未成功获取，本阶段市场分析基于 AI 已有知识和用户提供的上下文。";
    // 将搜索层错误降级为 warning（不阻塞流程）
    console.warn(`[runStageSplit] 搜索数据层未成功，降级继续（分析层可用）`);
  }

  // ── 对合并结果做完整 Schema 校验 ─────────────────
  const finalValidation = validate(schema, JSON.stringify(merged), 0);

  // 如果合并后仍有错误（不应出现，除非 A/B 各自通过了但合并后字段冲突）
  if (!finalValidation.success && finalValidation.errors?.length) {
    allErrors.push(
      ...finalValidation.errors.map((e) => `[合并校验] ${e}`)
    );
  }

  // ── 容错成功条件 ──────────────────────────────────
  // 只要 AI 分析层成功即可推进（搜索数据层失败降级为 warning）
  // 合并校验错误仍会导致失败
  const mergeErrors = allErrors.filter((e) => e.includes("[合并校验]"));
  const success =
    mergeErrors.length === 0 &&
    analysisAvailable; // 只要求 AI 分析层成功

  const output = success ? merged : undefined;

  // ── Save + Decision Memory ────────────────────────
  if (success && output) {
    await saveStructuredOutput(ctx.projectId, ctx.stage, output);

    const messages = ctx.history.map((m, i) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(
        Date.now() - (ctx.history.length - i) * 1000
      ).toISOString(),
    }));
    await saveConsultationMessages(ctx.projectId, ctx.stage, messages);

    const extractor = stageExtractors[ctx.stage];
    if (extractor) {
      const entries = extractor(ctx.projectId, output);
      await saveStageEntries(ctx.projectId, ctx.stage, entries);
    }
  }

  return {
    success,
    output,
    errors: allErrors.length > 0 ? allErrors : undefined,
    retriesUsed: totalRetries,
    needsHumanReview: !success,
    supplementarySearchAttempted: false,
    supplementarySearchHadResults: false,
    hasDataGapIssues: false,
    circuitBreakerTriggered: false,
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
  /** 搜索上下文（供后续轮次 consultation 注入，避免搜索结果仅限首轮） */
  searchContext?: string;
  /** Rule Check 结果 */
  ruleCheck: RuleCheckResult;
  /** 完整审计报告（Phase 3 Quality Gate 集成） */
  auditReport?: AuditReport;
}

/**
 * Stage Orchestrator — 阶段确认后的自动编排
 *
 * Phase 3 流程：
 * Step 1-3: Full Audit Engine（Rule Check + Cross Stage + AI Quality Audit）
 * Step 4: Quality Gate Decision → Advance / Reoptimize / Block
 * Step 5: Advance → 推进到 N+1 → 自动搜索 → 自动触发第一条 Consultation
 */
export async function advanceToNextStage(
  input: AdvanceToNextStageInput
): Promise<AdvanceResult> {
  const { projectId, currentStage, stageOutput, brandName, category } = input;

  // ── Step 1-3: Full Audit Engine（Rule Check + Cross Stage + AI Quality Audit）─
  // Phase 3 增强：替换 Phase 2 的轻量 Rule Check，运行完整三组件审计
  let auditReport: AuditReport;
  try {
    auditReport = await runStageAudit(projectId, currentStage, stageOutput);
  } catch (e: any) {
    console.error(`[orchestrator] Audit Engine 失败 (Stage ${currentStage}): ${e.message}`);
    // 降级：使用轻量 Rule Check（保持 Phase 2 兼容性）
    const requiredFields = STAGE_REQUIRED_FIELDS[currentStage] ?? [];
    const fallbackRuleCheck = runRuleCheck(stageOutput, undefined, requiredFields, currentStage);
    auditReport = {
      projectId,
      stageNumber: currentStage,
      ruleCheck: fallbackRuleCheck,
      crossStage: null,
      aiAudit: null,
      gateDecision: fallbackRuleCheck.passed ? "advance" : "block",
      allIssues: [],
      referenceIssues: [],
      needsHumanReview: !fallbackRuleCheck.passed,
      executedAt: new Date(),
    };
  }

  // 保存审计结果到 StageRecord（无论 advance/reoptimize/block）
  try {
    await saveAuditResult(projectId, currentStage, auditReport);
  } catch (e: any) {
    console.error(`[orchestrator] 审计结果保存失败: ${e.message}`);
  }

  const gateDecision = auditReport.gateDecision;
  const ruleCheckResult = auditReport.ruleCheck;

  // ── 处理非 advance 决策 ──────────────────────────
  if (gateDecision !== "advance") {
    await handleGateDecision(projectId, currentStage, gateDecision);
    return {
      advanced: false,
      gateDecision,
      ruleCheck: ruleCheckResult,
      auditReport,
      searchExecuted: false,
      searchContext: undefined,
    };
  }

  // ── Advance → 推进到下一阶段 ────────────────────
  const { nextStage } = await handleGateDecision(projectId, currentStage, "advance");

  if (!nextStage || nextStage > 8) {
    return {
      advanced: true,
      gateDecision: "advance",
      nextStage: undefined,
      ruleCheck: ruleCheckResult,
      auditReport,
      searchExecuted: false,
      searchContext: undefined,
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
      auditReport,
      searchExecuted: false,
      searchContext: undefined,
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

  // ── 持久化 searchContext 到 stage_record ──────────────
  if (searchContext) {
    try {
      await saveSearchContext(projectId, nextStage, searchContext);
    } catch (e: any) {
      console.error(`[orchestrator] 搜索上下文保存失败: ${e.message}`);
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
      tracking: { projectId, callType: "opening" as const },
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

  // 持久化开场消息到 consultationMessages，确保刷新后不丢失
  if (openingMessage) {
    try {
      await saveConsultationMessages(projectId, nextStage, [
        { role: "assistant", content: openingMessage, timestamp: new Date().toISOString() },
      ]);
    } catch (e: any) {
      console.error(`[orchestrator] 开场消息保存失败: ${e.message}`);
    }
  }

  return {
    advanced: true,
    gateDecision: "advance",
    nextStage,
    openingMessage,
    searchExecuted,
    searchContext,
    ruleCheck: ruleCheckResult,
    auditReport,
  };
}

// ── 阶段重执行 ──────────────────────────────────────────

/**
 * 重新执行一个失效阶段。
 *
 * 流程：
 * 1. 保留原有 consultationMessages 作为历史参考
 * 2. 注入更新后的 Decision Memory Context
 * 3. 重新 Consultation（在现有对话基础上追加）→ Convergence → Save
 * 4. 保存完成后，对更下游阶段级联触发影响分析
 */
export async function reExecuteStage(
  projectId: string,
  stageNumber: number,
  schema: ZodSchema<any>,
  brandName: string,
  category: string
): Promise<StageResult> {
  const { revalidateStage } = await import("@/lib/workflow/workflow");
  const { getBlockedBy } = await import("@/lib/memory/dependency-graph");
  const { analyzeImpact } = await import("@/lib/audit/impact-analyzer");
  const { invalidateDownstream } = await import("@/lib/workflow/workflow");

  // 1. 重置阶段状态为 active
  await revalidateStage(projectId, stageNumber);

  // 2. 读取原有对话历史 + 构建新 Context
  const record = await getStageRecord(projectId, stageNumber);
  const existingHistory: Array<{ role: "user" | "assistant"; content: string }> =
    (record?.consultationMessages as any[])?.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? [];

  const decisionMemoryContext = await buildMemoryContext(projectId, stageNumber);

  // 3. 在现有对话基础上追加一轮 AI 引导消息
  const ctx: StageContext = {
    projectId,
    stage: stageNumber,
    history: existingHistory,
    variables: { 品牌名: brandName, 品类: category },
    decisionMemoryContext: decisionMemoryContext || undefined,
  };

  // 4. 执行完整 Pipeline（S3 自动走拆分路径）
  const result = await runStage(ctx, schema);

  // 5. 级联重分析：对新输出检查更下游阶段
  if (result.success) {
    const furtherDownstream = getBlockedBy(stageNumber);
    for (const ds of furtherDownstream) {
      const dsRecord = await getStageRecord(projectId, ds);
      if (!dsRecord?.structuredOutput) continue;

      // 对每个更下游阶段，检查旧输出与新上游输出的影响
      const previousOutput = JSON.stringify(dsRecord.structuredOutput);
      const newUpstreamOutput = JSON.stringify(result.output);

      // 简单对比：如果上游新输出与下游旧输出中存在不一致的关键引用
      // 这里用保守策略——只要上游被重跑了，下游就标记为 needs_review
      if (previousOutput.length > 0 && newUpstreamOutput.length > 0) {
        await invalidateDownstream(projectId, [ds]);
      }
    }
  }

  return result;
}

// ── 智能优化 ──────────────────────────────────────────────

/**
 * 根据审计反馈智能优化阶段输出。
 *
 * 流程：
 * 1. 读取当前结构化输出 + 审计报告
 * 2. 按 issueType 分类问题（expression vs data_gap）
 * 3. 若存在 data_gap 问题 → 触发补充搜索
 * 4. 构建优化 Prompt（注入问题、评分、改进建议，含搜索数据）
 * 5. LLM 生成优化后的输出
 * 6. Schema Validation + Retry
 * 7. 保存新的结构化输出
 *
 * @param brandName - 品牌名，data_gap 搜索时需要
 * @param category - 品类，data_gap 搜索时需要
 */
export async function reOptimizeStage(
  projectId: string,
  stageNumber: number,
  schema: ZodSchema<any>,
  auditReport: AuditReport,
  brandName?: string,
  category?: string
): Promise<StageResult> {
  // 1. 读取当前输出
  const record = await getStageRecord(projectId, stageNumber);
  const currentOutput = record?.structuredOutput;
  if (!currentOutput) {
    return {
      success: false,
      errors: ["当前阶段没有结构化输出，无法优化"],
      retriesUsed: 0,
      needsHumanReview: true,
      supplementarySearchAttempted: false,
      supplementarySearchHadResults: false,
      hasDataGapIssues: false,
    circuitBreakerTriggered: false,
    };
  }

  // 2. 按 issueType 分类问题 + 条件触发补充搜索
  const { aiAudit, ruleCheck, referenceIssues } = auditReport;

  const dataGapIssues = aiAudit?.issues?.filter(i => i.issueType === "data_gap") ?? [];
  const expressionIssues = aiAudit?.issues?.filter(i => i.issueType === "expression") ?? [];
  const hasDataGapIssues = dataGapIssues.length > 0;
  const hasExpressionIssues = expressionIssues.length > 0;

  let supplementarySearchAttempted = false;
  let supplementarySearchHadResults = false;
  let searchContext: string | undefined;

  if (hasDataGapIssues && brandName && category) {
    supplementarySearchAttempted = true;
    try {
      const { runSearch } = await import("@/lib/ai/search");
      const memoryCtx = await buildMemoryContext(projectId, stageNumber);

      const searchOutput = await runSearch({
        stage: stageNumber,
        brandName,
        category,
        decisionMemoryContext: memoryCtx || undefined,
      });

      supplementarySearchHadResults = searchOutput.retrieved.length > 0;
      if (supplementarySearchHadResults) {
        searchContext = searchOutput.formatted.contextText;
        // 持久化搜索结果到 stage_record
        try {
          await saveSearchContext(projectId, stageNumber, searchContext);
        } catch (e: any) {
          console.error(`[reoptimize] 搜索上下文保存失败: ${e.message}`);
        }
      }
      console.log(
        `[reoptimize] 补充搜索完成: data_gap 问题 ${dataGapIssues.length} 个, ` +
        `搜索到 ${searchOutput.retrieved.length} 条结果`
      );
    } catch (e: any) {
      console.error(`[reoptimize] 补充搜索失败: ${e.message}`);
      supplementarySearchHadResults = false;
    }
  } else if (hasDataGapIssues && (!brandName || !category)) {
    console.warn(
      `[reoptimize] 检测到 ${dataGapIssues.length} 个 data_gap 问题但缺少品牌名/品类，跳过补充搜索`
    );
  }

  // ── 2.5 熔断检查 ──────────────────────────────────────
  // 条件：全部为 data_gap 问题 + 搜索已尝试 + 搜索无结果 + 无 expression 问题可修复
  // 此时继续改写是无效的——AI 没有新数据可以注入，也不存在表达层面的问题需要修复
  if (
    hasDataGapIssues &&
    supplementarySearchAttempted &&
    !supplementarySearchHadResults &&
    !hasExpressionIssues
  ) {
    const issueDescriptions = dataGapIssues
      .map((i) => `- [${i.dimension}] ${i.description}`)
      .join("\n");

    const reason = `## 优化无法继续——数据缺口无法通过改写修复

审计发现以下问题全部属于"数据/证据缺失"类型，无法通过重新措辞来修复：

${issueDescriptions}

补充搜索未能找到可验证的公开数据。

### 接下来你可以：

**选项 A：手动补充信息**
如果你掌握以下信息，可以直接在对话中提供，AI 会将其融入阶段输出：
- 具体的行业报告名称、年份和数据点
- 用户调研样本量和行为记录
- 竞品对比数据或用户评价原文
- 其他可验证的外部数据来源

**选项 B：接受当前内容，标注为待验证状态**
如果你认可当前的分析方向，可以接受现状继续推进。报告中会保留"待验证"标注，后续阶段可以在数据更充分时回退修改。

请告诉我你想选择哪个方向。`;

    return {
      success: false,
      errors: [reason],
      retriesUsed: 0,
      needsHumanReview: true,
      supplementarySearchAttempted,
      supplementarySearchHadResults,
      hasDataGapIssues,
      circuitBreakerTriggered: true,
      circuitBreakerReason: reason,
    };
  }

  // 3. 构建审计反馈摘要
  let auditFeedback = "";

  // 综合评分
  if (aiAudit) {
    auditFeedback += `综合评分: ${aiAudit.totalScore}/100\n\n`;
    auditFeedback += "四维评估:\n";
    for (const ds of aiAudit.dimensionScores) {
      auditFeedback += `- ${ds.dimension}: ${ds.score}/5 — ${ds.reason}\n`;
      if (ds.improvements?.length) {
        auditFeedback += `  改进建议: ${ds.improvements.join("；")}\n`;
      }
    }
    auditFeedback += "\n";
  }

  // AI 发现的问题
  if (aiAudit?.issues?.length) {
    auditFeedback += "发现的问题:\n";
    for (const issue of aiAudit.issues) {
      const typeTag = issue.issueType === "data_gap" ? "[数据缺口]" : "[表达问题]";
      auditFeedback += `- ${typeTag} [${issue.severity}] ${issue.description}`;
      if (issue.suggestion) auditFeedback += ` → ${issue.suggestion}`;
      auditFeedback += "\n";
    }
    auditFeedback += "\n";
  }

  // 结构检查
  if (ruleCheck?.issues?.length) {
    auditFeedback += "结构检查:\n";
    for (const issue of ruleCheck.issues) {
      auditFeedback += `- [${issue.severity}] ${issue.field ? issue.field + ": " : ""}${issue.message}\n`;
    }
    auditFeedback += "\n";
  }

  // 跨阶段引用
  if (referenceIssues?.length) {
    auditFeedback += "跨阶段引用检查:\n";
    for (const ref of referenceIssues) {
      auditFeedback += `- [${ref.severity}] ${ref.userMessage || ref.message}\n`;
    }
    auditFeedback += "\n";
  }

  // 3. 读取对话历史中的语气参考
  const messages = (record?.consultationMessages as any[]) ?? [];
  const recentAssistantMsgs = [...messages]
    .reverse()
    .filter((m: any) => m.role === "assistant")
    .slice(0, 3)
    .map((m: any) => m.content);
  const voiceReference =
    recentAssistantMsgs.length > 0
      ? `\n## AI 顾问对话语气参考\n以下是该阶段 AI 顾问与用户对话中的实际回复（提取其语气、句长、称呼习惯即可，内容忽略）：\n\n${recentAssistantMsgs.map((c: string) => `- ${c.slice(0, 200)}`).join("\n")}\n`
      : "";

  // 4. 各阶段完整确认总结模板（标题加粗 + 重点内容加粗）
  const CONFIRM_TEMPLATES: Record<number, string> = {
    1: `## S1 确认总结模板（必须严格按此格式输出）

以「好的，让我复述一下确保理解对了——」开头。

你做这件事是因为 [创始动机]。你观察到的具体现象是 [观察 1-2 条]。
[按创始人类型选择：问题驱动型→你确认存在的问题是 [核心问题，1-2 条]。现在大家的应对方式是 [现有方案]。
创作驱动型→这个创作选择背后，你觉得打动人的地方是 [创作依据]。和 [参照对象] 比，你想做的不同在于 [差异]。]
你想象中的用户是 [用户假设]，你觉得机会可能在于 [机会假设]——这两个都是你目前的判断，还没有经过验证。
资源方面：[约束概述]。

控制在 5-8 句话以内，不使用表格。对关键的品牌名、核心概念、重要数据可用 **加粗** 突出。
末尾：「如果哪里理解得不对，现在告诉我。如果以上内容准确，请回复**确认**。」`,

    2: `## S2 确认总结模板（必须严格按此格式输出）

以「好的，让我确认一下目前的理解：」开头。

**商业背景**
[行业环境 + 市场变化趋势 + 为什么现在值得关注]

**核心挑战**
[用户当前面临的问题 + 现有解决方式的不足 + 如果问题持续存在的影响]

**品牌战略方向**
[品牌未来应该优先解决的问题 + 基于当前资源条件的方向判断]

要求：报告级表达，不使用表格。标题使用 **加粗** 格式，段落中关键数据和判断可用 **加粗** 突出。
末尾：「如果理解有偏差，请告诉我。如果以上内容准确，请回复**确认**。」`,

    3: `## S3 确认总结模板（必须严格按此格式输出）

以「好的，让我确认一下目前的理解：」开头。

**品类现状**

| 维度 | 当前状态 | 变化趋势 |
|------|---------|---------|
| 市场规模 | [当前规模特征] | [规模变化方向] |
| 用户需求 | [当前需求特征] | [需求变化方向] |
| 供给格局 | [当前供给特征] | [供给变化方向] |

**当前体验不足**
[体验缺口描述 + 替代方案 + 满足了什么却未满足什么 + 影响程度]。第二个体验缺口同理。

**品牌机会方向**
[机会方向1，注明判断依据是数据/观察/推测]
[机会方向2，注明判断依据]

要求：必须使用 markdown 表格呈现品类现状。标题使用 **加粗** 格式，段落中关键数据可用 **加粗** 突出。
末尾：「如果理解有偏差，请告诉我。如果以上内容准确，请回复**确认**。」`,

    4: `## S4 确认总结模板（必须严格按此格式输出）

以「好的，让我确认一下消费者这部分：」开头。

**目标消费者定义**
我们目前关注的消费者画像：[基于决策动机与行为特征的人群描述，不提及具体个人姓名]。
他们通常会在 [具体场景] 下产生这个需求。

**当前解决方案与不足**
目前他们主要采用 [解决路径] 来应对，比如 [具体方案]。
这种方式能够满足 [已经满足的部分]，但在 [未被满足的体验] 上仍存在不足。

**深层需求分析**
从目前的信息来看，他们首先希望解决的是 [功能需求]。
进一步来看，这个需求可能还涉及 [情感或身份层需求]，但这一部分仍需要后续验证。

要求：报告级表达，不使用表格。标题使用 **加粗** 格式，段落中关键判断可用 **加粗** 突出。
末尾：「如果理解有偏差，请告诉我。如果以上内容准确，请回复**确认**。」`,

    5: `## S5 确认总结模板（必须严格按此格式输出）

以「好的，让我总结一下竞争这部分：」开头。

**竞争方向**

| 竞争类型 | 代表品牌 | 核心打法 | 用户需求 |
|---------|---------|---------|---------|
| [类型] | [品牌] | [主要竞争方式] | [这类品牌主要满足用户的什么需求] |

**竞品分析**

| 品牌 | 定位 | 核心优势 | 局限 | 可突破空间 |
|------|------|---------|------|-----------|
| [品牌A] | [定位描述] | [优势] | [局限] | [探索空间] |
| [品牌B] | [定位描述] | [优势] | [局限] | [探索空间] |

以上是基于目前信息形成的竞争判断，其中部分空间仍需要后续验证。

要求：必须使用 markdown 表格呈现竞争方向和竞品分析。标题使用 **加粗** 格式，关键判断可用 **加粗** 突出。
末尾：「如果以上内容准确，请回复**确认**。」`,

    6: `## S6 确认总结模板（必须严格按此格式输出）

以「好的，让我确认品牌核心战略这部分：」开头。

**品牌定位**
你的品牌希望成为：
[目标消费者] 在 [品类/场景] 中，因为 [核心价值] 而选择的品牌。
选择这个方向的原因是：[支撑理由]

**价值主张拆解**

| 层级 | 内容 | 推导逻辑 |
|------|------|---------|
| 功能价值 | [功能价值] | 基于[用户问题/产品能力] |
| 情绪价值 | [情绪价值] | 基于[消费者心理需求] |
| 社会价值 | [社会价值] | 基于[消费者身份表达/价值认同] |

**品牌故事**
[一段完整叙事，包含四层递进：品牌因何而起 → 用户面临什么问题与冲突 → 品牌相信什么理念 → 品牌采取了什么行动。不写成表格或分段标签，是一段有画面感的连贯叙事。]

**品牌人格**
这个品牌像一个：[人格描述]
在具体场景中，它会：[行为表现]
同时不会：[行为边界]

要求：必须使用 markdown 表格呈现价值主张拆解。标题使用 **加粗** 格式，品牌故事是一段完整叙事。
末尾：「理解得对吗？如果以上内容准确，请回复**确认**。」`,

    7: `## S7 确认总结模板（必须严格按此格式输出）

以「好的，这是视觉方向的确认：」开头。

**视觉核心概念**
[一句完整的视觉核心概念，至少 10 个字]

**视觉关键词**
[关键词1]、[关键词2]、[关键词3]

**视觉语言系统**

| 类型 | 策略方向 | 具体表达 |
|------|---------|---------|
| 形态语言 | [内容] | [内容] |
| 色彩语言 | [内容] | [内容] |
| 字体语言 | [内容] | [内容] |
| 图像语言 | [内容] | [内容] |
| 材质语言 | [内容] | [内容] |

**视觉禁区**
[禁区1]
原因：[原因]

[禁区2]
原因：[原因]

[禁区3]
原因：[原因]

要求：必须使用 markdown 表格呈现视觉语言系统。视觉禁区使用「[禁区描述] 原因：[原因]」格式，不得写成列表项。标题使用 **加粗** 格式。
末尾：「理解得对吗？如果以上内容准确，请回复**确认**。」`,

    8: `## S8 确认总结模板（必须严格按此格式输出）

以「好的，让我确认一下内容策略这部分：」开头。

这个品牌长期希望围绕 [内容核心方向] 与用户建立连接。

**内容价值体系**

| 用户阶段 | 用户问题 | 内容价值 |
|---------|---------|---------|
| 认知阶段 | [用户想了解什么] | [内容提供什么价值] |
| 兴趣阶段 | [用户想了解什么] | [内容提供什么价值] |
| 信任阶段 | [用户想了解什么] | [内容提供什么价值] |
| 转化阶段 | [用户想了解什么] | [内容提供什么价值] |

**内容主题方向**

| 内容支柱 | 核心目的 | 选题方向 |
|---------|---------|---------|
| [支柱1] | [目的] | [方向] |
| [支柱2] | [目的] | [方向] |

**渠道表达策略**

| 平台 | 内容形式 | 表达重点 |
|------|---------|---------|
| 小红书 | [形式] | [重点] |
| 抖音 | [形式] | [重点] |
| 微信 | [形式] | [重点] |

要求：必须使用 markdown 表格呈现内容价值体系、内容主题方向、渠道表达策略。标题使用 **加粗** 格式。
末尾：「理解得对吗？如果以上内容准确，请回复**确认**。」`,
  };

  const confirmTemplate = CONFIRM_TEMPLATES[stageNumber] ?? "";

  // 5. 构建优化 Prompt（自然语言 + JSON 双输出）
  //    根据是否有补充搜索数据，注入不同的指引
  const searchGuidance = searchContext
    ? `\n## 补充搜索数据\n\n以下是针对审计发现的"数据缺口"问题重新搜索获取的最新数据。请将这些数据融入优化后的输出中：\n\n---\n${searchContext}\n---\n\n重要：请在优化时优先使用这些新数据填充之前标注为"待验证"或"搜索范围内未找到"的字段。数据来源引用请保持原始格式（报告名称、年份、URL）。\n`
    : hasDataGapIssues
      ? `\n## ⚠️ 数据缺口警告\n\n审计发现本阶段存在 ${dataGapIssues.length} 个数据缺口类问题，但补充搜索未能获取到新的可用数据。\n请勿凭空编造数据——对于仍无法验证的信息，保留"待验证"标注或如实说明数据限制。\n请在表达层面优化其他方面（具体度、差异化、可执行性），但不要在证据层面添加未经证实的数据。\n`
      : "";

  const issueTypeGuidance = hasDataGapIssues
    ? `\n## 问题分类指引\n\n审计反馈中每个问题都标注了类型：\n- **[数据缺口]**：底层数据/证据缺失，需要通过补充搜索或用户输入来填充。${
        searchContext
          ? "搜索结果已在上方提供，请直接引用。"
          : "本次未获取到新数据——不要编造数据，保留'待验证'标注。"
      }\n- **[表达问题]**：信息已有但表达不佳——请通过调整措辞、优化结构、补充细节来修复。\n`
    : "";

  const optimizerPrompt = `你是一个品牌战略顾问。当前阶段的审计发现了以下问题，需要你对阶段输出进行针对性优化。

${voiceReference}
## 当前结构化输出
\`\`\`json
${JSON.stringify(currentOutput, null, 2)}
\`\`\`

## 审计反馈
${auditFeedback}
${searchGuidance}${issueTypeGuidance}
## 输出格式要求

你需要输出两个部分：

**第一部分：优化后的确认总结（自然语言）**
${confirmTemplate}

重要：
- 严格按照上面的模板格式输出，不要改动结构
- 模板中的 [方括号] 是占位符，替换为优化后的实际内容
- 将审计反馈中的改进建议融入优化后的内容
- 不要输出优化过程解释、审计分析、"我改了什么"之类的说明
- 不要输出 "---JSON---" 以外的分隔符

**第二部分：结构化 JSON**
在确认总结之后，新起一行输出 \`---JSON---\`，然后输出完整的优化后 JSON。
JSON 部分不使用 markdown 代码块包裹。`;

  // 6. 调用 LLM 生成优化版本（不使用 json_object，因为输出以自然语言开头）
  const provider = getLLMProvider();
  const rawOutput = await provider.chat(
    [{ role: "user", content: optimizerPrompt }],
    { temperature: 0.3, maxTokens: 4096 }
  );

  // 6. 解析双输出：自然语言 + JSON
  const separatorIndex = rawOutput.indexOf("---JSON---");
  let naturalLanguage = "";
  let jsonRaw = "";

  if (separatorIndex !== -1) {
    naturalLanguage = rawOutput.slice(0, separatorIndex).trim();
    jsonRaw = rawOutput.slice(separatorIndex + "---JSON---".length).trim();
  } else {
    // 降级：没找到分隔符，尝试整段解析为 JSON（可能是纯 JSON 输出）
    jsonRaw = rawOutput;
  }

  // 7. Normalization + Validation + Retry（JSON 部分）
  let jsonText = normalizeJSON(jsonRaw);
  jsonText = fixCommonJSONErrors(jsonText);

  let result = validate(schema, jsonText, 0);
  let retriesUsed = 0;

  while (!result.success && result.needsRetry) {
    retriesUsed = result.retryCount + 1;
    const feedback = buildRetryFeedback(result.errors ?? [], jsonText);

    const chatFn = provider.chatSafe ?? (async (msgs: any, opts: any) => {
      try { return { content: await provider.chat(msgs, opts) }; }
      catch (e: any) { return { content: "", error: e.message }; }
    });

    const safeRetry = await chatFn(
      [{ role: "user", content: feedback }],
      { temperature: 0.3, maxTokens: 4096, responseFormat: "json_object" }
    );

    // 重试期间 LLM 失败 → 停止重试
    if (safeRetry.error) {
      console.error(`[reOptimizeStage] LLM 重试失败: ${safeRetry.error}`);
      break;
    }

    jsonText = normalizeJSON(safeRetry.content);
    jsonText = fixCommonJSONErrors(jsonText);
    result = validate(schema, jsonText, retriesUsed);
  }

  // 8. 保存优化结果
  if (result.success && result.data) {
    await saveStructuredOutput(projectId, stageNumber, result.data);

    // 重新提取战略资产
    const extractor = stageExtractors[stageNumber];
    if (extractor) {
      const entries = extractor(projectId, result.data);
      await saveStageEntries(projectId, stageNumber, entries);
    }
  }

  return {
    success: result.success,
    output: result.data,
    naturalLanguage: naturalLanguage || undefined,
    errors: result.errors,
    retriesUsed: result.retryCount,
    needsHumanReview: !result.success && result.retryCount >= 3,
    supplementarySearchAttempted,
    supplementarySearchHadResults,
    hasDataGapIssues,
    circuitBreakerTriggered: false,
  };
}

// ── Phase 4: Confirm & Complete Pipeline ─────────────────

export interface ConfirmAndCompleteInput {
  projectId: string;
  stageNumber: number;
  brandName: string;
  category: string;
  /** 对应阶段的 Zod Schema */
  schema: ZodSchema<any>;
}

export interface ConfirmAndCompleteResult {
  success: boolean;
  /** 结构化阶段输出 */
  stageOutput?: Record<string, any>;
  /** 审计报告 */
  auditReport?: AuditReport;
  /** 门禁决策 */
  gateDecision?: GateDecision;
  /** 是否推进到下一阶段 */
  advanced: boolean;
  /** 下一阶段（如果 advanced） */
  nextStage?: number;
  /** 下一阶段的开场消息 */
  openingMessage?: string;
  /** 错误信息 */
  errors?: string[];
}

/**
 * Confirm & Complete Pipeline — 用户确认后的一体化完成流程
 *
 * 执行顺序：
 * 1. 读取对话历史
 * 2. Convergence → 结构化阶段输出
 * 3. 保存 StageOutput
 * 4. 更新 Decision Memory
 * 5. 执行 Audit（Rule Check + AI Quality Audit + Cross Stage）
 * 6. 保存 Audit Result
 * 7. Gate Decision → Advance/Reoptimize/Block
 * 8. Advance → 推进到下一阶段 + 自动开场
 */
export async function confirmAndCompleteStage(
  input: ConfirmAndCompleteInput
): Promise<ConfirmAndCompleteResult> {
  const { projectId, stageNumber, brandName, category, schema } = input;
  const errors: string[] = [];

  // ── Step 1: 读取对话历史 ──────────────────────────
  const record = await getStageRecord(projectId, stageNumber);
  const history: Array<{ role: "user" | "assistant"; content: string }> =
    (record?.consultationMessages as any[])?.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })) ?? [];

  if (history.length === 0) {
    return { success: false, advanced: false, errors: ["没有对话记录"] };
  }

  // ── Step 2: Convergence ──────────────────────────
  const decisionMemoryContext = await buildMemoryContext(projectId, stageNumber);

  let stageResult: StageResult;
  try {
    if (stageNumber === 3) {
      // S3 拆分收敛路径
      stageResult = await runStage(
        { projectId, stage: stageNumber, history, variables: { 品牌名: brandName, 品类: category }, decisionMemoryContext: decisionMemoryContext || undefined },
        schema
      );
    } else {
      stageResult = await runStage(
        { projectId, stage: stageNumber, history, variables: { 品牌名: brandName, 品类: category }, decisionMemoryContext: decisionMemoryContext || undefined },
        schema
      );
    }
  } catch (e: any) {
    errors.push(`Convergence 失败: ${e.message}`);
    return { success: false, advanced: false, errors };
  }

  if (!stageResult.success || !stageResult.output) {
    return {
      success: false,
      advanced: false,
      errors: stageResult.errors ?? ["Convergence 未产生有效输出"],
    };
  }

  const stageOutput = stageResult.output;
  console.log(`[confirm-pipeline] Step 2 完成: Convergence 成功 (Stage ${stageNumber})`);

  // ── Step 3: StageOutput 已由 runStage 保存 ──────
  // runStage 内部调用了 saveStructuredOutput + saveConsultationMessages + saveStageEntries
  console.log(`[confirm-pipeline] Step 3 完成: StageOutput 已持久化`);

  // ── Step 4: Decision Memory 已由 runStage 更新 ──
  // saveStageEntries 在 runStage 中已调用
  console.log(`[confirm-pipeline] Step 4 完成: Decision Memory 已更新`);

  // ── Step 5: Audit ────────────────────────────────
  let auditReport: AuditReport;
  try {
    auditReport = await runStageAudit(projectId, stageNumber, stageOutput);
    console.log(`[confirm-pipeline] Step 5 完成: Audit (总分=${auditReport.aiAudit?.totalScore ?? "N/A"})`);
  } catch (e: any) {
    console.error(`[confirm-pipeline] Audit 失败: ${e.message}`);
    const requiredFields = STAGE_REQUIRED_FIELDS[stageNumber] ?? [];
    const fallbackRuleCheck = runRuleCheck(stageOutput, undefined, requiredFields, stageNumber);
    auditReport = {
      projectId,
      stageNumber,
      ruleCheck: fallbackRuleCheck,
      crossStage: null,
      aiAudit: null,
      gateDecision: fallbackRuleCheck.passed ? "advance" : "block",
      allIssues: [],
      referenceIssues: [],
      needsHumanReview: !fallbackRuleCheck.passed,
      executedAt: new Date(),
    };
  }

  // ── Step 6: 保存 Audit Result ────────────────────
  try {
    await saveAuditResult(projectId, stageNumber, auditReport);
    console.log(`[confirm-pipeline] Step 6 完成: Audit Result 已保存`);
  } catch (e: any) {
    console.error(`[confirm-pipeline] 审计结果保存失败: ${e.message}`);
  }

  const gateDecision = auditReport.gateDecision;

  // ── Step 7: Gate Decision ────────────────────────
  if (gateDecision !== "advance") {
    await handleGateDecision(projectId, stageNumber, gateDecision);
    console.log(`[confirm-pipeline] Step 7: Gate = ${gateDecision}，不推进`);
    return {
      success: true,
      stageOutput,
      auditReport,
      gateDecision,
      advanced: false,
      errors: gateDecision === "block" ? ["阶段被阻断，需手动修复"] : undefined,
    };
  }

  // ── Step 8: Advance → 下一阶段 ───────────────────
  const { nextStage } = await handleGateDecision(projectId, stageNumber, "advance");
  console.log(`[confirm-pipeline] Step 8: Stage ${stageNumber} → Completed`);

  if (!nextStage || nextStage > 8) {
    return {
      success: true,
      stageOutput,
      auditReport,
      gateDecision: "advance",
      advanced: true,
      nextStage: undefined,
      openingMessage: "恭喜！您已完成全部八个阶段的品牌战略咨询。可以在报告中查看完整战略成果。",
    };
  }

  // 验证下一阶段依赖
  const canEnter = await canEnterStage(projectId, nextStage);
  if (!canEnter.allowed) {
    return {
      success: false,
      stageOutput,
      auditReport,
      gateDecision: "block",
      advanced: false,
      errors: [canEnter.reason ?? "依赖未满足"],
    };
  }

  // 初始化下一阶段
  await initStageRecord(projectId, nextStage);
  await setStageStatus(projectId, nextStage, "active");

  // 自动搜索
  let searchContext: string | undefined;
  if (isSearchStage(nextStage)) {
    try {
      const { runSearch } = await import("@/lib/ai/search");
      const memoryCtx = await buildMemoryContext(projectId, nextStage);
      const searchOutput = await runSearch({
        stage: nextStage,
        brandName,
        category,
        decisionMemoryContext: memoryCtx || undefined,
      });
      searchContext = searchOutput.formatted.contextText;
      if (searchContext) {
        await saveSearchContext(projectId, nextStage, searchContext);
      }
    } catch (e: any) {
      console.error(`[confirm-pipeline] 搜索失败: ${e.message}`);
    }
  }

  // 自动开场
  let openingMessage: string | undefined;
  try {
    const memoryCtx = await buildMemoryContext(projectId, nextStage);
    const ctx = {
      stage: nextStage,
      history: [] as Array<{ role: "user" | "assistant"; content: string }>,
      variables: { 品牌名: brandName, 品类: category },
      decisionMemoryContext: memoryCtx || undefined,
      searchContext,
      includeSearchProtocol: isSearchStage(nextStage),
      tracking: { projectId, callType: "opening" as const },
    };

    const triggerMessage = searchContext
      ? "（系统自动触发）请基于以上搜索发现，先向用户展示搜索成果覆盖情况，然后提出本阶段的第一个咨询问题。"
      : "（系统自动触发）请基于前序阶段的战略资产，向用户总结当前阶段的目标和已知信息，然后提出本阶段的第一个咨询问题。";

    openingMessage = await sendMessage(ctx, triggerMessage);
  } catch (e: any) {
    console.error(`[confirm-pipeline] 开场消息生成失败: ${e.message}`);
    openingMessage = `欢迎进入 Stage ${nextStage}。请描述您对本阶段的理解和需求。`;
  }

  // 持久化开场消息
  if (openingMessage) {
    try {
      await saveConsultationMessages(projectId, nextStage, [
        { role: "assistant", content: openingMessage, timestamp: new Date().toISOString() },
      ]);
    } catch (e: any) {
      console.error(`[confirm-pipeline] 开场消息保存失败: ${e.message}`);
    }
  }

  return {
    success: true,
    stageOutput,
    auditReport,
    gateDecision: "advance",
    advanced: true,
    nextStage,
    openingMessage,
  };
}

// ── 工具 ──────────────────────────────────────────────

import type { RuleCheckResult } from "@/lib/audit/rule-check";
