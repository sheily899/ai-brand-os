/**
 * Report Assembly + Final Audit（Phase 3）
 *
 * 职责：
 * - getBrandKnowledge(): 8 阶段 JSON 数据合并为 BrandKnowledge
 * - assembleReport(): BrandKnowledge → ReportContent（含 9 种 ReportBlock）
 * - polishReport(): 文本清洁（去 AI 对话痕迹）
 * - auditReport(): 报告级质量审核包装
 * - runFinalAudit(): 跨阶段引用完整性检查
 * - assembleWithAudit(): 完整三步骤（审核→组装→质量检查）
 *
 * 纯函数，不调用 LLM。
 */

import type {
  BrandKnowledge,
  ReportContent,
  CoverData,
  ExecutiveSummaryData,
  ExecutiveSummaryField,
  BlueprintData,
  ReportChapter,
  ReportBlock,
  NarrativeBlock,
  CardsBlock,
  TagsBlock,
  ComparisonBlock,
  LandscapeBlock,
  SupplyGapBlock,
  MatrixBlock,
  DecisionDimensionBlock,
  SourceField,
  FinalAuditResult,
  FinalAuditIssue,
  AssembleResult,
  ReportAuditResult,
  ReportCustomization,
  CardItem,
  ComparisonTableColumn,
  ColumnDef,
  ComparisonRow,
  LandscapeRow,
  SupplyGapRow,
  DecisionDimensionRow,
} from "./types";

// Re-export for backward compatibility
export type {
  BrandKnowledge,
  ReportContent,
  CoverData,
  ExecutiveSummaryData,
  BlueprintData,
  ReportChapter,
  ReportBlock,
  NarrativeBlock,
  CardsBlock,
  TagsBlock,
  ComparisonBlock,
  LandscapeBlock,
  SupplyGapBlock,
  MatrixBlock,
  DecisionDimensionBlock,
  SourceField,
  FinalAuditResult,
  FinalAuditIssue,
  AssembleResult,
  ReportAuditResult,
};
import { qualityCheck } from "./quality";
import type { QualityCheckResult } from "./quality";

// ═══════════════════════════════════════════════════════════
// Brand Knowledge — 8 阶段数据合并
// ═══════════════════════════════════════════════════════════

/**
 * 将 8 阶段 structuredOutput 合并为统一 BrandKnowledge。
 * 纯数据合并，不调 AI。
 */
export function getBrandKnowledge(
  projectId: string,
  brandName: string,
  category: string | undefined,
  stageOutputs: Record<number, Record<string, any>>
): BrandKnowledge {
  return {
    projectId,
    brandName,
    category,
    stages: stageOutputs,
    stagesReady: Object.keys(stageOutputs).filter(
      (k) => stageOutputs[Number(k)] && Object.keys(stageOutputs[Number(k)]).length > 0
    ).length,
  };
}

// ═══════════════════════════════════════════════════════════
// Polish — 文本清洁
// ═══════════════════════════════════════════════════════════

/**
 * 清洁报告文本：去除 AI 对话痕迹、确认用语等。
 * 纯代码实现，不调用 LLM。
 */
export function polishReport(text: string): string {
  let cleaned = text;

  // 移除确认总结开头（各种变体）
  cleaned = cleaned.replace(
    /^(好的|好)[，,]\s*(让我|我来|我来给你|我先)?\s*(确认一下|复述一下|总结一下|整理一下|确认|复述|总结|梳理)[：:]\s*/gim,
    ""
  );
  cleaned = cleaned.replace(
    /^(好的|好)[，,]\s*(这是|以下)[^。]{0,20}(确认|总结|方向)[：:]\s*/gim,
    ""
  );

  // 移除末尾确认请求
  cleaned = cleaned.replace(
    /(如果|若)(哪里|以上内容|以上|有)?[^。]{0,30}(理解|准确|正确|偏差)[^。]{0,30}[。，]?\s*$/gm,
    ""
  );
  cleaned = cleaned.replace(
    /(请回复|请).{0,10}(确认|告诉我|指出)[^。]*$/gm,
    ""
  );
  cleaned = cleaned.replace(
    /(理解得对|确认一下)[吗？?]?\s*$/gm,
    ""
  );

  // 移除对话标记前缀
  cleaned = cleaned.replace(/^你提到[：:]/gm, "");
  cleaned = cleaned.replace(/^您提到[：:]/gm, "");
  cleaned = cleaned.replace(/^根据(您的|你的)描述[：:]/gm, "");
  cleaned = cleaned.replace(/^正如(你|您)所说[：:]/gm, "");

  // 移除 AI 对话中的冗余引导词
  cleaned = cleaned.replace(/^(让我|我们可以|接下来|现在)[^。]{0,10}确认[：:]\s*/gm, "");

  // 移除末尾多余的空行
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  cleaned = cleaned.trim();

  return cleaned;
}

// ═══════════════════════════════════════════════════════════
// Helpers — 构造 SourceField
// ═══════════════════════════════════════════════════════════

let _blockIdCounter = 0;
function nextBlockId(): string {
  _blockIdCounter++;
  return `block_${_blockIdCounter}`;
}

/** 重置 block ID 计数器（每次 assemble 前调用） */
function resetBlockIdCounter(): void {
  _blockIdCounter = 0;
}

// ── Narrative segment helper ──────────────────────────────

/** 从 (text, fieldPath) 列表中构建 segments + content */
function mkSegments(
  parts: Array<{ text: string | undefined | null; fieldPath: string }>,
): { segments: Array<{ text: string; fieldPath: string }>; content: string } {
  const valid = parts
    .filter((p): p is { text: string; fieldPath: string } =>
      typeof p.text === "string" && p.text.trim().length > 0
    );
  return {
    segments: valid.map(p => ({ text: p.text, fieldPath: p.fieldPath })),
    content: valid.map(p => p.text).join("\n\n"),
  };
}

/** 从卡片数组构建 narrative segments + content */
function cardsToNarrative(
  items: Array<{ label?: string; title: string; description: string }>,
  fieldPath: string,
): { segments: Array<{ text: string; fieldPath: string }>; content: string } {
  const segs = items.map((item, i) => {
    const prefix = item.label ? `【${item.label}】` : "";
    const text = `${prefix}${item.title}：${item.description}`;
    return { text, fieldPath: `${fieldPath}[${i}]` };
  });
  return { segments: segs, content: segs.map((s) => s.text).join("\n\n") };
}

/** 从标签数组构建 narrative segments + content */
function tagsToNarrative(
  tags: string[],
  fieldPath: string,
): { segments: Array<{ text: string; fieldPath: string }>; content: string } {
  const segs = tags.map((tag, i) => ({
    text: tag,
    fieldPath: `${fieldPath}[${i}]`,
  }));
  return { segments: segs, content: segs.join("、") };
}

/** 从 stage data 中提取 fieldPath 对应的值（字符串或数组），用于 columnDefs 的 fieldPath 推断 */
function colDefs(
  keys: Array<{ key: string; label: string; protected?: boolean; fieldPath?: string }>,
): ColumnDef[] {
  return keys.map(k => ({
    key: k.key,
    label: k.label,
    protected: k.protected,
    fieldPath: k.fieldPath,
  }));
}

