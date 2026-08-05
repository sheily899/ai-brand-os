/**
 * Impact Analyzer — 决策修改影响分析引擎
 *
 * 纯规则实现，不引入 AI 调用。
 *
 * 三态分类逻辑：
 * - no_impact：字段不在 FIELD_FORWARD_DEPENDENCIES 中
 * - needs_review：字段在依赖路径中，但下游 convergenceOutput 中未找到旧值的子串匹配
 * - invalidated：下游 convergenceOutput 中包含旧值文本（直接引用/复述）
 *
 * 放在 audit/ 下因为语义上属于审计家族，
 * Phase 3 的 Cross Stage Check Layer A 会复用前向遍历逻辑。
 */

import { normalizeFieldPath, getDownstreamAffected, getFieldSourceStage } from "@/lib/memory/dependency-graph";
import { getStageRecord } from "@/lib/db/stage-repo";
import { getBlockedBy } from "@/lib/memory/dependency-graph";

// ── 类型 ──────────────────────────────────────────────────

export type ImpactLevel = "no_impact" | "needs_review" | "invalidated";

export interface StageImpact {
  stage: number;
  level: ImpactLevel;
  /** 为什么这个阶段受影响（或不受影响） */
  reason: string;
  /** 在下游输出中匹配到的旧值片段（仅 invalidated 时有值） */
  matchedSnippet?: string;
}

export interface ImpactReport {
  /** 被修改的字段路径 */
  modifiedField: string;
  /** 修改的来源阶段 */
  sourceStage: number;
  /** 旧值 */
  oldValue: string;
  /** 新值 */
  newValue: string;
  /** 对每个下游阶段的影响评估 */
  downstreamImpacts: StageImpact[];
  /** 汇总：是否有任何阶段被 invalidated */
  hasInvalidated: boolean;
  /** 汇总：是否有任何阶段需要人工审查 */
  hasNeedsReview: boolean;
}

// ── 核心分析函数 ──────────────────────────────────────────

/**
 * 分析修改一条 Decision Memory 条目对下游阶段的影响。
 *
 * @param projectId - 项目 ID
 * @param fieldPath - 被修改的字段路径（如 "deepNeeds.identityNeed"）
 * @param oldValue - 旧值文本
 * @param newValue - 新值文本
 * @param sourceStage - 来源阶段（从 Decision Memory 条目的 stageSource 获取）
 */
export async function analyzeImpact(
  projectId: string,
  fieldPath: string,
  oldValue: string,
  newValue: string,
  sourceStage: number
): Promise<ImpactReport> {
  const normalizedPath = normalizeFieldPath(fieldPath);
  const affectedStages = getDownstreamAffected(fieldPath);

  // 如果字段不在依赖图中，所有下游都是 no_impact
  if (affectedStages.length === 0) {
    const allDownstream = getBlockedBy(sourceStage);
    return {
      modifiedField: fieldPath,
      sourceStage,
      oldValue,
      newValue,
      downstreamImpacts: allDownstream.map((s) => ({
        stage: s,
        level: "no_impact" as ImpactLevel,
        reason: `字段 ${fieldPath} 不在字段级前向依赖图中，无下游阶段引用此字段`,
      })),
      hasInvalidated: false,
      hasNeedsReview: false,
    };
  }

  // 规范化旧值用于子串匹配
  const normalizedOld = oldValue.trim();

  const impacts: StageImpact[] = [];

  for (const stage of affectedStages) {
    const record = await getStageRecord(projectId, stage);
    if (!record?.structuredOutput) {
      impacts.push({
        stage,
        level: "needs_review",
        reason: `阶段 ${stage} 尚未完成收敛，无法自动判断影响`,
      });
      continue;
    }

    // 在下游 structuredOutput 中查找旧值子串
    const outputText = JSON.stringify(record.structuredOutput);
    const matchIndex = outputText.indexOf(normalizedOld);

    if (matchIndex >= 0) {
      // 找到子串匹配 → 下游直接引用/复述了被修改的具体值
      const start = Math.max(0, matchIndex - 20);
      const end = Math.min(outputText.length, matchIndex + normalizedOld.length + 20);
      impacts.push({
        stage,
        level: "invalidated",
        reason: `阶段 ${stage} 的输出中直接引用了 "${normalizedOld.slice(0, 50)}"`,
        matchedSnippet: outputText.slice(start, end),
      });
    } else {
      // 在依赖路径中但未逐字引用
      impacts.push({
        stage,
        level: "needs_review",
        reason: `字段 ${fieldPath} 被阶段 ${stage} 的 prompt 声明引用，但当前输出中未找到旧值的逐字匹配，建议人工审查`,
      });
    }
  }

  // 补充：sourceStage 的 requiredFor 中但不在 affectedStages 中的阶段 → no_impact
  const allDownstream = getBlockedBy(sourceStage);
  for (const stage of allDownstream) {
    if (!affectedStages.includes(stage)) {
      impacts.push({
        stage,
        level: "no_impact",
        reason: `字段 ${fieldPath} 不在阶段 ${stage} 的字段级依赖路径中`,
      });
    }
  }

  return {
    modifiedField: fieldPath,
    sourceStage,
    oldValue,
    newValue,
    downstreamImpacts: impacts.sort((a, b) => a.stage - b.stage),
    hasInvalidated: impacts.some((i) => i.level === "invalidated"),
    hasNeedsReview: impacts.some((i) => i.level === "needs_review"),
  };
}

/**
 * 轻量版：仅基于 fieldPath 和 sourceStage 判断哪些阶段会受影响。
 * 不访问数据库，用于预评估（在用户确认修改前展示）。
 */
export function previewImpact(
  fieldPath: string,
  sourceStage: number
): { affectedStages: number[]; allDownstream: number[] } {
  const affectedStages = getDownstreamAffected(fieldPath);
  const allDownstream = getBlockedBy(sourceStage);
  return { affectedStages, allDownstream };
}
