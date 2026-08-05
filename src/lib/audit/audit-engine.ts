/**
 * Stage Audit Engine — 三组件协调器（Phase 3）
 *
 * 职责：
 * - 协调 Rule Check → Cross Stage → AI Quality Audit 的执行顺序
 * - 合并三组件结果，输出统一的 Quality Gate 决策
 *
 * 架构（Phase 3.3 完整版）：
 *   Stage Output
 *       │
 *       ├── Step 1: Rule Check（纯代码，必跑）
 *       │     └── 字段完整性 + 逻辑冲突 + 字段一致性
 *       │
 *       ├── Step 2: Cross Stage Layer A（纯代码，条件触发）
 *       │     └── 引用完整性检查（依赖图驱动，DB 读取上游决策）
 *       │
 *       ├── Step 3: AI Quality Audit（LLM 调用，必跑）
 *       │     └── 四维评分 + Layer B 语义断裂检查（复用同次 LLM 调用）
 *       │
 *       └── Step 4: Quality Gate Decision
 *
 * 红线：
 * - 不修改已有阶段流程
 * - Layer B 不发起独立 LLM 调用（复用 AI Quality Audit）
 * - Audit Engine 不区分阶段——所有阶段使用同一个 Engine
 */

import { runRuleCheck, STAGE_REQUIRED_FIELDS } from "./rule-check";
import { runAIQualityAudit } from "./ai-quality";
import {
  checkReferenceIntegrity,
  checkReferenceIntegrityLight,
  buildSemanticCheckPrompt,
} from "./cross-stage";
import type { RuleCheckResult } from "./rule-check";
import type { AIAuditResult, AuditIssue } from "./ai-quality";
import type { ReferenceIssue, CrossStageResult } from "./cross-stage";

// ── 统一输出类型 ──────────────────────────────────────────

export interface AuditReport {
  /** 项目 ID */
  projectId: string;
  /** 阶段编号 */
  stageNumber: number;
  /** Rule Check 结果 */
  ruleCheck: RuleCheckResult;
  /** Cross Stage Context Check 结果（Layer A + B） */
  crossStage: CrossStageResult | null;
  /** AI Quality Audit 结果（可能为 null，如果跳过） */
  aiAudit: AIAuditResult | null;
  /** 最终门禁决策 */
  gateDecision: GateDecision;
  /** 合并后的问题列表 */
  allIssues: AuditIssue[];
  /** 引用完整性问题 */
  referenceIssues: ReferenceIssue[];
  /** 是否建议人工复核 */
  needsHumanReview: boolean;
  /** 执行时间戳 */
  executedAt: Date;
}

export type GateDecision = "advance" | "reoptimize" | "block";

// ── 审计入口 ──────────────────────────────────────────────

/**
 * 对单阶段输出执行完整审计。
 *
 * 流程：
 * 1. Rule Check（字段完整性 + 逻辑冲突 + 字段一致性）
 * 2. Cross Stage Layer A（引用完整性检查，条件触发——需要上游 Context）
 * 3. AI Quality Audit + Layer B（四维战略质量评估 + 语义断裂检查）
 * 4. 合并决策
 */