function sf(
  fieldPath: string,
  label: string,
  value: any,
  editorType: "textarea" | "list" | "card-list" | "table" = "textarea",
  /** 所属 stage 编号（1-8），用于 decisionId 前缀 */
  stage: number = 2
): SourceField {
  return { fieldPath, decisionId: `s${stage}_${fieldPath.replace(/\./g, "_")}`, label, value, editorType };
}

// ═══════════════════════════════════════════════════════════
// Chapter Builders — 每章从 stage data 构造 ReportBlock[]
// ═══════════════════════════════════════════════════════════

function buildChapter01(knowledge: BrandKnowledge): ReportBlock[] {
  const s2 = knowledge.stages[2];
  if (!s2) return [];
  const blocks: ReportBlock[] = [];

  // 1.1 商业背景
  const bgSegParts = [
    { text: s2.businessBackground?.marketContext, fieldPath: "businessBackground.marketContext" },
    { text: s2.businessBackground?.strategicWindow, fieldPath: "businessBackground.strategicWindow" },
    ...(s2.businessBackground?.drivingForces ?? []).flatMap((d: any, i: number) =>
      typeof d === "string"
        ? [{ text: d, fieldPath: `businessBackground.drivingForces[${i}]` }]
        : []
    ),
  ];
  const bgSectionOverride = getSection(knowledge, 2, "商业背景");
  const { segments: bgSegments, content: bgContent } = bgSectionOverride
    ? mkSegments([{ text: bgSectionOverride, fieldPath: "__section_bg" }])
    : mkSegments(bgSegParts);
  if (bgContent) {
    blocks.push({
      id: nextBlockId(), type: "narrative",
      title: "#### 1.1 商业背景",
      content: bgContent,
      segments: bgSegments,
      sourceFields: [
        sf("businessBackground.marketContext", "行业宏观背景", s2.businessBackground?.marketContext, "textarea", 2),
        sf("businessBackground.drivingForces", "驱动因素", s2.businessBackground?.drivingForces, "list", 2),
        sf("businessBackground.strategicWindow", "战略窗口", s2.businessBackground?.strategicWindow, "textarea", 2),
      ],
      editable: true,
    } satisfies NarrativeBlock);
  }

  // 1.2 核心挑战
  const chSegParts = [
    ...(s2.coreChallenges?.externalChallenges ?? []).map((c: string, i: number) =>
      ({ text: c, fieldPath: `coreChallenges.externalChallenges[${i}]` })
    ),
    ...(s2.coreChallenges?.internalChallenges ?? []).map((c: string, i: number) =>
      ({ text: c, fieldPath: `coreChallenges.internalChallenges[${i}]` })
    ),
  ];
  const chSectionOverride = getSection(knowledge, 2, "核心挑战");
  const { segments: chSegments, content: chContent } = chSectionOverride
    ? mkSegments([{ text: chSectionOverride, fieldPath: "__section_ch" }])
    : mkSegments(chSegParts);
  if (chContent) {
    blocks.push({
      id: nextBlockId(), type: "narrative",
      title: "#### 1.2 核心挑战",
      content: chContent,
      segments: chSegments,
      sourceFields: [
        sf("coreChallenges.externalChallenges", "外部挑战", s2.coreChallenges?.externalChallenges, "list", 2),
        sf("coreChallenges.internalChallenges", "内部约束", s2.coreChallenges?.internalChallenges, "list", 2),
      ],
      editable: true,
    } satisfies NarrativeBlock);
  }

  // 1.3 品牌战略方向
  const dirSegParts = [
    { text: s2.strategicDirection?.directionHypothesis, fieldPath: "strategicDirection.directionHypothesis" },
    ...(s2.strategicDirection?.workingPriorities ?? []).map((p: string, i: number) =>
      ({ text: p, fieldPath: `strategicDirection.workingPriorities[${i}]` })
    ),
  ];
  const dirSectionOverride = getSection(knowledge, 2, "品牌战略方向");
  const { segments: dirSegments, content: dirContent } = dirSectionOverride
    ? mkSegments([{ text: dirSectionOverride, fieldPath: "__section_dir" }])
    : mkSegments(dirSegParts);
  if (dirContent) {
    blocks.push({
      id: nextBlockId(), type: "narrative",
      title: "#### 1.3 品牌战略方向",
      content: dirContent,
      segments: dirSegments,
      sourceFields: [
        sf("strategicDirection.directionHypothesis", "方向假设", s2.strategicDirection?.directionHypothesis, "textarea", 2),
        sf("strategicDirection.workingPriorities", "工作焦点", s2.strategicDirection?.workingPriorities, "list", 2),
      ],
      editable: true,
    } satisfies NarrativeBlock);
  }

  return blocks;
}

function buildChapter02(knowledge: BrandKnowledge): ReportBlock[] {
  const s3 = knowledge.stages[3];
  if (!s3) return [];
  const blocks: ReportBlock[] = [];

  // 2.1 品类现状
  const csSegParts = [
    { text: s3.categoryStatus?.definition, fieldPath: "categoryStatus.definition" },
    { text: s3.categoryStatus?.currentState, fieldPath: "categoryStatus.currentState" },
    ...(s3.categoryStatus?.trends ?? []).flatMap((t: any, i: number) =>
      typeof t === "string" ? [{ text: t, fieldPath: `categoryStatus.trends[${i}]` }] : []
    ),
  ];
  const csOverride = getSection(knowledge, 3, "品类现状");
  const { segments: csSegments, content: csContent } = csOverride
    ? mkSegments([{ text: csOverride, fieldPath: "__section_cs" }])
    : mkSegments(csSegParts);
  if (csContent) {
    blocks.push({
      id: nextBlockId(), type: "narrative", title: "#### 2.1 品类现状", content: csContent,
      segments: csSegments,
      sourceFields: [
        sf("categoryStatus.definition", "品类定义", s3.categoryStatus?.definition, "textarea", 3),
        sf("categoryStatus.currentState", "供给格局", s3.categoryStatus?.currentState, "textarea", 3),
        sf("categoryStatus.trends", "趋势变化", s3.categoryStatus?.trends, "list", 3),
      ],
      editable: true,
    } satisfies NarrativeBlock);
  }

  // 2.2 当前体验不足 → 仅保留下方 supplyGap 表格
  // 2.3 品牌机会方向 → 仅保留下方 cards 卡片
  // 体验缺口 (supplyGap)
  const gaps = s3.experienceGaps;
  if (gaps?.length) {
    blocks.push({
      id: nextBlockId(), type: "supplyGap",
      title: "#### 2.2 当前体验不足",
      columnDefs: colDefs([
        { key: "dimension", label: "维度", protected: true, fieldPath: "experienceGaps[].gap" },
        { key: "currentMarket", label: "当前市场提供", protected: false, fieldPath: "experienceGaps[].currentAlternative" },
        { key: "unmetNeed", label: "用户仍未满足", protected: false, fieldPath: "experienceGaps[].gap" },
      ]),
      rows: gaps.map((g: any) => ({
        dimension: g.gap ?? "",
        currentMarket: g.currentAlternative ?? "",
        unmetNeed: g.gap ?? "",
      })),
      sourceFields: [sf("experienceGaps", "体验缺口", gaps, "card-list", 3)],
      editable: true,
    } satisfies SupplyGapBlock);
  }

  // 机会方向 (narrative 段落)
  const opps = s3.opportunityDirections;
  if (opps?.length) {
    const { segments: oppSegs, content: oppContent } = cardsToNarrative(
      opps.map((o: any) => ({ title: o.direction ?? "", description: o.rationale ?? "" })),
      "opportunityDirections"
    );
    blocks.push({
      id: nextBlockId(), type: "narrative",
      title: "#### 2.3 品牌机会方向",
      content: oppContent,
      segments: oppSegs,
      sourceFields: [sf("opportunityDirections", "机会方向", opps, "card-list", 3)],
      editable: true,
    } satisfies NarrativeBlock);
  }

  return blocks;
}

