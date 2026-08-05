/**
 * Rule Check — 增强版（Phase 3）
 *
 * 职责：
 * - 检查阶段输出的字段完整性和 Schema 完整性（Phase 2 已有）
 * - 基础逻辑冲突检测（Phase 3 新增）
 * - 字段间一致性检查（Phase 3 新增）
 *
 * 纯代码实现，不调用 LLM。
 *
 * 不包含：
 * - 跨阶段检查（Task 3.3 Cross Stage Context Check）
 * - 战略质量判断（Task 3.2 AI Quality Audit）
 */

import type { ZodSchema } from "zod";

export interface RuleIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface RuleCheckResult {
  passed: boolean;
  issues: RuleIssue[];
}

/**
 * 执行完整 Rule Check（Phase 2 轻量 + Phase 3 增强）
 *
 * 检查顺序：
 * 1. 输出为空检查
 * 2. Schema 完整性（Zod safeParse）
 * 3. 必填字段非空检查
 * 4. 逻辑冲突检测（Phase 3 新增）
 * 5. 字段间一致性检查（Phase 3 新增）
 */
export function runRuleCheck(
  output: Record<string, any> | undefined,
  schema?: ZodSchema<any>,
  requiredFields: string[] = [],
  stageNumber?: number
): RuleCheckResult {
  const issues: RuleIssue[] = [];

  // ── 1. 输出为空 ──────────────────────────────────────
  if (!output) {
    return {
      passed: false,
      issues: [{ field: "root", message: "阶段输出为空", severity: "error" }],
    };
  }

  // ── 2. Schema 完整性（仅当 schema 提供时）────────────
  if (schema) {
    const result = schema.safeParse(output);
    if (!result.success) {
      for (const err of result.error.issues) {
        issues.push({
          field: err.path.join("."),
          message: err.message,
          severity: "error",
        });
      }
    }
  }

  // ── 3. 必填字段非空检查 ─────────────────────────────
  for (const field of requiredFields) {
    const value = getNestedValue(output, field);
    if (value === undefined || value === null || value === "") {
      issues.push({
        field,
        message: `必填字段 "${field}" 为空`,
        severity: "error",
      });
    }
  }

  // ── 4. 逻辑冲突检测（Phase 3 新增）───────────────────
  if (stageNumber !== undefined) {
    issues.push(...checkLogicalConflicts(stageNumber, output));
  }

  // ── 5. 字段间一致性检查（Phase 3 新增）───────────────
  if (stageNumber !== undefined) {
    issues.push(...checkFieldConsistency(stageNumber, output));
  }

  return {
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}

/**
 * 各阶段必填字段定义
 * Phase 2 轻量版：只检查最核心字段
 */
export const STAGE_REQUIRED_FIELDS: Record<number, string[]> = {
  1: ["founderMotivation", "observations", "confirmedProblems"],
  2: ["businessBackground.marketContext", "coreChallenges.externalChallenges", "strategicDirection.directionHypothesis"],
  3: ["marketOverview", "opportunityDirections"],
  4: ["targetConsumer.definition", "deepNeeds.identityNeed", "deepNeeds.functionalNeed"],
  5: ["competitors", "competitiveGap"],
  6: ["positioning", "valuePropositions", "reasoning"],
  7: ["coreConcept", "visualSystem"],
  8: ["coreDirection", "themeDirections", "channelStrategy"],
};

// ═══════════════════════════════════════════════════════════
// Phase 3 新增：逻辑冲突检测
// ═══════════════════════════════════════════════════════════

/**
 * 检测阶段输出中的基础逻辑冲突。
 *
 * 纯规则匹配，不调用 LLM。每个检测函数独立，按阶段路由。
 * 只做单阶段内部冲突检测（跨阶段检查属于 Task 3.3）。
 */
function checkLogicalConflicts(
  stageNumber: number,
  output: Record<string, any>
): RuleIssue[] {
  switch (stageNumber) {
    case 1: return checkS1Conflicts(output);
    case 2: return checkS2Conflicts(output);
    case 3: return checkS3Conflicts(output);
    case 4: return checkS4Conflicts(output);
    case 5: return checkS5Conflicts(output);
    case 6: return checkS6Conflicts(output);
    case 7: return checkS7Conflicts(output);
    case 8: return checkS8Conflicts(output);
    default: return [];
  }
}

// ── S1 逻辑冲突 ──────────────────────────────────────────

function checkS1Conflicts(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // founderType 为 creation_driven 但 founderMotivation 无创建愿景
  if (output.founderType === "creation_driven") {
    const motivation = output.founderMotivation?.content ?? "";
    if (motivation.length > 0 && !containsAny(motivation, [
      "创造", "创建", "打造", "设计", "做出来", "做出",
    ])) {
      issues.push({
        field: "founderMotivation.content",
        message: "创始人类型为 creation_driven，但 motivation 中未检测到创造/打造类表述",
        severity: "warning",
      });
    }
  }

  // constraints: budget 为"无限制"或"不限"但 team 描述非常大
  const budget = output.constraints?.budget ?? "";
  const team = output.constraints?.team ?? "";
  if (containsAny(budget, ["无限制", "不限", "充足", "充裕"]) &&
      containsAny(team, ["1人", "2人", "独自", "一个人", "只有我"])) {
    issues.push({
      field: "constraints",
      message: `budget 描述为"${budget}"但 team 为"${team}"——资金充裕与极小团队存在矛盾，请确认`,
      severity: "warning",
    });
  }

  return issues;
}

// ── S2 逻辑冲突 ──────────────────────────────────────────

function checkS2Conflicts(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // strategicWindow 宣称时机成熟但 externalChallenges 全为负面
  const strategicWindow = output.strategicDirection?.directionHypothesis ?? "";
  const externalChallenges = output.coreChallenges?.externalChallenges ?? [];

  const positiveWindow = containsAny(strategicWindow, [
    "时机成熟", "机会窗口", "红利", "风口", "最佳时机", "增长期",
  ]);
  const allNegative = Array.isArray(externalChallenges) &&
    externalChallenges.length > 0 &&
    externalChallenges.every((c: string) =>
      containsAny(c, ["下降", "萎缩", "恶化", "衰退", "困难", "瓶颈", "饱和"])
    );

  if (positiveWindow && allNegative) {
    issues.push({
      field: "strategicDirection.directionHypothesis",
      message: "strategicWindow 判断时机成熟，但 externalChallenges 全部为负面描述，存在逻辑矛盾",
      severity: "warning",
    });
  }

  return issues;
}

// ── S3 逻辑冲突 ──────────────────────────────────────────

function checkS3Conflicts(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // marketStage 为"成熟期/衰退期"但 growthRate 描述高速增长
  const marketStage = output.marketOverview?.marketStage ?? "";
  const growthRate = output.marketOverview?.growthRate ?? "";

  if (containsAny(marketStage, ["成熟期", "成熟", "衰退", "饱和"]) &&
      containsAny(growthRate, ["高速增长", "快速增长", "爆发", "翻倍", "30%", "40%", "50%"])) {
    issues.push({
      field: "marketOverview",
      message: `marketStage 为"${marketStage}"但 growthRate 描述高速增长——成熟期通常增速放缓，请核实`,
      severity: "warning",
    });
  }

  // opportunityDirections 中 evidenceLevel=verified 但 direction 包含推测语言
  if (Array.isArray(output.opportunityDirections)) {
    for (let i = 0; i < output.opportunityDirections.length; i++) {
      const od = output.opportunityDirections[i];
      if (od.evidenceLevel === "verified" && od.direction &&
          containsAny(od.direction, ["可能", "也许", "或许", "推测", "估计", "大概"])) {
        issues.push({
          field: `opportunityDirections[${i}]`,
          message: `evidenceLevel=verified 但 direction 包含推测语言("${od.direction.slice(0, 30)}...")`,
          severity: "warning",
        });
      }
    }
  }

  return issues;
}

// ── S4 逻辑冲突 ──────────────────────────────────────────

function checkS4Conflicts(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // targetConsumer.definition 仅含人口统计标签（年龄+性别），无行为/场景描述
  const def = output.targetConsumer?.definition ?? "";
  const hasBehaviorContext = containsAny(def, [
    "场景", "情境", "会", "喜欢", "习惯", "经常", "每天", "需要",
    "购买", "使用", "消费", "选择", "在意", "关注", "担心",
  ]);
  const onlyDemographic =
    def.length > 0 &&
    /^\s*(男性|女性|男女|年轻人|中年人|Z世代|千禧|白领|学生|宝妈|职场).{0,20}$/.test(def);

  if (onlyDemographic && !hasBehaviorContext) {
    issues.push({
      field: "targetConsumer.definition",
      message: "targetConsumer.definition 仅包含人口标签，缺少行为场景或消费动机描述",
      severity: "warning",
    });
  }

  // functionalNeed 包含身份认同层表述（可能与 identityNeed 混淆）
  const functionalNeed = output.deepNeeds?.functionalNeed ?? "";
  const identityNeed = output.deepNeeds?.identityNeed ?? "";
  if (functionalNeed.length > 0 && identityNeed.length > 0) {
    const functionalOverlap = containsAny(functionalNeed, [
      "身份", "认同", "自我", "归属", "圈层", "阶级", "标签", "人设",
    ]);
    if (functionalOverlap) {
      issues.push({
        field: "deepNeeds.functionalNeed",
        message: "functionalNeed 包含身份认同层表述，可能与 identityNeed 混淆——functionalNeed 应聚焦功能层任务",
        severity: "warning",
      });
    }
  }

  return issues;
}

// ── S5 逻辑冲突 ──────────────────────────────────────────

function checkS5Conflicts(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // competitors[].weaknesses 包含比较级评价词（违规）
  if (Array.isArray(output.competitors)) {
    for (let i = 0; i < output.competitors.length; i++) {
      const c = output.competitors[i];
      if (Array.isArray(c.weaknesses)) {
        for (let j = 0; j < c.weaknesses.length; j++) {
          const w = c.weaknesses[j] as string;
          if (containsAny(w, ["更好", "更差", "不如", "更高级", "更优秀", "更差劲"])) {
            issues.push({
              field: `competitors[${i}].weaknesses[${j}]`,
              message: `竞品 weaknesses 包含比较级评价词: "${w.slice(0, 40)}"——应使用中性描述`,
              severity: "error",
            });
          }
        }
      }
    }
  }

  // competitiveGap.unmetNeeds 为空或无实质内容但竞品有 opportunityGap
  const unmetNeeds = output.competitiveGap?.unmetNeeds ?? [];
  const hasCompetitorGaps = Array.isArray(output.competitors) &&
    output.competitors.some((c: any) => c.opportunityGap && c.opportunityGap.length >= 8);

  if ((!Array.isArray(unmetNeeds) || unmetNeeds.length === 0) && hasCompetitorGaps) {
    issues.push({
      field: "competitiveGap.unmetNeeds",
      message: "竞品卡片中标注了 opportunityGap，但 competitiveGap.unmetNeeds 为空——跨竞品共同需求未总结",
      severity: "warning",
    });
  }

  // competitors[].positioning 相似度检测（3+ 个竞品定位几乎相同）
  if (Array.isArray(output.competitors) && output.competitors.length >= 3) {
    const positionings = output.competitors
      .map((c: any) => c.positioning ?? "")
      .filter((p: string) => p.length > 0);
    const uniquePositionings = new Set(positionings.map((p: string) => p.slice(0, 10)));
    if (uniquePositionings.size <= 1 && positionings.length >= 3) {
      issues.push({
        field: "competitors",
        message: `${positionings.length} 个竞品的定位高度相似（前10字相同），可能未充分区分竞品差异`,
        severity: "warning",
      });
    }
  }

  return issues;
}

// ── S6 逻辑冲突 ──────────────────────────────────────────

function checkS6Conflicts(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // positioning 包含"高端/轻奢/premium"但存在"性价比"层 valueProposition
  const positioning = output.positioning ?? "";
  const isPremium = containsAny(positioning, [
    "高端", "轻奢", "奢侈", "顶级", "尊贵", "premium", "luxury", "精品",
  ]);

  if (isPremium && Array.isArray(output.valuePropositions)) {
    for (let i = 0; i < output.valuePropositions.length; i++) {
      const vp = output.valuePropositions[i];
      if (containsAny(vp.proposition ?? "", ["性价比", "实惠", "便宜", "低价", "划算", "平价"])) {
        issues.push({
          field: `valuePropositions[${i}].proposition`,
          message: `定位为"${positioning.slice(0, 20)}..."但 valueProposition 包含"${vp.proposition.slice(0, 20)}"——高端定位与性价比主张矛盾`,
          severity: "error",
        });
      }
    }
  }

  // valuePropositions functional level 不包含功能描述关键词
  if (Array.isArray(output.valuePropositions)) {
    const functionalVP = output.valuePropositions.find(
      (v: any) => v.level === "functional"
    );
    if (functionalVP?.proposition && !containsAny(functionalVP.proposition, [
      "功能", "性能", "效果", "质量", "好用", "方便", "解决", "效率",
      "安全", "健康", "持久", "天然", "成分", "工艺", "技术",
    ])) {
      issues.push({
        field: "valuePropositions[functional]",
        message: `functional 层价值主张"${functionalVP.proposition.slice(0, 20)}"未包含功能描述关键词，可能层级分类有误`,
        severity: "warning",
      });
    }
  }

  // brandPersonality traits 互斥检测
  if (Array.isArray(output.brandPersonality)) {
    const traits = output.brandPersonality
      .map((t: any) => t.trait ?? "")
      .filter((t: string) => t.length > 0);

    const conflictingPairs: Array<[string[], string]> = [
      [["大胆", "叛逆", "前卫", "张扬", "激进"], "沉稳/保守/内敛"],
      [["活泼", "有趣", "幽默", "搞怪", "轻松"], "严肃/专业/庄重"],
      [["温暖", "亲和", "柔软", "治愈", "温柔"], "冷峻/锋利/硬核"],
      [["简约", "克制", "极简", "留白", "朴素"], "丰富/繁复/华丽/奢华"],
      [["年轻", "新锐", "潮流", "先锋", "酷"], "经典/传统/老派/复古"],
    ];

    for (const [groupA, groupBLabel] of conflictingPairs) {
      const hasGroupA = traits.some((t: string) =>
        groupA.some((a) => t.includes(a))
      );
      // Check for group B by looking at the opposing traits
      const groupBTraits = groupBLabel.split("/");
      const hasGroupB = traits.some((t: string) =>
        groupBTraits.some((b) => t.includes(b))
      );

      if (hasGroupA && hasGroupB) {
        const matchA = traits.find((t: string) => groupA.some((a) => t.includes(a)));
        const matchB = traits.find((t: string) => groupBTraits.some((b) => t.includes(b)));
        issues.push({
          field: "brandPersonality",
          message: `品牌人格存在矛盾特质: "${matchA}" vs "${matchB}"——这组特质通常不共存`,
          severity: "error",
        });
      }
    }
  }

  // reasoning 字段未显式引用 S3/S4/S5
  if (output.reasoning) {
    const r = output.reasoning;
    const marketRef = r.marketOpportunityReference ?? "";
    const consumerRef = r.consumerInsightReference ?? "";
    const competitiveRef = r.competitiveGapReference ?? "";

    if (marketRef.includes("未追溯") && consumerRef.includes("未追溯") && competitiveRef.includes("未追溯")) {
      issues.push({
        field: "reasoning",
        message: `reasoning 三个引用字段全部标注"未追溯到前序数据"——S6 定位可能为 AI 独立推断，需人工复核`,
        severity: "error",
      });
    } else {
      // 单个字段未追溯
      if (marketRef.includes("未追溯")) {
        issues.push({
          field: "reasoning.marketOpportunityReference",
          message: "S6 定位未追溯到 S3 市场机会数据",
          severity: "warning",
        });
      }
      if (consumerRef.includes("未追溯")) {
        issues.push({
          field: "reasoning.consumerInsightReference",
          message: "S6 定位未追溯到 S4 消费者洞察数据",
          severity: "warning",
        });
      }
      if (competitiveRef.includes("未追溯")) {
        issues.push({
          field: "reasoning.competitiveGapReference",
          message: "S6 定位未追溯到 S5 竞争判断数据",
          severity: "warning",
        });
      }
    }
  }

  return issues;
}

// ── S7 逻辑冲突 ──────────────────────────────────────────

function checkS7Conflicts(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // visualSystem 五种语言感知基调矛盾检测
  const vs = output.visualSystem;
  if (vs) {
    const dimensions = [
      { key: "form", label: "形态" },
      { key: "color", label: "色彩" },
      { key: "typography", label: "字体" },
      { key: "imagery", label: "图像" },
      { key: "material", label: "材质" },
    ] as const;

    const tones: string[] = [];
    for (const dim of dimensions) {
      const tone = vs[dim.key]?.perceptualTone ?? "";
      if (tone) tones.push(tone);
    }

    // 检测极简 vs 繁复的矛盾
    const hasMinimal = tones.some((t: string) =>
      containsAny(t, ["极简", "简约", "干净", "留白", "朴素", "克制"])
    );
    const hasRich = tones.some((t: string) =>
      containsAny(t, ["丰富", "繁复", "华丽", "奢华", "饱满", "堆叠"])
    );

    if (hasMinimal && hasRich) {
      issues.push({
        field: "visualSystem",
        message: "视觉系统同时包含极简和繁复/华丽的感知基调——整体美学方向存在矛盾",
        severity: "warning",
      });
    }

    // 检测 exclusions 包含自己的 choice
    for (const dim of dimensions) {
      const choice = vs[dim.key]?.choice ?? "";
      const exclusions = vs[dim.key]?.exclusions ?? "";
      if (choice.length >= 3 && exclusions.length >= 3 &&
          choice.includes(exclusions.slice(0, Math.min(4, exclusions.length)))) {
        issues.push({
          field: `visualSystem.${dim.key}`,
          message: `${dim.label}语言的 choice 与 exclusions 内容重叠——应明确区分`,
          severity: "warning",
        });
      }
    }
  }

  // restrictions[].exclusion 与 visualSystem 五维度 choice 矛盾
  if (Array.isArray(output.restrictions)) {
    const allChoices = [
      output.visualSystem?.form?.choice ?? "",
      output.visualSystem?.color?.choice ?? "",
      output.visualSystem?.typography?.choice ?? "",
      output.visualSystem?.imagery?.choice ?? "",
      output.visualSystem?.material?.choice ?? "",
    ].join(" ");

    for (let i = 0; i < output.restrictions.length; i++) {
      const exclusion = output.restrictions[i]?.exclusion ?? "";
      if (exclusion.length >= 3 && allChoices.includes(exclusion.slice(0, 3))) {
        issues.push({
          field: `restrictions[${i}].exclusion`,
          message: `视觉禁区"${exclusion}"与 visualSystem 中的选择有重叠`,
          severity: "warning",
        });
      }
    }
  }

  return issues;
}

// ── S8 逻辑冲突 ──────────────────────────────────────────

function checkS8Conflicts(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // channelStrategy 中多平台都标记"重点"或"核心"
  if (output.channelStrategy) {
    const cs = output.channelStrategy;
    const platformKeys = ["xiaohongshu", "douyin", "wechat", "小红书", "抖音", "微信"] as const;

    let primaryCount = 0;
    const primaryPlatforms: string[] = [];
    for (const key of platformKeys) {
      const platform = cs[key];
      if (platform && typeof platform === "object") {
        const strategy = platform.strategy ?? platform.contentDirection ?? "";
        if (containsAny(strategy, ["重点", "核心", "主力", "主要", "主导"])) {
          primaryCount++;
          primaryPlatforms.push(key);
        }
      } else if (typeof platform === "string") {
        if (containsAny(platform, ["重点", "核心", "主力", "主要", "主导"])) {
          primaryCount++;
          primaryPlatforms.push(key);
        }
      }
    }

    if (primaryCount >= 3) {
      issues.push({
        field: "channelStrategy",
        message: `channelStrategy 中 ${primaryPlatforms.join("、")} 均标记为"重点"——建议区分主次`,
        severity: "warning",
      });
    }
  }

  // contentValueSystem 四阶段是否完整
  if (output.contentValueSystem) {
    const stages = ["awareness", "interest", "trust", "decision"];
    for (const stage of stages) {
      if (!output.contentValueSystem[stage]) {
        issues.push({
          field: `contentValueSystem.${stage}`,
          message: `contentValueSystem 缺少 ${stage} 阶段的内容策略`,
          severity: "warning",
        });
      }
    }
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════
// Phase 3 新增：字段间一致性检查
// ═══════════════════════════════════════════════════════════

/**
 * 检查同一阶段内相关字段之间的一致性。
 *
 * 不同于逻辑冲突检测（检查单个字段内的矛盾表述），
 * 一致性检查关注字段 A vs 字段 B 的关系是否自洽。
 */
function checkFieldConsistency(
  stageNumber: number,
  output: Record<string, any>
): RuleIssue[] {
  switch (stageNumber) {
    case 4: return checkS4Consistency(output);
    case 5: return checkS5Consistency(output);
    case 6: return checkS6Consistency(output);
    case 7: return checkS7Consistency(output);
    case 8: return checkS8Consistency(output);
    default: return [];
  }
}

// ── S4 字段一致性 ────────────────────────────────────────

function checkS4Consistency(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // targetConsumer.definition 与 deepNeeds.functionalNeed 的人群指向一致性
  const consumerDef = output.targetConsumer?.definition ?? "";
  const idealSelf = output.targetConsumer?.idealSelfReflection ?? "";

  // idealSelfReflection 应与 definition 有关联（不应是完全无关的另一群人）
  if (consumerDef.length >= 10 && idealSelf.length >= 10) {
    // 简单检测：两个描述中是否有共同关键词
    const defWords = extractKeywords(consumerDef);
    const selfWords = extractKeywords(idealSelf);
    const commonWords = defWords.filter((w) => selfWords.includes(w));

    if (commonWords.length === 0) {
      issues.push({
        field: "targetConsumer",
        message: "targetConsumer.definition 与 idealSelfReflection 无共享关键词——两段描述可能指向不同人群",
        severity: "warning",
      });
    }
  }

  return issues;
}

// ── S5 字段一致性 ────────────────────────────────────────

function checkS5Consistency(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // competitiveGap.marketOpportunity 应与 competitors[].opportunityGap 有关联
  const marketOpportunity = output.competitiveGap?.marketOpportunity ?? "";
  const competitorGaps: string[] = Array.isArray(output.competitors)
    ? output.competitors
        .map((c: any) => c.opportunityGap ?? "")
        .filter((g: string) => g.length >= 8)
    : [];

  if (marketOpportunity.length >= 10 && competitorGaps.length >= 2) {
    // 检查 marketOpportunity 是否至少覆盖了部分竞品 opportunityGap 中的关键词
    const gapKeywords = new Set<string>();
    for (const gap of competitorGaps) {
      for (const kw of extractKeywords(gap)) {
        gapKeywords.add(kw);
      }
    }

    const marketKeywords = extractKeywords(marketOpportunity);
    const overlap = marketKeywords.filter((kw) => gapKeywords.has(kw));

    if (overlap.length === 0 && competitorGaps.length >= 3) {
      issues.push({
        field: "competitiveGap.marketOpportunity",
        message: "marketOpportunity 与竞品 opportunityGap 的关键词无交集——机会总结可能未基于竞品分析",
        severity: "warning",
      });
    }
  }

  // competitors[] 之间不应完全相同（至少应该有差异化）
  if (Array.isArray(output.competitors) && output.competitors.length >= 2) {
    const names = output.competitors.map((c: any) => c.name).filter(Boolean);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      issues.push({
        field: "competitors",
        message: "竞品列表中存在重名品牌",
        severity: "error",
      });
    }
  }

  return issues;
}

// ── S6 字段一致性 ────────────────────────────────────────

function checkS6Consistency(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // positioning 与 valuePropositions 的层级对应关系
  const positioning = output.positioning ?? "";

  if (Array.isArray(output.valuePropositions)) {
    const expectedLevels = new Set(["functional", "emotional", "social"]);
    const actualLevels = new Set(
      output.valuePropositions.map((v: any) => v.level)
    );

    // 恰好 3 条且 level 不重复
    if (output.valuePropositions.length !== 3) {
      issues.push({
        field: "valuePropositions",
        message: `valuePropositions 应有恰好 3 条（functional/emotional/social），当前 ${output.valuePropositions.length} 条`,
        severity: "error",
      });
    }

    for (const expected of expectedLevels) {
      if (!actualLevels.has(expected)) {
        issues.push({
          field: "valuePropositions",
          message: `valuePropositions 缺少 ${expected} 层级`,
          severity: "error",
        });
      }
    }

    // functional level 的 proposition 不应包含情绪/社会描述
    const functionalVP = output.valuePropositions.find(
      (v: any) => v.level === "functional"
    );
    if (functionalVP?.proposition && containsAny(functionalVP.proposition, [
      "身份", "认同", "归属", "圈层", "社交", "彰显", "阶级",
    ])) {
      issues.push({
        field: "valuePropositions[functional].proposition",
        message: "functional 层的价值主张包含身份/社交类表述——可能应为 emotional 或 social 层",
        severity: "warning",
      });
    }
  }

  // brandStory 与 positioning 的叙事一致性
  const struggleMoment = output.brandStory?.struggleMoment ?? "";
  const brandAction = output.brandStory?.brandAction ?? "";

  if (positioning.length >= 15 && brandAction.length >= 10) {
    // brandAction 应体现 positioning 的核心价值方向
    const posKeywords = extractKeywords(positioning).filter(
      (k) => k.length >= 2
    );
    const actionHasMatch = posKeywords.some((kw) => brandAction.includes(kw));
    if (!actionHasMatch && posKeywords.length >= 3) {
      issues.push({
        field: "brandStory.brandAction",
        message: "brandAction 与 positioning 的关键词无交集——品牌故事行动与定位可能脱节",
        severity: "warning",
      });
    }
  }

  return issues;
}

// ── S7 字段一致性 ────────────────────────────────────────

function checkS7Consistency(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // coreConcept 与 keywords[].rationale 的一致性
  const coreConcept = output.coreConcept ?? "";
  const keywords = output.keywords ?? [];

  if (coreConcept.length >= 10 && Array.isArray(keywords) && keywords.length > 0) {
    // 每个 keyword.rationale 应能追溯到 coreConcept
    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i];
      const rationale = kw.rationale ?? "";

      if (rationale.length >= 4) {
        const conceptWords = extractKeywords(coreConcept).filter((w) => w.length >= 2);
        const rationaleHasMatch = conceptWords.some((cw) =>
          rationale.includes(cw)
        );

        if (!rationaleHasMatch) {
          issues.push({
            field: `keywords[${i}].rationale`,
            message: `关键词"${kw.keyword}"的 rationale 与 coreConcept 无共享关键词——关键词可能与核心概念脱节`,
            severity: "warning",
          });
        }
      }
    }
  }

  // visualSystem 五种语言之间不应互相矛盾（choice 层面）
  const vs = output.visualSystem;
  if (vs) {
    const choices = [
      vs.form?.choice ?? "",
      vs.color?.choice ?? "",
      vs.typography?.choice ?? "",
      vs.imagery?.choice ?? "",
      vs.material?.choice ?? "",
    ].filter((c) => c.length > 0);

    // 选择中不应该同时存在"暖色调"和"冷色调"（除非是故意的对比策略——由 AI Audit 判断）
    // 同时检查 choice 和 perceptualTone 两个字段
    const allToneTexts = [
      vs.form?.choice ?? "", vs.form?.perceptualTone ?? "",
      vs.color?.choice ?? "", vs.color?.perceptualTone ?? "",
      vs.typography?.choice ?? "", vs.typography?.perceptualTone ?? "",
      vs.imagery?.choice ?? "", vs.imagery?.perceptualTone ?? "",
      vs.material?.choice ?? "", vs.material?.perceptualTone ?? "",
    ].filter((c) => c.length > 0);

    const hasWarm = allToneTexts.some((c) => containsAny(c, ["暖色", "暖调", "温暖", "热烈"]));
    const hasCool = allToneTexts.some((c) => containsAny(c, ["冷色", "冷调", "冷静", "冷淡"]));
    if (hasWarm && hasCool) {
      issues.push({
        field: "visualSystem",
        message: "视觉系统中同时包含暖调和冷调方向——可能需要明确主调",
        severity: "warning",
      });
    }
  }

  return issues;
}

