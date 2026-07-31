/**
 * Search Context 注入器
 *
 * 职责：
 * - 将搜索结果格式化为可注入 Consultation system prompt 的文本
 * - 生成搜索覆盖报告（AI 开场白用）
 * - 生成 dataSources 数组（阶段 JSON 用）
 *
 * 注入格式遵循 shared-search-protocol.md Section 四"四段式展示"。
 */

import type {
  SearchContextInput,
  FormattedSearchContext,
  CoverageDimension,
  RetrievedContent,
} from "./types";

/**
 * 将完整搜索上下文格式化为三个产物：
 * 1. contextText — 注入 Consultation system prompt
 * 2. coverageReport — AI 开场白中的搜索覆盖报告
 * 3. dataSources  — 阶段 JSON 的搜索来源记录
 */
export function formatSearchContext(input: SearchContextInput): FormattedSearchContext {
  const { retrievedContents, coverage, brandName, category } = input;

  // ── contextText：注入 system prompt ──────────────────
  const contextParts: string[] = [];

  contextParts.push(`## 本次搜索发现（${brandName} - ${category}）\n`);

  // 每个抓取的内容
  for (let i = 0; i < retrievedContents.length; i++) {
    const c = retrievedContents[i];
    const label = c.sourceType === "fulltext" ? "全文引用" : "摘要引用";
    contextParts.push(`### [${i + 1}] ${c.title}`);
    contextParts.push(`- 来源: [${c.source}](${c.url})`);
    contextParts.push(`- 引用类型: ${label}`);
    if (c.fallbackReason) {
      contextParts.push(`- ⚠️ ${c.fallbackReason}`);
    }
    contextParts.push(`\n${c.content.slice(0, 3000)}\n`);
    if (c.content.length > 3000) {
      contextParts.push("...(内容已截断，完整内容请参考原链接)");
    }
    contextParts.push("");
  }

  // 覆盖维度状态
  contextParts.push("### 搜索覆盖状态\n");
  for (const dim of coverage) {
    const icon = dim.status === "covered" ? "✅" : dim.status === "missing" ? "❌" : "⬜";
    const note = dim.note ? ` — ${dim.note}` : "";
    contextParts.push(`- ${icon} ${dim.name}${note}`);
  }

  const contextText = contextParts.join("\n");

  // ── coverageReport：AI 开场白摘要 ────────────────────
  const coveredCount = coverage.filter((d) => d.status === "covered").length;
  const missingCount = coverage.filter((d) => d.status === "missing").length;
  const missingDims = coverage.filter((d) => d.status === "missing");

  const reportParts: string[] = [];
  reportParts.push(`共搜索 ${retrievedContents.length} 个来源，覆盖 ${coveredCount}/${coverage.length} 个分析维度。`);

  if (missingDims.length > 0) {
    const dimNames = missingDims.map((d) => d.name).join("、");
    reportParts.push(`以下维度暂未覆盖：${dimNames}。`);
  }

  // 区分全文/摘要来源
  const fulltextCount = retrievedContents.filter((c) => c.sourceType === "fulltext").length;
  const snippetCount = retrievedContents.filter((c) => c.sourceType === "snippet").length;
  if (snippetCount > 0) {
    reportParts.push(
      `${fulltextCount} 个来源获取了全文，${snippetCount} 个来源基于搜索摘要判断。`
    );
  }

  const coverageReport = reportParts.join(" ");

  // ── dataSources：阶段 JSON 用 ────────────────────────
  const dataSources = retrievedContents.map((c) => ({
    url: c.url,
    title: c.title,
    type: c.sourceType === "fulltext" ? "full_text" as const : "snippet" as const,
    summary: c.content.slice(0, 300),
  }));

  return { contextText, coverageReport, dataSources };
}

/**
 * 构建注入 Consultation system prompt 的完整搜索上下文文本
 * 快捷方法 — 等同于 formatSearchContext(input).contextText
 */
export function injectSearchContext(input: SearchContextInput): string {
  return formatSearchContext(input).contextText;
}
