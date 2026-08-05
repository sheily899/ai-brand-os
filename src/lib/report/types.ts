/**
 * Report Types — 品牌策略报告完整类型定义
 *
 * 覆盖：
 * - 9 种 ReportBlock 内容块类型
 * - 7 章报告结构
 * - 封面 / 执行摘要 / 品牌蓝图
 * - 数据溯源（sourceFields）
 * - 编辑和自定义
 */

// ── 数据溯源 ──────────────────────────────────────────────

/** 内容块的字段级数据溯源 */
export interface SourceField {
  /** 数据在 StageResult.data 中的路径，如 "businessBackground.marketContext" */
  fieldPath: string;
  /** 对应 STAGE_DECISIONS 中的决策 ID */
  decisionId: string;
  /** 编辑面板中的显示名 */
  label: string;
  /** 原始值 */
  value: any;
  /** 编辑器类型 */
  editorType: EditorType;
}

export type EditorType = "textarea" | "list" | "card-list" | "table";

// ── 9 种内容块类型 ────────────────────────────────────────

export type ReportBlockType =
  | "narrative"
  | "cards"
  | "tags"
  | "comparison"
  | "landscape"
  | "supplyGap"
  | "matrix"
  | "decisionDimension"
  | "source";

/** 内容块基类 */
export interface ReportBlockBase {
  id: string;
  type: ReportBlockType;
  /** 板块标题（可选） */
  title?: string;
  /** 四级子标签（可选，用于 #### 级别） */
  subLabel?: string;
  /** 数据溯源 */
  sourceFields: SourceField[];
  /** 是否可编辑 */
  editable: boolean;
}

// ── narrative — 正文段落 ──────────────────────────────────

export interface NarrativeBlock extends ReportBlockBase {
  type: "narrative";
  /** 正文内容，支持多段落（whitespace-pre-line） */
  content: string;
  /** 段落级溯源：每个段落的文本 + 对应 fieldPath */
  segments?: Array<{
    text: string;
    fieldPath: string;
  }>;
  /** 可选：左侧竖线引用块（pull-quote） */
  pullQuote?: string;
}

// ── cards — 卡片网格 ─────────────────────────────────────

export interface CardItem {
  /** 卡片标签（如 "功能价值"、"情绪价值"） */
  label?: string;
  /** 卡片标题 */
  title: string;
  /** 卡片描述 */
  description: string;
  /** 扩展字段（自由 key-value） */
  extra?: Record<string, string>;
}

export interface CardsBlock extends ReportBlockBase {
  type: "cards";
  /** 1-3 列自适应网格 */
  columns?: 1 | 2 | 3;
  items: CardItem[];
}

// ── tags — 标签组 ────────────────────────────────────────

export interface TagsBlock extends ReportBlockBase {
  type: "tags";
  /** 标签文本列表 */
  tags: string[];
}

// ── comparison — 竞品对比表 ──────────────────────────────

export interface ComparisonTableColumn {
  key: string;
  label: string;
  /** 是否预设受保护列（不可删除） */
  protected: boolean;
}

/** 统一列定义——挂载在表格 block 上，用于编辑时判断实质性 vs 装饰性 */
export interface ColumnDef {
  key: string;
  label: string;
  protected?: boolean;
  /** 有 fieldPath → 实质性数据列，编辑时走 recordFieldEdit */
  fieldPath?: string;
}

export interface ComparisonRow {
  /** 品牌名 */
  brand: string;
  /** 列值映射 { columnKey → value } */
  cells: Record<string, string>;
}

export interface ComparisonBlock extends ReportBlockBase {
  type: "comparison";
  /** 列定义 */
  columns: ComparisonTableColumn[];
  /** 统一列定义（编辑判断用） */
  columnDefs?: ColumnDef[];
  /** 行数据 */
  rows: ComparisonRow[];
  /** 用户可自定义的额外列 */
  customColumns?: ComparisonTableColumn[];
}

// ── landscape — 竞争方向表格 ─────────────────────────────

