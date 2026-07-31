/**
 * Decision Memory — 战略资产存储
 *
 * 原则：
 * - 只保存对未来决策有用的战略资产
 * - 不保存聊天记录
 * - 不保存 AI 中间推理
 * - 按 confirmedFacts / confirmedDecisions / hypotheses / unresolvedQuestions 分类
 *
 * 证据层级：search_backed > search_snippet > ai_inferred
 */

import { db, decisionMemoryEntry } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils/id";

// ── 类型定义 ──────────────────────────────────────────

export type EntryType =
  | "confirmed_fact"
  | "confirmed_decision"
  | "hypothesis"
  | "unresolved_question";

export type EvidenceLevel = "search_backed" | "search_snippet" | "ai_inferred";

export interface DecisionMemoryInput {
  projectId: string;
  stageSource: number;
  entryType: EntryType;
  content: string;
  fieldPath: string;       // 来源字段路径，如 "founderMotivation.content"
  evidenceLevel?: EvidenceLevel;
}

export interface DecisionMemoryEntry {
  id: string;
  projectId: string;
  stageSource: number;
  entryType: EntryType;
  content: string;
  fieldPath: string;
  evidenceLevel: EvidenceLevel;
  confirmedAt: Date;
}

// ── 写入 ──────────────────────────────────────────────

export async function saveEntry(entry: DecisionMemoryInput): Promise<void> {
  await db.insert(decisionMemoryEntry).values({
    id: generateId(),
    projectId: entry.projectId,
    stageSource: entry.stageSource,
    entryType: entry.entryType,
    content: entry.content,
    fieldPath: entry.fieldPath,
    evidenceLevel: entry.evidenceLevel ?? "ai_inferred",
    confirmedAt: new Date(),
  });
}

/** 批量保存阶段性提取的战略资产 */
export async function saveStageEntries(
  projectId: string,
  stageSource: number,
  entries: Array<{
    entryType: EntryType;
    content: string;
    fieldPath: string;
    evidenceLevel?: EvidenceLevel;
  }>
): Promise<void> {
  const values = entries.map((e) => ({
    id: generateId(),
    projectId,
    stageSource,
    entryType: e.entryType,
    content: e.content,
    fieldPath: e.fieldPath,
    evidenceLevel: e.evidenceLevel ?? "ai_inferred",
    confirmedAt: new Date(),
  }));

  if (values.length > 0) {
    await db.insert(decisionMemoryEntry).values(values);
  }
}

// ── 读取 ──────────────────────────────────────────────

/** 获取项目的全部战略资产 */
export async function getEntries(projectId: string): Promise<DecisionMemoryEntry[]> {
  return db
    .select()
    .from(decisionMemoryEntry)
    .where(eq(decisionMemoryEntry.projectId, projectId))
    .orderBy(decisionMemoryEntry.confirmedAt) as any;
}

/** 仅获取 confirmed_fact + confirmed_decision（可靠信息） */
export async function getConfirmed(projectId: string): Promise<DecisionMemoryEntry[]> {
  const rows = await db
    .select()
    .from(decisionMemoryEntry)
    .where(eq(decisionMemoryEntry.projectId, projectId)) as any;
  return rows.filter(
    (r: any) => r.entryType === "confirmed_fact" || r.entryType === "confirmed_decision"
  );
}

/** 构建 Decision Memory Context 文本（注入后续阶段 Prompt） */
export async function buildMemoryContext(
  projectId: string,
  targetStage: number
): Promise<string> {
  const all = await getEntries(projectId);

  // 只注入当前阶段之前的资产
  const relevant = all.filter((e: any) => e.stageSource < targetStage);
  if (relevant.length === 0) return "";

  const facts = relevant.filter((e: any) => e.entryType === "confirmed_fact");
  const decisions = relevant.filter((e: any) => e.entryType === "confirmed_decision");
  const hypotheses = relevant.filter((e: any) => e.entryType === "hypothesis");
  const unresolved = relevant.filter((e: any) => e.entryType === "unresolved_question");

  const lines: string[] = [];

  if (facts.length > 0) {
    lines.push("### 已确认事实");
    facts.forEach((f: any) => lines.push(`- [S${f.stageSource}] ${f.content}`));
  }

  if (decisions.length > 0) {
    lines.push("\n### 已确认决策");
    decisions.forEach((d: any) => lines.push(`- [S${d.stageSource}] ${d.content}`));
  }

  if (hypotheses.length > 0) {
    lines.push("\n### 待验证假设");
    hypotheses.forEach((h: any) => lines.push(`- [S${h.stageSource}] ${h.content}`));
  }

  if (unresolved.length > 0) {
    lines.push("\n### 未解决问题");
    unresolved.forEach((u: any) => lines.push(`- [S${u.stageSource}] ${u.content}`));
  }

  return lines.join("\n");
}

