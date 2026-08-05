/**
 * AI Quality Audit — 四维战略质量评估 V3.1（Phase 3）
 *
 * 职责：
 * - 每阶段 Convergence 完成后，调用 LLM 评估输出质量
 * - 四维评分：Specificity / Differentiation / Actionability / Evidence
 * - Evidence 升级为三维子维度模型：Presence / Reliability / Connection
 * - 每阶段独立权重（禁止平均分配）、门禁阈值、评分锚点
 * - 输出评分、问题、优化建议、门禁推荐
 *
 * 权重设计原则：
 * - S1/S2：Specificity+Evidence 主导（商业真实性和现实性验证）
 * - S3：Evidence 极高 35%（外部市场数据验证）
 * - S4：Evidence 极高 35%（行为证据验证）
 * - S5：Differentiation 全系统最高 40%（竞争差异发现）
 * - S6：Differentiation 35%+Actionability 25%（战略枢纽）
 * - S7：Differentiation 35%+Actionability 35%（视觉执行双驱动）
 * - S8：Actionability 全系统最高 45%（内容执行体系）
 *
 * Evidence 三维模型：
 * - Presence（证据存在性）：结论是否拥有明确来源？
 * - Reliability（证据可信度）：来源是否真实、有效、具有代表性？
 * - Connection（证据关联性）：证据是否真正支持当前战略判断？是否形成推理链？
 * - 不同阶段审查不同类型：S1商业真实性/S2商业现实性/S3外部市场依据/
 *   S4行为证据/S5竞争依据/S6战略推导链/S7战略一致性/S8用户需求基础
 *
 * 不负责：
 * - 格式/字段检查（Rule Check）
 * - 跨阶段语义检查（Task 3.3 Cross Stage Context Check Layer B）
 *
 * 红线：不发起独立 LLM 调用做跨阶段检查（Layer B 复用本调用）。
 *
 * 模型配置：
 * - 默认使用 deepseek-chat（与 consultation 相同）
 * - 设置 AUDIT_MODEL=deepseek-reasoner 可切换为推理模型独立审计
 */

import { getLLMProvider } from "@/lib/ai/provider";
import { recordUsageFromProvider, estimateCharCount } from "@/lib/ai/token-tracker";
import { normalizeJSON, fixCommonJSONErrors } from "@/lib/stage/normalizer";

// ── 类型定义 ──────────────────────────────────────────────

export type AuditDimension =
  | "specificity"
  | "differentiation"
  | "actionability"
  | "evidence";

export interface DimensionScore {
  dimension: AuditDimension;
  score: number;          // 1-5
  weight: number;         // 0-1, 四维和为 1
  weightedScore: number;  // score × weight × 20 → 归一化到 0-100
  reason: string;
  improvements: string[];
}

export interface AuditIssue {
  dimension: AuditDimension;
  severity: "critical" | "major" | "minor";
  description: string;
  suggestion: string;
  /**
   * 问题类型标注，用于 Reoptimize 分流决策：
   * - "expression": 表达问题 — 内容已有但表达不佳（模糊、结构差、不具体），通过改写可修复
   * - "data_gap": 数据缺口 — 底层数据/证据缺失（搜索无结果、无用户访谈数据、无外部报告），改写无法修复，需要重新搜索或人工补充
   */
  issueType: "expression" | "data_gap";
}

export interface AIAuditResult {
  stageNumber: number;
  dimensionScores: DimensionScore[];
  totalScore: number;          // 0-100 加权总分
  issues: AuditIssue[];
  gateRecommendation: "advance" | "reoptimize" | "block";
  needsHumanReview: boolean;
  /** 跨阶段语义检查结果（Layer B，null = 未触发） */
  crossStageSemantics: CrossStageSemantics | null;
}

/** Layer B 语义断裂检查结果（嵌入 AI Quality Audit 输出中） */
export interface CrossStageSemantics {
  hasIssues: boolean;
  issues: Array<{
    type: "semantic_break";
    severity: "warning" | "info";
    currentStageField: string;
    upstreamField: string;
    description: string;
    gapDetail?: string;
  }>;
}

// ── 阶段配置 ──────────────────────────────────────────────

/** 单维度评分锚点：1/3/5 分的可数、可核对标准 */
interface DimensionAnchors {
  score1: string;  // 1 分标准
  score3: string;  // 3 分标准
  score5: string;  // 5 分标准
}

interface StageAuditConfig {
  stageName: string;
  objective: string;
  weights: Record<AuditDimension, number>;
  advanceThreshold: number;
  reoptimizeThreshold: number;
  focusAreas: string[];
  acceptableEvidence: string[];
  /** 可选：每维度的可数评分锚点。未提供时使用通用 1-5 分描述。 */
  scoringAnchors?: Partial<Record<AuditDimension, DimensionAnchors>>;
}

// ──────────────────────────────────────────────────────────────
// S1-S8 阶段差异化审计标准 V3.1
//
// 设计原则：
// - 四维框架统一，权重按阶段战略目的重新分配（禁止平均分配）
// - Evidence 升级为三维子维度模型：
//   Presence（证据存在性）：结论是否拥有明确来源？
//   Reliability（证据可信度）：来源是否真实、有效、具有代表性？
//   Connection（证据关联性）：证据是否真正支持当前战略判断？
// - 不同阶段 Evidence 审查不同类型：
//   S1 商业真实性 / S2 商业现实性 / S3 外部市场依据 / S4 行为证据
//   S5 竞争依据 / S6 战略推导链 / S7 战略一致性 / S8 用户需求基础
// ──────────────────────────────────────────────────────────────

