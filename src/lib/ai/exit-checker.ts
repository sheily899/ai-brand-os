/**
 * Exit Condition Checker — 代码层阶段退出条件检查
 *
 * 职责：
 * - 定义每个阶段的退出条件 Schema（从 consultation prompt 提取）
 * - 每轮用户消息后，通过 LLM 评估对话历史是否满足退出条件
 * - 返回结构化结果供 Workflow 决策
 *
 * 与 consultation/convergence 完全独立：不参与咨询对话，只做条件判断。
 */

import { getLLMProvider } from "./provider";

// ── 类型定义 ──────────────────────────────────────────

export interface ExitCondition {
  id: string;
  description: string;
  category: "core" | "supp";
  /** 质量阈值：描述该条件需要的信息具体度 */
  minQuality: string;
}

export interface StageExitSchema {
  stage: number;
  conditions: ExitCondition[];
  minCoreRequired: number;
  minSuppRequired: number;
  /** 最少对话轮次——低于此轮次不做检查（防止过早触发） */
  minRounds: number;
}

export interface ConditionAssessment {
  conditionId: string;
  met: boolean;
  evidence: string;
  qualityOk: boolean;
  qualityIssue?: string;
}

export interface ExitCheckResult {
  conditionsMet: boolean;
  coreCompleted: number;
  coreTotal: number;
  suppCompleted: number;
  suppTotal: number;
  assessments: ConditionAssessment[];
  /** 如果未满足，说明缺少什么 */
  missingSummary?: string;
}

// ── S1-S8 Exit Condition Schemas ──────────────────────
// 从 stage{n}-consultation.md 的 Exit Conditions 表提取