// ── S1 专用提取器 ─────────────────────────────────────

/**
 * 从 FounderVision JSON 提取战略资产
 *
 * 映射规则（来自 plan.md Task 1.5）：
 * - founderMotivation.content → confirmed_fact (source: founder_statement)
 * - observations[].* → confirmed_fact (source: founder_observation)
 * - confirmedProblems[] → confirmed_fact
 * - constraints.* → confirmed_fact（非空值才提取）
 */
export function extractFromFounderVision(
  projectId: string,
  data: Record<string, any>
): Array<{
  entryType: EntryType;
  content: string;
  fieldPath: string;
  evidenceLevel: EvidenceLevel;
}> {
  const entries: Array<{
    entryType: EntryType;
    content: string;
    fieldPath: string;
    evidenceLevel: EvidenceLevel;
  }> = [];

  // founderMotivation → fact
  if (data.founderMotivation?.content) {
    entries.push({
      entryType: "confirmed_fact",
      content: data.founderMotivation.content,
      fieldPath: "founderMotivation.content",
      evidenceLevel: "ai_inferred",
    });
  }

  // observations[] → facts
  if (Array.isArray(data.observations)) {
    for (let i = 0; i < data.observations.length; i++) {
      const obs = data.observations[i];
      const summary = [obs.subject, obs.context, obs.behavior, obs.result]
        .filter(Boolean)
        .join(" — ");
      if (summary) {
        entries.push({
          entryType: "confirmed_fact",
          content: summary,
          fieldPath: `observations[${i}]`,
          evidenceLevel: "ai_inferred",
        });
      }
    }
  }

  // confirmedProblems[] → facts
  if (Array.isArray(data.confirmedProblems)) {
    for (let i = 0; i < data.confirmedProblems.length; i++) {
      entries.push({
        entryType: "confirmed_fact",
        content: data.confirmedProblems[i],
        fieldPath: `confirmedProblems[${i}]`,
        evidenceLevel: "ai_inferred",
      });
    }
  }

  // constraints (非空值) → facts
  if (data.constraints) {
    const { budget, team, timeline } = data.constraints;
    if (budget) {
      entries.push({
        entryType: "confirmed_fact",
        content: `预算约束: ${budget}`,
        fieldPath: "constraints.budget",
        evidenceLevel: "ai_inferred",
      });
    }
    if (team) {
      entries.push({
        entryType: "confirmed_fact",
        content: `团队规模: ${team}`,
        fieldPath: "constraints.team",
        evidenceLevel: "ai_inferred",
      });
    }
    if (timeline) {
      entries.push({
        entryType: "confirmed_fact",
        content: `时间线: ${timeline}`,
        fieldPath: "constraints.timeline",
        evidenceLevel: "ai_inferred",
      });
    }
  }

  return entries;
}

// ── 通用提取接口（S2-S8 在对应 task 中实现具体逻辑） ──

/** Stage → Decision Memory 字段映射器类型 */
export type StageExtractor = (
  projectId: string,
  stageOutput: Record<string, any>
) => Array<{
  entryType: EntryType;
  content: string;
  fieldPath: string;
  evidenceLevel: EvidenceLevel;
}>;

// ── S2 提取器 ──────────────────────────────────────────

