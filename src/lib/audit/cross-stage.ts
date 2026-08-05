/**
 * Cross Stage Context Check — 跨阶段上下文检查（Phase 3）
 *
 * Layer A: Fact Reference Check（纯代码，依赖图驱动）
 *   - 检查当前阶段是否引用了决策依赖图要求的前序字段
 *   - 不使用 LLM
 *
 * Layer B: Strategic Continuity Check（LLM，复用 AI Quality Audit 调用）
 *   - 检查当前阶段结论是否与上游核心判断存在逻辑矛盾
 *   - 检查上游洞察是否被不当抽象或曲解
 *   - 检查上游约束是否被忽略
 *
 * 红线：
 * - Layer A 不调用 LLM
 * - Layer B 不发起独立 LLM 调用（prompt 拼接在 AI Quality Audit 中）
 * - 检查范围严格由决策依赖图决定
 */

import { getDependencies } from "@/lib/memory/dependency-graph";
import { getStageName } from "@/lib/stage-config";
import { displayFieldName } from "@/lib/audit/field-display";

// ── Layer A 类型 ──────────────────────────────────────────

export interface ReferenceIssue {
  severity: "error" | "warning";
  currentStage: number;
  upstreamStage: number;
  upstreamField: string;
  /** 技术详情——开发排查用，仅供 AuditDetail 折叠区展示 */
  message: string;
  /** 用户可读文案——AuditCard 默认展示 */
  userMessage: string;
  /** 依赖路径描述 */
  dependencyPath?: string;
}

export interface CrossStageResult {
  /** Layer A 事实引用检查结果 */
  referenceIssues: ReferenceIssue[];
  /** Layer B 语义断裂检查结果（null = 未触发，空数组 = 触发但无问题） */
  semanticIssues: CrossStageSemanticIssue[] | null;
  /** 是否通过了引用完整性检查（无 error 级别问题） */
  referenceIntegrityPassed: boolean;
}

export interface CrossStageSemanticIssue {
  type: "semantic_break";
  severity: "warning" | "info";
  currentStageField: string;
  upstreamField: string;
  description: string;
  gapDetail?: string;
}

// ── 用户文案生成 ──────────────────────────────────────────

/** 生成 ReferenceIssue 的用户可读文案 */
function buildUserMessage(params: {
  severity: "error" | "warning";
  currentStage: number;
  upstreamStage: number;
  upstreamField: string;
  description?: string;
  category: "missing" | "empty" | "shallow";
}): string {
  const upstreamName = getStageName(params.upstreamStage);
  const upstreamLabel = `S${params.upstreamStage} ${upstreamName}`;
  const fieldLabel = displayFieldName(params.upstreamField);
  const currentLabel = `S${params.currentStage}`;

  switch (params.category) {
    case "missing":
      return `${upstreamLabel}中的${fieldLabel}尚未产出，建议先回到 S${params.upstreamStage} 确认该部分内容，再继续当前阶段`;
    case "empty":
      return `${currentLabel}缺少对${upstreamLabel}中${fieldLabel}的回应${
        params.description ? `（${params.description}）` : ""
      }——建议在对话中补充说明当前判断与上游发现之间的关联`;
    case "shallow":
      return `${currentLabel}对${upstreamLabel}中${fieldLabel}的引用不够具体——建议展开说明上游发现对当前判断的影响，而非仅提及概念`;
  }
}

// ── 阶段强制引用定义 ──────────────────────────────────────

/**
 * 每个阶段必须引用的上游字段。
 * 键 = 当前阶段号，值 = 必须引用的上游字段列表。
 *
 * 这些是决策依赖图中的强制引用约束，由 prompt 模板显式声明。
 * 只有这里定义的引用关系才会被检查——不使用关键词匹配。
 */
interface MandatoryReference {
  upstreamStage: number;
  upstreamField: string;   // fieldPath in Decision Memory
  checkField: string;      // 在当前阶段输出中的检查字段路径
  description: string;
}

