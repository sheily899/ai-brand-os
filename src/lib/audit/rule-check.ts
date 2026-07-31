/**
 * Rule Check — 轻量版（Phase 2）
 *
 * 职责：
 * - 检查阶段输出的字段完整性和 Schema 完整性
 * - 纯代码实现，不调用 LLM
 *
 * Phase 3 会在此基础上增加：
 * - 逻辑冲突检测
 * - 字段间一致性检查
 *
 * 不包含：
 * - 任何 LLM 调用
 * - 跨阶段检查（Phase 3）
 */

import type { ZodSchema } from "zod";

export interface RuleIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface RuleCheckResult {
  passed: boolean;
  issues: RuleIssue[];
}

/**
 * 执行轻量 Rule Check
 * - 检查 Zod schema 是否通过
 * - 检查核心字段是否为非空
 */
export function runRuleCheck(
  output: Record<string, any> | undefined,
  schema: ZodSchema<any>,
  requiredFields: string[] = []
): RuleCheckResult {
  const issues: RuleIssue[] = [];

  // 1. 输出为空
  if (!output) {
    return {
      passed: false,
      issues: [{ field: "root", message: "阶段输出为空", severity: "error" }],
    };
  }

  // 2. Schema 完整性
  const result = schema.safeParse(output);
  if (!result.success) {
    for (const err of result.error.issues) {
      issues.push({
        field: err.path.join("."),
        message: err.message,
        severity: "error",
      });
    }
  }

  // 3. 必填字段非空检查
  for (const field of requiredFields) {
    const value = getNestedValue(output, field);
    if (value === undefined || value === null || value === "") {
      issues.push({
        field,
        message: `必填字段 "${field}" 为空`,
        severity: "error",
      });
    }
  }

  return {
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}

/**
 * 各阶段必填字段定义
 * Phase 2 轻量版：只检查最核心字段
 */
export const STAGE_REQUIRED_FIELDS: Record<number, string[]> = {
  1: ["founderMotivation", "observations", "confirmedProblems"],
  2: ["businessBackground.marketContext", "coreChallenges.externalChallenges", "strategicDirection.directionHypothesis"],
  3: ["marketOverview", "opportunityDirections"],
  4: ["targetConsumer.definition", "deepNeeds.identityNeed", "deepNeeds.functionalNeed"],
  5: ["competitors", "competitiveGap"],
  6: ["positioning", "valuePropositions", "reasoning"],
  7: ["visualDirection"],
  8: ["contentPillars"],
};

/**
 * 获取嵌套对象值
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}