function buildChapter03(knowledge: BrandKnowledge): ReportBlock[] {
  const s4 = knowledge.stages[4];
  if (!s4) return [];
  const blocks: ReportBlock[] = [];

  // 3.1 目标消费者定义
  const tcParts = [
    { text: s4.targetConsumer?.definition, fieldPath: "targetConsumer.definition" },
    { text: s4.targetConsumer?.idealSelfReflection, fieldPath: "targetConsumer.idealSelfReflection" },
  ];
  const tcOverride = getSection(knowledge, 4, "目标消费者定义");
  const { segments: tcSegs, content: tcContent } = tcOverride
    ? mkSegments([{ text: tcOverride, fieldPath: "__section_tc" }])
    : mkSegments(tcParts);
  if (tcContent) {
    blocks.push({
      id: nextBlockId(), type: "narrative", title: "#### 3.1 目标消费者定义", content: tcContent,
      segments: tcSegs,
      sourceFields: [
        sf("targetConsumer.definition", "消费者定义", s4.targetConsumer?.definition, "textarea", 4),
        sf("targetConsumer.idealSelfReflection", "理想自我映射", s4.targetConsumer?.idealSelfReflection, "textarea", 4),
      ],
      editable: true,
    } satisfies NarrativeBlock);
  }

  // 3.2 当前解决方案与不足 → 仅保留下方 supplyGap 表格

  // 3.3 深层需求分析
  const dnParts = [
    { text: s4.deepNeeds?.functionalNeed, fieldPath: "deepNeeds.functionalNeed" },
    { text: s4.deepNeeds?.identityNeed, fieldPath: "deepNeeds.identityNeed" },
  ];
  const dnOverride = getSection(knowledge, 4, "深层需求分析");
  const { segments: dnSegs, content: dnContent } = dnOverride
    ? mkSegments([{ text: dnOverride, fieldPath: "__section_dn" }])
    : mkSegments(dnParts);
  if (dnContent) {
    blocks.push({
      id: nextBlockId(), type: "narrative", title: "#### 3.3 深层需求分析", content: dnContent,
      segments: dnSegs,
      sourceFields: [
        sf("deepNeeds.functionalNeed", "功能需求", s4.deepNeeds?.functionalNeed, "textarea", 4),
        sf("deepNeeds.identityNeed", "身份认同需求", s4.deepNeeds?.identityNeed, "textarea", 4),
      ],
      editable: true,
    } satisfies NarrativeBlock);
  }

  // 现有解决方案 (supplyGap)
  const solutions = s4.existingSolutions;
  if (solutions?.length) {
    blocks.push({
      id: nextBlockId(), type: "supplyGap",
      title: "#### 3.2 当前解决方案与不足",
      columnDefs: colDefs([
        { key: "dimension", label: "解决路径", protected: true, fieldPath: "existingSolutions[].solutionType" },
        { key: "currentMarket", label: "采用方式", protected: false, fieldPath: "existingSolutions[].examples" },
        { key: "unmetNeed", label: "尚未满足", protected: false, fieldPath: "existingSolutions[].failReason" },
      ]),
      rows: solutions.map((s: any) => ({
        dimension: s.solutionType ?? "",
        currentMarket: s.examples ?? "",
        unmetNeed: s.failReason ?? "",
      })),
      sourceFields: [sf("existingSolutions", "现有解决方案", solutions, "card-list", 4)],
      editable: true,
    } satisfies SupplyGapBlock);
  }

  return blocks;
}

function buildChapter04(knowledge: BrandKnowledge): ReportBlock[] {
  const s5 = knowledge.stages[5];
  if (!s5) return [];
  const blocks: ReportBlock[] = [];

  // 4.1 竞争方向 → 仅保留下方 landscape 表格

  // 竞争方向 (landscape table)
  const dims = s5.competitiveLandscape?.dimensions;
  if (dims?.length) {
    blocks.push({
      id: nextBlockId(), type: "landscape",
      title: "#### 4.1 竞争方向",
      columns: [
        { key: "competitionType", label: "竞争类型", protected: true },
        { key: "representativeBrands", label: "代表品牌", protected: false },
        { key: "coreStrategy", label: "核心打法", protected: false },
        { key: "consumerNeed", label: "用户需求", protected: false },
      ],
      columnDefs: colDefs([
        { key: "competitionType", label: "竞争类型", protected: true, fieldPath: "competitiveLandscape.dimensions[].type" },
        { key: "representativeBrands", label: "代表品牌", protected: false },
        { key: "coreStrategy", label: "核心打法", protected: false, fieldPath: "competitiveLandscape.dimensions[].coreStrategy" },
        { key: "consumerNeed", label: "用户需求", protected: false, fieldPath: "competitiveLandscape.dimensions[].consumerNeed" },
      ]),
      rows: dims.map((d: any) => ({
        competitionType: d.type ?? "",
        representativeBrands: Array.isArray(d.representativeBrands) ? d.representativeBrands.join("、") : (d.representativeBrands ?? ""),
        coreStrategy: d.coreStrategy ?? "",
        consumerNeed: d.consumerNeed ?? "",
      })),
      sourceFields: [sf("competitiveLandscape.dimensions", "竞争方向", dims, "table", 5)],
      editable: true,
    } satisfies LandscapeBlock);
  }

  // 4.2 竞品分析 → 仅保留下方 comparison 表格

  // 竞品分析 (comparison table)
  const competitors = s5.competitors;
  if (competitors?.length) {
    const columns: ComparisonTableColumn[] = [
      { key: "brand", label: "品牌", protected: true },
      { key: "positioning", label: "定位", protected: false },
      { key: "keySellingPoint", label: "核心卖点", protected: false },
      { key: "strengths", label: "优势", protected: false },
      { key: "weaknesses", label: "短板", protected: false },
      { key: "opportunityGap", label: "可突破空间", protected: false },
    ];
    blocks.push({
      id: nextBlockId(), type: "comparison", title: "#### 4.2 竞品分析", columns,
      columnDefs: colDefs([
        { key: "brand", label: "品牌", protected: true, fieldPath: "competitors[].name" },
        { key: "positioning", label: "定位", protected: false, fieldPath: "competitors[].positioning" },
        { key: "keySellingPoint", label: "核心卖点", protected: false },
        { key: "strengths", label: "优势", protected: false, fieldPath: "competitors[].strengths" },
        { key: "weaknesses", label: "短板", protected: false, fieldPath: "competitors[].weaknesses" },
        { key: "opportunityGap", label: "可突破空间", protected: false, fieldPath: "competitors[].opportunityGap" },
      ]),
      rows: competitors.map((c: any) => ({
        brand: c.name ?? "",
        cells: {
          brand: c.name ?? "",
          positioning: c.positioning ?? "",
          keySellingPoint: Array.isArray(c.heroProducts) ? c.heroProducts.map((p: any) => p.sellingPoint).join("；") : (c.heroProducts ?? ""),
          strengths: Array.isArray(c.strengths) ? c.strengths.join("；") : (c.strengths ?? ""),
          weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses.join("；") : (c.weaknesses ?? ""),
          opportunityGap: c.opportunityGap ?? "",
        },
      })),
      sourceFields: [sf("competitors", "竞品分析", competitors, "table", 5)],
      editable: true,
    } satisfies ComparisonBlock);
  }

  return blocks;
}

