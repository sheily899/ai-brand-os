/**
 * Workflow Engine — 阶段状态机
 *
 * 职责：
 * - 管理每个阶段的当前状态
 * - 验证阶段推进合法性（依赖检查）
 * - 处理 Quality Gate 决策
 *
 * 严格禁止：
 * - 调用 LLM
 * - 判断内容质量
 * - 生成战略内容
 */

import { db, stageRecord, project } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/utils/id";
import { getDependencies } from "@/lib/memory/dependency-graph";

// ── 状态定义 ──────────────────────────────────────────

export type StageStatus =
  | "draft"           // 尚未开始
  | "active"          // 咨询中
  | "waiting_confirm" // 等待用户确认
  | "completed"       // 审核通过，推进到下一阶段
  | "failed"          // 审核不通过
  | "blocked"         // 被前置阶段阻塞
  | "archived";       // 已归档

export type GateDecision = "advance" | "reoptimize" | "block";

export interface WorkflowState {
  projectId: string;
  currentStage: number;
  stageStatus: StageStatus;
  completedStages: number[];
}

// ── 阶段状态管理 ──────────────────────────────────────

export async function getStageStatus(
  projectId: string,
  stageNumber: number
): Promise<StageStatus> {
  const rows = await db
    .select({ status: stageRecord.status })
    .from(stageRecord)
    .where(
      and(
        eq(stageRecord.projectId, projectId),
        eq(stageRecord.stageNumber, stageNumber)
      )
    )
    .limit(1);

  return (rows[0]?.status as StageStatus) ?? "draft";
}

/** 获取所有已完成阶段 */
export async function getCompletedStages(projectId: string): Promise<number[]> {
  const rows = await db
    .select({ stageNumber: stageRecord.stageNumber })
    .from(stageRecord)
    .where(
      and(
        eq(stageRecord.projectId, projectId),
        eq(stageRecord.status, "completed")
      )
    );

  return rows.map((r) => r.stageNumber).sort((a, b) => a - b);
}

// ── 阶段推进验证 ──────────────────────────────────────

/** 验证是否允许进入目标阶段 */
export async function canEnterStage(
  projectId: string,
  targetStage: number
): Promise<{ allowed: boolean; reason?: string }> {
  const deps = getDependencies(targetStage);

  if (deps.length === 0) {
    // S1 无依赖，始终可进入
    return { allowed: true };
  }

  const completed = await getCompletedStages(projectId);

  for (const dep of deps) {
    if (!completed.includes(dep)) {
      return {
        allowed: false,
        reason: `Stage ${dep} 尚未完成，无法进入 Stage ${targetStage}`,
      };
    }
  }

  return { allowed: true };
}

/** 非法跳级检查：不允许跳过阶段 */
export function isSequentialJump(current: number, target: number): boolean {
  // 允许进入当前阶段或下一阶段
  if (target === current || target === current + 1) return false;
  // 允许返回已完成阶段（回顾）
  if (target < current) return false;
  // 不允许跳过阶段
  return true;
}

// ── 状态转换 ──────────────────────────────────────────

/** 初始化阶段记录（首次进入时调用） */
export async function initStageRecord(
  projectId: string,
  stageNumber: number
): Promise<void> {
  const existing = await db
    .select({ id: stageRecord.id })
    .from(stageRecord)
    .where(
      and(
        eq(stageRecord.projectId, projectId),
        eq(stageRecord.stageNumber, stageNumber)
      )
    )
    .limit(1);

  if (existing.length > 0) return; // 已存在

  await db.insert(stageRecord).values({
    id: generateId(),
    projectId,
    stageNumber,
    status: "active",
    consultationMessages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

/** 更新阶段状态 */
export async function setStageStatus(
  projectId: string,
  stageNumber: number,
  status: StageStatus
): Promise<void> {
  await db
    .update(stageRecord)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(stageRecord.projectId, projectId),
        eq(stageRecord.stageNumber, stageNumber)
      )
    );
}

/** 处理 Quality Gate 决策 */
export async function handleGateDecision(
  projectId: string,
  stageNumber: number,
  decision: GateDecision
): Promise<{ newStatus: StageStatus; nextStage?: number }> {
  switch (decision) {
    case "advance":
      await setStageStatus(projectId, stageNumber, "completed");
      return { newStatus: "completed", nextStage: stageNumber + 1 };

    case "reoptimize":
      await setStageStatus(projectId, stageNumber, "active");
      return { newStatus: "active" };

    case "block":
      await setStageStatus(projectId, stageNumber, "blocked");
      return { newStatus: "blocked" };
  }
}

/** 获取当前工作流状态快照 */
export async function getWorkflowState(
  projectId: string
): Promise<WorkflowState> {
  const completed = await getCompletedStages(projectId);

  // 找到最早的未完成阶段作为 current
  let currentStage = 1;
  for (let i = 1; i <= 8; i++) {
    if (!completed.includes(i)) {
      currentStage = i;
      break;
    }
  }

  const status = await getStageStatus(projectId, currentStage);

  return {
    projectId,
    currentStage,
    stageStatus: status,
    completedStages: completed,
  };
}
