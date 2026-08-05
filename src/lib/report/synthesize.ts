/**
 * Executive Summary Synthesis — S8 完成后的独立合成步骤
 *
 * 职责：读取 S3-S8 全部关键字段，通过一次独立 LLM 调用，
 * 合成 5 段精炼的执行摘要（每段 1-3 句 + 引用追溯）。
 *
 * 触发时机：S8 converge 完成后，Orchestrator 检测 8 阶段齐全时调用。
 * 结果存入 Project.context.executiveSummary，供 assembleReport() 读取。
 *
 * 不负责：
 * - 组装完整报告
 * - 阶段推进
 * - 内容质量判断
 */

import type { BrandKnowledge, ExecutiveSummaryData, ExecutiveSummaryField } from "./types";
import { getLLMProvider } from "@/lib/ai/provider";

// ═══════════════════════════════════════════════════════════
// Prompt
// ═══════════════════════════════════════════════════════════

/**
 * 构建执行摘要合成 Prompt。
 *
 * 语言标准采用分层语气（选项 C）：
 * - 品牌定位/目标用户/核心价值：确定性陈述（品牌自己的选择）
 * - 差异化/战略方向：保留源数据中的不确定性信号
 */
function buildPrompt(knowledge: BrandKnowledge): string {
  const s3 = knowledge.stages[3];
  const s4 = knowledge.stages[4];
  const s5 = knowledge.stages[5];
  const s6 = knowledge.stages[6];
  const s7 = knowledge.stages[7];
  const s8 = knowledge.stages[8];

  return `你是一位资深品牌策略顾问。你的任务是为「${knowledge.brandName}」撰写一份精炼的品牌战略执行摘要。

## 目标

让决策者在 1 分钟内理解：
这个品牌是谁、服务谁、为什么存在、为什么比别人强、未来往哪里走。

每段摘要 1-3 句话，用语专业、自然、精简。不是堆砌数据，是做出判断。

## 可用数据

以下是从 8 阶段品牌咨询流程中提取的结构化数据。你的摘要必须基于这些数据，
不得编造任何未在数据中出现的事实。

### S3 市场机会
- 品类现状：${s3?.categoryStatus?.definition ?? "无"}
- 品类趋势：${s3?.categoryStatus?.trends?.join("；") ?? "无"}
- 机会方向：${s3?.opportunityDirections?.map((o: any) => o.direction).join("；") ?? "无"}

### S4 消费者洞察
- 目标消费者：${s4?.targetConsumer?.definition ?? "无"}
- 功能需求：${s4?.deepNeeds?.functionalNeed ?? "无"}
- 身份认同需求：${s4?.deepNeeds?.identityNeed ?? "无"}

### S5 竞争判断
- 竞品空位：${s5?.competitiveGap?.marketOpportunity ?? "无"}
- 未满足需求：${s5?.competitiveGap?.unmetNeeds?.join("；") ?? "无"}
${(s5?.competitors as any[])?.map((c: any) =>
    `- ${c.name}：定位「${c.positioning}」，可突破空间：${c.opportunityGap}`
  ).join("\n") ?? "无竞品数据"}

### S6 品牌核心战略
- 品牌定位：${s6?.positioning ?? "无"}
- 功能价值主张：${(s6?.valuePropositions as any[])?.find((v: any) => v.level === "functional")?.proposition ?? "无"}
- 情绪价值主张：${(s6?.valuePropositions as any[])?.find((v: any) => v.level === "emotional")?.proposition ?? "无"}
- 社会价值主张：${(s6?.valuePropositions as any[])?.find((v: any) => v.level === "social")?.proposition ?? "无"}
- 品牌故事-困境：${s6?.brandStory?.struggleMoment ?? "无"}
- 品牌故事-行动：${s6?.brandStory?.brandAction ?? "无"}
- 品牌故事-关系：${s6?.brandStory?.brandRelationship ?? "无"}

### S7 视觉策略
- 视觉核心概念：${s7?.coreConcept ?? "无"}

### S8 内容策略
- 内容核心方向：${s8?.coreDirection ?? "无"}

## 输出格式

为以下 5 个字段各输出一段精炼摘要 + 引用追溯：

### 1. brandPositioning（品牌定位 — 确定性语气）
回答：这个品牌是什么？
格式：一句自然的品牌陈述句，包含品牌类别 + 核心用户 + 核心价值。
不是「对于[消费者]而言，本品牌是[品类]中[价值]的选择」这类公式化写法。

### 2. targetAudience（目标用户 — 确定性语气）
回答：品牌为谁服务？
格式：1-2句，核心人群标签 + 主要需求 + 典型使用场景。
不需要完整画像，只保留最关键的信息。

### 3. coreValue（品牌核心价值 — 确定性语气）
回答：品牌为什么值得存在？
格式：1-3句，从用户痛点出发，说明品牌解决什么问题、创造什么价值。
这是摘要最重要的部分——为什么这个世界需要这个品牌。

### 4. differentiation（品牌差异化 — 视源数据证据强度决定语气）
回答：为什么选择你，而不是别人？
格式：1-3句，必须包含至少一个具体的对比参照物（不能说「相比竞品」，
要说「相比传统甜品强调庆祝场景」「相比奶茶强调即时满足」）。
需要找准核心竞争点，不是罗列所有差异。

### 5. strategicDirection（战略方向 — 视源数据证据强度决定语气）
回答：未来应该如何发展？
格式：1-2句，不用展开策略，只告诉方向：
产品方向 + 内容方向 + 品牌建设方向。

## 语气标准

核心原则：品牌选择类判断（identity）用确定语气，市场判断类（positioning relative to market）保留证据梯度。

**确定性陈述**（品牌定位/目标用户/核心价值）：
- 使用宣言式、确定性的陈述句
- 这是品牌自己的选择，不是需要验证的外部判断
- 示例：「安小甜是一个面向城市年轻女性的日常奖励型甜品品牌」
  ——而非「安小甜可能成为一个面向年轻女性的品牌」

**保留不确定性**（差异化/战略方向）：
- 如果源数据中出现「初步判断」「有待验证」「基于有限信息」等措辞，
  摘要中保留对应的软化表达（「初步判断」「目前的观察显示」）
- 如果源数据有搜索工具验证的市场数据支撑，可以使用确定性语气
- 示例：源数据写「基于有限竞品信息初步判断」→ 摘要用「初步判断，
  品牌可聚焦……」而非「品牌明确聚焦……」

## 引用可追溯性（强制）

每段摘要在 sources 数组中标注依据：

- brandPositioning → 至少引用 S6.positioning + 1 个消费者或品类字段
- targetAudience → 至少引用 S4.targetConsumer.definition
- coreValue → 至少引用 S6.valuePropositions (emotional层) + S4.deepNeeds
- differentiation → 至少引用 S5.competitiveGap.marketOpportunity + 至少 1 个竞品 opportunityGap
- strategicDirection → 至少引用 S7.coreConcept + S8.coreDirection

sources 数组中每条对象的格式：
- stage: 阶段编号（3-8）
- field: 字段路径（如 "positioning"、"targetConsumer.definition"）
- quote: 源数据中的关键原文摘录（≤60字，不得改写、不得概括）

**重要**：quote 必须是源数据中的原文，不是你的概括。如果找不到对应源数据支撑，
标注为 { "stage": 0, "field": "insufficient_data", "quote": "无对应源数据" }
——让缺失显式化，而非编造依据。

## 输出 JSON

只输出 JSON，不输出解释文字：

\`\`\`json
{
  "brandPositioning": {
    "text": "自然的品牌陈述句（1句）",
    "sources": [
      { "stage": 6, "field": "positioning", "quote": "源数据原文摘录" }
    ]
  },
  "targetAudience": {
    "text": "核心人群描述（1-2句）",
    "sources": [
      { "stage": 4, "field": "targetConsumer.definition", "quote": "源数据原文摘录" }
    ]
  },
  "coreValue": {
    "text": "品牌核心价值陈述（1-3句）",
    "sources": [
      { "stage": 6, "field": "valuePropositions.emotional", "quote": "源数据原文摘录" },
      { "stage": 4, "field": "deepNeeds.identityNeed", "quote": "源数据原文摘录" }
    ]
  },
  "differentiation": {
    "text": "差异化判断（1-3句，含具体对比参照物）",
    "sources": [
      { "stage": 5, "field": "competitiveGap.marketOpportunity", "quote": "源数据原文摘录" }
    ]
  },
  "strategicDirection": {
    "text": "战略方向（1-2句，产品+内容+品牌方向）",
    "sources": [
      { "stage": 7, "field": "coreConcept", "quote": "源数据原文摘录" },
      { "stage": 8, "field": "coreDirection", "quote": "源数据原文摘录" }
    ]
  }
}
\`\`\``;
}

