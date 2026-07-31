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

/** 阶段提取器注册表（Phase 2+ 填充） */
export const stageExtractors: Record<number, StageExtractor> = {
  1: extractFromFounderVision,
  // S2-S8 提取器在对应阶段接入时注册
};