/**
 * 从 BusinessContext JSON 提取战略资产
 *
 * 映射规则（来自 plan.md Task 1.5）：
 * - businessBackground.marketContext → confirmed_fact (search_backed if dataSources present)
 * - businessBackground.drivingForces[] → confirmed_fact
 * - businessBackground.strategicWindow → confirmed_fact
 * - coreChallenges.externalChallenges[] → confirmed_fact
 * - coreChallenges.internalChallenges[] → confirmed_fact
 * - strategicDirection.directionHypothesis → hypothesis
 * - strategicDirection.workingPriorities[] → hypothesis
 */
export function extractFromBusinessContext(
  projectId: string,
  data: Record<string, any>
): Array<{
  entryType: EntryType;
  content: string;
  fieldPath: string;
  evidenceLevel: EvidenceLevel;
}> {
  const entries: Array<{
    entryType: EntryType;
    content: string;
    fieldPath: string;
    evidenceLevel: EvidenceLevel;
  }> = [];

  const hasSearchData =
    Array.isArray(data.dataSources) && data.dataSources.length > 0;
  const factEvidence: EvidenceLevel = hasSearchData ? "search_backed" : "ai_inferred";

  // businessBackground.marketContext → fact
  if (data.businessBackground?.marketContext) {
    entries.push({
      entryType: "confirmed_fact",
      content: data.businessBackground.marketContext,
      fieldPath: "businessBackground.marketContext",
      evidenceLevel: factEvidence,
    });
  }

  // businessBackground.drivingForces[] → facts
  if (Array.isArray(data.businessBackground?.drivingForces)) {
    for (let i = 0; i < data.businessBackground.drivingForces.length; i++) {
      entries.push({
        entryType: "confirmed_fact",
        content: data.businessBackground.drivingForces[i],
        fieldPath: `businessBackground.drivingForces[${i}]`,
        evidenceLevel: factEvidence,
      });
    }
  }

  // businessBackground.strategicWindow → fact
  if (data.businessBackground?.strategicWindow) {
    entries.push({
      entryType: "confirmed_fact",
      content: data.businessBackground.strategicWindow,
      fieldPath: "businessBackground.strategicWindow",
      evidenceLevel: factEvidence,
    });
  }

  // coreChallenges.externalChallenges[] → facts
  if (Array.isArray(data.coreChallenges?.externalChallenges)) {
    for (let i = 0; i < data.coreChallenges.externalChallenges.length; i++) {
      entries.push({
        entryType: "confirmed_fact",
        content: data.coreChallenges.externalChallenges[i],
        fieldPath: `coreChallenges.externalChallenges[${i}]`,
        evidenceLevel: "ai_inferred",
      });
    }
  }

  // coreChallenges.internalChallenges[] → facts
  if (Array.isArray(data.coreChallenges?.internalChallenges)) {
    for (let i = 0; i < data.coreChallenges.internalChallenges.length; i++) {
      entries.push({
        entryType: "confirmed_fact",
        content: data.coreChallenges.internalChallenges[i],
        fieldPath: `coreChallenges.internalChallenges[${i}]`,
        evidenceLevel: "ai_inferred",
      });
    }
  }

  // strategicDirection.directionHypothesis → hypothesis
  if (data.strategicDirection?.directionHypothesis) {
    entries.push({
      entryType: "hypothesis",
      content: data.strategicDirection.directionHypothesis,
      fieldPath: "strategicDirection.directionHypothesis",
      evidenceLevel: "ai_inferred",
    });
  }

  // strategicDirection.workingPriorities[] → hypotheses
  if (Array.isArray(data.strategicDirection?.workingPriorities)) {
    for (let i = 0; i < data.strategicDirection.workingPriorities.length; i++) {
      entries.push({
        entryType: "hypothesis",
        content: data.strategicDirection.workingPriorities[i],
        fieldPath: `strategicDirection.workingPriorities[${i}]`,
        evidenceLevel: "ai_inferred",
      });
    }
  }

  return entries;
}

// ── S3 提取器 ──────────────────────────────────────────