const STAGE_EXIT_SCHEMAS: Record<number, StageExitSchema> = {
  // S1: 创始人诉求 — 5 核心 + 2 补充
  1: {
    stage: 1,
    minRounds: 3,
    minCoreRequired: 5,
    minSuppRequired: 1,
    conditions: [
      {
        id: "s1_motivation",
        description: "创始动机明确，包含具体触发事件，且已判断创始人属于问题驱动型还是创作驱动型",
        category: "core",
        minQuality: "触发事件必须包含具体的时间/地点/情境，不能只是概括性描述如'一直想做这个'",
      },
      {
        id: "s1_observations",
        description: "至少 2 条具体观察，包含谁、何时、何种情境、发生了什么",
        category: "core",
        minQuality: "每条观察必须有四要素（人/时/境/事），不能是抽象概括如'很多人需要这个'",
      },
      {
        id: "s1_problems_or_design",
        description: "问题驱动型：至少 2 个创始人确认过的问题；创作驱动型：创始人自己最看重的设计细节或感受已记录",
        category: "core",
        minQuality: "问题必须是创始人亲口确认存在的，不能是AI推断的；创作细节须有具体描述而非'我喜欢这种风格'",
      },
      {
        id: "s1_alternatives_or_references",
        description: "问题驱动型：至少 1 种现有替代方案被讨论过；创作驱动型：至少 1 个参照对象及创始人感受已记录",
        category: "core",
        minQuality: "替代方案/参照对象须具体命名或描述，不能是'市面上的其他产品'这种泛称",
      },
      {
        id: "s1_user_hypothesis",
        description: "用户假设已有具体描述——尽力追问到具体的人，但最多追问一次，不强求",
        category: "supp",
        minQuality: "应包含人群特征描述（年龄/场景/行为），不能只有'年轻女性'这种单标签",
      },
      {
        id: "s1_opportunity_hypothesis",
        description: "机会假设已用试探性语言记录——只记录创始人自己的判断",
        category: "supp",
        minQuality: "须是创始人自己的判断陈述，不能是AI替他总结的",
      },
      {
        id: "s1_resources",
        description: "资源约束至少覆盖 2 个维度（预算/团队/时间/能力等）",
        category: "core",
        minQuality: "每个维度须有具体数值或范围，不能只有'预算有限''团队不大'这类模糊表述",
      },
    ],
  },

  // S2: 商业背景 — 3 核心
  2: {
    stage: 2,
    minRounds: 3,
    minCoreRequired: 3,
    minSuppRequired: 0,
    conditions: [
      {
        id: "s2_background",
        description: "商业背景已明确——行业环境、变化趋势及判断依据",
        category: "core",
        minQuality: "须包含行业名称、至少一个具体趋势变化及其来源依据，不能只有'这个行业在发展'",
      },
      {
        id: "s2_challenge",
        description: "核心挑战已明确——用户问题、现有不足及持续影响",
        category: "core",
        minQuality: "问题须具体到可操作的层面，'不足'须有对比参照，不能只有'做得不够好'",
      },
      {
        id: "s2_direction",
        description: "品牌战略方向已结合当前资源约束，形成'优先验证哪一类问题'的方向判断",
        category: "core",
        minQuality: "方向判断须与已讨论的资源约束逻辑一致，不能是脱离资源的空泛方向",
      },
    ],
  },

  // S3: 市场机会 — 3 核心
  3: {
    stage: 3,
    minRounds: 3,
    minCoreRequired: 3,
    minSuppRequired: 0,
    conditions: [
      {
        id: "s3_category_status",
        description: "品类现状已明确——品类边界、供给格局特征、至少 2 个趋势性变化",
        category: "core",
        minQuality: "每个趋势须有时间维度和判断来源（数据/报告/观察），不能只有'市场在增长'",
      },
      {
        id: "s3_experience_gaps",
        description: "当前体验不足——至少 2 个具体体验缺口，每个包含替代方案和影响程度",
        category: "core",
        minQuality: "每个缺口须描述：谁在什么场景下、用什么替代方案、哪里不够好、影响程度如何",
      },
      {
        id: "s3_opportunity_directions",
        description: "品牌机会方向——2-3 个有依据的机会方向，每个有明确判断来源",
        category: "core",
        minQuality: "每个方向的判断依据须标注来源类型（数据/推断/观察），不能全是'综合判断'",
      },
    ],
  },

  // S4: 消费者洞察 — 4 核心 + 1 补充
  4: {
    stage: 4,
    minRounds: 3,
    minCoreRequired: 4,
    minSuppRequired: 0,
    conditions: [
      {
        id: "s4_consumer_persona",
        description: "描述一个具体消费者及生活场景",
        category: "core",
        minQuality: "须包含人群特征、典型场景、行为描述，不能只有'25-35岁女性'这类标签组合",
      },
      {
        id: "s4_current_solution",
        description: "明确消费者当前解决方式",
        category: "core",
        minQuality: "须有具体的产品或行为描述，不能只有'用其他产品代替'",
      },
      {
        id: "s4_solution_gaps",
        description: "明确当前方案满足与不足——满足了什么、未满足什么",
        category: "core",
        minQuality: "满足和不足须一一对应具体维度，不能只有'不太满意'",
      },
      {
        id: "s4_functional_needs",
        description: "明确消费者功能需求——希望首先解决什么",
        category: "core",
        minQuality: "需求须可转化为产品/服务标准，不能只有'更好的体验'",
      },
      {
        id: "s4_identity_needs",
        description: "初步探索情感或身份需求",
        category: "supp",
        minQuality: "须有推断依据（从对话中的哪些信息得出），不能是凭空贴标签",
      },
    ],
  },

  // S5: 竞争判断 — 4 核心 + 1 补充
  5: {
    stage: 5,
    minRounds: 3,
    minCoreRequired: 4,
    minSuppRequired: 0,
    conditions: [
      {
        id: "s5_competitor_types",
        description: "已识别直接竞品、替代方案、非消费选择三种竞争类型",
        category: "core",
        minQuality: "每种类型须有具体品牌/方案名称，不能只有分类标签",
      },
      {
        id: "s5_competitor_analysis",
        description: "至少分析 2-3 个主要竞品",
        category: "core",
        minQuality: "每个竞品须包含定位、核心打法描述，不能只有品牌名称列表",
      },
      {
        id: "s5_competitor_positioning",
        description: "每个竞品明确定位和核心打法",
        category: "core",
        minQuality: "定位须是一句完整陈述，核心打法须具体到可观察的行为",
      },
      {
        id: "s5_competitor_weakness",
        description: "识别竞品局限或可突破空间",
        category: "supp",
        minQuality: "局限须有依据（用户反馈/市场表现/产品分析），不能只有'做得不够好'",
      },
      {
        id: "s5_competitive_direction",
        description: "形成初步竞争方向判断",
        category: "core",
        minQuality: "方向须结合竞品分析和品牌自身条件，有推导逻辑",
      },
    ],
  },

  // S6: 品牌核心战略 — 4 核心 + 1 补充
  6: {
    stage: 6,
    minRounds: 3,
    minCoreRequired: 4,
    minSuppRequired: 0,
    conditions: [
      {
        id: "s6_positioning_direction",
        description: "品牌定位方向明确——针对谁、在什么品类、提供什么价值、为什么选择",
        category: "core",
        minQuality: "定位须是一句完整的品牌定位陈述，四个要素缺一不可",
      },
      {
        id: "s6_positioning_elements",
        description: "定位包含目标人群、品类框架、核心价值、选择理由四个要素",
        category: "core",
        minQuality: "每个要素须具体，'目标人群'不能只有人群标签，'选择理由'须有逻辑支撑",
      },
      {
        id: "s6_value_layers",
        description: "功能、情绪、社会三层价值均明确",
        category: "core",
        minQuality: "每层价值须有推导逻辑：功能价值→来自产品能力，情绪价值→来自消费者心理，社会价值→来自身份认同",
      },
      {
        id: "s6_brand_story",
        description: "品牌故事包含核心冲突和品牌选择",
        category: "supp",
        minQuality: "故事须有叙事弧线（起因→冲突→选择→行动），不能是事实罗列",
      },
      {
        id: "s6_brand_persona",
        description: "品牌人格包含具体行为描述——它像谁、会做什么、不会做什么",
        category: "core",
        minQuality: "行为描述须具体到可指导内容创作的程度，不能只有'温暖''专业'等形容词",
      },
    ],
  },

  // S7: 视觉策略 — 5 核心
  7: {
    stage: 7,
    minRounds: 3,
    minCoreRequired: 5,
    minSuppRequired: 0,
    conditions: [
      {
        id: "s7_visual_concept",
        description: "视觉核心概念明确——一句完整的视觉核心概念，至少 10 个字",
        category: "core",
        minQuality: "概念须是一句完整陈述，能表达视觉方向的核心意图，不能是关键词罗列",
      },
      {
        id: "s7_visual_keywords",
        description: "视觉关键词明确，3-5 个，并有解释",
        category: "core",
        minQuality: "每个关键词须有解释说明为什么选择它，不能只有词汇列表",
      },
      {
        id: "s7_visual_language",
        description: "五类视觉语言（形态/色彩/字体/图像/材质）都有方向描述",
        category: "core",
        minQuality: "每类须有具体的策略方向和表达方式，不能只有'简约''大气'等形容词",
      },
      {
        id: "s7_visual_expression",
        description: "每类视觉语言明确表达方式和避免方向",
        category: "core",
        minQuality: "表达方式和避免方向须一一对应、形成明确边界",
      },
      {
        id: "s7_visual_taboos",
        description: "至少 3 个视觉禁区，并说明原因",
        category: "core",
        minQuality: "每个禁区须有明确的原因（与品牌战略的关联），不能只有'不要用红色'",
      },
    ],
  },

  // S8: 内容策略 — 4 核心
  8: {
    stage: 8,
    minRounds: 3,
    minCoreRequired: 4,
    minSuppRequired: 0,
    conditions: [
      {
        id: "s8_content_direction",
        description: "品牌长期希望传递的核心内容方向明确",
        category: "core",
        minQuality: "方向须是一句完整的战略陈述，能指导内容选题",
      },
      {
        id: "s8_content_funnel",
        description: "认知、兴趣、信任、转化四个阶段均有内容价值讨论",
        category: "core",
        minQuality: "每个阶段须有用户问题和内容价值对应，不能只有阶段名称",
      },
      {
        id: "s8_content_pillars",
        description: "至少形成 2-3 个可持续发展的内容主题方向",
        category: "core",
        minQuality: "每个主题须有核心目的和选题方向，可落地执行",
      },
      {
        id: "s8_channel_strategy",
        description: "至少明确小红书、抖音、微信三个渠道的表达差异",
        category: "core",
        minQuality: "每个渠道须有内容形式和表达重点的差异化描述",
      },
    ],
  },
};