const STAGE_AUDIT_CONFIGS: Record<number, StageAuditConfig> = {
  // ── S1: 用户访谈 ── Specificity+Evidence 主导 ─────────────
  1: {
    stageName: "用户访谈",
    objective: "从创始人输入中提取创业背景、初始想法、用户问题和商业假设",
    weights: { specificity: 0.35, differentiation: 0.10, actionability: 0.30, evidence: 0.25 },
    advanceThreshold: 70,
    reoptimizeThreshold: 50,
    focusAreas: [
      "创始人动机是否包含具体触发事件（时间/情境），而非「想做有意义的事」等泛泛表述",
      "用户问题是否基于创始人的具体观察（谁/何时/何种情境/发生了什么），而非假设",
      "约束条件是否被充分收集（资源/时间/能力/市场等维度）",
      "是否区分了已验证事实（创始人亲身经历/行为记录）与创始人个人推断（未经外部验证的判断）",
    ],
    acceptableEvidence: ["创始人具体经历", "用户反馈原文", "已有销售或运营数据", "真实市场行为记录"],
    scoringAnchors: {
      specificity: {
        score1: '创始动机为单句概括，缺少具体触发事件、个人经历、时间节点。用户问题为假设性描述，无具体观察支撑',
        score3: '创始动机含 ≥1 个触发事件（时间/情境），用户问题基于 ≥1 条具体观察（人/时/境/事），≥1 个约束条件',
        score5: '创始动机含完整叙事链（事件→反思→决定），≥2 条观察含四要素，约束覆盖 ≥2 个维度且说明对决策的影响',
      },
      differentiation: {
        score1: '未区分事实与假设，创始人独特资源/视角/经历未被提取。所有判断为「我觉得」级别',
        score3: '≥2 个判断标注了信息可信度层级（已验证事实/创始人推断/待验证假设），创始人有一个初步差异化方向且有个人经历支撑',
        score5: '所有判断有可信度标注，差异化假设有 ≥1 条独特资源/经历支撑，创始人类型判断有行为证据',
      },
      actionability: {
        score1: '停留在创始人自述复述，未提取可指导后续阶段的结论或待验证问题',
        score3: '≥2 个可被 S2/S3 消费的明确假设（含验证逻辑），约束条件可转化为项目边界',
        score5: '完整初始战略假设集，每个假设有验证路径标注（S3验证/S4验证），可直接作为 S2 起点',
      },
      evidence: {
        score1: '来源缺失：无任何来源标注，全为 AI 推断。可信度：无法区分「创始人说的」「创始人做的」和「AI推断的」。推理链：证据与判断之间无任何逻辑链',
        score3: '来源：≥2 个判断标注了来源类型（经历/反馈/数据）。可信度：≥1 个来源可追溯（有时间/渠道/上下文）。推理链：≥1 个判断与其来源可形成因果链（「因为创始人经历了X→所以判断Y」）',
        score5: '来源：所有核心判断有具体来源（时间/渠道/原话/行为记录），已验证事实、创始人推断、待验证假设三层均有覆盖。可信度：来源多元（≥2 种类型），可直接验证。推理链：创始人经历→用户问题→初始假设形成完整因果链，每层推理有对应证据锚点',
      },
    },
  },

  // ── S2: 商业背景分析 ── Actionability+Evidence 主导 ──────
  2: {
    stageName: "商业背景分析",
    objective: "明确商业模式、产品基础、当前阶段和战略挑战",
    weights: { specificity: 0.30, differentiation: 0.10, actionability: 0.35, evidence: 0.25 },
    advanceThreshold: 70,
    reoptimizeThreshold: 50,
    focusAreas: [
      "商业模式是否说清了产品形态、收入来源、交付方式和当前阶段（idea/MVP/growth/scale）",
      "战略挑战是否具体到可操作的问题层面（非「竞争激烈」「市场不确定」等通用表述）",
      "方向假设是否体现了创始人的独特判断（「因为看到X，所以认为应该做Y」）",
      "行业背景是否包含了可验证的具体信息而非常识性描述",
    ],
    acceptableEvidence: ["产品运营数据", "用户反馈", "创始团队经验", "行业可比案例", "已有业务指标"],
    scoringAnchors: {
      specificity: {
        score1: '商业模式为单句标签（「做电商」「做SaaS」），未说明产品形态/收入模式/交付方式。战略挑战为通用表述',
        score3: '明确产品形态、收入来源/交付方式、当前阶段。战略挑战具体到 ≥2 个可操作层面（含具体数据或行为描述）。≥1 个可验证的行业信息',
        score5: '商业模式含具体数字或可比参照（客单价/毛利率/渠道结构），有收入模型推演。战略挑战有优先级排序和取舍逻辑。≥2 个可验证的行业信息点',
      },
      differentiation: {
        score1: '战略方向为品类通用，与 S1 创始人经历无逻辑关联，未体现创始人独特判断或独有资源',
        score3: '≥1 个方向假设体现创始人独特认知或资源，与 S1 创始经历有明确逻辑关联',
        score5: '方向假设构成自洽战略叙事（经验+问题+资源→选择A而非B），明确了一个不做的方向及原因',
      },
      actionability: {
        score1: '无法判断优先级，待验证假设不明确，所有方向权重相同',
        score3: '≥2 个待验证假设有优先级排序，每个方向有验证说明，可转化为 S3 研究问题',
        score5: '清晰战略选择逻辑（含约束分析），假设均可转化为 S3 问题，有项目边界和阶段目标',
      },
      evidence: {
        score1: '来源：无事实基础，均为创始人主观表述或 AI 推断。可信度：未区分「已有事实」和「计划设想」，无法验证。推理链：商业描述与战略方向之间无推理链',
        score3: '来源：≥2 个判断有事实支撑（数据/反馈/指标/经验），区分已验证与待验证。可信度：≥1 个事实可验证（有具体数字或可比参照）。推理链：≥1 条判断链（「现有X→约束Y→所以应该Z」）',
        score5: '来源：产品现状有具体数据支撑（月活/复购率/NPS等），商业模式判断可追溯到行业案例。可信度：≥2 个独立来源交叉验证核心判断，数据有时效性和代表性。推理链：完整推理链：现有基础→战略约束→方向选择→验证路径，每步有事实锚点',
      },
    },
  },

  // ── S3: 市场机会 ── Evidence 极高权重 35% ──────────
  3: {
    stageName: "市场机会分析",
    objective: "找到真实市场机会，基于数据而非直觉",
    // Evidence=35%：S3 的核心价值在于市场判断有外部数据支撑（从40%调降以提升一般质量案例的可通过性）
    weights: { specificity: 0.25, differentiation: 0.20, actionability: 0.20, evidence: 0.35 },
    advanceThreshold: 70,
    reoptimizeThreshold: 55,
    focusAreas: [
      "市场范围是否明确了品类边界、地域范围、规模量级（非「市场很大」）",
      "消费趋势是否包含具体行为变化或数据变化（非「健康趋势」「年轻化」等常识）",
      "市场机会方向是否区分了有数据支撑的结论、基于数据推断的见解、待验证假设三种可信度层级",
      "体验缺口是否具体到用户场景和行为（「用户在X场景下的Y行为表明存在Z缺口」）",
    ],
    acceptableEvidence: ["行业报告（含名称/年份/数据点）", "搜索趋势关键词", "消费数据", "渠道数据", "竞品市场表现数据", "用户行为平台数据"],
    scoringAnchors: {
      specificity: {
        score1: '市场描述泛泛而谈，无具体范围/规模/增长趋势。品类定义模糊（「健康食品市场」而非「即食功能性零食在二线城市的300亿细分」）',
        score3: '明确市场范围（品类边界/地域/规模量级），≥1 个趋势含具体行为或数据变化（非常识性），区分有数据支撑/基于推断/待验证假设',
        score5: '含具体数据（规模/增速/细分占比），≥2 个趋势有外部来源+具体数字，≥2 个体验缺口具体到用户场景（谁/什么情况/什么问题/现有方案/为何不够好）',
      },
      differentiation: {
        score1: '市场方向为品类常识（「健康化」「年轻化」「高端化」），任何品牌的同类分析都能得出相同结论',
        score3: '≥1 个非显性发现或对常识的独特品类解读，与 S2 战略方向有逻辑衔接',
        score5: '构建独特品类理解框架（重新定义边界或分类），≥2 个排他性判断（「大多数人认为X，但数据显示Y」），为 S4 提供聚焦方向',
      },
      actionability: {
        score1: '市场判断与品牌决策无连接，不知针对哪个机会、如何验证',
        score3: '≥2 个机会有优先级和验证路径（「优先验证A因为X，方式为Y」），有「如果X则Y」决策逻辑',
        score5: '完整行动框架：优先级→验证方式→所需资源→进入路径。直接指导 S4 研究方向。≥1 个机会有时间窗口标注',
      },
      evidence: {
        score1: '来源：无任何外部来源，所有数据为 AI 常识推断，无报告名称/年份/数据点。可信度：无。来源均为虚构或不可验证。推理链：无。市场判断与品牌机会之间无推理链',
        score3: '来源：≥2 个判断有具体来源标注（报告名称/年份/平台），≥1 个数据点可直接验证（数字+来源+时间）。可信度：来源基本可信，但可能单一或时效性不确定，有局限说明。推理链：≥1 条清晰推理链「数据X+趋势Y→机会Z」，区分有数据支撑和基于推断的判断',
        score5: '来源：所有核心判断有可溯源来源（名称/时间/渠道/数据点），≥2 个独立来源交叉验证。可信度：来源权威/时效性好/样本有代表性，明确标注数据局限和推断边界。推理链：完整推理链贯穿：多源数据→趋势判断→机会识别→品牌适配分析。数据受限时明确标注推断属性',
      },
    },
  },

  // ── S4: 消费者洞察 ── Specificity+Evidence 主导 ──────────
  4: {
    stageName: "消费者洞察",
    objective: "理解消费者为什么购买，区分功能需求和身份认同需求",
    weights: { specificity: 0.30, differentiation: 0.20, actionability: 0.15, evidence: 0.35 },
    advanceThreshold: 70,
    reoptimizeThreshold: 55,
    focusAreas: [
      "消费者描述是否从人口标签深入到决策动机和行为特征（在什么场景下、为什么产生需求、如何做决策）",
      "功能层需求（functionalNeeds）与身份认同层需求（identityNeeds）是否清晰区分且不重复",
      "现有解决方案的 failReason 是否具体到用户行为（「用户试过X但放弃因为Y」而非「用户不满意」）",
      "洞察推导链是否完整：原始信息 → 行为事实 → 深层需求判断 → 品牌启示",
    ],
    acceptableEvidence: ["用户访谈原文", "用户评论/评价分析", "购买行为记录", "使用场景观察", "内容反馈（收藏/评论/分享行为）"],
    scoringAnchors: {
      specificity: {
        score1: '消费者定义停留在人口属性标签（年龄/职业/兴趣），缺决策场景/行为路径/购买动机。可适用于任何同类消费者',
        score3: '含 ≥1 个消费场景（时/地/情境），≥1 个行为特征（选择/比较/购买/放弃），≥1 个明确决策动机（非通用表述）。区分「谁在用」和「谁在买」',
        score5: '≥2 个消费场景含完整行为链（触发→选择→替代→放弃→满意条件），决策动机有用户原话支撑。解释「为什么这样选择」而非仅描述「做了什么」',
      },
      differentiation: {
        score1: '需求为品类通用（好用/品质好），identityNeeds=彰显品味/体现个性，无法体现目标用户的独特心理',
        score3: '明确区分 functional/identity 需求，identityNeeds 含 ≥1 个非显性洞察（用户自己未意识到的深层动机）',
        score5: 'identityNeeds ≥2 个洞察有行为/语言支撑，解释目标用户与普通消费者的关键差异，发现品类默认之外的隐藏需求',
      },
      actionability: {
        score1: '洞察停留在描述层面（「用户希望品牌更有吸引力」），无法转化为品牌决策',
        score3: '≥2 个洞察对应品牌含义（「用户看重X→存在Y问题→品牌应强调Z」），格式完整',
        score5: '所有洞察有品牌映射（定位/产品/传播），标注可立即应用 vs 需验证，为 S6 提供选择理由素材',
      },
      evidence: {
        score1: '来源：无用户反馈原文/行为观察/访谈记录，所有判断为 AI 常识推断。无法区分事实和推测。可信度：无。推理链：洞察与证据之间无推理链',
        score3: '来源：≥2 个洞察有来源支持（原话/反馈/观察/记录），区分已验证事实、创始人推断、待验证假设。可信度：≥1 个来源有行为记录支撑（非纯主观），failReason 有行为解释。推理链：≥1 条完整推理链「观察行为→解释行为→深层需求→品牌启示」',
        score5: '来源：≥4 个洞察有具体证据，≥2 个不同来源交叉验证核心判断。可信度：用户原话/真实行为（购买/使用/放弃）覆盖核心判断，不依赖单一来源，样本有代表性。推理链：每个洞察有完整推理链，消费行为→需求判断→品牌启示的每一步都有证据锚点',
      },
    },
  },

  // ── S5: 竞争判断 ── Differentiation 全系统最高 40% ───────
  5: {
    stageName: "竞争判断",
    objective: "找到竞争位置和品牌差异化机会",
    // Differentiation=40%：S5 的核心价值在于发现真正排他的差异机会
    weights: { specificity: 0.20, differentiation: 0.40, actionability: 0.25, evidence: 0.15 },
    advanceThreshold: 70,
    reoptimizeThreshold: 55,
    focusAreas: [
      "竞品选择是否有明确逻辑（覆盖哪些竞争方向/为什么选这些），而非「选了3个知名品牌」",
      "竞品分析是否深入到具体 weakness 和 opportunityGap——每个弱点能否追溯到用户评价原文或产品功能缺失",
      "市场空位是否定义了具体竞争维度（「竞品在X维度做到Y水平，但没有人解决Z问题」）",
      "差异化方向是否具有排他性（「我们在竞品做不到的方向上建立标准」而非「我们比竞品更好」）",
    ],
    acceptableEvidence: ["竞品用户评价原文", "产品功能对比分析", "价格/渠道/服务对比", "竞品市场行为观察", "用户切换行为分析"],
    scoringAnchors: {
      specificity: {
        score1: '竞品名单无选择逻辑，分析停留在表面描述（「A品牌做得好」「B品牌价格低」），未深入到 weakness/gap',
        score3: '竞品有选择理由且覆盖 ≥2 个竞争方向。≥2 个竞品含具体 weakness（可追溯到评价或功能缺失）。有竞争维度定义',
        score5: '覆盖 ≥3 个竞争方向各有代表性品牌。每个 weakness 有 ≥1 条评价原文/功能对比支撑。marketOpportunity 可追溯到具体缺口',
      },
      differentiation: {
        score1: '差异化为品类通用（「更好」「更懂年轻人」「服务更贴心」），未发现真正心智空位，任何品牌都可复用',
        score3: '≥1 个市场空位具体到竞争维度。与 S4 未满足需求有逻辑关联。≥1 个 gap 是竞品难以快速模仿的',
        score5: '心智空位有完整竞争证据支撑（「竞品A/B/C均未解决X→品牌可在X建立认知差异」）。差异化具有排他性——「不同且难以跟进」。≥2 条差异可追溯到竞品用户评价的具体抱怨',
      },
      actionability: {
        score1: '停留在分析层面（「A是市场领导者」），不知如何转化为品牌定位或产品策略',
        score3: '≥2 个 opportunityGap 对应品牌行动方向（「竞品X不足→我们建Y→做法Z」），可转化为 S6 选择理由素材',
        score5: '每个 gap 有行动建议和优先级，差异化可直接作为 S6 核心输入，输出含竞争策略类型判断（成本领先/差异化/聚焦）及理由',
      },
      evidence: {
        score1: '来源：无证据——所有评价为 AI 常识（「A是领先品牌」「B品质好」），无评价原文/对比数据/市场观察。可信度：无。推理链：无。判断与证据之间无推理链',
        score3: '来源：≥2 个竞品判断有具体证据（评价原文/功能对比/价格分析/渠道观察），≥1 个 gap 可追溯到竞品具体缺陷。可信度：证据可溯源（有时效性和上下文），但可能未覆盖所有判断。推理链：≥1 条完整推理链「竞品X缺失→用户抱怨Y→我们的机会Z」',
        score5: '来源：每个竞品核心判断有 ≥1 条可溯源证据，市场空位有 ≥2 个独立来源支撑。可信度：证据多元（评价原文+产品对比+行为观察），来源具有代表性，证据缺口明确标注。推理链：完整证据链：S4用户需求+竞品缺失→市场空位→差异化机会。每步推导有证据锚点。不完整时标注证据缺口',
      },
    },
  },

  // ── S6: 品牌核心战略 ── Differentiation+Actionability 主导 ─
  6: {
    stageName: "品牌核心战略",
    objective: "形成完整的品牌定位系统，承接前序全部洞察",
    // Differentiation=35%：定位的本质是选择不做什么
    // Evidence=15% 审查战略推导链（S3→S4→S5→S6），非外部数据
    weights: { specificity: 0.25, differentiation: 0.35, actionability: 0.25, evidence: 0.15 },
    advanceThreshold: 75,
    reoptimizeThreshold: 60,
    focusAreas: [
      "定位陈述句四要素（为谁服务/解决什么问题/提供什么价值/为什么选择你）是否各自具体且可验证",
      "三层价值主张是否各自独立且有递进——functional≠emotional≠social，不存在语义重复",
      "品牌人格特质是否包含可测试的行为约束（dos/donts 能评审设计稿/文案，排除具体设计选择）",
      "战略推导链是否形成逻辑闭环：S3市场机会→S4消费者洞察→S5竞争空位→S6品牌定位，每个环节有显式引用",
    ],
    acceptableEvidence: ["S3 市场机会字段引用", "S4 消费者洞察字段引用", "S5 竞争空位字段引用", "S1 创始人经历", "S2 商业约束"],
    scoringAnchors: {
      specificity: {
        score1: '定位缺要素或为通用词汇拼接。品牌故事为模板化叙事。品牌人格为形容词堆砌（「专业/创新/温暖」）',
        score3: '四要素齐全（目标消费者含行为特征/品类有边界/价值非通用/理由有逻辑链），VP三层独立不重复，≥5 个特质各有 dos/donts',
        score5: '可作为创意简报独立使用。目标消费者含 ≥2 个行为特征+场景。品牌故事有叙事逻辑（moment+action+relationship）。≥3 个特质 dos/donts 可转化为评审 checklist',
      },
      differentiation: {
        score1: '定位换名可用于任意同类品牌。VP均为品类通用诉求。品牌人格为品类刻板印象。brandStory为通用模板',
        score3: '≥1 个差异化要素（独特人群/非默认属性/独有资源）。≥2 个特质可区分竞品。≥1 条 VP 触及未被表达的消费者需求',
        score5: '完整差异化系统——人群对应 S5 空位、价值形成认知差异、≥3 个特质成自洽体系、≥2 条 VP 可追溯到 S4/S5 具体 gap',
      },
      actionability: {
        score1: '无法指导 S7/S8——定位太模糊、dos/donts 不可测试（「做好产品」/「做不好产品」）、VP 无法生成内容主题',
        score3: '可写入创意简报：目标消费者定义能指导 S7 方向，≥3 个特质 dos/donts 可测试，≥2 条 VP 可转化为内容主题，品牌故事有 ≥1 个可传播元素',
        score5: '即完整创意简报：定位可生成一句话 brief，dos/donts 覆盖 ≥3 个决策领域，每条 VP 可展开为内容支柱，reasoning 链为 S7/S8 提供可追溯依据',
      },
      evidence: {
        score1: '来源：reasoning 三个引用全部标注「未追溯」或仅有模糊引用（「来自S4」但无字段/内容）。推导链断裂——S6 与 S3/S4/S5 无逻辑关系。可信度：前序引用无法验证。推理链：无。品牌定位与消费者需求/竞争空位之间无逻辑链',
        score3: '来源：≥2 个 reasoning 引用标注了具体字段名+内容摘要。可信度：前序字段确实存在且内容匹配引用描述。推理链：≥1 条完整推导链「S4发现X→S5确认竞品未解决X→S6定位Y」。品牌故事与 S1/S4 记录的消费者困境一致',
        score5: '来源：全部 3 个引用有字段名+内容摘要+推导逻辑。品牌故事要素可追溯到 S1/S4。每条 VP 有独立 S4/S5 来源。可信度：每个引用的前序字段可交叉验证，引用内容与原文一致。推理链：完整推导链：S4消费者需求→S5竞争空位→S6品牌定位。消费者描述与 S4 consumerProfile 一致，核心价值方向与 S5 marketOpportunity 一致',
      },
    },
  },

  // ── S7: 视觉策略 ── Differentiation+Actionability 主导 ────
  7: {
    stageName: "视觉策略",
    objective: "将品牌战略转译为可执行的视觉语言系统",
    weights: { specificity: 0.20, differentiation: 0.35, actionability: 0.35, evidence: 0.10 },
    advanceThreshold: 75,
    reoptimizeThreshold: 60,
    focusAreas: [
      "coreConcept 是否统领性地定义了视觉美学方向，而非仅列出视觉元素",
      "五种视觉语言（form/color/typography/imagery/material）是否全部填充且每种有 ≥2 个具体样式描述",
      "视觉方向是否与 S6 品牌人格一致——品牌人格的 dos/donts 是否在视觉语言中有对应体现",
      "restrictions 是否有战略理由（「不能用X因为与品牌Y特质冲突」而非「不能用X因为不好看」）",
    ],
    acceptableEvidence: ["S6 品牌定位字段引用", "S6 品牌人格特质引用", "S4 消费者心理洞察", "S5 竞品视觉分析"],
    scoringAnchors: {
      specificity: {
        score1: '五种视觉语言有缺失或仅为单关键词（color="暖色系"、typography="简洁"），设计师无法理解视觉方向',
        score3: '五种全填充，≥3 种有具体描述（色值范围/字体风格/摄影方向），coreConcept 有明确美学方向',
        score5: '五种各 ≥2 个样式描述或参考，视觉系统内部一致（互相呼应），coreConcept 统领全局，有应用场景说明',
      },
      differentiation: {
        score1: '视觉为品类通用模板（护肤品=清新自然、科技=极简蓝白），无品牌个性，换名后可复用',
        score3: '≥2 种语言体现与 S6 品牌人格的关联，restrictions 有战略理由，视觉与 S5 竞品视觉有明显区分',
        score5: '视觉与竞品有差异且有战略依据（可追溯到 S5），restrictions ≥3 条有战略理由，构成「品牌视觉人格」',
      },
      actionability: {
        score1: '无法指导设计师——停留于概念（「温暖」「高级」），缺少可交付方向。设计师需要重新做视觉策略',
        score3: '≥3 种语言含可交付级描述（色值范围/字体推荐/摄影风格），设计师可据此产出初稿，restrictions 可作为排除清单',
        score5: '五种全有可交付描述+参考方向+moodboard，restrictions 可作为完整设计评审 checklist，有视觉优先级指导',
      },
      evidence: {
        score1: '来源：无战略依据——所有视觉选择均为 AI 审美判断（「暖色=温暖」），与 S6 无关联。无法回答「为什么选这个方向」。可信度：无。推理链：视觉方向与品牌战略之间无推理链',
        score3: '来源：≥2 个关键视觉决策可追溯到 S6 或 S4 具体字段。≥1 个 restrictions 有战略理由。可信度：引用的前序字段确实存在且与视觉选择逻辑一致。推理链：≥1 条推理链「品牌人格/定位→视觉决策」。coreConcept 推导可追溯到品牌战略',
        score5: '来源：所有关键决策（coreConcept+五种语言）有明确的战略依据。每个视觉选择可追溯到 S6/S4/品牌人格的具体字段。可信度：战略依据真实存在，视觉选择的推导过程可独立验证。推理链：完整「从战略到视觉」推导链。消费者心理→品牌人格→视觉表达每步有明确逻辑',
      },
    },
  },

  // ── S8: 内容规划 ── Actionability 全系统最高 45% ─────────
  8: {
    stageName: "内容规划",
    objective: "建立可执行的长期内容资产体系",
    // Actionability=45%：S8 的核心价值在于可执行的内容运营体系
    weights: { specificity: 0.20, differentiation: 0.15, actionability: 0.45, evidence: 0.20 },
    advanceThreshold: 70,
    reoptimizeThreshold: 55,
    focusAreas: [
      "内容支柱是否服务于 S6 品牌目标（每个支柱能回答「这个内容方向如何帮助品牌实现定位」）",
      "内容执行体系是否完整：内容类型+内容角度+发布节奏+平台策略+生产方式",
      "contentValueSystem 四阶段（awareness/interest/trust/decision）是否覆盖完整且各有具体内容策略",
      "平台策略是否有用户行为依据——为什么选这个平台、在这个平台上如何差异化表达品牌",
    ],
    acceptableEvidence: ["S4 消费者行为数据", "平台用户行为特征", "内容反馈数据", "S6 品牌定位", "S7 视觉策略"],
    scoringAnchors: {
      specificity: {
        score1: '内容为通用栏目（「产品介绍」「品牌故事」「使用教程」），无具体主题方向。平台策略为通用描述（「做小红书种草」）',
        score3: '≥2 个内容支柱有具体 topic 方向。≥1 个平台有平台级策略（为什么选+如何表达+预期形式）。四阶段各有内容覆盖',
        score5: '≥3 个支柱各有 ≥2 个 topic 可追溯 S6 目标。每个平台有差异化内容策略。完整内容价值体系',
      },
      differentiation: {
        score1: '内容策略任何品牌都适用，换名+换关键词即可复用，无品牌独特资产体现',
        score3: '≥1 个内容方向体现品牌独特资产（品牌故事/创始人经历/用户共创/独特价值观），内容调性与 S6 品牌人格一致',
        score5: '≥2 个独特方向形成差异化矩阵，与竞品表达方式明显不同。内容能沉淀品牌自有资产，构成竞争壁垒',
      },
      actionability: {
        score1: '只有方向无执行方式——运营团队不知从何入手。缺少内容类型/角度/平台选择逻辑',
        score3: '内容类型+角度+平台选择+发布频率，≥1 个平台有具体内容策略，可制定月度内容计划',
        score5: '完整执行体系：类型+节奏+模板+选题+KPI+生产方式（自制/合作/UGC），可用于 3-6 个月运营规划，有内容效果衡量框架和迭代逻辑',
      },
      evidence: {
        score1: '来源：无战略或用户依据——所有方向为 AI 内容营销常识推断（「做小红书因为小红书火」）。平台选择无用户行为依据。可信度：无。推理链：内容决策与用户需求/品牌战略之间无推理链',
        score3: '来源：≥2 个内容方向可追溯到 S4 或 S6 字段。≥1 个平台选择有用户行为逻辑（用户在平台花费时间/行为模式）。可信度：引用的前序字段存在且一致，用户行为数据可验证。推理链：≥1 条推理链「用户需求X→内容方向Y→平台表达Z」',
        score5: '来源：平台选择有具体用户行为依据（可追溯到 S4），每个支柱可追溯到用户需求。≥2 个不同类型内容反馈来源。可信度：用户行为数据有来源/时效/代表性，内容反馈数据可验证。推理链：完整推理链：用户行为→内容需求→品牌内容体系→平台差异化表达→效果衡量，每步有证据锚点',
      },
    },
  },
};