export interface LandscapeRow {
  /** 竞争类型（如 "品类巨头"、"新锐品牌"） */
  competitionType: string;
  /** 代表品牌 */
  representativeBrands: string;
  /** 核心打法 */
  coreStrategy: string;
  /** 用户需求 */
  consumerNeed: string;
  /** 扩展字段 */
  extra?: Record<string, string>;
}

export interface LandscapeBlock extends ReportBlockBase {
  type: "landscape";
  /** 列定义（支持自定义扩展列） */
  columns: ComparisonTableColumn[];
  /** 统一列定义（编辑判断用） */
  columnDefs?: ColumnDef[];
  /** 行数据 */
  rows: LandscapeRow[];
}
// ── supplyGap — 供给缺口表 ───────────────────────────────

export interface SupplyGapRow {
  /** 维度名称（如 "体验缺口"、"解决路径"） */
  dimension: string;
  /** 当前市场提供 */
  currentMarket: string;
  /** 用户仍未满足 */
  unmetNeed: string;
  /** 用户自定义的额外列数据 */
  extra?: Record<string, string>;
}

export interface SupplyGapBlock extends ReportBlockBase {
  type: "supplyGap";
  /** 列定义（含预设列 + 用户自定义列） */
  columns?: ComparisonTableColumn[];
  /** 统一列定义（编辑判断用） */
  columnDefs?: ColumnDef[];
  rows: SupplyGapRow[];
}

// ── matrix — 竞品矩阵 ─────────────────────────────────────

export interface MatrixBlock extends ReportBlockBase {
  type: "matrix";
  /** 维度列表（行头） */
  dimensions: string[];
  /** 品牌列表（列头） */
  brands: string[];
  /** 矩阵数据 [dimensionIndex][brandIndex] → 值 */
  cells: string[][];
  /** 每行最优的品牌索引（用于 ★ 标记） */
  bestPerRow?: number[];
  /** 统一列定义（编辑判断用） */
  columnDefs?: ColumnDef[];
}

// ── decisionDimension — 消费者决策维度模型 ──────────────

export interface DecisionDimensionRow {
  /** 决策维度 */
  dimension: string;
  /** 消费者真正关注 */
  consumerConcern: string;
  /** 当前市场主要解决方式 */
  marketSolution: string;
  /** 当前不足 */
  gap: string;
}

export interface DecisionDimensionBlock extends ReportBlockBase {
  type: "decisionDimension";
  /** 统一列定义（编辑判断用） */
  columnDefs?: ColumnDef[];
  rows: DecisionDimensionRow[];
}

// ── source — 数据来源引用 ─────────────────────────────────

export interface SourceItem {
  /** 数据源标题/名称 */
  title: string;
  /** URL */
  url?: string;
  /** 检索日期 */
  retrievedAt?: string;
  /** 摘要 */
  summary?: string;
  /** 来源类型 */
  sourceType?: "full_text" | "snippet";
}

export interface SourceBlock extends ReportBlockBase {
  type: "source";
  sources: SourceItem[];
}

// ── 联合类型 ──────────────────────────────────────────────

export type ReportBlock =
  | NarrativeBlock
  | CardsBlock
  | TagsBlock
  | ComparisonBlock
  | LandscapeBlock
  | SupplyGapBlock
  | MatrixBlock
  | DecisionDimensionBlock
  | SourceBlock;

// ── 报告结构 ──────────────────────────────────────────────

/** 单章 */
export interface ReportChapter {
  /** 章编号 01-07 */
  number: number;
  /** 章节标题 */
  title: string;
  /** 副标题（定义该章解决什么问题） */
  subtitle: string;
  /** 数据来源阶段 */
  sourceStage: number;
  /** 内容块列表（可拖拽排序） */
  blocks: ReportBlock[];
}

/** 封面数据 */
export interface CoverData {
  brandName: string;
  category?: string;
  /** S7 视觉策略的色彩语言关键词，用于匹配色系 */
  colorKeywords?: string[];
  generatedAt: string;
}