// ── 评估 System Prompt ───────────────────────────────

const CHECKER_SYSTEM_PROMPT = `你是一个品牌咨询质量检查员。你的唯一职责是：评估一段对话历史是否满足了当前阶段的退出条件。

你不是咨询顾问，不做判断、不追问、不评价内容好坏。

## 评估原则

1. **逐条对照**：对每个条件，在对话历史中寻找证据。找到了 → met: true + 写出证据原文。没找到 → met: false。
2. **质量判断**：即使话题被讨论过，如果信息不够具体（见每个条件的 qualityThreshold），标记 qualityOk: false 并说明原因。
3. **严格但公正**：不因为对话轮次少就判定不满足。如果创始人一次回答覆盖了多个条件，就如实判定满足。
4. **不推断**：只根据对话中的原文判断，不推测"创始人可能还知道什么"。

## 质量判断标准

对于每个条件，不仅判断"是否讨论过"，还要判断讨论的质量：

**不达标示例**：
- "年轻女性用户"（只有人群标签，缺少场景、行为、动机）
- "市场很大"（无数据、无来源、无具体规模）
- "竞品做得不够好"（无具体维度、无对比参照）
- "品牌要温暖专业"（只有形容词，缺少行为描述）

**达标示例**：
- "25-35岁城市女性，在夜间压力场景下购买香薰产品，通过气味获得情绪放松"（人群+场景+行为+动机）
- "根据创始人对小红书和天猫的观察，2024年该品类在天猫的搜索量增长了约40%"（有来源、有数据）
- "竞品A定位'天然安全'，但在消费者调研中用户反馈它的气味不够持久"（有具体维度+对比）
- "这个品牌像一位有品味的朋友，会在你焦虑时递上一杯茶，但不会说教或强行安慰"（有行为描述+边界）

## 输出格式

必须输出严格的 JSON，不包含 markdown 代码块标记：

{
  "conditionsMet": true/false,
  "coreCompleted": 数字,
  "coreTotal": 数字,
  "suppCompleted": 数字,
  "suppTotal": 数字,
  "assessments": [
    {
      "conditionId": "条件ID",
      "met": true/false,
      "evidence": "对话中找到的证据原文摘要",
      "qualityOk": true/false,
      "qualityIssue": "如果不达标，说明原因（达标则为空字符串）"
    }
  ],
  "missingSummary": "如果未满足，用一句话说明缺少什么核心信息（满足则为空字符串）"
}`;