// ── Evidence 三维子维度审计框架 ────────────────────────────

/**
 * Evidence 不再简单判断"有没有数据"，升级为三个子维度：
 *
 * Presence（证据存在性）：结论是否拥有明确来源？
 *   - 检查：用户反馈/数据/行业报告/竞品信息/前序阶段字段/行为记录
 *   - 1分=无来源，全AI推断 | 3分=部分有来源 | 5分=关键判断均有明确来源
 *
 * Reliability（证据可信度）：来源是否真实、有效、有代表性？
 *   - 检查：来源是否可验证/时间是否有效/数据是否合理/样本是否有代表性/是否过度推断
 *   - 1分=来源不明/虚构/无法验证 | 3分=基本可信但有局限 | 5分=来源可靠、有代表性、明确限制条件
 *
 * Connection（证据关联性）：证据是否真正支持战略判断？
 *   - 检查：证据→Insight→Strategic Decision 是否形成完整推理链
 *   - 1分=证据与结论无逻辑关系 | 3分=部分支持但推导有跳跃 | 5分=完整推理链，每步有证据锚点
 */

/** 每个阶段的 Evidence 审查焦点和三维要求 */
const STAGE_EVIDENCE_GUIDANCE: Record<number, string> = {
  1: `S1 的 Evidence 审查商业真实性。
证据来源检查：创始人经历、用户反馈、已有业务记录是否被标注为来源？
证据可信度检查：创始人的"说"和"做"是否被区分？经历是否有时间/情境/结果？
推理链完整性检查：创始人经历→用户问题→初始假设之间是否存在因果推理链？`,

  2: `S2 的 Evidence 审查商业现实性。
证据来源检查：运营数据、产品现状、团队经验是否被引用？已有事实和计划设想是否被区分？
证据可信度检查：业务数据是否有具体数字（月活/复购率/NPS）？行业信息是否可验证？
推理链完整性检查：现有业务基础→战略约束→方向选择的推理链是否完整？`,

  3: `S3 的 Evidence 审查外部市场依据（全系统权重最高 40%）。
证据来源检查：行业报告名称/年份/数据点、搜索趋势关键词、消费数据来源是否明确标注？
证据可信度检查：数据来源是否权威？时间是否有效？样本是否有代表性？还是 AI 训练数据的常识推断？
推理链完整性检查：数据→趋势判断→市场机会识别的推理链是否清晰？是否区分了有数据支撑的判断和基于数据的推断？`,

  4: `S4 的 Evidence 审查行为证据。
证据来源检查：用户访谈原文、评论分析、购买行为记录、使用场景观察是否被引用？
证据可信度检查：用户原话是否可直接验证？行为记录是否具体有时效？是否区分了"用户说的"和"用户做的"？
推理链完整性检查：行为观察→行为解释→需求判断→品牌启示的推理链是否完整可追溯？`,

  5: `S5 的 Evidence 审查竞争依据。
证据来源检查：竞品用户评价原文、产品功能对比、价格/渠道/服务对比数据是否被引用？
证据可信度检查：评价原文是否真实可溯源？产品对比是否具体到功能/价格/体验？市场观察是否有时间/渠道记录？
推理链完整性检查：竞品分析→弱点→机会缺口→差异化方向的推理链是否完整？`,

  6: `S6 的 Evidence 审查战略推导链（不是外部数据！）。
证据来源检查：reasoning 引用是否显式标注了 S3/S4/S5 的具体字段名和内容摘要？
证据可信度检查：引用的前序字段是否真实存在？引用内容是否与原文一致？是否存在捏造前序发现的情况？
推理链完整性检查：S4消费者需求→S5竞争空位→S6品牌定位是否形成完整可验证的逻辑闭环？`,

  7: `S7 的 Evidence 审查战略一致性（不是外部数据！）。
证据来源检查：visual directions 是否标注了对应的 S6 品牌定位字段/S4 消费者心理/品牌人格特质？
证据可信度检查：引用的战略依据是否真实存在于前序输出中？视觉选择的推导是否可独立验证？
推理链完整性检查：消费者心理→品牌人格→视觉表达是否形成完整的"从战略到视觉"推导链？`,

  8: `S8 的 Evidence 审查用户需求基础。
证据来源检查：平台选择是否有用户行为数据支撑？内容方向是否可追溯到 S4 消费者洞察或 S6 品牌战略字段？
证据可信度检查：用户行为数据是否有来源/时效/代表性？内容反馈数据是否可验证？
推理链完整性检查：用户行为模式→内容需求→品牌内容体系→平台差异化表达→效果衡量的推理链是否完整？`,
};

