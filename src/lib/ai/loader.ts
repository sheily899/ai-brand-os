/**
 * Prompt Loader — 加载 Prompt 模板 + 注入变量
 *
 * 职责：
 * - 读取 .md 格式 Prompt 模板
 * - 注入 Context 变量（品牌名、品类、Decision Memory 等）
 * - 拼接共享搜索协议（S3/S5/S8 阶段）
 *
 * 不负责：
 * - 实际调用 LLM（由 consultation.ts / convergence.ts 负责）
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const PROMPTS_DIR = resolve(process.cwd(), "src/lib/ai/prompts");

interface LoadOptions {
  /** 阶段编号 */
  stage: number;
  /** 咨询还是收束 */
  mode: "consultation" | "converge";
  /** 注入变量 */
  variables?: Record<string, string>;
  /** 是否拼接搜索协议（S3/S5/S8） */
  includeSearchProtocol?: boolean;
  /** Decision Memory Context（前序阶段提取的战略资产） */
  decisionMemoryContext?: string;
}

/** 加载并注入变量后的完整 System Prompt */
export function loadPrompt(options: LoadOptions): string {
  const { stage, mode, variables = {} } = options;

  const filename = `stage${stage}-${mode}.md`;
  const filePath = resolve(PROMPTS_DIR, filename);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`Prompt file not found: ${filename}`);
  }

  // 变量注入：{品牌名} 等占位符替换
  let processed = raw;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    // 用全局替换支持多处使用同一变量
    processed = processed.split(placeholder).join(value);
  }

  // 拼接 Decision Memory Context（如果有）
  if (options.decisionMemoryContext) {
    processed += `\n\n## 前序阶段确认的战略资产\n\n${options.decisionMemoryContext}`;
  }

  return processed;
}

/**
 * 从对话历史构造 messages 数组
 * systemPrompt → 历史消息 → 新用户消息（可选）
 */
export function buildMessages(
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  newUserMessage?: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  if (newUserMessage) {
    messages.push({ role: "user", content: newUserMessage });
  }

  return messages;
}