/** 执行摘要单个字段 — 精炼文本 + 引用追溯 */
export interface ExecutiveSummaryField {
  /** 精炼后的展示文本（1-3句，直接渲染） */
  text: string;
  /** 引用来源追溯（内部使用，编辑面板可见，前端默认不展示） */
  sources: Array<{
    /** 源阶段编号 */
    stage: number;
    /** 源字段路径，如 "positioning" */
    field: string;
    /** 原字段中的关键原文摘录（≤60字，不得改写） */
    quote: string;
  }>;
}

/** 执行摘要数据 — S8 完成后由独立 LLM 合成步骤生成 */
export interface ExecutiveSummaryData {
  brandPositioning: ExecutiveSummaryField;
  targetAudience: ExecutiveSummaryField;
  coreValue: ExecutiveSummaryField;
  differentiation: ExecutiveSummaryField;
  strategicDirection: ExecutiveSummaryField;
}

/** 品牌蓝图数据 */
export interface BlueprintData {
  /** 品牌本质（S6 brandStory.brandRelationship） */
  brandEssence: string;
  /** 品牌使命（S6 positioning） */
  brandMission: string;
  /** 品牌定位（S6 positioning，截取） */
  brandPositioning: string;
  /** 品牌承诺（S6 valuePropositions 情感层） */
  brandPromise: string;
  /** 品牌人格（S6 brandPersonality 所有 trait 顿号连接） */
  brandPersonality: string;
  /** 视觉方向（S7 coreConcept） */
  visualDirection: string;
}

/** 完整报告内容 */
export interface ReportContent {
  /** 封面数据 */
  cover: CoverData;
  /** 执行摘要 */
  executiveSummary: ExecutiveSummaryData;
  /** 七章正文 */
  chapters: ReportChapter[];
  /** 品牌蓝图 */
  blueprint: BlueprintData;
  /** 品牌名 */
  brandName: string;
  /** 生成时间 */
  generatedAt: string;
}

// ── 报告自定义 ────────────────────────────────────────────

/** 报告文本覆盖 — path → 自定义文本，存储在 project.context.reportOverrides */
export type ReportOverrides = Record<string, string>;

/** 用户对报告的自定义设置（持久化到 Project.context） */
export interface ReportCustomization {
  /** 章节内 Block 排序：chapterNumber → blockId[] */
  blockOrder: Record<number, string[]>;
  /** 表格列排序：blockId → columnKey[] */
  columnOrder: Record<string, string[]>;
  /** 表格行排序：blockId → rowKey[]（natural key: brand / competitionType / dimension） */
  rowOrder: Record<string, string[]>;
}

// ── Final Audit（保持与现有 assemble.ts 兼容）────────────

export interface FinalAuditIssue {
  stage: number;
  severity: "error" | "warning";
  field: string;
  message: string;
  dependencyPath?: string;
}

export interface FinalAuditResult {
  passed: boolean;
  issues: FinalAuditIssue[];
  summary: string;
}

export interface AssembleResult {
  report: ReportContent | null;
  audit: FinalAuditResult;
  quality: import("./quality").QualityCheckResult | null;
  suspended: boolean;
  suspendReason?: string;
}

// ── Report-level quality audit ────────────────────────────

export interface ReportAuditResult {
  /** 报告质量分数 0-100 */
  score: number;
  /** 是否通过 */
  passed: boolean;
  /** 问题摘要 */
  summary: string;
  /** 问题详情列表（最多 10 条） */
  issues: Array<{
    severity: "error" | "warning";
    category: string;
    message: string;
    chapter?: number;
  }>;
}

// ── Brand Knowledge（8 阶段数据合并产物）─────────────────

/**
 * 8 阶段 JSON 数据合并后的统一知识对象。
 * 由 getBrandKnowledge() 从 stageOutputs 组装，
 * 供 assembleReport() 消费。
 */
export interface BrandKnowledge {
  projectId: string;
  brandName: string;
  category?: string;
  stages: Record<number, Record<string, any>>;
  /** 完成的阶段数 */
  stagesReady: number;
}