// ── 评分提示模板 ──────────────────────────────────────────

function buildAuditSystemPrompt(config: StageAuditConfig, stageNumber: number): string {
  const weights = config.weights;
  const anchors = config.scoringAnchors;
  const evidenceGuidance = STAGE_EVIDENCE_GUIDANCE[stageNumber] ?? "";

  // 按维度定义
  const dims: Array<{
    key: AuditDimension;
    label: string;
    weight: number;
    desc: string;
  }> = [
    { key: "specificity", label: "Specificity（具体度）", weight: weights.specificity, desc: "是否具体到场景、人群、行为？避免模糊笼统的泛泛而谈。" },
    { key: "differentiation", label: "Differentiation（差异化）", weight: weights.differentiation, desc: "是否形成了独特的判断？是否区分于行业通用表述？" },
    { key: "actionability", label: "Actionability（可执行性）", weight: weights.actionability, desc: "是否能指导下一步行动？后续阶段是否可以直接使用这些输出？" },
    { key: "evidence", label: "Evidence（证据支撑）", weight: weights.evidence, desc: `从三个子维度综合评估（详见下方 Evidence 审计框架）。\n${evidenceGuidance}\n本阶段可接受的证据类型：${config.acceptableEvidence.join("、")}。` },
  ];

  // 维度评分区段
  const dimSections = dims.map((d, i) => {
    const anchor = anchors?.[d.key];
    const pct = (d.weight * 100).toFixed(0);
    let section = `### ${i + 1}. ${d.label} 权重 ${pct}%\n${d.desc}`;
    if (anchor) {
      section += `\n\n评分锚点（1/3/5 分，2 分和 4 分在对应区间内根据覆盖程度判断）：\n- 1 分：${anchor.score1}\n- 3 分：${anchor.score3}\n- 5 分：${anchor.score5}`;
    }
    return section;
  }).join("\n\n");

  // 评分标准：有自定义锚点时显示简洁版，无锚点时显示通用描述
  const hasAnchors = anchors && Object.keys(anchors).length > 0;
  const scoringSection = hasAnchors
    ? `## 评分说明
每个维度上方已给出 1/3/5 分的具体可数锚点。评分时请逐条核对输出内容是否满足数量阈值或质量条件，而非依赖"感觉"。`
    : `## 评分标准
- 5 分：卓越 — 超出预期，判断深度和精度达到资深品牌顾问水平
- 4 分：良好 — 达到预期，有实质战略价值
- 3 分：合格 — 基本达标，但存在可优化的空间
- 2 分：不足 — 存在明显质量问题，需要优化
- 1 分：严重不足 — 关键信息缺失或错误，必须重做`;

  return `你是一位资深品牌战略审计专家。你的任务是评估一个 AI 品牌咨询系统在 Stage ${stageNumber}「${config.stageName}」阶段输出的战略质量。

## 阶段目标
${config.objective}

## 四维评分框架

请从以下四个维度独立评估，每维度 1-5 分（1=严重不足，3=合格，5=卓越）。

${dimSections}

## 本阶段重点关注
${config.focusAreas.map((f, i) => `${i + 1}. ${f}`).join("\n")}

${scoringSection}

## Evidence 三维审计框架

Evidence 维度不简单判断"有没有数据"，而是从三个角度综合评估：

1. **证据来源**：结论是否拥有明确来源？
   - 检查：是否标注了信息来源？是来自用户反馈/数据/报告/前序阶段字段，还是全部为AI推断？
2. **证据可信度**：来源是否真实、有效、具有代表性？
   - 检查：来源是否可验证？数据时间是否有效？样本是否有代表性？是否存在"有引用但不可信"的情况？
3. **推理链完整性**：证据是否真正支持当前战略判断？
   - 检查：证据 → 洞察 → 战略决策 是否形成完整推理链？是否存在"有数据但与结论无关"的情况？

**重要**：不能仅根据"是否有引用"判断高低分。必须综合评估来源存在性、可信度和推理关联性。无来源=低分，有来源但不可信=中等，有来源且可信但与结论无关=低分。

## 重要原则
- 评分时请考虑当前阶段可获取的实际信息量。不要因为"搜索数据未找到"而扣 Evidence 分——搜索缺失是外部约束，不是输出质量问题。
- 不要跨阶段要求——例如不要因为 S3 缺少竞品对比而扣分（竞品分析是 S5 的任务）。
- 每个维度的评分理由必须引用输出中的具体内容作为证据。
- **评分理由中严禁使用任何英文词汇或缩写**，包括但不限于：Presence、Reliability、Connection、Fact、Inference、Hypothesis、verified、inferred、explicit、evidenceLevel、founder_observation、VP（请写"价值主张"）、dos/donts（请写"行为准则/禁区"）、coreConcept（请写"核心概念"）、reasoning（请写"推理依据"）、weakness（请写"弱点"）、gap（请写"缺口"）、KPI（请写"关键指标"）、checklist（请写"检查清单"）、moodboard（请写"情绪板"）、functional/identity needs（请写"功能需求/身份需求"）、consumerProfile（请写"消费者画像"）、marketOpportunity（请写"市场机会"）、restrictions（请写"视觉禁区"）、contentValueSystem（请写"内容价值体系"）、opportunityGap（请写"机会缺口"）、failReason（请写"失败原因"）、fulltext、snippet、user review。评分理由必须是纯中文自然语言。

## 问题类型标注（issueType）—— 必填，用于指导后续优化策略

对 issues 中的每一条问题，你必须标注 issueType，取值为 "expression" 或 "data_gap"。这个标注直接影响系统后续的处理方式，请严格按以下标准判断：

### "expression"（表达问题）— 通过改写可修复
**定义**：底层信息已存在，但表达方式存在问题。AI 可以通过重新措辞、调整结构、补充细节来修复，**不需要获取新的外部数据**。

**典型场景**：
- 描述模糊不具体（如"市场很大"→应写"市场规模约1500亿元"），但底层数据已存在于输出中
- 结构混乱、分类不清、层次重叠（如功能需求和身份需求未区分）
- 措辞过于模板化、缺少品牌个性（如品牌故事写成通用模板）
- 未遵循确认总结模板格式（如缺少表格、标题格式不对）
- 优先级排序缺失（如两个机会方向未标优先级），但内容本身已有足够信息
- 与品牌人格的行为准则/禁区对应关系未显式标注（但内容已有）
- 跨阶段引用流于形式（引用了但未展开说明影响），但前序内容确实存在

**判断标准**：如果让同一位 AI 顾问基于现有对话记录重新写一遍，能否显著改善？能 → "expression"

### "data_gap"（数据/证据缺口）— 改写无法修复，需要新数据
**定义**：底层信息缺失，无论怎么改写都无法弥补。AI 需要获取新的搜索数据、用户输入或外部报告才能改善。

**典型场景**：
- 市场规模/增速数据标注为"待验证"或"搜索范围内未找到"，且未提供具体报告名称和年份
- 趋势判断缺乏具体数据点，标注为"基于行业趋势分析，需进一步数据验证"
- 消费者洞察缺乏用户原话或行为记录支撑，且不是表达问题——对话中确实没有这些信息
- 竞品弱点缺乏用户评价原文或产品功能对比数据
- 搜索 API 不可用时，数据层字段填充为"搜索范围内未找到"（非 AI 表达问题）
- 前序阶段该有的数据字段确实为空（如后续阶段引用必然缺失）
- 证据来源标注为推断且对话中确实没有可验证的事实依据

**判断标准**：即使让同一位 AI 顾问基于现有对话记录重新写，也无法改善——因为对话中就不存在这些信息。需要**新的搜索**或**用户手动补充**。→ "data_gap"

### 边界情况判断指南
- Evidence 维度的问题**通常是 data_gap**，但也有例外：如果输出中实际包含了数据来源但表述不清晰（如报告名称写在了正文但没在数据来源列表中列出），标 "expression"
- 如果数据标注了"待验证"但对话中用户明确提过相关数据（AI 没提取好），标 "expression"（AI 可以重新提取）
- 如果数据标注了"待验证"且对话中确实没有，标 "data_gap"（AI 没有信息可以提取）
- Specificity/Actionability/Differentiation 维度的问题**通常是 expression**，但极少数情况——如"无法判断优先级因为缺少市场数据"——也应标 "data_gap"

## 输出格式要求

你必须输出合法的 JSON，格式如下：
\`\`\`json
{
  "scores": [
    {
      "dimension": "specificity",
      "score": 4,
      "reason": "具体评分理由，引用输出中的具体内容作为证据",
      "improvements": ["改进建议1", "改进建议2"]
    },
    {
      "dimension": "differentiation",
      "score": 3,
      "reason": "...",
      "improvements": ["..."]
    },
    {
      "dimension": "actionability",
      "score": 4,
      "reason": "...",
      "improvements": ["..."]
    },
    {
      "dimension": "evidence",
      "score": 3,
      "reason": "...",
      "improvements": ["..."]
    }
  ],
  "issues": [
    {
      "dimension": "differentiation",
      "severity": "major",
      "description": "具体问题描述",
      "suggestion": "具体改进建议",
      "issueType": "expression"
    }
  ],
  "overallAssessment": "一句话整体评价（30 字以内）"
}
\`\`\`

**注意**：issueType 字段是必填的。每条 issue 都必须根据上述标准标注为 "expression" 或 "data_gap"。

## 注意事项
- 评分必须基于输出内容的实际质量，不要因为缺少某些字段就给全低分（字段完整性由规则引擎检查）
- improvements 必须是可执行的建议，不能是"需要改进"这类空话
- 如果输出质量确实很低，不要犹豫给低分——这对产品改进至关重要
- 每个维度的评分理由必须引用输出中的具体内容作为证据`;
}