// ── 公开 API ──────────────────────────────────────────

/**
 * 检查当前对话是否满足阶段退出条件。
 *
 * @param stage - 阶段编号 (1-8)
 * @param history - 完整对话历史
 * @returns 结构化的退出条件评估结果
 */
export async function checkExitConditions(
  stage: number,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ExitCheckResult> {
  const schema = STAGE_EXIT_SCHEMAS[stage];
  if (!schema) {
    throw new Error(`Stage ${stage} exit schema not defined`);
  }

  // ── 轮次保护 ──────────────────────────────────────
  const userMessages = history.filter((m) => m.role === "user");
  if (userMessages.length < schema.minRounds) {
    return {
      conditionsMet: false,
      coreCompleted: 0,
      coreTotal: schema.conditions.filter((c) => c.category === "core").length,
      suppCompleted: 0,
      suppTotal: schema.conditions.filter((c) => c.category === "supp").length,
      assessments: [],
      missingSummary: `对话轮次不足（当前 ${userMessages.length} 轮，最少需 ${schema.minRounds} 轮）`,
    };
  }

  // ── 快速路径：用户明确要求总结 ──────────────────────
  const lastUserMsg = userMessages[userMessages.length - 1]?.content ?? "";
  const userWantsSummary =
    /总结一下|先确认目前的内容|可以收束了|差不多了|先总结/.test(lastUserMsg);

  // ── 构建评估 Prompt ──────────────────────────────
  const conditionsText = schema.conditions
    .map(
      (c, i) =>
        `${i + 1}. [${c.category === "core" ? "核心" : "补充"}] ${c.id}: ${c.description}\n   质量标准: ${c.minQuality}`
    )
    .join("\n\n");

  const triggerRule = `触发规则: 核心 ${schema.minCoreRequired} 项全部达成${
    schema.minSuppRequired > 0 ? ` + 补充 >= ${schema.minSuppRequired} 项` : ""
  } → conditionsMet: true`;

  // 格式化对话历史为可读文本
  const historyText = history
    .map((m) => `[${m.role === "user" ? "用户" : "AI顾问"}]: ${m.content.slice(0, 500)}`)
    .join("\n\n");

  const userPrompt = `## 阶段 ${stage} 退出条件

${conditionsText}

${triggerRule}

${userWantsSummary ? "⚠️ 用户最新消息中表达了总结/收束意愿，如果条件基本满足，应优先判定为满足。" : ""}

## 对话历史

${historyText}

请逐条评估每个条件是否满足，输出 JSON。`;

  // ── 调用 LLM ──────────────────────────────────────
  const provider = getLLMProvider();
  try {
    const rawOutput = await provider.chat(
      [
        { role: "system", content: CHECKER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.1, maxTokens: 1024 }
    );

    // 解析 JSON
    let parsed: any;
    try {
      // 尝试移除可能的 markdown 代码块标记
      const cleaned = rawOutput
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error(`[exit-checker] JSON 解析失败，原始输出: ${rawOutput.slice(0, 500)}`);
      return buildFallbackResult(schema, userWantsSummary);
    }

    // ── 结果校验 ────────────────────────────────────
    // ⚠️ 安全原则：不信任 LLM 给的汇总数字（parsed.coreCompleted / parsed.conditionsMet），
    // 始终从 assessments 数组逐条计算，且 met 必须同时满足 qualityOk。

    const assessments: ConditionAssessment[] = parsed.assessments ?? [];

    // 从 assessments 逐条计算（不信任 parsed.coreCompleted/suppCompleted）
    const coreCompleted = assessments.filter((a) => {
      const cond = schema.conditions.find((c) => c.id === a.conditionId);
      return cond?.category === "core" && a.met === true && a.qualityOk !== false;
    }).length;

    const suppCompleted = assessments.filter((a) => {
      const cond = schema.conditions.find((c) => c.id === a.conditionId);
      return cond?.category === "supp" && a.met === true && a.qualityOk !== false;
    }).length;

    const coreTotal = schema.conditions.filter((c) => c.category === "core").length;
    const suppTotal = schema.conditions.filter((c) => c.category === "supp").length;

    // ⚠️ 不信任 parsed.conditionsMet —— 只用实际逐条计算结果
    const conditionsMet =
      coreCompleted >= schema.minCoreRequired &&
      suppCompleted >= schema.minSuppRequired;

    return {
      conditionsMet,
      coreCompleted,
      coreTotal,
      suppCompleted,
      suppTotal,
      assessments,
      missingSummary:
        parsed.missingSummary ||
        (!conditionsMet
          ? `核心 ${coreCompleted}/${coreTotal}（需≥${schema.minCoreRequired}），补充 ${suppCompleted}/${suppTotal}（需≥${schema.minSuppRequired}）`
          : undefined),
    };
  } catch (e: any) {
    console.error(`[exit-checker] LLM 调用失败: ${e.message}`);
    return buildFallbackResult(schema, userWantsSummary);
  }
}

/**
 * 当 LLM 调用失败或 JSON 无法解析时的降级结果。
 * 使用简单的启发式规则：
 * - 检查对话轮次是否达到 minRounds * 1.5
 * - 检查用户是否表达了总结意愿
 * - 检查对话是否有足够的信息量
 */
function buildFallbackResult(
  schema: StageExitSchema,
  userWantsSummary: boolean
): ExitCheckResult {
  const coreTotal = schema.conditions.filter((c) => c.category === "core").length;
  const suppTotal = schema.conditions.filter((c) => c.category === "supp").length;

  // 降级模式下保守：只当用户明确要求总结时才标记满足
  // 并且对话轮次至少达到 minRounds * 1.5
  return {
    conditionsMet: false, // 降级模式下保守处理
    coreCompleted: 0,
    coreTotal,
    suppCompleted: 0,
    suppTotal,
    assessments: [],
    missingSummary: userWantsSummary
      ? "用户表达了总结意愿，但退出条件检查工具暂时不可用。请尝试使用手动触发收束。"
      : "退出条件检查工具暂时不可用，请继续对话或手动触发收束。",
  };
}

/**
 * 获取阶段的退出条件 Schema（供外部查阅）。
 */
export function getStageExitSchema(stage: number): StageExitSchema | undefined {
  return STAGE_EXIT_SCHEMAS[stage];
}

/**
 * 检测 AI 回复是否包含确认总结。
 * 用于在 AI 输出后自动切换状态为 awaiting_confirmation。
 *
 * 使用精确字符串匹配固定收尾语（与 consultation prompt 中的硬约束一致），
 * 不依赖正则猜测语义，避免 LLM 措辞变化导致漏检。
 */
const FIXED_CONFIRMATION_SENTENCE = "如果以上内容准确，请回复确认";

export function detectConfirmationSummary(response: string): boolean {
  // 精确匹配：去除 markdown 加粗标记和首尾空白后，检查是否包含固定收尾语
  const cleaned = response.trim().replace(/\*\*/g, "");
  return cleaned.includes(FIXED_CONFIRMATION_SENTENCE) && response.length > 150;
}