// ── S8 字段一致性 ────────────────────────────────────────

function checkS8Consistency(output: Record<string, any>): RuleIssue[] {
  const issues: RuleIssue[] = [];

  // coreDirection 与 themeDirections[].pillar 的一致性
  const coreDirection = output.coreDirection ?? "";
  const themeDirections = output.themeDirections ?? [];

  if (coreDirection.length >= 10 && Array.isArray(themeDirections)) {
    for (let i = 0; i < themeDirections.length; i++) {
      const td = themeDirections[i];
      const pillar = td.pillar ?? "";
      const purpose = td.corePurpose ?? "";

      // pillar 不应与 coreDirection 完全无关
      if (pillar.length >= 3) {
        const dirKeywords = extractKeywords(coreDirection).filter((w) => w.length >= 2);
        const pillarMatch = dirKeywords.some((kw) =>
          pillar.includes(kw) || (purpose.includes(kw))
        );

        if (!pillarMatch && dirKeywords.length >= 3) {
          issues.push({
            field: `themeDirections[${i}].pillar`,
            message: `内容支柱"${pillar}"与 coreDirection 无共享关键词——可能与核心方向脱节`,
            severity: "warning",
          });
        }
      }
    }
  }

  // channelStrategy 与 contentValueSystem 的对应
  const contentValueSystem = output.contentValueSystem ?? {};
  const hasTrustDecision = contentValueSystem.trust || contentValueSystem.decision;
  const channelStrategy = output.channelStrategy ?? {};

  if (hasTrustDecision && channelStrategy) {
    // trust/decision 阶段应该对应私域或微信
    const hasTrustChannel = Object.values(channelStrategy).some((v: any) => {
      if (typeof v === "string") return containsAny(v, ["微信", "私域", "社群"]);
      if (typeof v === "object") {
        const s = v.strategy ?? v.contentDirection ?? "";
        return typeof s === "string" && containsAny(s, ["微信", "私域", "社群"]);
      }
      return false;
    });

    if (!hasTrustChannel) {
      issues.push({
        field: "channelStrategy",
        message: "contentValueSystem 包含 trust/decision 阶段但 channelStrategy 中未涉及微信/私域/社群——私域通常是信任和决策转化的关键渠道",
        severity: "warning",
      });
    }
  }

  return issues;
}

// ═══════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════

/**
 * 获取嵌套对象值
 */
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
 * 检查字符串是否包含任意一个关键词。
 */
function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

/**
 * 从文本中提取中文关键词（2-4 字，用于关键词级对比）。
 * 简单分词：按标点和空格分割，取 2-4 字片段。
 */
function extractKeywords(text: string): string[] {
  const segments = text.split(/[，,。.、；;：:\s\n\-\—]+/);
  const keywords: string[] = [];
  const seen = new Set<string>();

  for (const seg of segments) {
    if (seg.length >= 2 && seg.length <= 6) {
      const normalized = seg.trim();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        keywords.push(normalized);
      }
    }
  }

  // 如果分段太少，用 2-gram 补充
  if (keywords.length < 3 && text.length >= 4) {
    for (let i = 0; i <= text.length - 2; i++) {
      const bigram = text.slice(i, i + 2);
      if (!seen.has(bigram) && /^[一-鿿]{2}$/.test(bigram)) {
        seen.add(bigram);
        keywords.push(bigram);
        if (keywords.length >= 8) break;
      }
    }
  }

  return keywords;
}
