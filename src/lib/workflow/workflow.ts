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
  | "converging"      // 退出条件满足，AI 正在输出确认总结
  | "waiting_confirm" // 等待用户确认
  | "completed"       // 审核通过，推进到下一阶段
  | "failed"          // 审核不通过
  | "blocked"         // 被前置阶段阻塞
  | "invalidated"     // 上游决策变更导致过期
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

/** 批量获取项目全部 8 个阶段的状态——1 次 DB 查询替代 8 次 */
export async function getAllStageStatuses(
  projectId: string
): Promise<Map<number, StageStatus>> {
  const rows = await db
    .select({ stageNumber: stageRecord.stageNumber, status: stageRecord.status })
    .from(stageRecord)
    .where(eq(stageRecord.projectId, projectId));

  const map = new Map<number, StageStatus>();
  for (let i = 1; i <= 8; i++) {
    map.set(i, "draft");
  }
  for (const row of rows) {
    if (row.stageNumber) {
      map.set(row.stageNumber, row.status as StageStatus);
    }
  }
  return map;
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

/** 验证是否允许进入目标阶段（包括重新进入 invalidated 阶段） */
export async function canEnterStage(
  projectId: string,
  targetStage: number
): Promise<{ allowed: boolean; reason?: string }> {
  const deps = getDependencies(targetStage);

  if (deps.length === 0) {
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

  // 额外检查：如果目标阶段状态是 invalidated，允许重新进入
  const status = await getStageStatus(projectId, targetStage);
  if (status === "invalidated") {
    return { allowed: true };
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
  // ── 依赖守卫：禁止跳过前序阶段 ──────────────────────
  if (stageNumber > 1) {
    const canEnter = await canEnterStage(projectId, stageNumber);
    if (!canEnter.allowed) {
      throw new Error(canEnter.reason ?? `Stage ${stageNumber} 的前序阶段尚未完成，无法进入`);
    }
  }

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

// ── 影响传播 ──────────────────────────────────────────

/**
 * 将受影响的下游阶段标记为 invalidated。
 *
 * 由 impact-analyzer 调用，在用户确认修改后执行。
 * 只标记被分析为 invalidated 或 needs_review 的阶段。
 * 已经 completed 的阶段会被降级为 invalidated。
 */
export async function invalidateDownstream(
  projectId: string,
  stageNumbers: number[]
): Promise<void> {
  for (const stage of stageNumbers) {
    const status = await getStageStatus(projectId, stage);
    // 只对已完成或已失效的阶段标记（不覆盖 active 中的阶段——那个由前端确认流程处理）
    if (status === "completed" || status === "invalidated") {
      await setStageStatus(projectId, stage, "invalidated");
    }
  }
}

/**
 * 重新进入失效阶段：将状态从 invalidated 重置为 active，
 * 保留原有 consultationMessages 作为历史参考。
 */
export async function revalidateStage(
  projectId: string,
  stageNumber: number
): Promise<void> {
  const status = await getStageStatus(projectId, stageNumber);
  if (status === "invalidated") {
    await setStageStatus(projectId, stageNumber, "active");
  }
}
