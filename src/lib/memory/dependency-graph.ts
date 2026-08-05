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

/** 获取被某阶段直接阻塞的下游阶段 */
export function getBlockedBy(stage: number): number[] {
  return STAGE_DEPENDENCIES.filter((d) => d.dependsOn.includes(stage)).map(
    (d) => d.stage
  );
}

/** 递归获取某阶段的所有下游阶段（含间接依赖），用于回溯影响范围展示 */
export function getAllDownstream(stage: number): number[] {
  const visited = new Set<number>();
  const queue = [stage];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const blocked = getBlockedBy(current);
    for (const b of blocked) {
      if (!visited.has(b)) {
        visited.add(b);
        queue.push(b);
      }
    }
  }

  return [...visited].sort((a, b) => a - b);
}

// ── 字段级前向依赖 ──────────────────────────────────────

/**
 * 字段级前向依赖定义。
 *
 * 建立在 STAGE_DEPENDENCIES.requiredFor 的阶段级粗筛基础上，
 * 提供字段级精筛——明确"上游的哪个字段被修改时，下游的哪些阶段受影响"。
 *
 * key 格式：使用 `[]` 通配数组元素，如 `opportunityDirections[].direction`
 * value.affected：受影响的阶段编号列表
 *
 * 每条 entry 注释标注来源证据（convergence prompt 显式声明 + 行号）。
 * MVP 覆盖 S3/S4/S5 → S6/S7/S8 的核心引用路径。
 */

export interface FieldForwardDep {
  stage: number;       // 来源阶段
  affected: number[];  // 受影响的阶段列表
  /** 引用该字段的下游 prompt 证据 */
  evidence: string;
}