// ── AI Quality Audit 核心函数 ────────────────────────────

/**
 * 运行 AI Quality Audit。
 *
 * 调用 LLM 对阶段输出进行四维质量评估。
 * 返回包含评分、问题、门禁推荐的结构化结果。
 *
 * 模型选择：
 * - 默认 deepseek-chat（与 consultation 共用模型）
 * - 环境变量 AUDIT_MODEL=deepseek-reasoner → 使用推理模型独立审计
 *   （解决"同一 AI 又是球员又是裁判"的问题）
 *
 * @param crossStagePrompt - Layer B 语义断裂检查 prompt 扩展（可选）。
 *   由 audit-engine 在 Rule Check + Layer A 通过后构建并传入。
 *   不发起独立 LLM 调用——完全复用本调用。
 */
export async function runAIQualityAudit(
  stageNumber: number,
  stageOutput: Record<string, any>,
  _decisionMemoryContext?: string,  // Phase 3.2: 暂不消费，Task 3.3 Layer B 使用
  crossStagePrompt?: string,        // Layer B prompt 扩展
  projectId?: string,               // Token 追踪用
): Promise<AIAuditResult> {
  const config = STAGE_AUDIT_CONFIGS[stageNumber];
  if (!config) {
    throw new Error(`AI Quality Audit: 无效的阶段编号 ${stageNumber}`);
  }

  const provider = getLLMProvider();
  const systemPrompt = buildAuditSystemPrompt(config, stageNumber);
  // 注意：Layer B prompt 不追加到 system prompt（会 priming 评分行为）
  // 而是放在 user message 末尾作为独立任务

  // 序列化输出为 JSON 字符串作为 user message
  const outputJson = JSON.stringify(stageOutput, null, 2);

  let userMessage = `请评估以下 Stage ${stageNumber}「${config.stageName}」的输出质量：

\`\`\`json
${outputJson}
\`\`\`

请严格按照四维评分框架给出评估结果。`;

  // Layer B: 跨阶段语义检查作为独立任务追加到 user message 末尾
  // 放在 user message 而非 system prompt，减少上游上下文对四维评分的 priming
  if (crossStagePrompt) {
    userMessage += `\n\n---\n\n## ⚠️ 独立任务：跨阶段语义检查（完成四维评分后再处理）\n\n${crossStagePrompt}`;
  }

  // ── LLM 调用 ────────────────────────────────────────
  const auditModel = process.env.AUDIT_MODEL || "deepseek-chat";
  const isReasoner = auditModel === "deepseek-reasoner";
  const isV4Flash = auditModel === "deepseek-v4-flash";

  // reasoner 不支持 system role / response_format / temperature
  // v4-flash 支持全部参数但有内部推理，需要更高 maxTokens
  const messages: Array<{ role: "system" | "user"; content: string }> = isReasoner
    ? [{ role: "user", content: `${systemPrompt}\n\n---\n\n${userMessage}` }]
    : [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ];

  let rawResponse: string;
  const chatFn = provider.chatSafe ?? (async (msgs: any, opts: any) => {
    try { return { content: await provider.chat(msgs, opts) }; }
    catch (e: any) { return { content: "", error: e.message }; }
  });

  const safeResult = await chatFn(
    messages,
    isReasoner
      ? { maxTokens: 4096, model: auditModel }
      : { temperature: 0.2, maxTokens: isV4Flash ? 16384 : 2048, responseFormat: "json_object", model: auditModel }
  );

  if (safeResult.error) {
    console.error(`[ai-quality] LLM 调用失败: ${safeResult.error}`);
    return createFallbackResult(stageNumber, safeResult.error);
  }
  rawResponse = safeResult.content;

  // ── Token 追踪 ──────────────────────────────────────
  if (projectId && provider.lastUsage) {
    const { systemChars, conversationChars } = estimateCharCount(messages);
    recordUsageFromProvider(provider, {
      projectId,
      stageNumber,
      callType: "audit",
      model: auditModel,
      systemPromptChars: systemChars,
      conversationChars,
    }).catch(() => {});
  }

  // reasoner 输出可能包含 <｜end▁of▁thinking｜>... 思考标签，提取最终 JSON
  if (isReasoner) {
    // 移除  ‍...  ‍ 思考块（reasoner 可能在最终答案中包含思考过程）
    rawResponse = rawResponse.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  }

  // ── 解析响应 ────────────────────────────────────────
  try {
    let jsonText = normalizeJSON(rawResponse);
    jsonText = fixCommonJSONErrors(jsonText);
    const parsed = JSON.parse(jsonText);
    return buildResult(stageNumber, parsed, config, !!crossStagePrompt);
  } catch (e: any) {
    console.error(`[ai-quality] 结果解析失败: ${e.message}`);
    console.error(`[ai-quality] 原始响应（前200字）: ${rawResponse.slice(0, 200)}`);
    return createFallbackResult(stageNumber, `结果解析失败: ${e.message}`);
  }
}