// ═══════════════════════════════════════════════════════════
// Synthesis
// ═══════════════════════════════════════════════════════════

/**
 * 清洗 LLM 输出中的 markdown 代码块标记
 */
function extractJSON(text: string): string {
  // 移除 ```json ... ``` 包裹
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) return match[1].trim();
  // 尝试直接找到 { 开头
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  return text;
}

/**
 * 验证单个 ExecutiveSummaryField 的结构合法性
 */
function validateField(field: any, name: string): ExecutiveSummaryField | null {
  if (!field || typeof field.text !== "string" || !field.text.trim()) {
    console.warn(`[synthesize] ${name}.text 缺失或为空`);
    return null;
  }
  if (!Array.isArray(field.sources) || field.sources.length === 0) {
    console.warn(`[synthesize] ${name}.sources 缺失或为空——继续但标记`);
    return { text: field.text.trim(), sources: [] };
  }
  return {
    text: field.text.trim(),
    sources: field.sources
      .filter((s: any) => typeof s?.stage === "number" && typeof s?.field === "string" && typeof s?.quote === "string")
      .map((s: any) => ({
        stage: s.stage,
        field: s.field,
        quote: s.quote.substring(0, 60),
      })),
  };
}

/**
 * 合成执行摘要。
 *
 * 读取 S3-S8 全部关键字段，通过一次独立 LLM 调用，
 * 输出 5 段精炼摘要（各含 text + sources）。
 *
 * @param knowledge - 8 阶段完整 BrandKnowledge
 * @returns ExecutiveSummaryData，如果 LLM 调用失败返回 null
 */