export const FIELD_FORWARD_DEPENDENCIES: Record<string, FieldForwardDep> = {
  // ── S3 → S4/S5/S6（来自 stage4-converge.md:15, stage5-converge.md, stage6-converge.md:71）──
  "marketOverview.marketSize": {
    stage: 3, affected: [4, 5, 6],
    evidence: "S4 消费场景判断需要市场规模背景；S5 竞争格局分析参考市场规模；S6 reasoning.marketOpportunityReference 显式引用",
  },
  "marketOverview.growthRate": {
    stage: 3, affected: [4, 5, 6],
    evidence: "S4 需求趋势判断需要增长率背景；S5 赛道吸引力判断参考增速；S6 战略时机判断引用",
  },
  "marketOverview.marketStage": {
    stage: 3, affected: [5, 6],
    evidence: "S5 竞争阶段判断需要赛道生命周期；S6 定位策略依赖赛道阶段",
  },
  "opportunityDirections[].direction": {
    stage: 3, affected: [4, 6],
    evidence: "stage4-converge.md:15 显式引用；stage6-converge.md:71 reasoning.marketOpportunityReference 强制引用",
  },
  "opportunityDirections[].rationale": {
    stage: 3, affected: [6],
    evidence: "stage6-converge.md:71 reasoning 引用 S3 判断依据",
  },
  "opportunityDirections[].evidenceLevel": {
    stage: 3, affected: [6],
    evidence: "S6 引用时需判断证据可信度以确定战略确定性的措辞",
  },
  "categoryStatus.definition": {
    stage: 3, affected: [4, 5, 6],
    evidence: "品类定义是 S4/S5/S6 的基础上下文",
  },
  "categoryStatus.currentState": {
    stage: 3, affected: [5, 6],
    evidence: "供给格局是 S5 竞争判断和 S6 定位的基础",
  },
  "categoryStatus.trends": {
    stage: 3, affected: [4, 6],
    evidence: "S4 消费者趋势 + S6 战略方向引用品类趋势",
  },
  "experienceGaps[].gap": {
    stage: 3, affected: [4, 6],
    evidence: "stage4-converge.md:15 显式引用 experienceGaps；S6 定位回应市场缺口",
  },
  "experienceGaps[].currentAlternative": {
    stage: 3, affected: [4, 6],
    evidence: "S4 现有解决方案分析 + S6 差异化方向参考",
  },

  // ── S4 → S6/S7/S8（来自 stage6-converge.md:72, stage7-converge.md, stage8-converge.md）──
  "deepNeeds.identityNeed": {
    stage: 4, affected: [6, 7, 8],
    evidence: "stage6-converge.md:72 reasoning.consumerInsightReference 强制引用；S7 视觉调性 + S8 内容调性依赖身份认同",
  },
  "deepNeeds.functionalNeed": {
    stage: 4, affected: [6, 7, 8],
    evidence: "S6 价值主张功能层 + S7 功能场景视觉 + S8 内容价值系统依赖功能需求",
  },
  "targetConsumer.definition": {
    stage: 4, affected: [6, 7, 8],
    evidence: "S6 目标受众 + S7 审美偏好 + S8 内容受众策略均依赖消费者定义",
  },
  "targetConsumer.idealSelfReflection": {
    stage: 4, affected: [6, 7, 8],
    evidence: "S6 品牌故事 + S7 视觉调性 + S8 内容情感层均依赖理想自我映射",
  },
  "existingSolutions[].failReason": {
    stage: 4, affected: [6],
    evidence: "S6 差异化定位需要理解现有方案的失败原因",
  },

  // ── S5 → S6/S7/S8（来自 stage6-converge.md:73）──
  "whitespaceOpportunity": {
    stage: 5, affected: [6, 7, 8],
    evidence: "stage6-converge.md:73 reasoning.competitiveGapReference 强制引用；S7/S8 差异化表达依赖空位判断",
  },
  "competitiveLandscape.dimensions": {
    stage: 5, affected: [6],
    evidence: "S6 定位选择需要竞争维度全景",
  },
  "directCompetitors[].positioning": {
    stage: 5, affected: [6, 7],
    evidence: "S6 差异化定位 + S7 视觉区隔均需竞品定位信息",
  },
  "directCompetitors[].weakness": {
    stage: 5, affected: [6],
    evidence: "S6 价值主张设计需要针对竞品弱点",
  },
  "convergenceAndDivergence": {
    stage: 5, affected: [6],
    evidence: "S6 品牌定位需要理解竞争趋同与分化格局",
  },

  // ── S6 → S7/S8（枢纽阶段，来自 stage7-converge.md, stage8-converge.md）──
  "positioning": {
    stage: 6, affected: [7, 8],
    evidence: "S7 视觉方向 + S8 内容策略均以品牌定位为锚点",
  },
  "valuePropositions": {
    stage: 6, affected: [7, 8],
    evidence: "S7 视觉语言 + S8 内容价值系统依赖价值主张三层结构",
  },
  "brandPersonality": {
    stage: 6, affected: [7, 8],
    evidence: "S7 每种视觉语言需与人格一致；S8 内容调性需反映品牌人格",
  },
  "brandStory": {
    stage: 6, affected: [7, 8],
    evidence: "S7 核心视觉概念 + S8 内容叙事方向均承接品牌故事",
  },
};

/** 字段路径规范化：将数组索引替换为 [] 通配符 */
export function normalizeFieldPath(fieldPath: string): string {
  return fieldPath.replace(/\[\d+\]/g, "[]");
}

/** 查询某字段的下游受影响阶段 */
export function getDownstreamAffected(fieldPath: string): number[] {
  const key = normalizeFieldPath(fieldPath);
  const entry = FIELD_FORWARD_DEPENDENCIES[key];
  return entry?.affected ?? [];
}

/** 查询某字段的来源阶段 */
export function getFieldSourceStage(fieldPath: string): number | null {
  const key = normalizeFieldPath(fieldPath);
  return FIELD_FORWARD_DEPENDENCIES[key]?.stage ?? null;
}