const STAGE_MANDATORY_REFERENCES: Record<number, MandatoryReference[]> = {
  // S2 依赖 S1 的核心字段
  2: [
    {
      upstreamStage: 1,
      upstreamField: "founderMotivation.content",
      checkField: "businessBackground.marketContext",
      description: "S2 商业背景应体现对 S1 创始人诉求的理解",
    },
  ],

  // S3 依赖 S1 + S2
  3: [
    {
      upstreamStage: 1,
      upstreamField: "confirmedProblems",
      checkField: "opportunityDirections",
      description: "S3 市场机会应回应 S1 确认的问题",
    },
  ],

  // S4 依赖 S1 + S3
  4: [
    {
      upstreamStage: 1,
      upstreamField: "observations",
      checkField: "targetConsumer.definition",
      description: "S4 消费者定义应基于 S1 用户观察",
    },
  ],

  // S5 依赖 S3 + S4
  5: [
    {
      upstreamStage: 4,
      upstreamField: "deepNeeds.functionalNeed",
      checkField: "competitiveGap.marketOpportunity",
      description: "S5 竞争空位判断应回应 S4 功能需求",
    },
  ],

  // S6 战略枢纽：强制引用 S3/S4/S5 核心字段
  6: [
    {
      upstreamStage: 3,
      upstreamField: "opportunityDirections",
      checkField: "reasoning.marketOpportunityReference",
      description: "S6 定位必须引用 S3 市场机会发现（reasoning.marketOpportunityReference）",
    },
    {
      upstreamStage: 4,
      upstreamField: "deepNeeds.identityNeed",
      checkField: "reasoning.consumerInsightReference",
      description: "S6 定位必须引用 S4 身份认同层判断（reasoning.consumerInsightReference）",
    },
    {
      upstreamStage: 4,
      upstreamField: "deepNeeds.functionalNeed",
      checkField: "reasoning.consumerInsightReference",
      description: "S6 定位必须引用 S4 功能需求（reasoning.consumerInsightReference）",
    },
    {
      upstreamStage: 5,
      upstreamField: "competitiveGap.marketOpportunity",
      checkField: "reasoning.competitiveGapReference",
      description: "S6 定位必须引用 S5 竞争空位判断（reasoning.competitiveGapReference）",
    },
  ],

  // S7 依赖 S6
  7: [
    {
      upstreamStage: 6,
      upstreamField: "positioning",
      checkField: "coreConcept",
      description: "S7 视觉概念应体现 S6 品牌定位",
    },
    {
      upstreamStage: 6,
      upstreamField: "brandPersonality",
      checkField: "visualSystem",
      description: "S7 视觉语言应与 S6 品牌人格一致",
    },
  ],

  // S8 依赖 S6
  8: [
    {
      upstreamStage: 6,
      upstreamField: "positioning",
      checkField: "coreDirection",
      description: "S8 内容方向应服务于 S6 品牌定位",
    },
    {
      upstreamStage: 6,
      upstreamField: "brandStory",
      checkField: "themeDirections",
      description: "S8 内容支柱应承接 S6 品牌故事",
    },
  ],
};

// ═══════════════════════════════════════════════════════════
// Layer A: 引用完整性检查
// ═══════════════════════════════════════════════════════════

/**
 * 检查当前阶段是否引用了决策依赖图要求的全部前序字段。
 *
 * 纯代码实现，不使用 LLM。只检查 STAGE_MANDATORY_REFERENCES 中定义的引用关系。
 *
 * 检查逻辑：
 * 1. 读取上游阶段的 Decision Memory 条目
 * 2. 对每个强制引用约束，检查上游字段是否存在于 Decision Memory
 * 3. 如果上游字段存在，检查当前阶段输出的对应 checkField 是否包含有效引用
 * 4. "有效引用"的判断标准：输出内容中不包含"未追溯"标记，且内容长度足够
 */