// ── 结果构建 ──────────────────────────────────────────────

function buildResult(
  stageNumber: number,
  raw: Record<string, any>,
  config: StageAuditConfig,
  includeCrossStage: boolean = false
): AIAuditResult {
  const scores = raw.scores ?? [];
  const issues = raw.issues ?? [];

  const dimensionScores: DimensionScore[] = [];
  let totalScore = 0;

  const dimensions: AuditDimension[] = [
    "specificity",
    "differentiation",
    "actionability",
    "evidence",
  ];

  for (const dim of dimensions) {
    const dimData = scores.find(
      (s: any) => s.dimension === dim
    ) ?? { score: 3, reason: "AI 未返回该维度评分", improvements: [] };

    const rawScore = clampScore(Number(dimData.score) || 3);
    const weight = config.weights[dim];
    const weightedScore = rawScore * weight * 20; // 归一化到 0-100

    dimensionScores.push({
      dimension: dim,
      score: rawScore,
      weight,
      weightedScore: Math.round(weightedScore * 10) / 10,
      reason: String(dimData.reason ?? ""),
      improvements: Array.isArray(dimData.improvements)
        ? dimData.improvements.map(String)
        : [],
    });

    totalScore += weightedScore;
  }

  totalScore = Math.round(totalScore * 10) / 10;

  // 门禁推荐
  let gateRecommendation: "advance" | "reoptimize" | "block";
  if (totalScore >= config.advanceThreshold) {
    gateRecommendation = "advance";
  } else if (totalScore >= config.reoptimizeThreshold) {
    gateRecommendation = "reoptimize";
  } else {
    gateRecommendation = "block";
  }

  // 是否有 critical 级别问题
  const hasCritical = issues.some(
    (i: any) => i.severity === "critical"
  );

  // 任一维度 1 分 → 强制至少 reoptimize
  const hasScore1 = dimensionScores.some((d) => d.score <= 1);
  // 任一维度 ≤2 分 → 不允许直接 advance（防止总分达标但关键维度短板）
  const hasScore2 = dimensionScores.some((d) => d.score <= 2);

  if (hasCritical || hasScore1) {
    if (gateRecommendation === "advance") {
      gateRecommendation = "reoptimize";
    }
  }

  if (hasScore2 && gateRecommendation === "advance") {
    gateRecommendation = "reoptimize";
  }

  const auditIssues: AuditIssue[] = (Array.isArray(issues) ? issues : [])
    .map((i: any) => ({
      dimension: (i.dimension as AuditDimension) ?? "specificity",
      severity: (i.severity as "critical" | "major" | "minor") ?? "minor",
      description: String(i.description ?? ""),
      suggestion: String(i.suggestion ?? ""),
      issueType: (i.issueType === "expression" || i.issueType === "data_gap")
        ? i.issueType
        : "expression", // 默认降级为 expression（安全侧：允许改写但不跳过搜索）
    }))
    .filter((i: AuditIssue) => i.description.length > 0);

  // Layer B 语义断裂检查结果（仅在 prompt 要求时 LLM 才返回）
  let crossStageSemantics: AIAuditResult["crossStageSemantics"] = null;
  if (includeCrossStage && raw.crossStageSemantics) {
    const cs = raw.crossStageSemantics;
    crossStageSemantics = {
      hasIssues: cs.hasIssues ?? false,
      issues: Array.isArray(cs.issues) ? cs.issues.map((i: any) => ({
        type: "semantic_break" as const,
        severity: (i.severity === "warning" ? "warning" : "info") as "warning" | "info",
        currentStageField: String(i.currentStageField ?? ""),
        upstreamField: String(i.upstreamField ?? ""),
        description: String(i.description ?? ""),
        gapDetail: i.gapDetail ? String(i.gapDetail) : undefined,
      })) : [],
    };
  }

  return {
    stageNumber,
    dimensionScores,
    totalScore,
    issues: auditIssues,
    gateRecommendation,
    needsHumanReview: gateRecommendation === "block" || hasCritical,
    crossStageSemantics,
  };
}

// ── 降级处理 ──────────────────────────────────────────────

function createFallbackResult(
  stageNumber: number,
  errorMessage: string
): AIAuditResult {
  const dimensionScores: DimensionScore[] = (
    ["specificity", "differentiation", "actionability", "evidence"] as AuditDimension[]
  ).map((dim) => ({
    dimension: dim,
    score: 3,
    weight: 0.25,
    weightedScore: 15,
    reason: `AI Quality Audit 不可用（${errorMessage}），使用默认及格分`,
    improvements: [],
  }));

  return {
    stageNumber,
    dimensionScores,
    totalScore: 60,
    issues: [
      {
        dimension: "specificity",
        severity: "minor",
        description: `AI Quality Audit 执行失败：${errorMessage}`,
        suggestion: "请检查 LLM 服务连通性后手动触发重新审计",
        issueType: "expression" as const,
      },
    ],
    gateRecommendation: "advance", // 降级时放行，不阻塞流程
    needsHumanReview: true,
    crossStageSemantics: null,
  };
}

function clampScore(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score)));
}

// ── 导出配置供 audit-engine 使用 ─────────────────────────

export { STAGE_AUDIT_CONFIGS };