export async function synthesizeExecutiveSummary(
  knowledge: BrandKnowledge
): Promise<ExecutiveSummaryData | null> {
  if (knowledge.stagesReady < 6) {
    console.warn("[synthesize] 阶段数据不足（需要至少 S3-S6），跳过摘要合成");
    return null;
  }

  const provider = getLLMProvider();
  const prompt = buildPrompt(knowledge);

  try {
    const raw = await provider.chat(
      [
        {
          role: "system",
          content:
            "你是一位资深品牌策略顾问。你的输出是一份精炼的品牌战略执行摘要，每个判断都基于提供的源数据。你只输出 JSON，不输出解释文字。",
        },
        { role: "user", content: prompt },
      ],
      {
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: "json_object",
      }
    );

    const jsonText = extractJSON(raw);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("[synthesize] LLM 输出不是合法 JSON:", raw.substring(0, 200));
      return null;
    }

    const brandPositioning = validateField(parsed.brandPositioning, "brandPositioning");
    const targetAudience = validateField(parsed.targetAudience, "targetAudience");
    const coreValue = validateField(parsed.coreValue, "coreValue");
    const differentiation = validateField(parsed.differentiation, "differentiation");
    const strategicDirection = validateField(parsed.strategicDirection, "strategicDirection");

    if (!brandPositioning || !targetAudience || !coreValue || !differentiation || !strategicDirection) {
      console.error("[synthesize] 一个或多个摘要字段无效");
      return null;
    }

    return {
      brandPositioning,
      targetAudience,
      coreValue,
      differentiation,
      strategicDirection,
    };
  } catch (error) {
    console.error("[synthesize] LLM 调用失败:", error);
    return null;
  }
}
