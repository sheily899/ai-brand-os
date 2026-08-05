/**
 * Markdown 渲染工具函数。
 *
 * 行内格式：**粗体**、*斜体*、`行内代码`、~~删除线~~、[文本](URL) 链接、--- 分割线
 * 块级格式：标题、表格、有序/无序列表、代码块、引用块、段落
 */

/** 安全 URL 协议白名单 */
const ALLOWED_PROTOCOLS = /^https?:\/\//i;

// ============================================================================
// 行内格式渲染
// ============================================================================

/**
 * 将 [文本](URL) 格式的 markdown 链接渲染为安全的 <a> 标签。
 */
export function renderMarkdownLinks(text: string): string {
  return text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_full: string, label: string, url: string) => {
      const trimmedUrl = url.trim();
      if (!ALLOWED_PROTOCOLS.test(trimmedUrl)) {
        return `[${label}](${trimmedUrl})`;
      }
      return `<a href="${trimmedUrl}" target="_blank" rel="noopener noreferrer" class="underline hover:no-underline">${label}</a>`;
    }
  );
}

/**
 * 渲染行内 markdown 为 HTML。
 * 支持：**粗体**、*斜体*、`行内代码`、~~删除线~~、[链接](url)
 *
 * 注意：不使用简单正则替换（会破坏已渲染的 HTML tag 属性中的 * 等字符）。
 * 因此采用逐字符扫描 + 状态机的方式确保安全。
 */
export function renderInlineMarkdown(text: string): string {
  // 先渲染链接（链接内部不再解析其他格式，避免 URL 中的特殊字符被破坏）
  let html = renderMarkdownLinks(text);

  // 行内代码（最高优先级，内部不解析其他格式）
  html = html.replace(/`([^`]+)`/g, '<code class="bg-stone-100 text-[#c7254e] rounded px-1 py-0.5 text-xs font-mono">$1</code>');

  // 粗体 + 斜体（三连星）
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");

  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // 斜体（单星号，不匹配双星）
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  // 删除线
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // 水平分割线（独立一行）
  html = html.replace(/^[-*_]{3,}\s*$/gm, '<hr class="my-3 border-stone-200" />');

  return html;
}

/**
 * HTML 实体转义（用于代码块）
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================================
// 表格渲染
// ============================================================================

/**
 * 检测文本块是否为 Markdown 表格（≥2 行且每行都以 | 开头和结尾）。
 */
export function isMarkdownTable(text: string): boolean {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return false;
  return lines.every((line) => {
    const trimmed = line.trim();
    return /^\|.+\|$/.test(trimmed);
  });
}

/**
 * 解析 Markdown 表格分隔行中的对齐方式。
 * |:---| → left, |:---:| → center, |---:| → right
 */
function parseAlignment(sepLine: string): ("left" | "center" | "right")[] {
  return sepLine
    .split("|")
    .filter((cell) => cell.trim() !== "")
    .map((cell) => {
      const t = cell.trim();
      const startColon = t.startsWith(":");
      const endColon = t.endsWith(":");
      if (startColon && endColon) return "center";
      if (endColon) return "right";
      return "left";
    });
}

/**
 * 将 Markdown 表格文本块渲染为 HTML table。
 */
export function renderMarkdownTable(text: string): string | null {
  if (!isMarkdownTable(text)) return null;

  const lines = text.trim().split("\n");
  if (lines.length < 2) return null;

  const headerLine = lines[0].trim();
  const sepLine = lines[1]?.trim() ?? "";
  const dataLines = lines.slice(2).filter((line) => {
    const trimmed = line.trim();
    if (/^\|[\s\-:|]+\|$/.test(trimmed)) return false;
    return true;
  });

  const alignments = parseAlignment(sepLine);

  const headerCells = headerLine
    .split("|")
    .filter((cell) => cell.trim() !== "");

  const thead = `<thead><tr>${headerCells
    .map(
      (cell, i) =>
        `<th class="border border-stone-300 px-3 py-2" style="text-align:${alignments[i] || "left"}">${renderInlineMarkdown(cell.trim())}</th>`
    )
    .join("")}</tr></thead>`;

  const tbody = `<tbody>${dataLines
    .map((line) => {
      const cells = line
        .split("|")
        .filter((cell) => cell.trim() !== "");
      return `<tr>${cells
        .map(
          (cell, i) =>
            `<td class="border border-stone-200 px-3 py-1.5" style="text-align:${alignments[i] || "left"}">${renderInlineMarkdown(cell.trim())}</td>`
        )
        .join("")}</tr>`;
    })
    .join("")}</tbody>`;

  return `<table class="w-full border-collapse text-sm my-2 border border-stone-300"><thead class="bg-stone-100">${thead}</thead><tbody>${tbody}</tbody></table>`;
}

// ============================================================================
// 块级渲染
// ============================================================================

/**
 * 检测块是否为有序列表（所有行都以 "数字. " 开头）。
 */
function isOrderedList(block: string): boolean {
  const lines = block.trim().split("\n");
  if (lines.length < 1) return false;
  return lines.every((line) => /^\d+\.\s/.test(line.trim()));
}

/**
 * 检测块是否为块引用（所有行都以 "> " 开头）。
 */
function isBlockquote(block: string): boolean {
  const lines = block.trim().split("\n");
  if (lines.length < 1) return false;
  return lines.every((line) => /^>\s/.test(line.trim()));
}

/**
 * 检测块是否为代码块（以 ``` 开头和结尾）。
 */