/**
 * 从 MarketInsights JSON 提取战略资产
 *
 * 映射规则（来自 plan.md Task 1.5）：
 * - marketOverview.marketSize/growthRate/marketStage → confirmed_fact (search_backed)
 * - industryTrend.currentTrends[] → confirmed_fact
 * - channelAnalysis.mainChannels[] → confirmed_fact
 * - regulatoryEnvironment.policies[] → confirmed_fact
 * - categoryStatus.* → confirmed_fact
 * - experienceGaps[].gap → confirmed_fact
 * - opportunityDirections[].direction（evidenceLevel=verified）→ confirmed_fact
 * - opportunityDirections[].direction（evidenceLevel=inferred/hypothesis）→ hypothesis
 *
 * 通用规则：search_backed > search_snippet > ai_inferred
 * 字段值为"搜索范围内未找到"或空数组不写入
 */
export function extractFromMarketInsights(
  projectId: string,
  data: Record<string, any>
): Array<{
  entryType: EntryType;
  content: string;
  fieldPath: string;
  evidenceLevel: EvidenceLevel;
}> {
  const entries: Array<{
    entryType: EntryType;
    content: string;
    fieldPath: string;
    evidenceLevel: EvidenceLevel;
  }> = [];

  const hasSearchData =
    Array.isArray(data.dataSources) && data.dataSources.length > 0;
  const searchEvidence: EvidenceLevel = hasSearchData
    ? "search_backed"
    : "ai_inferred";

  // marketOverview.* → facts (search data)
  if (data.marketOverview?.marketSize) {
    const val = data.marketOverview.marketSize;
    if (val !== "搜索范围内未找到") {
      entries.push({
        entryType: "confirmed_fact",
        content: val,
        fieldPath: "marketOverview.marketSize",
        evidenceLevel: searchEvidence,
      });
    }
  }
  if (data.marketOverview?.growthRate) {
    const val = data.marketOverview.growthRate;
    if (val !== "搜索范围内未找到") {
      entries.push({
        entryType: "confirmed_fact",
        content: val,
        fieldPath: "marketOverview.growthRate",
        evidenceLevel: searchEvidence,
      });
    }
  }
  if (data.marketOverview?.marketStage && data.marketOverview.marketStage !== "信息不足") {
    entries.push({
      entryType: "confirmed_fact",
      content: `赛道阶段: ${data.marketOverview.marketStage}`,
      fieldPath: "marketOverview.marketStage",
      evidenceLevel: searchEvidence,
    });
  }

  // industryTrend.currentTrends[] → facts
  if (Array.isArray(data.industryTrend?.currentTrends)) {
    for (let i = 0; i < data.industryTrend.currentTrends.length; i++) {
      entries.push({
        entryType: "confirmed_fact",
        content: data.industryTrend.currentTrends[i],
        fieldPath: `industryTrend.currentTrends[${i}]`,
        evidenceLevel: searchEvidence,
      });
    }
  }

  // channelAnalysis.mainChannels[] → facts
  if (Array.isArray(data.channelAnalysis?.mainChannels)) {
    for (let i = 0; i < data.channelAnalysis.mainChannels.length; i++) {
      entries.push({
        entryType: "confirmed_fact",
        content: data.channelAnalysis.mainChannels[i],
        fieldPath: `channelAnalysis.mainChannels[${i}]`,
        evidenceLevel: searchEvidence,
      });
    }
  }

  // categoryStatus.* → facts
  if (data.categoryStatus?.definition) {
    entries.push({
      entryType: "confirmed_fact",
      content: data.categoryStatus.definition,
      fieldPath: "categoryStatus.definition",
      evidenceLevel: "ai_inferred",
    });
  }
  if (data.categoryStatus?.currentState) {
    entries.push({
      entryType: "confirmed_fact",
      content: data.categoryStatus.currentState,
      fieldPath: "categoryStatus.currentState",
      evidenceLevel: "ai_inferred",
    });
  }

  // experienceGaps[].gap → facts
  if (Array.isArray(data.experienceGaps)) {
    for (let i = 0; i < data.experienceGaps.length; i++) {
      if (data.experienceGaps[i].gap) {
        entries.push({
          entryType: "confirmed_fact",
          content: data.experienceGaps[i].gap,
          fieldPath: `experienceGaps[${i}].gap`,
          evidenceLevel: "ai_inferred",
        });
      }
    }
  }

  // opportunityDirections[] → verified→fact, inferred/hypothesis→hypothesis
  if (Array.isArray(data.opportunityDirections)) {
    for (let i = 0; i < data.opportunityDirections.length; i++) {
      const od = data.opportunityDirections[i];
      if (od.direction) {
        const isVerified = od.evidenceLevel === "verified";
        entries.push({
          entryType: isVerified ? "confirmed_fact" : "hypothesis",
          content: od.direction,
          fieldPath: `opportunityDirections[${i}].direction`,
          evidenceLevel: od.evidenceLevel === "verified" ? "search_backed" : "ai_inferred",
        });
      }
    }
  }

  return entries;
}

