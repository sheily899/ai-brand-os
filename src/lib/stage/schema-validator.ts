/**
 * Schema Validator — Zod 校验 + 重试控制
 *
 * 职责：
 * - 对 Convergence 输出进行 Zod 校验
 * - 校验失败时发起重试（仅重新生成违规字段）
 * - 最多重试 3 次，仍未通过标记"待人工复核"
 *
 * 不负责：
 * - 内容质量判断（交给 Audit Engine）
 */

import { ZodSchema, ZodError } from "zod";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  needsRetry: boolean;
  retryCount: number;
}

const MAX_RETRIES = 3;

/** 对 LLM 输出进行 Schema 校验 */
export function validate<T>(
  schema: ZodSchema<T>,
  jsonText: string,
  retryCount = 0
): ValidationResult<T> {
  try {
    const parsed = JSON.parse(jsonText);
    const data = schema.parse(parsed);
    return {
      success: true,
      data,
      needsRetry: false,
      retryCount,
    };
  } catch (error) {
    const errors: string[] = [];

    if (error instanceof ZodError) {
      for (const issue of error.issues) {
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
      }
    } else if (error instanceof SyntaxError) {
      errors.push(`JSON 解析错误: ${error.message}`);
    } else {
      errors.push(`未知错误: ${String(error)}`);
    }

    return {
      success: false,
      errors,
      needsRetry: retryCount < MAX_RETRIES,
      retryCount,
    };
  }
}

/** 生成重试时的错误反馈 Prompt 片段 */
export function buildRetryFeedback(errors: string[], jsonText: string): string {
  return [
    "上一次输出的 JSON 存在以下校验错误：",
    ...errors.map((e) => `  - ${e}`),
    "",
    "上一次输出的 JSON：",
    "```json",
    jsonText,
    "```",
    "",
    "请只修正上述错误字段，其余正确字段保持不变，重新输出完整 JSON。",
    "只输出 JSON，不要输出解释文字。",
  ].join("\n");
}