function isFencedCode(block: string): boolean {
  return /^```[\s\S]*```$/.test(block.trim());
}

/**
 * 检测块是否为标题（# / ## / ###）。
 */
function isHeading(block: string): boolean {
  return /^#{1,3}\s+.+$/.test(block.trim()) && !block.includes("\n");
}

/**
 * 将单个 Markdown 块渲染为 HTML。
 * 按优先级依次检测：代码块 → 表格 → 标题 → 块引用 → 有序列表 → 无序列表 → 段落
 */
function renderBlock(block: string): string {
  const trimmed = block.trim();
  if (!trimmed) return "";

  // 1. 代码块（``` ... ```）
  if (isFencedCode(trimmed)) {
    const inner = trimmed.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
    return `<pre class="bg-stone-100 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code class="text-stone-700 font-mono">${escapeHtml(inner)}</code></pre>`;
  }

  // 2. 表格
  if (isMarkdownTable(trimmed)) {
    return renderMarkdownTable(trimmed) ?? `<p>${renderInlineMarkdown(trimmed)}</p>`;
  }

  // 3. 标题
  if (isHeading(trimmed)) {
    const match = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = renderInlineMarkdown(match[2]);
      const sizes: Record<number, string> = {
        1: "text-lg font-semibold",
        2: "text-base font-semibold",
        3: "text-sm font-semibold",
      };
      return `<h${level} class="${sizes[level] || "text-sm font-semibold"} my-2">${text}</h${level}>`;
    }
  }

  // 4. 块引用
  if (isBlockquote(trimmed)) {
    const content = trimmed
      .split("\n")
      .map((line) => renderInlineMarkdown(line.replace(/^>\s?/, "")))
      .join("<br>");
    return `<blockquote class="border-l-3 border-stone-300 pl-3 my-2 text-stone-600 italic">${content}</blockquote>`;
  }

  // 5. 有序列表
  if (isOrderedList(trimmed)) {
    const items = trimmed
      .split("\n")
      .map((line) => {
        const text = renderInlineMarkdown(line.trim().replace(/^\d+\.\s*/, ""));
        return `<li>${text}</li>`;
      })
      .join("");
    return `<ol class="list-decimal pl-5 my-1 space-y-0.5">${items}</ol>`;
  }

  // 6. 任务清单（[x] / [ ]，支持带或不带前导 -）
  if (/^(\s*[-•]\s)?\[[x\s]\]/im.test(trimmed)) {
    const items = trimmed
      .split("\n")
      .filter((line) => /^(\s*[-•]\s)?\[[x\s]\]/i.test(line.trim()))
      .map((line) => {
        const trimmedLine = line.trim();
        const checked = /\[x\]/i.test(trimmedLine);
        // 去掉前导标记，提取文本内容
        const text = renderInlineMarkdown(
          trimmedLine.replace(/^(\s*[-•]\s)?\[[x\s]\]\s*/i, "")
        );
        const checkbox = checked
          ? `<span class="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-emerald-100 text-emerald-600 mr-2 shrink-0"><svg class="w-3 h-3" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
          : `<span class="inline-flex items-center justify-center w-4 h-4 rounded-sm border border-stone-300 bg-white mr-2 shrink-0"></span>`;
        return `<div class="flex items-start py-0.5 ${checked ? "text-stone-700" : "text-stone-400"}">${checkbox}<span>${text}</span></div>`;
      })
      .join("");
    return `<div class="my-1 space-y-0.5">${items}</div>`;
  }

  // 7. 无序列表
  if (trimmed.split("\n").some((line) => /^[-•]\s/.test(line.trim()))) {
    const items = trimmed
      .split("\n")
      .filter((line) => /^[-•]\s/.test(line.trim()))
      .map((line) => {
        const text = renderInlineMarkdown(line.trim().replace(/^[-•]\s*/, ""));
        return `<li>${text}</li>`;
      })
      .join("");
    return `<ul class="list-disc pl-5 my-1 space-y-0.5">${items}</ul>`;
  }

  // 7. 普通段落
  const lines = trimmed.split("\n");
  const rendered = lines.map((line) => renderInlineMarkdown(line)).join("<br>");
  return `<p>${rendered}</p>`;
}

/**
 * 渲染完整的 Markdown 内容为 HTML。
 * 按双空行分割块，每个块独立检测类型并渲染。
 *
 * 用于消息气泡、报告正文、搜索发现等所有需要渲染 Markdown 的场景。
 */
export function renderMarkdownBlocks(content: string): string {
  return content
    .split(/\n\n+/)
    .map((block) => renderBlock(block))
    .filter(Boolean)
    .join("");
}

// ============================================================================
// 向后兼容（旧 API）
// ============================================================================

/**
 * @deprecated 使用 renderInlineMarkdown 代替。
 * 仅保留用于尚未迁移到 renderMarkdownBlocks 的外部调用。
 */
export function renderSimpleMarkdown(text: string): string {
  let html = text;
  html = renderMarkdownLinks(html);
  html = html.replace(/^[-*_]{3,}\s*$/gm, '<hr class="my-3 border-stone-200" />');
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return html;
}