// ── S4 提取器 ──────────────────────────────────────────

/**
 * 从 ConsumerInsight JSON 提取战略资产
 *
 * 映射规则（来自 plan.md Task 1.5）：
 * - targetConsumer.definition → confirmed_fact
 * - existingSolutions[].failReason → confirmed_fact
 * - deepNeeds.functionalNeed → confirmed_fact
 * - deepNeeds.identityNeed → confirmed_decision（S6 强制引用）
 *
 * identityNeed 是 S6 的强制引用字段，标记为 decision 级别。
 */
export function extractFromConsumerInsight(
  projectId: string,
  data: Record<string, any>
): Array<{
  entryType: EntryType;
  content: string;
  fieldPath: string;
  evidenceLevel: EvidenceLevel;
}> {
  const entries: Array<{
    entryType: EntryType;
    content: string;
    fieldPath: string;
    evidenceLevel: EvidenceLevel;
  }> = [];

  // targetConsumer.definition → fact
  if (data.targetConsumer?.definition) {
    entries.push({
      entryType: "confirmed_fact",
      content: data.targetConsumer.definition,
      fieldPath: "targetConsumer.definition",
      evidenceLevel: "ai_inferred",
    });
  }

  // targetConsumer.idealSelfReflection → hypothesis (inferred by nature)
  if (data.targetConsumer?.idealSelfReflection) {
    entries.push({
      entryType: "hypothesis",
      content: data.targetConsumer.idealSelfReflection,
      fieldPath: "targetConsumer.idealSelfReflection",
      evidenceLevel: "ai_inferred",
    });
  }

  // existingSolutions[].failReason → facts
  if (Array.isArray(data.existingSolutions)) {
    for (let i = 0; i < data.existingSolutions.length; i++) {
      if (data.existingSolutions[i].failReason) {
        entries.push({
          entryType: "confirmed_fact",
          content: data.existingSolutions[i].failReason,
          fieldPath: `existingSolutions[${i}].failReason`,
          evidenceLevel: "ai_inferred",
        });
      }
    }
  }

  // deepNeeds.functionalNeed → fact
  if (data.deepNeeds?.functionalNeed) {
    entries.push({
      entryType: "confirmed_fact",
      content: data.deepNeeds.functionalNeed,
      fieldPath: "deepNeeds.functionalNeed",
      evidenceLevel: "ai_inferred",
    });
  }

  // deepNeeds.identityNeed → decision（S6 强制引用）
  if (data.deepNeeds?.identityNeed) {
    entries.push({
      entryType: "confirmed_decision",
      content: data.deepNeeds.identityNeed,
      fieldPath: "deepNeeds.identityNeed",
      evidenceLevel: "ai_inferred",
    });
  }

  return entries;
}

// ── S5 提取器 ──────────────────────────────────────────

/**
 * 从 CompetitiveInsights JSON 提取战略资产
 *
 * 映射规则（来自 plan.md Task 1.5）：
 * - competitors[].name / positioning / strengths / weaknesses → confirmed_fact（search_backed）
 * - competitiveGap.marketOpportunity → hypothesis
 * - competitiveGap.unmetNeeds[] → hypothesis
 *
 * competitiveGap 供 S6 强制引用。
 */
