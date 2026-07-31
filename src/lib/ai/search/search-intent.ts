/**
 * Search Intent Generator
 *
 * 职责：
 * - 根据阶段+品牌+品类+Decision Memory Context 生成搜索意图
 * - 读取 shared-search-protocol.md 获取覆盖维度定义
 * - 使用 AI 生成结构化搜索关键词
 *
 * 搜索规则完全读取 shared-search-protocol.md，代码中不重复维护覆盖矩阵。
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { getLLMProvider } from "@/lib/ai/provider";
import type { SearchIntent, CoverageDimension } from "./types";

const PROTOCOL_PATH = resolve(process.cwd(), "reference/shared-search-protocol.md");

// ── Protocol 文件读取 ──────────────────────────────────

let _protocolCache: string | null = null;

/** 读取共享搜索协议全文（缓存） */
function loadProtocol(): string {
  if (!_protocolCache) {
    try {
      _protocolCache = readFileSync(PROTOCOL_PATH, "utf8");
    } catch {
      console.error("[search-intent] 无法加载 shared-search-protocol.md");
      _protocolCache = "";
    }
  }
  return _protocolCache;
}

/** 提取指定阶段的覆盖矩阵部分 */
function extractStageSection(stage: number): string {
  const protocol = loadProtocol();
  if (!protocol) return "";

  // 按阶段编号匹配对应 section
  const stageNames: Record<number, string> = {
    2: "Stage 2 商业背景分析",
    3: "Stage 3 市场机会分析",
    5: "Stage 5 竞争判断",
    8: "Stage 8 内容规划",
  };

  const heading = stageNames[stage];
  if (!heading) return "";

  // 提取该阶段的覆盖矩阵段落（## 二 下的 ### Stage N 部分）
  const sectionStart = protocol.indexOf(heading);
  if (sectionStart === -1) return "";

  // 查找下一个同级 ### 作为结束标记
  const remaining = protocol.slice(sectionStart + heading.length);
  const nextSectionMatch = remaining.match(/\n###\s/);
  const sectionEnd = nextSectionMatch
    ? sectionStart + heading.length + nextSectionMatch.index!
    : protocol.length;

  return protocol.slice(sectionStart, sectionEnd);
}

// ── AI 搜索意图生成 ───────────────────────────────────

export interface GenerateIntentInput {
  stage: number;
  brandName: string;
  category: string;
  /** Decision Memory Context（前序阶段已确认资产） */
  decisionMemoryContext?: string;
}

/**
 * 使用 AI 根据阶段覆盖矩阵 + 品牌上下文生成搜索意图
 */
export async function generateSearchIntent(
  input: GenerateIntentInput
): Promise<SearchIntent> {
  const { stage, brandName, category, decisionMemoryContext } = input;

  const stageSection = extractStageSection(stage);

  // 构建 AI prompt
  const systemPrompt = `你是一个搜索策略专家。你的任务是根据给定的品牌信息和阶段要求，生成结构化的搜索计划。

## 当前阶段覆盖矩阵

以下定义了本阶段必须覆盖的搜索维度。你需要为每个维度生成具体的搜索关键词。

${stageSection || "(搜索协议未加载，请根据常识生成搜索关键词)"}

## 品牌上下文

- 品牌名称：${brandName}
- 品类方向：${category}
${decisionMemoryContext ? `\n### 前序阶段已确认信息\n${decisionMemoryContext}` : ""}

## 输出要求

严格输出 JSON 对象：

\`\`\`json
{
  "objective": "一句话描述本次搜索的战略目标",
  "queries": [
    {
      "keyword": "具体搜索关键词（包含品牌/品类名以缩小范围）",
      "dimension": "对应覆盖矩阵中的维度名称",
      "preferredSources": ["优先搜索的第一个来源", "第二个"]
    }
  ],
  "coverageDimensions": [
    {
      "name": "维度名（对齐覆盖矩阵）",
      "status": "not_searched"
    }
  ]
}
\`\`\`

规则：
1. 覆盖矩阵中列出的每个"必须覆盖维度"都要在 coverageDimensions 中对应一项
2. 每个维度至少生成 1 个搜索查询（queries）
3. 关键词应包含品类名 + 搜索目的（如"宠物食品 市场规模 2024"）
4. preferredSources 从搜索协议第一节"优先搜索来源"中选择
5. queries 数量：3-8 条（覆盖所有必须维度即可）
6. 只输出 JSON，不要任何解释文字`;

  try {
    const provider = getLLMProvider();
    const response = await provider.chat(
      [{ role: "user", content: systemPrompt }],
      { temperature: 0.3, maxTokens: 2048, responseFormat: "json_object" }
    );

    const parsed = JSON.parse(response);
    return {
      stage,
      objective: parsed.objective ?? `Stage ${stage} 搜索`,
      queries: parsed.queries ?? [],
      coverageDimensions: parsed.coverageDimensions ?? [],
    };
  } catch (e: any) {
    console.error(`[search-intent] AI 生成失败: ${e.message}`);

    // 回退：从协议中提取基础维度名作为降级方案
    const fallbackDimensions = extractDimensionNames(stage);
    return {
      stage,
      objective: `Stage ${stage} 市场信息搜索`,
      queries: fallbackDimensions.map((d) => ({
        keyword: `${brandName} ${category} ${d}`,
        dimension: d,
        preferredSources: [],
      })),
      coverageDimensions: fallbackDimensions.map((d) => ({
        name: d,
        status: "not_searched",
      })),
    };
  }
}

/**
 * 降级方案：从协议文本中简单提取维度名称
 * 仅在 AI 调用失败时使用
 */
function extractDimensionNames(stage: number): string[] {
  const section = extractStageSection(stage);
  if (!section) return [];

  // 匹配表格中的维度名称（第一列）
  const dimensionMatch = section.match(/\|\s*(.+?)\s*\|/g);
  if (!dimensionMatch) return [];

  const dimensions: string[] = [];
  let inTable = false;
  for (const line of section.split("\n")) {
    if (line.includes("必须覆盖维度")) {
      inTable = true;
      continue;
    }
    if (inTable && line.startsWith("|") && !line.includes("---") && !line.includes("搜索关键词")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 1 && cells[0].length < 30) {
        dimensions.push(cells[0]);
      }
    }
    if (inTable && line.trim() === "") break;
  }

  return dimensions.length > 0 ? dimensions : ["市场规模", "增长趋势", "竞争格局"];
}
