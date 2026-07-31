/**
 * 决策依赖图（Decision Dependency Graph）
 *
 * 定义八阶段 dependsOn 关系。
 * - Workflow Engine 用此验证阶段推进合法性
 * - Cross Stage Context Check Layer A 用此确定检查范围
 *
 * 注意：此图仅定义**阶段级**依赖。字段级依赖（如 S6.reasoning → S3/S4/S5 具体字段）
 * 定义在 Cross Stage Check 的字段级依赖配置中（Phase 3 实现）。
 */

export interface StageDependency {
  stage: number;
  name: string;
  dependsOn: number[];   // 必须先完成的前序阶段
  requiredFor: number[]; // 被哪些阶段依赖
}

export const STAGE_DEPENDENCIES: StageDependency[] = [
  {
    stage: 1,
    name: "用户访谈",
    dependsOn: [],
    requiredFor: [2, 3, 4, 5, 6],
  },
  {
    stage: 2,
    name: "商业背景分析",
    dependsOn: [1],
    requiredFor: [3, 5, 6],
  },
  {
    stage: 3,
    name: "市场机会分析",
    dependsOn: [1, 2],
    requiredFor: [4, 5, 6],
  },
  {
    stage: 4,
    name: "消费者洞察",
    dependsOn: [1, 3],
    requiredFor: [5, 6, 7, 8],
  },
  {
    stage: 5,
    name: "竞争判断",
    dependsOn: [1, 2, 3, 4],
    requiredFor: [6, 7, 8],
  },
  {
    stage: 6,
    name: "品牌核心战略",
    dependsOn: [1, 2, 3, 4, 5], // 战略枢纽：承接全部前序
    requiredFor: [7, 8],
  },
  {
    stage: 7,
    name: "视觉策略",
    dependsOn: [4, 5, 6],
    requiredFor: [8],
  },
  {
    stage: 8,
    name: "内容规划",
    dependsOn: [4, 5, 6, 7],
    requiredFor: [],
  },
];

/** 快速查找某阶段的依赖 */
export function getDependencies(stage: number): number[] {
  const dep = STAGE_DEPENDENCIES.find((d) => d.stage === stage);
  return dep?.dependsOn ?? [];
}

/** 验证某阶段是否依赖目标阶段 */
export function dependsOn(stage: number, targetStage: number): boolean {
  return getDependencies(stage).includes(targetStage);
}

/** 获取被某阶段阻塞的下游阶段 */
export function getBlockedBy(stage: number): number[] {
  return STAGE_DEPENDENCIES.filter((d) => d.dependsOn.includes(stage)).map(
    (d) => d.stage
  );
}