export function extractFromCompetitiveInsights(
  projectId: string,
  data: Record<string, any>
): Array<{
  entryType: EntryType;
  content: string;
  fieldPath: string;
  evidenceLevel: EvidenceLevel;
}> {
  const entries: Array<{
    entryType: EntryType;
    content: string;
    fieldPath: string;
    evidenceLevel: EvidenceLevel;
  }> = [];

  const hasSearchData =
    Array.isArray(data.dataSources) && data.dataSources.length > 0;
  const searchEvidence: EvidenceLevel = hasSearchData
    ? "search_backed"
    : "ai_inferred";

  // competitiveLandscape → fact
  if (data.competitiveLandscape?.convergenceAndDivergence) {
    entries.push({
      entryType: "confirmed_fact",
      content: data.competitiveLandscape.convergenceAndDivergence,
      fieldPath: "competitiveLandscape.convergenceAndDivergence",
      evidenceLevel: searchEvidence,
    });
  }

  // competitors[] → facts (search data backed)
  if (Array.isArray(data.competitors)) {
    for (let i = 0; i < data.competitors.length; i++) {
      const c = data.competitors[i];
      if (c.name) {
        entries.push({
          entryType: "confirmed_fact",
          content: `竞品: ${c.name} — 定位: ${c.positioning || "未标注"}`,
          fieldPath: `competitors[${i}]`,
          evidenceLevel: searchEvidence,
        });
      }
      if (c.opportunityGap) {
        entries.push({
          entryType: "hypothesis",
          content: `${c.name} 机会缺口: ${c.opportunityGap}`,
          fieldPath: `competitors[${i}].opportunityGap`,
          evidenceLevel: "ai_inferred",
        });
      }
    }
  }

  // competitiveGap.unmetNeeds[] → hypotheses
  if (Array.isArray(data.competitiveGap?.unmetNeeds)) {
    for (let i = 0; i < data.competitiveGap.unmetNeeds.length; i++) {
      entries.push({
        entryType: "hypothesis",
        content: data.competitiveGap.unmetNeeds[i],
        fieldPath: `competitiveGap.unmetNeeds[${i}]`,
        evidenceLevel: "ai_inferred",
      });
    }
  }

  // competitiveGap.marketOpportunity → hypothesis（S6 强制引用）
  if (data.competitiveGap?.marketOpportunity) {
    entries.push({
      entryType: "hypothesis",
      content: data.competitiveGap.marketOpportunity,
      fieldPath: "competitiveGap.marketOpportunity",
      evidenceLevel: "ai_inferred",
    });
  }

  return entries;
}

// ── S6 提取器 ──────────────────────────────────────────

/**
 * 从 BrandStrategy JSON 提取战略资产
 *
 * 映射规则（来自 plan.md Task 1.5）：
 * - positioning → confirmed_decision
 * - valuePropositions[] → confirmed_decision
 * - brandStory / brandPersonality → confirmed_decision
 * - reasoning → 不存入（仅用于 Cross Stage Check）
 */
export function extractFromBrandStrategy(
  projectId: string,
  data: Record<string, any>
): Array<{
  entryType: EntryType;
  content: string;
  fieldPath: string;
  evidenceLevel: EvidenceLevel;
}> {
  const entries: Array<{
    entryType: EntryType;
    content: string;
    fieldPath: string;
    evidenceLevel: EvidenceLevel;
  }> = [];

  // positioning → decision
  if (data.positioning) {
    entries.push({
      entryType: "confirmed_decision",
      content: data.positioning,
      fieldPath: "positioning",
      evidenceLevel: "ai_inferred",
    });
  }

  // valuePropositions[] → decisions
  if (Array.isArray(data.valuePropositions)) {
    for (let i = 0; i < data.valuePropositions.length; i++) {
      const vp = data.valuePropositions[i];
      if (vp.proposition) {
        entries.push({
          entryType: "confirmed_decision",
          content: `[${vp.level}] ${vp.proposition}`,
          fieldPath: `valuePropositions[${i}]`,
          evidenceLevel: "ai_inferred",
        });
      }
    }
  }

  // brandStory.struggleMoment → fact
  if (data.brandStory?.struggleMoment) {
    entries.push({
      entryType: "confirmed_fact",
      content: data.brandStory.struggleMoment,
      fieldPath: "brandStory.struggleMoment",
      evidenceLevel: "ai_inferred",
    });
  }

  // brandStory.brandAction → decision
  if (data.brandStory?.brandAction) {
    entries.push({
      entryType: "confirmed_decision",
      content: data.brandStory.brandAction,
      fieldPath: "brandStory.brandAction",
      evidenceLevel: "ai_inferred",
    });
  }

  // brandPersonality traits → decisions (concatenated trait summary)
  if (Array.isArray(data.brandPersonality)) {
    const traits = data.brandPersonality
      .filter((t: any) => t.trait)
      .map((t: any) => t.trait);
    if (traits.length > 0) {
      entries.push({
        entryType: "confirmed_decision",
        content: `品牌人格特质: ${traits.join("、")}`,
        fieldPath: "brandPersonality",
        evidenceLevel: "ai_inferred",
      });
    }
  }

  // reasoning → 不存入（plan.md: "reasoning→不存入"）

  return entries;
}