function buildChapter05(knowledge: BrandKnowledge): ReportBlock[] {
  const s6 = knowledge.stages[6];
  if (!s6) return [];
  const blocks: ReportBlock[] = [];

  // 5.1 品牌定位
  const posParts = [
    { text: s6.positioning, fieldPath: "positioning" },
  ];
  const posOverride = getSection(knowledge, 6, "品牌定位");
  const { segments: posSegs, content: posContent } = posOverride
    ? mkSegments([{ text: posOverride, fieldPath: "__section_pos" }])
    : mkSegments(posParts);
  if (posContent) {
    blocks.push({
      id: nextBlockId(), type: "narrative", title: "#### 5.1 品牌定位", content: posContent,
      segments: posSegs,
      sourceFields: [
        sf("positioning", "品牌定位", s6.positioning, "textarea", 6),
      ],
      editable: true,
    } satisfies NarrativeBlock);
  }

  // 价值主张 (supplyGap 表格)
  const vps = s6.valuePropositions;
  if (vps?.length) {
    blocks.push({
      id: nextBlockId(), type: "supplyGap",
      title: "#### 5.2 价值主张",
      columnDefs: colDefs([
        { key: "dimension", label: "价值层", protected: true, fieldPath: "valuePropositions[].level" },
        { key: "currentMarket", label: "价值主张", protected: false, fieldPath: "valuePropositions[].proposition" },
        { key: "unmetNeed", label: "战略推导", protected: false, fieldPath: "valuePropositions[].soWhatDerivation" },
      ]),
      rows: vps.map((vp: any) => ({
        dimension: vp.level === "functional" ? "功能价值" : vp.level === "emotional" ? "情绪价值" : "社会价值",
        currentMarket: vp.proposition ?? "",
        unmetNeed: vp.soWhatDerivation ?? "",
      })),
      sourceFields: [sf("valuePropositions", "价值主张", vps, "card-list", 6)],
      editable: true,
    } satisfies SupplyGapBlock);
  }

  // 5.3 品牌故事
  const storyParts = [
    { text: s6.brandStory?.struggleMoment, fieldPath: "brandStory.struggleMoment" },
    { text: s6.brandStory?.brandAction, fieldPath: "brandStory.brandAction" },
    { text: s6.brandStory?.brandRelationship, fieldPath: "brandStory.brandRelationship" },
  ];
  const storyOverride = getSection(knowledge, 6, "品牌故事");
  const { segments: storySegs, content: storyContent } = storyOverride
    ? mkSegments([{ text: storyOverride, fieldPath: "__section_story" }])
    : mkSegments(storyParts);
  if (storyContent) {
    blocks.push({
      id: nextBlockId(), type: "narrative", title: "#### 5.3 品牌故事", content: storyContent,
      segments: storySegs,
      sourceFields: [
        sf("brandStory.struggleMoment", "消费者困境", s6.brandStory?.struggleMoment, "textarea", 6),
        sf("brandStory.brandAction", "品牌行动", s6.brandStory?.brandAction, "textarea", 6),
        sf("brandStory.brandRelationship", "品牌关系", s6.brandStory?.brandRelationship, "textarea", 6),
      ],
      editable: true,
    } satisfies NarrativeBlock);
  }

  // 品牌人格 (narrative 段落)
  const bp = s6.brandPersonality;
  if (bp?.length) {
    const traitTags = bp.map((t: any) => t.trait ?? "").filter(Boolean);
    const { segments: bpSegs, content: bpContent } = tagsToNarrative(traitTags, "brandPersonality");
    blocks.push({
      id: nextBlockId(), type: "narrative",
      title: "#### 5.4 品牌人格",
      content: bpContent,
      segments: bpSegs,
      sourceFields: [sf("brandPersonality", "品牌人格特质", bp, "card-list", 6)],
      editable: true,
    } satisfies NarrativeBlock);
  }

  return blocks;
}

function buildChapter06(knowledge: BrandKnowledge): ReportBlock[] {
  const s7 = knowledge.stages[7];
  if (!s7) return [];
  const blocks: ReportBlock[] = [];

  // 6.1 视觉核心概念
  const ccParts = [
    { text: s7.coreConcept, fieldPath: "coreConcept" },
  ];
  const ccOverride = getSection(knowledge, 7, "视觉核心概念");
  const { segments: ccSegs, content: ccContent } = ccOverride
    ? mkSegments([{ text: ccOverride, fieldPath: "__section_cc" }])
    : mkSegments(ccParts);
  if (ccContent) {
    blocks.push({
      id: nextBlockId(), type: "narrative", title: "#### 6.1 视觉核心概念", content: ccContent,
      segments: ccSegs,
      sourceFields: [
        sf("coreConcept", "视觉核心概念", s7.coreConcept, "textarea", 7),
      ],
      editable: true,
    } satisfies NarrativeBlock);
  }

  const keywords = s7.keywords;
  if (keywords?.length) {
    const { segments: kwSegs, content: kwContent } = cardsToNarrative(
      keywords.map((k: any) => ({ title: k.keyword ?? "", description: k.rationale ?? "" })),
      "keywords"
    );
    blocks.push({
      id: nextBlockId(), type: "narrative",
      title: "#### 6.2 视觉关键词",
      content: kwContent,
      segments: kwSegs,
      sourceFields: [sf("keywords", "视觉关键词", keywords, "card-list", 7)],
      editable: true,
    } satisfies NarrativeBlock);
  }

  // 视觉语言系统 (cards) — 按维度拆分为 card-list
  const vs = s7.visualSystem;
  if (vs) {
    const dims = ["form", "color", "typography", "imagery", "material"] as const;
    const labels: Record<string, string> = {
      form: "形态语言", color: "色彩语言", typography: "字体语言",
      imagery: "图像语言", material: "材质语言",
    };
    const items = dims
      .filter((d) => vs[d] && (vs[d].choice || vs[d].perceptualTone || vs[d].exclusions))
      .map((d) => {
        const vd = vs[d];
        const parts: string[] = [];
        if (vd.choice) parts.push(vd.choice);
        if (vd.perceptualTone) parts.push(vd.perceptualTone);
        if (vd.exclusions) parts.push(`排除：${vd.exclusions}`);
        return { title: labels[d], description: parts.join("  ") };
      });
    // 将 visualSystem 按维度拆分为 card-list sourceFields
    const vsSourceFields = dims
      .filter((d) => vs[d])
      .map((d) => sf(`visualSystem.${d}`, labels[d], vs[d], "card-list", 7));
    if (items.length > 0) {
      blocks.push({
        id: nextBlockId(), type: "supplyGap",
        title: "#### 6.3 视觉语言系统",
        columnDefs: colDefs([
          { key: "dimension", label: "维度", protected: true, fieldPath: "visualSystem[].dimension" },
          { key: "currentMarket", label: "选择与感知调性", protected: false, fieldPath: "visualSystem[].choice" },
          { key: "unmetNeed", label: "排除项", protected: false, fieldPath: "visualSystem[].exclusions" },
        ]),
        rows: items.map((item: any) => ({
          dimension: item.title ?? "",
          currentMarket: item.description?.split("  排除：")[0] ?? item.description ?? "",
          unmetNeed: item.description?.includes("排除：") ? item.description.split("排除：")[1]?.trim() ?? "" : "",
        })),
        sourceFields: vsSourceFields.length > 0 ? vsSourceFields : [sf("visualSystem", "视觉语言系统", vs, "textarea", 7)],
        editable: true,
      } satisfies SupplyGapBlock);
    }
  }

  // 视觉禁区 (narrative 段落)
  const restrictions = s7.restrictions;
  if (restrictions?.length) {
    const { segments: resSegs, content: resContent } = cardsToNarrative(
      restrictions.map((r: any) => ({ title: r.exclusion ?? "", description: r.strategicRationale ?? "" })),
      "restrictions"
    );
    blocks.push({
      id: nextBlockId(), type: "narrative",
      title: "#### 6.4 视觉禁区",
      content: resContent,
      segments: resSegs,
      sourceFields: [sf("restrictions", "视觉禁区", restrictions, "card-list", 7)],
      editable: true,
    } satisfies NarrativeBlock);
  }

  return blocks;
}