export async function checkReferenceIntegrity(
  projectId: string,
  stageNumber: number,
  stageOutput: Record<string, any>
): Promise<CrossStageResult> {
  const mandatoryRefs = STAGE_MANDATORY_REFERENCES[stageNumber] ?? [];
  const issues: ReferenceIssue[] = [];

  // 动态导入避免测试环境中 DATABASE_URL 缺失导致模块加载失败
  const { getEntriesByStage } = await import("@/lib/memory/decision-memory");

  for (const ref of mandatoryRefs) {
    // 1. 读取上游 Decision Memory 条目
    const upstreamEntries = await getEntriesByStage(projectId, ref.upstreamStage);

    // 筛选匹配 fieldPath 的条目
    const matchingEntries = upstreamEntries.filter((e: any) => {
      const entryField = e.fieldPath ?? "";
      // 模糊匹配：支持前缀匹配和数组通配符
      return (
        entryField === ref.upstreamField ||
        entryField.startsWith(ref.upstreamField) ||
        entryField.replace(/\[\d+\]/g, "[]") === ref.upstreamField.replace(/\[\d+\]/g, "[]")
      );
    });

    if (matchingEntries.length === 0) {
      // 上游字段不存在 → 标记为上游缺失，非当前阶段问题
      issues.push({
        severity: "warning",
        currentStage: stageNumber,
        upstreamStage: ref.upstreamStage,
        upstreamField: ref.upstreamField,
        message: `依赖的上游字段 [S${ref.upstreamStage}] ${ref.upstreamField} 不存在于 Decision Memory 中——上游阶段可能尚未完成或未产出该字段`,
        userMessage: buildUserMessage({
          severity: "warning",
          currentStage: stageNumber,
          upstreamStage: ref.upstreamStage,
          upstreamField: ref.upstreamField,
          description: ref.description,
          category: "missing",
        }),
        dependencyPath: `S${ref.upstreamStage}.${ref.upstreamField} → S${stageNumber}.${ref.checkField}`,
      });
      continue;
    }

    // 2. 检查当前阶段输出是否引用了上游内容
    const checkValue = getNestedValue(stageOutput, ref.checkField);
    const checkStr = typeof checkValue === "object"
      ? JSON.stringify(checkValue)
      : String(checkValue ?? "");

    // 检查是否为无效引用（"未追溯"标记、空字符串、过短内容）
    const isUntraceable =
      checkStr.length === 0 ||
      checkStr.includes("未追溯") ||
      checkStr.includes("未找到前序") ||
      (typeof checkValue === "string" && checkValue.length < 10);

    if (isUntraceable) {
      issues.push({
        severity: "error",
        currentStage: stageNumber,
        upstreamStage: ref.upstreamStage,
        upstreamField: ref.upstreamField,
        message: `${ref.description}：当前输出中 ${ref.checkField} 未包含有效引用（标记为"未追溯"或内容过短）`,
        userMessage: buildUserMessage({
          severity: "error",
          currentStage: stageNumber,
          upstreamStage: ref.upstreamStage,
          upstreamField: ref.upstreamField,
          description: ref.description,
          category: "empty",
        }),
        dependencyPath: `S${ref.upstreamStage}.${ref.upstreamField} → S${stageNumber}.${ref.checkField}`,
      });
    } else {
      // 3. 检查引用是否包含上游决策的关键词（粗略匹配）
      const upstreamContent = matchingEntries
        .map((e: any) => e.content ?? "")
        .join(" ");

      if (upstreamContent.length > 10) {
        // 从上游内容中提取 2-4 字关键词，检查是否在引用中出现
        const keywords = extractKeyPhrases(upstreamContent, 3);
        const matchedKeywords = keywords.filter((kw) => checkStr.includes(kw));

        // 如果没有任何关键词匹配，可能意味着引用流于形式
        if (matchedKeywords.length === 0 && keywords.length >= 2) {
          issues.push({
            severity: "warning",
            currentStage: stageNumber,
            upstreamStage: ref.upstreamStage,
            upstreamField: ref.upstreamField,
            message: `${ref.checkField} 中未检测到对 [S${ref.upstreamStage}] ${ref.upstreamField} 具体内容的关键词引用——引用可能流于形式`,
            userMessage: buildUserMessage({
              severity: "warning",
              currentStage: stageNumber,
              upstreamStage: ref.upstreamStage,
              upstreamField: ref.upstreamField,
              description: ref.description,
              category: "shallow",
            }),
            dependencyPath: `S${ref.upstreamStage}.${ref.upstreamField} → S${stageNumber}.${ref.checkField}`,
          });
        }
      }
    }
  }

  const hasError = issues.some((i) => i.severity === "error");

  return {
    referenceIssues: issues,
    semanticIssues: null, // Layer B 结果由 AI Quality Audit 填充
    referenceIntegrityPassed: !hasError,
  };
}