// ── S7 提取器 ──────────────────────────────────────────

/**
 * 从 VisualStrategy JSON 提取战略资产
 *
 * 映射规则（来自 plan.md Task 1.5）：
 * - visualDirection → confirmed_decision
 */
export function extractFromVisualStrategy(
  projectId: string,
  data: Record<string, any>
): Array<{
  entryType: EntryType;
  content: string;
  fieldPath: string;
  evidenceLevel: EvidenceLevel;
}> {
  const entries: Array<{
    entryType: EntryType;
    content: string;
    fieldPath: string;
    evidenceLevel: EvidenceLevel;
  }> = [];

  // coreConcept → decision
  if (data.coreConcept) {
    entries.push({
      entryType: "confirmed_decision",
      content: data.coreConcept,
      fieldPath: "coreConcept",
      evidenceLevel: "ai_inferred",
    });
  }

  // keywords → decisions
  if (Array.isArray(data.keywords)) {
    for (const kw of data.keywords) {
      if (kw.keyword) {
        entries.push({
          entryType: "confirmed_decision",
          content: `视觉关键词: ${kw.keyword}`,
          fieldPath: "keywords",
          evidenceLevel: "ai_inferred",
        });
      }
    }
  }

  return entries;
}

// ── S8 提取器 ──────────────────────────────────────────

/**
 * 从 ContentStrategy JSON 提取战略资产
 *
 * 映射规则（来自 plan.md Task 1.5）：
 * - contentPillars → confirmed_decision
 */
export function extractFromContentStrategy(
  projectId: string,
  data: Record<string, any>
): Array<{
  entryType: EntryType;
  content: string;
  fieldPath: string;
  evidenceLevel: EvidenceLevel;
}> {
  const entries: Array<{
    entryType: EntryType;
    content: string;
    fieldPath: string;
    evidenceLevel: EvidenceLevel;
  }> = [];

  // coreDirection → decision
  if (data.coreDirection) {
    entries.push({
      entryType: "confirmed_decision",
      content: data.coreDirection,
      fieldPath: "coreDirection",
      evidenceLevel: "ai_inferred",
    });
  }

  // themeDirections[].pillar → decisions
  if (Array.isArray(data.themeDirections)) {
    for (let i = 0; i < data.themeDirections.length; i++) {
      const td = data.themeDirections[i];
      if (td.pillar) {
        entries.push({
          entryType: "confirmed_decision",
          content: `内容支柱: ${td.pillar} — ${td.corePurpose || ""}`,
          fieldPath: `themeDirections[${i}]`,
          evidenceLevel: "ai_inferred",
        });
      }
    }
  }

  return entries;
}

/** 阶段提取器注册表（Phase 2+ 填充） */
export const stageExtractors: Record<number, StageExtractor> = {
  1: extractFromFounderVision,
  2: extractFromBusinessContext,
  3: extractFromMarketInsights,
  4: extractFromConsumerInsight,
  5: extractFromCompetitiveInsights,
  6: extractFromBrandStrategy,
  7: extractFromVisualStrategy,
  8: extractFromContentStrategy,
};
