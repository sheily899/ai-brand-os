/**
 * Prompt Loader — 加载 Prompt 模板 + 注入变量
 *
 * 职责：
 * - 读取 .md 格式 Prompt 模板
 * - 注入 Context 变量（品牌名、品类、Decision Memory 等）
 * - 拼接共享搜索协议（S2/S3/S5/S8 阶段）
 * - 注入搜索上下文（Search Intelligence Layer 产出）
 *
 * 不负责：
 * - 实际调用 LLM（由 consultation.ts / convergence.ts 负责）
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const PROMPTS_DIR = resolve(process.cwd(), "src/lib/ai/prompts");
const SEARCH_PROTOCOL_PATH = resolve(process.cwd(), "reference/shared-search-protocol.md");

// ── 搜索协议缓存 ──────────────────────────────────────

let _protocolCache: string | null = null;

function loadSearchProtocol(): string {
  if (!_protocolCache) {
    try {
      _protocolCache = readFileSync(SEARCH_PROTOCOL_PATH, "utf8");
    } catch {
      console.warn("[loader] shared-search-protocol.md 加载失败，搜索协议将跳过");
      _protocolCache = "";
    }
  }
  return _protocolCache;
}

// ── 搜索阶段判断 ──────────────────────────────────────

/** 哪些阶段需要拼接搜索协议 */
const SEARCH_STAGES = new Set([2, 3, 5, 8]);

// ── 公开接口 ──────────────────────────────────────────

export interface LoadOptions {
  /** 阶段编号 */
  stage: number;
  /** 咨询还是收束 */
  mode: "consultation" | "converge";
  /** 注入变量（品牌名、品类等） */
  variables?: Record<string, string>;
  /** 是否拼接搜索协议（S2/S3/S5/S8 阶段建议开启） */
  includeSearchProtocol?: boolean;
  /** Decision Memory Context（前序阶段提取的战略资产） */
  decisionMemoryContext?: string;
  /** 搜索上下文（Search Intelligence Layer 产出，注入 system prompt） */
  searchContext?: string;
}

/** 加载并注入变量后的完整 System Prompt */
export function loadPrompt(options: LoadOptions): string {
  const {
    stage,
    mode,
    variables = {},
    includeSearchProtocol = false,
    searchContext,
  } = options;

  const filename = `stage${stage}-${mode}.md`;
  const filePath = resolve(PROMPTS_DIR, filename);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`Prompt file not found: ${filename}`);
  }

  // ── 变量注入：{品牌名} 等占位符替换 ──────────────────
  let processed = raw;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    processed = processed.split(placeholder).join(value);
  }

  // ── 拼接搜索协议 ─────────────────────────────────────
  if (includeSearchProtocol || SEARCH_STAGES.has(stage)) {
    const protocol = loadSearchProtocol();
    if (protocol) {
      processed += `\n\n---\n\n## 搜索能力说明\n\n${protocol}`;
    }
  }

  // ── 搜索上下文注入（AI 已执行的搜索结果） ──────────────
  if (searchContext) {
    processed += `\n\n---\n\n## 已执行的搜索及其结果\n\n${searchContext}`;
  }

  // ── Decision Memory Context ──────────────────────────
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

/** 判断某阶段是否需要搜索 */
export function isSearchStage(stage: number): boolean {
  return SEARCH_STAGES.has(stage);
}