export async function runStageAudit(
  projectId: string,
  stageNumber: number,
  stageOutput: Record<string, any>,
  options?: {
    /** 跳过 AI Audit（测试/降级时使用） */
    skipAI?: boolean;
    /** 跳过跨阶段检查（测试时使用） */
    skipCrossStage?: boolean;
  }
): Promise<AuditReport> {
  // ── Step 1: Rule Check ──────────────────────────────
  const requiredFields = STAGE_REQUIRED_FIELDS[stageNumber] ?? [];
  const ruleCheck = runRuleCheck(
    stageOutput,
    undefined,
    requiredFields,
    stageNumber
  );

  // ── Step 2: Cross Stage Layer A ─────────────────────
  let crossStage: CrossStageResult | null = null;
  let referenceIssues: ReferenceIssue[] = [];

  if (!options?.skipCrossStage && ruleCheck.passed) {
    try {
      // 完整版 Layer A（DB 查询）：检查引用完整性
      crossStage = await checkReferenceIntegrity(
        projectId,
        stageNumber,
        stageOutput
      );
      referenceIssues = crossStage.referenceIssues;
    } catch (e: any) {
      console.error(
        `[audit-engine] Cross Stage Layer A 失败 (Stage ${stageNumber}): ${e.message}`
      );
      // 失败时降级为轻量版检查
      referenceIssues = checkReferenceIntegrityLight(stageNumber, stageOutput);
      crossStage = {
        referenceIssues,
        semanticIssues: null,
        referenceIntegrityPassed: referenceIssues.filter((i) => i.severity === "error").length === 0,
      };
    }
  } else if (!options?.skipCrossStage) {
    // Rule Check 未通过——跳过 DB 查询，只做轻量版
    referenceIssues = checkReferenceIntegrityLight(stageNumber, stageOutput);
    crossStage = {
      referenceIssues,
      semanticIssues: null,
      referenceIntegrityPassed: referenceIssues.filter((i) => i.severity === "error").length === 0,
    };
  }

  // ── Step 3: AI Quality Audit + Layer B ──────────────
  let aiAudit: AIAuditResult | null = null;

  if (!options?.skipAI) {
    try {
      // 构建 Layer B prompt（仅在 Rule Check 通过时，且非 S1）
      let crossStagePrompt: string | undefined;
      if (ruleCheck.passed && stageNumber > 1) {
        try {
          const { buildMemoryContext } = await import("@/lib/memory/decision-memory");
          const upstreamContext = await buildMemoryContext(projectId, stageNumber);
          crossStagePrompt = buildSemanticCheckPrompt(stageNumber, upstreamContext);
        } catch (e: any) {
          console.error(
            `[audit-engine] Layer B prompt 构建失败: ${e.message}`
          );
          // 不影响主流程
        }
      }

      aiAudit = await runAIQualityAudit(
        stageNumber,
        stageOutput,
        undefined,          // decisionMemoryContext（暂未消费）
        crossStagePrompt,   // Layer B 扩展
        projectId,          // Token 追踪
      );

      // 将 Layer B 结果合并到 CrossStage
      if (aiAudit.crossStageSemantics && crossStage) {
        crossStage.semanticIssues = aiAudit.crossStageSemantics.issues;
      }
    } catch (e: any) {
      console.error(
        `[audit-engine] AI Quality Audit 失败 (Stage ${stageNumber}): ${e.message}`
      );
      // AI Audit 失败不阻塞流程
    }
  }

  // ── Step 4: 合并决策 ────────────────────────────────
  const hasRefError = referenceIssues.some((i) => i.severity === "error");

  // Layer B 独立信号：统计 warning 级别语义断裂数量
  const layerBWarningCount =
    aiAudit?.crossStageSemantics?.issues?.filter(
      (i) => i.severity === "warning"
    ).length ?? 0;

  const gateDecision = mergeDecisions(
    ruleCheck,
    aiAudit,
    hasRefError,
    layerBWarningCount
  );

  return {
    projectId,
    stageNumber,
    ruleCheck,
    crossStage,
    aiAudit,
    gateDecision,
    allIssues: aiAudit?.issues ?? [],
    referenceIssues,
    needsHumanReview:
      aiAudit?.needsHumanReview ??
      (ruleCheck.issues.length > 0 || hasRefError),
    executedAt: new Date(),
  };
}

// ── 决策合并逻辑 ──────────────────────────────────────────

/** Layer B 独立阈值：至少 N 个 warning 级别语义断裂 → 影响 gate */
const LAYER_B_WARNING_THRESHOLD = 1;

/**
 * 合并 Rule Check + Cross Stage Layer A + AI Quality Audit + Layer B 结果。
 *
 * 各组件角色：
 * - Rule Check：结构完整性（error → block）
 * - Layer A（引用完整性）：上游字段引用（error → 至少 reoptimize）
 * - AI Quality Audit：四维内容质量（不包含 Layer B 发现）
 * - Layer B（语义连贯性）：独立信号，有 warning → 降级 advance 为 reoptimize
 *
 * 规则：
 * 1. Rule Check 有 error → 强制 block
 * 2. Layer A 引用缺失 error → 强制至少 reoptimize（PRD 4B.3）
 * 3. AI Audit gateRecommendation = block → block
 * 4. Layer B 语义断裂 ≥ threshold → 降级（advance → reoptimize，不强制 block）
 */
function mergeDecisions(
  ruleCheck: RuleCheckResult,
  aiAudit: AIAuditResult | null,
  hasReferenceError: boolean,
  layerBWarningCount: number = 0
): GateDecision {
  // Rule Check 不通过 → block（结构性问题必须先修复）
  if (!ruleCheck.passed) {
    return "block";
  }

  // Layer A: 引用缺失 error → 强制至少 reoptimize（PRD 04.A: "强制触发至少 Reoptimize"）
  if (hasReferenceError) {
    // 如果 AI Audit 也说 block，保持 block
    if (aiAudit?.gateRecommendation === "block") {
      return "block";
    }
    return "reoptimize";
  }

  // AI Audit 不可用 → advance（降级放行）
  if (!aiAudit) {
    return "advance";
  }

  // 基础 gate（仅基于四维评分，不包含 Layer B 影响）
  let gate: GateDecision;
  switch (aiAudit.gateRecommendation) {
    case "block":
      return "block";
    case "reoptimize":
      gate = "reoptimize";
      break;
    case "advance":
      gate = "advance";
      break;
    default:
      gate = "advance";
  }

  // Layer B: 语义断裂独立信号
  // 当四维评分说 advance，但 Layer B 发现语义断裂时 → 降级为 reoptimize
  // Layer B 不会单独导致 block（那是 Rule Check / AI Audit 评分极低的事）
  if (gate === "advance" && layerBWarningCount >= LAYER_B_WARNING_THRESHOLD) {
    return "reoptimize";
  }

  return gate;
}

// ── 便捷函数 ──────────────────────────────────────────────

export function canAdvance(report: AuditReport): boolean {
  return report.gateDecision === "advance";
}

export function needsReoptimize(report: AuditReport): boolean {
  return report.gateDecision === "reoptimize";
}

export function isBlocked(report: AuditReport): boolean {
  return report.gateDecision === "block";
}
