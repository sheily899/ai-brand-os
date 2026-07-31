/**
 * Stage Router — 阶段路由判断
 *
 * 职责：
 * - 确定用户当前应处于哪个阶段
 * - 提供导航建议（下一步该做什么）
 *
 * 不负责：
 * - 实际推进（交给 workflow.ts）
 * - 内容判断
 */

import { canEnterStage, isSequentialJump, getWorkflowState } from "./workflow";
import { getDependencies } from "@/lib/memory/dependency-graph";

export interface StageRoute {
  currentStage: number;
  allowedStages: number[];          // 可进入的阶段（已完成 + 当前）
  nextStage: number | null;        // 下一阶段（如果有）
  recommendedAction: "start" | "continue" | "review" | "wait";
}

export async function getStageRoute(
  projectId: string
): Promise<StageRoute> {
  const state = await getWorkflowState(projectId);

  // 已完成阶段都可回顾
  const allowedStages = [...state.completedStages];

  // 当前阶段如果未完成也允许进入
  if (!state.completedStages.includes(state.currentStage)) {
    allowedStages.push(state.currentStage);
  }

  // 下一阶段
  const nextStage = state.currentStage < 8 ? state.currentStage + 1 : null;

  // 推荐动作
  let recommendedAction: StageRoute["recommendedAction"] = "start";
  if (state.stageStatus === "active") {
    recommendedAction = "continue";
  } else if (state.stageStatus === "waiting_confirm") {
    recommendedAction = "continue";
  } else if (state.stageStatus === "completed" && nextStage) {
    recommendedAction = "start";
  } else if (state.stageStatus === "completed" && !nextStage) {
    recommendedAction = "review";
  } else if (state.stageStatus === "blocked") {
    recommendedAction = "wait";
  }

  return {
    currentStage: state.currentStage,
    allowedStages,
    nextStage,
    recommendedAction,
  };
}