function buildChapter07(knowledge: BrandKnowledge): ReportBlock[] {
  const s8 = knowledge.stages[8];
  if (!s8) return [];
  const blocks: ReportBlock[] = [];

  // 7.1 内容核心方向
  const cdParts = [
    { text: s8.coreDirection, fieldPath: "coreDirection" },
  ];
  const cdOverride = getSection(knowledge, 8, "内容核心方向");
  const { segments: cdSegs, content: cdContent } = cdOverride
    ? mkSegments([{ text: cdOverride, fieldPath: "__section_cd" }])
    : mkSegments(cdParts);
  if (cdContent) {
    blocks.push({
      id: nextBlockId(), type: "narrative", title: "#### 7.1 内容核心方向", content: cdContent,
      segments: cdSegs,
      sourceFields: [
        sf("coreDirection", "内容核心方向", s8.coreDirection, "textarea", 8),
      ],
      editable: true,
    } satisfies NarrativeBlock);
  }

  // 内容价值体系 (matrix)
  const cvs = s8.contentValueSystem;
  if (cvs?.length) {
    const stageLabels: Record<string, string> = {
      awareness: "认知", interest: "兴趣", trust: "信任", decision: "转化",
    };
    blocks.push({
      id: nextBlockId(), type: "matrix", title: "#### 7.2 内容价值体系",
      dimensions: cvs.map((c: any) => stageLabels[c.userStage] ?? c.userStage),
      brands: ["用户问题", "内容价值"],
      cells: cvs.map((c: any) => [c.userProblem ?? "", c.contentValue ?? ""]),
      sourceFields: [sf("contentValueSystem", "内容价值体系", cvs, "table", 8)],
      editable: true,
    } satisfies MatrixBlock);
  }

  // 内容主题方向 (supplyGap 表格)
  const themes = s8.themeDirections;
  if (themes?.length) {
    blocks.push({
      id: nextBlockId(), type: "supplyGap",
      title: "#### 7.3 内容主题方向",
      columnDefs: colDefs([
        { key: "dimension", label: "内容栏目", protected: true, fieldPath: "themeDirections[].pillar" },
        { key: "currentMarket", label: "核心目的", protected: false, fieldPath: "themeDirections[].corePurpose" },
        { key: "unmetNeed", label: "主题方向", protected: false, fieldPath: "themeDirections[].topicDirections" },
      ]),
      rows: themes.map((t: any) => ({
        dimension: t.pillar ?? "",
        currentMarket: t.corePurpose ?? "",
        unmetNeed: Array.isArray(t.topicDirections) ? t.topicDirections.join("、") : (t.topicDirections ?? ""),
      })),
      sourceFields: [sf("themeDirections", "内容主题方向", themes, "card-list", 8)],
      editable: true,
    } satisfies SupplyGapBlock);
  }

  // 渠道表达策略 (supplyGap 表格)
  const channels = s8.channelStrategy;
  if (channels?.length) {
    blocks.push({
      id: nextBlockId(), type: "supplyGap",
      title: "#### 7.4 渠道表达策略",
      columnDefs: colDefs([
        { key: "dimension", label: "平台", protected: true, fieldPath: "channelStrategy[].platform" },
        { key: "currentMarket", label: "内容形式", protected: false, fieldPath: "channelStrategy[].contentFormat" },
        { key: "unmetNeed", label: "表达重点", protected: false, fieldPath: "channelStrategy[].expressionFocus" },
      ]),
      rows: channels.map((ch: any) => ({
        dimension: PLATFORM_LABELS[ch.platform] ?? ch.platform ?? "",
        currentMarket: ch.contentFormat ?? "",
        unmetNeed: ch.expressionFocus ?? "",
      })),
      sourceFields: [sf("channelStrategy", "渠道表达策略", channels, "card-list", 8)],
      editable: true,
    } satisfies SupplyGapBlock);
  }

  return blocks;
}

const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: "小红书",
  douyin: "抖音",
  wechat: "微信",
};

/** 从 stage 的 sectionSummaries 中获取指定 section 的原文段落 */
function getSection(knowledge: BrandKnowledge, stage: number, sectionName: string): string | undefined {
  return knowledge.stages[stage]?.sectionSummaries?.[sectionName];
}

// ── 章节构建器注册 ────────────────────────────────────────

const CHAPTER_BUILDERS: Record<number, {
  sourceStage: number;
  title: string;
  subtitle: string;
  builder: (knowledge: BrandKnowledge) => ReportBlock[];
}> = {
  1: { sourceStage: 2, title: "品牌背景与战略方向", subtitle: "明确品牌起点与未来方向", builder: buildChapter01 },
  2: { sourceStage: 3, title: "市场机会", subtitle: "发现市场趋势与增长机会", builder: buildChapter02 },
  3: { sourceStage: 4, title: "消费者洞察", subtitle: "理解用户需求与行为动机", builder: buildChapter03 },
  4: { sourceStage: 5, title: "竞争判断", subtitle: "寻找竞争差异与品牌位置", builder: buildChapter04 },
  5: { sourceStage: 6, title: "品牌核心战略", subtitle: "建立品牌价值与战略选择", builder: buildChapter05 },
  6: { sourceStage: 7, title: "视觉策略", subtitle: "构建品牌感知与视觉表达", builder: buildChapter06 },
  7: { sourceStage: 8, title: "内容策略", subtitle: "连接用户关系与长期资产", builder: buildChapter07 },
};

// ── 辅助构建器 ────────────────────────────────────────────

// ── Cover / Summary / Blueprint Builders ──────────────────