/**
 * 轻量版引用完整性检查——不访问数据库。
 * 仅检查 S6 reasoning 字段中的"未追溯"标记。
 * 用于 Rule Check 已覆盖的场景，避免重复 DB 查询。
 */
export function checkReferenceIntegrityLight(
  stageNumber: number,
  stageOutput: Record<string, any>
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];

  if (stageNumber === 6) {
    const reasoning = stageOutput.reasoning;
    if (reasoning) {
      const refs = [
        { field: "marketOpportunityReference", label: "S3 市场机会", upstreamStage: 3, upstreamField: "opportunityDirections" },
        { field: "consumerInsightReference", label: "S4 消费者洞察", upstreamStage: 4, upstreamField: "deepNeeds.identityNeed" },
        { field: "competitiveGapReference", label: "S5 竞争判断", upstreamStage: 5, upstreamField: "competitiveGap.marketOpportunity" },
      ];

      for (const r of refs) {
        const value = reasoning[r.field] ?? "";
        if (typeof value === "string" && (value.includes("未追溯") || value.length < 10)) {
          issues.push({
            severity: "error",
            currentStage: 6,
            upstreamStage: r.upstreamStage,
            upstreamField: r.upstreamField,
            message: `S6 reasoning.${r.field} 未包含对 ${r.label} 的有效引用`,
            userMessage: buildUserMessage({
              severity: "error",
              currentStage: 6,
              upstreamStage: r.upstreamStage,
              upstreamField: r.upstreamField,
              description: `S6 必须引用${r.label}`,
              category: "empty",
            }),
            dependencyPath: `S${r.upstreamStage}.${r.upstreamField} → S6.reasoning.${r.field}`,
          });
        }
      }
    }
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════
// Layer B: 语义断裂检查 Prompt 扩展
// ═══════════════════════════════════════════════════════════

/**
 * 为 AI Quality Audit 的 system prompt 构建 Layer B 扩展段落。
 *
 * 仅在阶段质量达标（Rule Check 通过）时调用。
 * 将该段落追加到 AI Quality Audit 的 system prompt 末尾，
 * 并在输出 JSON schema 中增加 crossStageSemantics 字段。
 *
 * 不发起独立 LLM 调用——完全复用 AI Quality Audit 调用。
 */
export function buildSemanticCheckPrompt(
  stageNumber: number,
  upstreamContext: string
): string {
  if (!upstreamContext || upstreamContext.trim().length === 0) {
    return "";
  }

  const dependencies = getDependencies(stageNumber);
  if (dependencies.length === 0) {
    return ""; // S1 无上游，不需要语义检查
  }

  // 获取强制引用列表
  const mandatoryRefs = STAGE_MANDATORY_REFERENCES[stageNumber] ?? [];
  const refDescriptions = mandatoryRefs
    .map((r) => `  - [S${r.upstreamStage}] ${r.upstreamField} → ${r.checkField}: ${r.description}`)
    .join("\n");

  return `
## 跨阶段语义连贯性检查（Layer B）—— 独立任务

> **⚠️ 四维评分已在上方完成。以下内容仅供独立语义检查，绝对不要因此调整 specificity / differentiation / actionability / evidence 的任何分数。评分只基于当前阶段输出的自身质量。**

当前阶段（S${stageNumber}）依赖以下前序阶段的决策输出：

### 上游决策上下文
${upstreamContext}

### 强制引用约束
${refDescriptions}

### 语义断裂检查要点

请判断以下三类问题（如有），记录在 JSON 输出的 crossStageSemantics 字段中：

1. **逻辑矛盾**：当前阶段的结论是否与上游核心判断存在逻辑矛盾？
   - 例如：S4 说用户核心需求是"省时"，S6 的品牌定位却围绕"仪式感"展开，且没有解释转变依据

2. **不当抽象/曲解**：当前阶段是否将上游的具体洞察做了不当抽象或曲解？
   - 例如：S4 说"用户在深夜使用"，S6 将其直接等同于"用户需要放松"，未说明推导依据

3. **约束忽略**：上游的关键约束或限制条件是否在当前阶段被忽略？
   - 例如：S2 说"预算仅够覆盖一线城市"，S6 的品牌扩张路径却假设全国市场

### 输出格式

在 JSON 输出的根级别增加字段：
\`\`\`json
{
  "crossStageSemantics": {
    "hasIssues": true/false,
    "issues": [
      {
        "type": "semantic_break",
        "severity": "warning",
        "currentStageField": "positioning",
        "upstreamField": "S4.deepNeeds.identityNeed",
        "description": "S4 结论为...，S6 定位为...，两者之间缺少推导依据",
        "gapDetail": "从 X 到 Y 的转变没有解释"
      }
    ]
  }
}
\`\`\`

注意：
- 语义断裂检查不判断"结论是否正确"，只判断"结论是否与上游判断存在未解释的跳跃或矛盾"
- 如果当前阶段提供了合理依据来解释转变，则不算语义断裂
- 没有发现问题时，hasIssues 为 false，issues 为空数组

**关键原则：四维评分与 Layer B 完全独立**
- 上述语义连贯性检查的发现，只能记录在 crossStageSemantics 字段中。
- 绝对不要将跨阶段语义问题混入四维评分（specificity / differentiation / actionability / evidence）。
- 四维评分仅基于当前阶段输出本身的内容质量——不因"与上游不一致"而扣分。
- 例如：S6 定位与 S4 洞察存在逻辑跳跃 → 这是 Layer B 的问题，记录在 crossStageSemantics 中，不应影响 S6 的 Specificity 或 Differentiation 分数。`;
}

// ═══════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════

function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * 从文本中提取有代表性的关键短语（3-5 字中文词）。
 * 用于 Layer A 的关键词级别引用验证。
 */
function extractKeyPhrases(text: string, minLength: number = 2): string[] {
  const phrases: string[] = [];
  const seen = new Set<string>();

  // 按标点分割
  const segments = text.split(/[，,。.、；;：:\s\n\-—]+/);
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (trimmed.length >= minLength && trimmed.length <= 8 && !seen.has(trimmed)) {
      seen.add(trimmed);
      phrases.push(trimmed);
    }
  }

  // 如果分段太少，用 n-gram 补充
  if (phrases.length < 3 && text.length >= 4) {
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i <= text.length - len; i++) {
        const ngram = text.slice(i, i + len);
        if (!seen.has(ngram) && /^[一-鿿]+$/.test(ngram)) {
          seen.add(ngram);
          phrases.push(ngram);
          if (phrases.length >= 10) break;
        }
      }
      if (phrases.length >= 10) break;
    }
  }

  return phrases;
}
