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
import { resolve, join } from "path";
import type { MessageContent } from "@/lib/ai/provider/interface";

/** 是否启用 vision 多模态（需要模型支持，如 GPT-4o、Claude 3.5）。DeepSeek deepseek-chat 不支持 */
const VISION_ENABLED = process.env.VISION_ENABLED === "true"; // 默认关闭（DeepSeek 不支持 image_url）

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

// ── 图片处理 ──────────────────────────────────────────

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/** 将相对路径图片转为 base64 data URL */
function imageToBase64(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:/.test(trimmed)) return trimmed;

  try {
    const filePath = join(process.cwd(), "public", trimmed.replace(/^\//, ""));
    const buffer = readFileSync(filePath);
    const base64 = buffer.toString("base64");
    const ext = trimmed.split(".").pop()?.toLowerCase() ?? "png";
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
      gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    };
    return `data:${mimeMap[ext] ?? "image/png"};base64,${base64}`;
  } catch {
    console.warn(`[loader] 无法读取图片: ${trimmed}`);
    return trimmed;
  }
}

/** Vision 模式：将 ![name](url) 转为多模态 content 数组 */
function toMultimodalContent(text: string): MessageContent {
  const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = IMAGE_RE.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: "text", text: text.slice(lastIdx, match.index) });
    }
    parts.push({ type: "image_url", image_url: { url: imageToBase64(match[2]) } });
    lastIdx = match.index + match[0].length;
  }

  if (parts.length === 0) return text;
  if (lastIdx < text.length) {
    parts.push({ type: "text", text: text.slice(lastIdx) });
  }
  if (!parts.some((p) => p.type === "text")) {
    parts.unshift({ type: "text", text: "请分析这张图片" });
  }
  return parts as MessageContent;
}

/** 文本模式：给包含图片的消息加上 AI 可读的上下文提示 */
function wrapImageAsText(text: string): string {
  const matches = text.match(IMAGE_RE);
  if (!matches || matches.length === 0) return text;

  const names = matches.map((m) => {
    const nameMatch = m.match(/!\[([^\]]*)\]/);
    return nameMatch?.[1] ?? "未知文件";
  });

  return `[系统提示] 用户上传了 ${names.length} 张图片（${names.join("、")}）。当前模型暂不支持直接查看图片内容，请根据文件名和对话上下文来判断图片可能的用途，并在回复中坦诚说明你无法查看图片这一限制。\n\n${text}`;
}

// ── buildMessages ──────────────────────────────────────

/**
 * 从对话历史构造 messages 数组。
 * - VISION_ENABLED=true → 图片以多模态 base64 发送（需模型支持 vision）
 * - VISION_ENABLED=false（默认）→ 图片保持文字 + 系统提示
 */
export function buildMessages(
  systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  newUserMessage?: string
): Array<{ role: "system" | "user" | "assistant"; content: MessageContent }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: MessageContent }> = [
    { role: "system", content: systemPrompt },
  ];

  const processUserContent = (text: string): MessageContent =>
    VISION_ENABLED ? toMultimodalContent(text) : wrapImageAsText(text);

  for (const msg of history) {
    messages.push({
      role: msg.role,
      content: msg.role === "user" ? processUserContent(msg.content) : msg.content,
    });
  }

  if (newUserMessage) {
    messages.push({ role: "user", content: processUserContent(newUserMessage) });
  }

  return messages;
}

/** 判断某阶段是否需要搜索 */
export function isSearchStage(stage: number): boolean {
  return SEARCH_STAGES.has(stage);
}