function buildCoverData(knowledge: BrandKnowledge): CoverData {
  const s7 = knowledge.stages[7];
  return {
    brandName: knowledge.brandName,
    category: knowledge.category,
    colorKeywords: s7?.keywords?.map((k: any) => k.keyword) ?? [],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 从 S4 消费者定义中提取第一句（≤80 字）。
 *
 * 消费者定义通常是 AI 生成的完整画像（含功能需求、身份需求、使用场景等），
 * 摘要里放全文会过长。只取第一句，保证摘要里用户描述不超过 80 字。
 */
function extractCoreUser(s4: Record<string, any> | undefined): string {
  const def = s4?.targetConsumer?.definition ?? "";
  if (!def) return "";

  // 找第一个中文句号/问号/感叹号
  const sentenceEnd = def.search(/[。？！]/);
  if (sentenceEnd !== -1 && sentenceEnd > 4) {
    const firstSentence = def.substring(0, sentenceEnd + 1);
    if (firstSentence.length <= 80) return firstSentence;
  }

  // 第一句太长 → 断在最后一个逗号/顿号/空格
  const truncated = def.substring(0, 80);
  const lastBreak = Math.max(
    truncated.lastIndexOf("，"),
    truncated.lastIndexOf("、"),
    truncated.lastIndexOf(" ")
  );
  return lastBreak > 40 ? truncated.substring(0, lastBreak) : truncated;
}

/**
 * 构建执行摘要 fallback。
 *
 * 正常流程：执行摘要在 S8 完成后由 synthesizeExecutiveSummary() 独立合成，
 * 存入 Project.context.executiveSummary，assembleReport() 直接读取。
 *
 * 此函数是 fallback——仅当预合成数据不可用时（旧项目 / S8 未完成），
 * 用最精简的方式从现有字段提取一个基础摘要，避免报告完全空白。
 */
function buildFallbackExecutiveSummary(knowledge: BrandKnowledge): ExecutiveSummaryData {
  const s4 = knowledge.stages[4];
  const s5 = knowledge.stages[5];
  const s6 = knowledge.stages[6];
  const s8 = knowledge.stages[8];

  const fallback = (text: string, stage: number, field: string): ExecutiveSummaryField => ({
    text,
    sources: text ? [{ stage, field, quote: text.substring(0, 60) }] : [],
  });

  return {
    brandPositioning: fallback(
      s6?.positioning ?? "",
      6,
      "positioning"
    ),
    targetAudience: fallback(
      extractCoreUser(s4),
      4,
      "targetConsumer.definition"
    ),
    coreValue: fallback(
      s6?.valuePropositions?.find((vp: any) => vp.level === "emotional")?.proposition ?? "",
      6,
      "valuePropositions.emotional"
    ),
    differentiation: fallback(
      s5?.competitiveGap?.marketOpportunity ?? "",
      5,
      "competitiveGap.marketOpportunity"
    ),
    strategicDirection: fallback(
      s8?.coreDirection ?? "",
      8,
      "coreDirection"
    ),
  };
}

function buildBlueprint(knowledge: BrandKnowledge): BlueprintData {
  const s6 = knowledge.stages[6];
  const s7 = knowledge.stages[7];

  const emotionalVP = s6?.valuePropositions?.find((vp: any) => vp.level === "emotional");

  return {
    brandEssence: s6?.brandStory?.brandRelationship ?? "",
    brandMission: s6?.positioning ?? "",
    brandPositioning: s6?.positioning?.slice(0, 80) ?? "",
    brandPromise: emotionalVP?.proposition ?? "",
    brandPersonality: Array.isArray(s6?.brandPersonality) ? s6.brandPersonality.map((t: any) => t.trait).join("、") : (s6?.brandPersonality ?? ""),
    visualDirection: s7?.coreConcept ?? "",
  };
}

// ═══════════════════════════════════════════════════════════
// Report Assembly
// ═══════════════════════════════════════════════════════════

/**
 * 将 8 阶段结构化输出组装为 ReportContent。
 *
 * 流程：getBrandKnowledge → buildCover → buildExecutiveSummary → buildChapters → buildBlueprint
 *
 * @param projectId - 项目 ID
 * @param brandName - 品牌名
 * @param category - 品类
 * @param stageOutputs - 各阶段的 structuredOutput 映射 { stageNumber → output }
 * @returns ReportContent
 */
export async function assembleReport(
  projectId: string,
  brandName: string,
  category: string | undefined,
  stageOutputs: Record<number, Record<string, any>>,
  /** S8 完成后由 synthesizeExecutiveSummary() 预合成的执行摘要。不存在时退化为字段级 fallback。 */
  executiveSummary?: ExecutiveSummaryData,
  /** 用户对报告的自定义设置（block 排序、列排序）。不存在时使用默认顺序。 */
  customization?: ReportCustomization,
  /** 用户对报告展示层文本的覆盖（封面、标题、标签等）。 */
  reportOverrides?: Record<string, string>
): Promise<ReportContent> {
  resetBlockIdCounter();

  // Step 1: 合并 BrandKnowledge
  const knowledge = getBrandKnowledge(projectId, brandName, category, stageOutputs);

  if (knowledge.stagesReady === 0) {
    throw new Error("无可用阶段输出——至少需要 1 个阶段的 structuredOutput 才能组装报告");
  }

  // Step 2: 组装各部件
  const cover = buildCoverData(knowledge);
  const execSummary = executiveSummary ?? buildFallbackExecutiveSummary(knowledge);
  const blueprint = buildBlueprint(knowledge);

  // Step 3: 构建章节
  const chapters: ReportChapter[] = [];

  for (let chNum = 1; chNum <= 7; chNum++) {
    const def = CHAPTER_BUILDERS[chNum];
    if (!def) continue;

    // 检查该章节的源阶段是否已有数据
    if (!knowledge.stages[def.sourceStage]) continue;

    let blocks = def.builder(knowledge);
    if (blocks.length === 0) continue;

    // 应用用户自定义的 block 排序
    if (customization?.blockOrder[chNum]) {
      const order = customization.blockOrder[chNum];
      const blockMap = new Map(blocks.map((b) => [b.title, b]));
      const ordered: ReportBlock[] = [];
      for (const title of order) {
        const match = blockMap.get(title);
        if (match) {
          ordered.push(match);
          blockMap.delete(title);
        }
      }
      // 新增的 block 追加到末尾
      for (const remaining of blockMap.values()) {
        ordered.push(remaining);
      }
      blocks = ordered;
    }

    // 应用用户自定义的列排序（仅 comparison / landscape 类型）
    if (customization?.columnOrder) {
      blocks = blocks.map((b) => applyColumnOrder(b, customization.columnOrder));
    }

    // 应用用户自定义的行排序（5 种表格类型）
    if (customization?.rowOrder) {
      blocks = blocks.map((b) => applyRowOrder(b, customization.rowOrder));
    }

    chapters.push({
      number: chNum,
      title: def.title,
      subtitle: def.subtitle,
      sourceStage: def.sourceStage,
      blocks,
    });
  }

  // 应用用户对展示层文本的覆盖（封面标题、章节标题、block 标题等）
  const report: ReportContent = {
    cover,
    executiveSummary: execSummary,
    chapters,
    blueprint,
    brandName,
    generatedAt: new Date().toISOString(),
  };

  return reportOverrides ? applyOverrides(report, reportOverrides) : report;
}

/** 按 dot-path 设置嵌套对象字段。如 setNestedProperty(obj, "brandPositioning.text", "hello") */
function setNestedProperty(obj: Record<string, any>, dottedPath: string, value: string): void {
  const parts = dottedPath.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * 将用户对展示层文本的覆盖（reportOverrides）应用到已组装的 ReportContent。
 *
 * 覆盖路径格式：
 * - cover.{field}            → report.cover
 * - executiveSummary.{path}  → report.executiveSummary（支持嵌套如 brandPositioning.text）
 * - blueprint.{path}         → report.blueprint（支持嵌套如 footer.brandName）
 * - chapter.{n}.{field}      → report.chapters[n-1]
 * - block_{id}.title         → 搜索对应 block
 */
function applyOverrides(
  report: ReportContent,
  overrides: Record<string, string>,
): ReportContent {
  if (!overrides || Object.keys(overrides).length === 0) return report;

  // shallow clone + deep clone nested objects that will be mutated
  const r: ReportContent = {
    ...report,
    cover: { ...report.cover },
    executiveSummary: JSON.parse(JSON.stringify(report.executiveSummary)),
    blueprint: { ...report.blueprint },
    chapters: report.chapters.map((ch) => ({
      ...ch,
      blocks: ch.blocks.map((b) => ({ ...b })),
    })),
  };

  for (const [path, value] of Object.entries(overrides)) {
    if (typeof value !== "string" || value.length === 0) continue;

    if (path.startsWith("cover.")) {
      setNestedProperty(r.cover as any, path.slice(6), value);
    } else if (path.startsWith("executiveSummary.")) {
      setNestedProperty(r.executiveSummary as any, path.slice(18), value);
    } else if (path.startsWith("blueprint.")) {
      setNestedProperty(r.blueprint as any, path.slice(10), value);
    } else if (path.startsWith("chapter.")) {
      const m = path.match(/^chapter\.(\d+)\.(title|subtitle)$/);
      if (m) {
        const chNum = parseInt(m[1], 10);
        const field = m[2];
        const ch = r.chapters.find((c) => c.number === chNum);
        if (ch) (ch as any)[field] = value;
      }
    } else if (path.startsWith("block_")) {
      const m = path.match(/^(block_\d+)\.title$/);
      if (m) {
        const blockId = m[1];
        for (const ch of r.chapters) {
          const block = ch.blocks.find((b) => b.id === blockId);
          if (block) {
            block.title = value;
            break;
          }
        }
      }
    }
  }

  return r;
}

/** 对 comparison / landscape / matrix 类型的 block 应用列排序 */
function applyColumnOrder(
  block: ReportBlock,
  columnOrder: Record<string, string[]>
): ReportBlock {
  const order = columnOrder[block.id];
  if (!order || order.length === 0) return block;

  // comparison / landscape: columns 是 Array<{ key, label }>
  if (block.type === "comparison" || block.type === "landscape") {
    const colMap = new Map(block.columns.map((c) => [c.key, c]));
    const ordered: ComparisonTableColumn[] = [];
    for (const key of order) {
      const match = colMap.get(key);
      if (match) {
        ordered.push(match);
        colMap.delete(key);
      }
    }
    // 新增的列追加到末尾
    for (const remaining of colMap.values()) {
      ordered.push(remaining);
    }
    return { ...block, columns: ordered } as any;
  }

  // supplyGap: columns 可选存储在 block.columns，与 comparison/landscape 同结构
  if (block.type === "supplyGap") {
    if (!block.columns || block.columns.length === 0) return block;
    const colMap = new Map(block.columns.map((c) => [c.key, c]));
    const ordered: ComparisonTableColumn[] = [];
    for (const key of order) {
      const match = colMap.get(key);
      if (match) { ordered.push(match); colMap.delete(key); }
    }
    for (const remaining of colMap.values()) ordered.push(remaining);
    return { ...block, columns: ordered } as any;
  }

  // matrix: brands 是 string[]，cells[dimIdx][brandIdx] 需同步重排
  if (block.type === "matrix") {
    const brandIdxMap = new Map(block.brands.map((b, i) => [b, i]));
    const orderedBrands: string[] = [];
    const brandReorderMap = new Map<number, number>(); // oldIdx → newIdx
    const used = new Set<number>();

    for (const brand of order) {
      const oldIdx = brandIdxMap.get(brand);
      if (oldIdx !== undefined && !used.has(oldIdx)) {
        brandReorderMap.set(oldIdx, orderedBrands.length);
        orderedBrands.push(brand);
        used.add(oldIdx);
      }
    }
    // 未在 order 中的 brand 追加到末尾
    for (let i = 0; i < block.brands.length; i++) {
      if (!used.has(i)) {
        brandReorderMap.set(i, orderedBrands.length);
        orderedBrands.push(block.brands[i]);
      }
    }

    // 按新 brand 顺序重排 cells
    const orderedCells = block.cells.map((row) => {
      const newRow: string[] = [];
      // 按 oldIdx→newIdx 映射重建行
      for (let oldIdx = 0; oldIdx < block.brands.length; oldIdx++) {
        const newIdx = brandReorderMap.get(oldIdx);
        if (newIdx !== undefined) {
          newRow[newIdx] = row[oldIdx] ?? "";
        }
      }
      return newRow;
    });

    return {
      ...block,
      brands: orderedBrands,
      cells: orderedCells,
    } as any;
  }

  return block;
}

/** 对表格 block 应用行排序 */
function applyRowOrder(
  block: ReportBlock,
  rowOrder: Record<string, string[]>
): ReportBlock {
  const order = rowOrder[block.id];
  if (!order || order.length === 0) return block;

  if (block.type === "comparison" || block.type === "landscape" ||
      block.type === "supplyGap" || block.type === "decisionDimension") {
    const rowMap = new Map(block.rows.map((r) => {
      const key = (r as any).brand ?? (r as any).competitionType ?? (r as any).dimension ?? "";
      return [key, r];
    }));
    const ordered: any[] = [];
    for (const key of order) {
      const match = rowMap.get(key);
      if (match) { ordered.push(match); rowMap.delete(key); }
    }
    for (const remaining of rowMap.values()) ordered.push(remaining);
    return { ...block, rows: ordered } as any;
  }

  if (block.type === "matrix") {
    // Matrix: 三个并行数组同步重排
    const dimMap = new Map(block.dimensions.map((d, i) => [d, i]));
    const orderedDims: string[] = [];
    const orderedCells: string[][] = [];
    const orderedBest: (number | undefined)[] = [];
    const used = new Set<number>();

    for (const key of order) {
      const idx = dimMap.get(key);
      if (idx !== undefined && !used.has(idx)) {
        orderedDims.push(block.dimensions[idx]);
        orderedCells.push(block.cells[idx] ?? []);
        orderedBest.push(block.bestPerRow?.[idx]);
        used.add(idx);
      }
    }
    // 未在 order 中的维度追加到末尾
    for (let i = 0; i < block.dimensions.length; i++) {
      if (!used.has(i)) {
        orderedDims.push(block.dimensions[i]);
        orderedCells.push(block.cells[i] ?? []);
        orderedBest.push(block.bestPerRow?.[i]);
      }
    }

    return {
      ...block,
      dimensions: orderedDims,
      cells: orderedCells,
      bestPerRow: orderedBest.length > 0 ? orderedBest : undefined,
    } as any;
  }

  return block;
}

// ═══════════════════════════════════════════════════════════
// Report Audit
// ═══════════════════════════════════════════════════════════

/**
 * 报告级质量审核 — 包装 qualityCheck + runFinalAudit。
 *
 * @param report - 已组装的 ReportContent
 * @param stageOutputs - 各阶段输出（供 Final Audit 使用）
 * @returns ReportAuditResult
 */
export function auditReport(
  report: ReportContent,
  stageOutputs: Record<number, Record<string, any>>
): ReportAuditResult {
  const issues: ReportAuditResult["issues"] = [];

  // 1. 对全文文本执行违规检测
  const allText = [
    ...report.chapters.flatMap((ch) => ch.blocks.map((b) => {
      if (b.type === "narrative") return b.content;
      if (b.type === "cards") return b.items.map(i => `${i.title} ${i.description}`).join(" ");
      if (b.type === "tags") return b.tags.join(" ");
      return "";
    })),
    report.executiveSummary.brandPositioning.text,
    report.executiveSummary.coreValue.text,
    report.blueprint.brandEssence,
    report.blueprint.brandMission,
    report.blueprint.brandPromise,
  ].join("\n");

  const qc = qualityCheck(allText);
  for (const v of qc.violations) {
    issues.push({
      severity: "warning",
      category: v.category,
      message: `${v.match} — ${v.suggestion}`,
    });
  }

  // 2. 章节完整性检查
  const expectedChapters = 7;
  if (report.chapters.length < expectedChapters) {
    issues.push({
      severity: "warning",
      category: "completeness",
      message: `报告仅包含 ${report.chapters.length}/${expectedChapters} 章，内容不完整`,
    });
  }

  // 3. 关键字段非空检查
  if (!report.blueprint.brandEssence) {
    issues.push({ severity: "warning", category: "completeness", message: "品牌本质（brandEssence）缺失" });
  }
  if (!report.blueprint.brandPersonality) {
    issues.push({ severity: "warning", category: "completeness", message: "品牌人格（brandPersonality）缺失" });
  }

  const errors = issues.filter(i => i.severity === "error");
  const score = Math.max(0, 100 - errors.length * 15 - issues.filter(i => i.severity === "warning").length * 5);

  return {
    score,
    passed: errors.length === 0,
    summary: errors.length > 0
      ? `发现 ${errors.length} 个严重问题和 ${issues.length - errors.length} 个提醒`
      : issues.length > 0
        ? `报告质量良好（${issues.length} 个优化建议）`
        : "报告质量优秀",
    issues: issues.slice(0, 10),
  };
}

// ═══════════════════════════════════════════════════════════
// Final Audit — 跨阶段引用完整性
// ═══════════════════════════════════════════════════════════

/**
 * Final Audit — 报告组装前的终极跨阶段检查。
 *
 * 遍历完整依赖图，对每个阶段的关键引用字段执行 Layer A 级别的
 * 引用完整性检查（纯代码）。
 */
export async function runFinalAudit(
  projectId: string,
  stageOutputs: Record<number, Record<string, any>>
): Promise<FinalAuditResult> {
  const issues: FinalAuditIssue[] = [];
  const availableStages = new Set(
    Object.keys(stageOutputs).map(Number).filter((s) => s >= 1 && s <= 8)
  );

  // ── 1: S6 reasoning 引用完整性 ──────────────────────
  const s6 = stageOutputs[6];
  if (s6?.reasoning) {
    const refChecks = [
      { field: "marketOpportunityReference", label: "S3 市场机会", upstreamStage: 3 },
      { field: "consumerInsightReference", label: "S4 消费者洞察", upstreamStage: 4 },
      { field: "competitiveGapReference", label: "S5 竞争判断", upstreamStage: 5 },
    ];

    for (const check of refChecks) {
      const value = s6.reasoning[check.field];
      if (!value || typeof value !== "string" || value.length < 10 || value.includes("未追溯")) {
        issues.push({
          stage: 6,
          severity: "error",
          field: `reasoning.${check.field}`,
          message: `S6 定位对 ${check.label}（S${check.upstreamStage}）的引用缺失或无效——无法验证战略推导链`,
          dependencyPath: `S${check.upstreamStage} → S6.reasoning.${check.field}`,
        });
      }
    }
  } else if (availableStages.has(6)) {
    issues.push({
      stage: 6,
      severity: "error",
      field: "reasoning",
      message: "S6 缺少 reasoning 字段——无法执行跨阶段引用完整性检查",
    });
  }

  // ── 2: S7 核心字段非空检查 ─────────────────────────
  if (availableStages.has(7)) {
    const s7 = stageOutputs[7];
    if (!s7?.coreConcept || (typeof s7.coreConcept === "string" && s7.coreConcept.trim().length < 5)) {
      issues.push({
        stage: 7,
        severity: "warning",
        field: "coreConcept",
        message: "S7 核心视觉概念为空或过短——视觉策略可能未完成推导",
        dependencyPath: "S6 → S7.coreConcept",
      });
    }
    if (!s7?.visualSystem) {
      issues.push({
        stage: 7,
        severity: "warning",
        field: "visualSystem",
        message: "S7 缺少视觉语言系统定义——视觉策略不完整",
      });
    }
  }

  // ── 3: S8 核心字段非空检查 ─────────────────────────
  if (availableStages.has(8)) {
    const s8 = stageOutputs[8];
    if (!s8?.coreDirection || (typeof s8.coreDirection === "string" && s8.coreDirection.trim().length < 5)) {
      issues.push({
        stage: 8,
        severity: "warning",
        field: "coreDirection",
        message: "S8 核心内容方向为空或过短——内容策略可能未完成推导",
        dependencyPath: "S6 → S8.coreDirection",
      });
    }
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    passed: !hasErrors,
    issues,
    summary: hasErrors
      ? `发现 ${issues.filter(i => i.severity === "error").length} 个 error 级引用问题和 ${issues.filter(i => i.severity === "warning").length} 个 warning——报告组装已暂停`
      : issues.length > 0
        ? `通过（${issues.length} 个 warning 级别提醒，不影响组装）`
        : "全部跨阶段引用检查通过",
  };
}

// ═══════════════════════════════════════════════════════════
// Combined: Audit + Assemble
// ═══════════════════════════════════════════════════════════

/**
 * 执行 Final Audit → 质量检查 → 组装报告（完整三步骤）。
 *
 * 这是报告组装的标准入口，供 CLI 和 API 调用。
 */
export async function assembleWithAudit(
  projectId: string,
  stageOutputs: Record<number, Record<string, any>>,
  brandName?: string,
  category?: string,
  executiveSummary?: ExecutiveSummaryData,
  customization?: ReportCustomization,
  reportOverrides?: Record<string, string>
): Promise<AssembleResult> {
  // Step 1: Final Audit
  const audit = await runFinalAudit(projectId, stageOutputs);

  if (!audit.passed) {
    const errorCount = audit.issues.filter((i) => i.severity === "error").length;
    return {
      report: null,
      audit,
      quality: null,
      suspended: true,
      suspendReason: `Final Audit 发现 ${errorCount} 个 error 级引用问题：${audit.summary}`,
    };
  }

  // Step 2: Assemble
  let report: ReportContent;
  try {
    report = await assembleReport(
      projectId,
      brandName ?? projectId,
      category,
      stageOutputs,
      executiveSummary,
      customization,
      reportOverrides
    );
  } catch (e: any) {
    return {
      report: null,
      audit,
      quality: null,
      suspended: true,
      suspendReason: `报告组装失败: ${e.message}`,
    };
  }

  // Step 3: Report-level audit + Quality Check
  const reportAudit = auditReport(report, stageOutputs);
  const allText = report.chapters
    .flatMap((ch) => ch.blocks.map((b) => {
      if (b.type === "narrative") return b.content;
      if (b.type === "cards") return b.items.map(i => `${i.title} ${i.description}`).join(" ");
      return "";
    }))
    .join("\n");
  const quality = qualityCheck(allText);

  return {
    report,
    audit,
    quality,
    suspended: false,
  };
}
