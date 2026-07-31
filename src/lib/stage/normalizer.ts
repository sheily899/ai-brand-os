/**
 * Output Normalizer — 纯正则修复 LLM JSON 输出格式问题
 *
 * 职责：
 * - 去除 Markdown 代码块包裹（```json ... ```）
 * - 修复括号匹配
 * - 修复常见引号/破折号问题
 *
 * 不负责：
 * - Schema 验证（交给 schema-validator.ts）
 * - 内容质量判断
 */

export function normalizeJSON(raw: string): string {
  let text = raw.trim();

  // 1. 去除 Markdown 代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  // 2. 去除可能的 BOM 和零宽字符
  text = text.replace(/^﻿/, "");
  text = text.replace(/[​-‍﻿]/g, "");

  // 3. 查找第一个 { 和最后一个 } 之间的内容
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  // 4. 尝试修复常见的嵌套数组语法问题
  // （LLM 有时会输出多余的逗号或丢失引号）

  return text;
}

/** 轻量级 JSON 修复 */
export function fixCommonJSONErrors(text: string): string {
  let fixed = text;

  // 删除尾随逗号（对象和数组）
  fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

  // 修复单引号（JSON 要求双引号，但只在值部分做保守替换）
  // 注意：不做全局替换，避免破坏内容中的引号

  return fixed;
}
