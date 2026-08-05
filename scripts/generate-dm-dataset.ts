/**
 * Phase 2: Extended Decision Memory Dataset Generator
 *
 * 基于真实 2778 条 DM 数据的 Schema 和业务分布，生成 500/5000 条
 * 模拟 DM 条目用于压力测试。
 *
 * 设计原则：
 * - 保留真实 fieldPath 模式和相对频率
 * - 保留 (stage, entryType, evidenceLevel) 交叉分布
 * - 内容长度分布匹配真实数据（avg 64, median 50, max ~400）
 * - 扩展长期品牌运营中会出现的字段（内容反馈、受众洞察、迭代决策等）
 */

// ── 校准参数（来自 analyze-dm-data.ts 的真实数据统计）─────────

interface StageConfig {
  stage: number;
  weight: number;        // 该阶段的条目数占比
  fields: FieldConfig[];  // 该阶段包含的字段类型
}

interface FieldConfig {
  fieldPath: string;
  entryType: string;
  evidenceLevel: string;
  weight: number;        // 该字段在阶段内的相对频率
  // 内容生成参数
  contentPrefix?: string;  // 内容前缀模板
  contentAvgLen: number;   // 平均内容长度
  contentTopics: string[]; // 变体主题词（用于生成差异化内容）
}

// ── S1-S8 完整 Schema 定义 ─────────────────────────────

/**
 * 每个阶段的字段配置基于真实 DM 数据的 fieldPath 分布。
 *
 * 扩展字段（标注 ★）模拟长期品牌运营中出现的 Memory 类型：
 * - contentFeedback: 内容发布后的用户反馈数据
 * - audienceSegment: 受众细分洞察
 * - performanceMetrics: 阶段执行效果指标
 * - iterationDecisions: 品牌迭代决策记录
 * - marketUpdate: 市场环境更新事实
 */
const STAGE_CONFIGS: StageConfig[] = [
  // S1: 用户访谈 — 421 entries in real data (~15%)
  {
    stage: 1, weight: 15,
    fields: [
      { fieldPath: "founderMotivation.content", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 12, contentAvgLen: 125, contentTopics: ["创始动机", "创业初心", "行业观察", "个人经历"] },
      { fieldPath: "observations[].behavior", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 55, contentAvgLen: 97, contentTopics: ["用户行为观察", "消费场景记录", "用户痛点发现", "使用习惯洞察", "购买决策过程"] },
      { fieldPath: "confirmedProblems[].problem", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 28, contentAvgLen: 34, contentTopics: ["产品问题", "服务缺陷", "体验痛点", "行业弊端"] },
      { fieldPath: "constraints.budget", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 3, contentAvgLen: 25, contentTopics: ["预算约束"] },
      { fieldPath: "constraints.team", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 2, contentAvgLen: 21, contentTopics: ["团队规模"] },
    ],
  },

  // S2: 商业背景分析 — 701 entries (~25%)
  {
    stage: 2, weight: 25,
    fields: [
      { fieldPath: "businessBackground.marketContext", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 6, contentAvgLen: 180, contentTopics: ["行业宏观背景", "市场环境分析", "品类发展趋势", "宏观经济影响"] },
      { fieldPath: "businessBackground.drivingForces[].force", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 22, contentAvgLen: 39, contentTopics: ["消费升级驱动", "技术变革推动", "人口结构变化", "政策监管影响", "社会文化趋势"] },
      { fieldPath: "businessBackground.strategicWindow", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 6, contentAvgLen: 92, contentTopics: ["市场窗口期", "进入时机判断", "先发优势窗口"] },
      { fieldPath: "coreChallenges.externalChallenges[].challenge", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 20, contentAvgLen: 50, contentTopics: ["外部竞争压力", "供应链风险", "政策不确定性", "消费者需求变化", "技术替代威胁"] },
      { fieldPath: "coreChallenges.internalChallenges[].challenge", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 19, contentAvgLen: 44, contentTopics: ["团队能力缺口", "资金限制", "运营效率", "品牌认知度低", "产品差异化不足"] },
      { fieldPath: "strategicDirection.directionHypothesis", entryType: "hypothesis", evidenceLevel: "ai_inferred", weight: 6, contentAvgLen: 139, contentTopics: ["品牌方向假设", "市场切入假设", "差异化方向推测", "增长路径预判"] },
      { fieldPath: "strategicDirection.workingPriorities[].priority", entryType: "hypothesis", evidenceLevel: "ai_inferred", weight: 20, contentAvgLen: 40, contentTopics: ["优先验证方向", "短期工作重点", "资源分配优先级", "能力建设顺序"] },
    ],
  },

  // S3: 市场机会分析 — 709 entries (~26%)
  {
    stage: 3, weight: 26,
    fields: [
      { fieldPath: "marketOverview.marketSize", entryType: "confirmed_fact", evidenceLevel: "search_backed", weight: 5, contentAvgLen: 85, contentTopics: ["市场规模数据", "行业产值统计", "目标市场容量"] },
      { fieldPath: "marketOverview.growthRate", entryType: "confirmed_fact", evidenceLevel: "search_backed", weight: 5, contentAvgLen: 67, contentTopics: ["年增长率", "复合增长率", "增速变化趋势"] },
      { fieldPath: "marketOverview.marketStage", entryType: "confirmed_fact", evidenceLevel: "search_backed", weight: 6, contentAvgLen: 9, contentTopics: ["导入期", "增长期", "成熟期", "转型期"] },
      { fieldPath: "industryTrend.currentTrends[].trend", entryType: "confirmed_fact", evidenceLevel: "search_backed", weight: 20, contentAvgLen: 46, contentTopics: ["消费趋势变化", "技术应用趋势", "渠道变革", "用户体验升级", "可持续消费", "个性化定制"] },
      { fieldPath: "channelAnalysis.mainChannels[].channel", entryType: "confirmed_fact", evidenceLevel: "search_backed", weight: 20, contentAvgLen: 36, contentTopics: ["线上电商渠道", "社交媒体渠道", "线下实体渠道", "私域运营渠道", "直播带货渠道", "社区团购渠道"] },
      { fieldPath: "categoryStatus.definition", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 6, contentAvgLen: 79, contentTopics: ["品类边界定义", "品类框架描述", "品类范围界定"] },
      { fieldPath: "categoryStatus.currentState", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 6, contentAvgLen: 87, contentTopics: ["品类现状", "供给端特征", "需求端特征", "品类竞争格局"] },
      { fieldPath: "experienceGaps[].gap", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 18, contentAvgLen: 54, contentTopics: ["用户体验缺口", "服务流程断点", "产品功能缺失", "情感需求未被满足"] },
      { fieldPath: "opportunityDirections[].direction", entryType: "hypothesis", evidenceLevel: "ai_inferred", weight: 15, contentAvgLen: 52, contentTopics: ["市场机会方向", "差异化切入点", "新兴细分市场", "未被满足的需求场景"] },
    ],
  },

  // S4: 消费者洞察 — 204 entries (~7%)
  {
    stage: 4, weight: 7,
    fields: [
      { fieldPath: "targetConsumer.definition", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 16, contentAvgLen: 177, contentTopics: ["目标消费者画像", "核心用户群定义", "消费者决策动机", "消费者行为特征"] },
      { fieldPath: "targetConsumer.idealSelfReflection", entryType: "hypothesis", evidenceLevel: "ai_inferred", weight: 16, contentAvgLen: 113, contentTopics: ["理想自我投射", "身份认同需求", "消费者渴望成为的样子"] },
      { fieldPath: "existingSolutions[].failReason", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 35, contentAvgLen: 85, contentTopics: ["现有方案未满足的需求", "竞品的核心缺陷", "消费者未被解决的问题", "替代方案的局限性"] },
      { fieldPath: "deepNeeds.functionalNeed", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 16, contentAvgLen: 81, contentTopics: ["功能性深层需求", "实用价值诉求", "效率提升需求", "质量保障需求"] },
      { fieldPath: "deepNeeds.identityNeed", entryType: "hypothesis", evidenceLevel: "ai_inferred", weight: 16, contentAvgLen: 145, contentTopics: ["身份认同需求", "社会归属需求", "自我表达需求", "价值观认同"] },
    ],
  },

  // S5: 竞争判断 — 347 entries (~13%)
  {
    stage: 5, weight: 13,
    fields: [
      { fieldPath: "competitiveLandscape.convergenceAndDivergence", entryType: "confirmed_fact", evidenceLevel: "search_backed", weight: 8, contentAvgLen: 130, contentTopics: ["竞争趋同分析", "差异化方向", "行业同质化程度", "差异化机会空间"] },
      { fieldPath: "competitors[].info", entryType: "confirmed_fact", evidenceLevel: "search_backed", weight: 28, contentAvgLen: 52, contentTopics: ["竞品定位分析", "竞品优势评估", "竞品定价策略", "竞品渠道策略", "竞品用户口碑"] },
      { fieldPath: "competitors[].opportunityGap", entryType: "hypothesis", evidenceLevel: "ai_inferred", weight: 28, contentAvgLen: 85, contentTopics: ["竞品服务缺口", "竞品产品缺陷", "竞品体验盲区", "竞品覆盖不到的细分"] },
      { fieldPath: "competitiveGap.unmetNeeds[].need", entryType: "hypothesis", evidenceLevel: "ai_inferred", weight: 27, contentAvgLen: 32, contentTopics: ["未被竞品满足的需求", "消费者期望与现实的差距", "市场供给缺口"] },
      { fieldPath: "competitiveGap.marketOpportunity", entryType: "hypothesis", evidenceLevel: "ai_inferred", weight: 8, contentAvgLen: 188, contentTopics: ["心智空位判断", "品牌差异化切入机会", "战略定位空白区域"] },
    ],
  },

  // S6: 品牌核心战略 — 175 entries (~6%)
  {
    stage: 6, weight: 6,
    fields: [
      { fieldPath: "positioning", entryType: "confirmed_decision", evidenceLevel: "ai_inferred", weight: 14, contentAvgLen: 123, contentTopics: ["品牌定位声明", "目标人群+品类+价值+理由"] },
      { fieldPath: "valuePropositions[].vp", entryType: "confirmed_decision", evidenceLevel: "ai_inferred", weight: 43, contentAvgLen: 25, contentTopics: ["功能价值主张", "情感价值主张", "社会价值主张"] },
      { fieldPath: "brandStory.struggleMoment", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 14, contentAvgLen: 96, contentTopics: ["品牌故事-挣扎时刻", "创始人的困境", "品牌起源的冲突"] },
      { fieldPath: "brandStory.brandAction", entryType: "confirmed_decision", evidenceLevel: "ai_inferred", weight: 14, contentAvgLen: 92, contentTopics: ["品牌故事-品牌行动", "品牌的选择与承诺", "品牌核心行为"] },
      { fieldPath: "brandPersonality", entryType: "confirmed_decision", evidenceLevel: "ai_inferred", weight: 14, contentAvgLen: 28, contentTopics: ["品牌人格特质组合"] },
    ],
  },

  // S7: 视觉策略 — 126 entries (~5%)
  {
    stage: 7, weight: 5,
    fields: [
      { fieldPath: "coreConcept", entryType: "confirmed_decision", evidenceLevel: "ai_inferred", weight: 20, contentAvgLen: 39, contentTopics: ["核心视觉概念", "视觉美学统领方向"] },
      { fieldPath: "keywords", entryType: "confirmed_decision", evidenceLevel: "ai_inferred", weight: 80, contentAvgLen: 10, contentTopics: ["视觉关键词"] },
    ],
  },

  // S8: 内容策略 — 95 entries (~3%)
  {
    stage: 8, weight: 3,
    fields: [
      { fieldPath: "coreDirection", entryType: "confirmed_decision", evidenceLevel: "ai_inferred", weight: 26, contentAvgLen: 40, contentTopics: ["内容核心方向", "内容策略主线"] },
      { fieldPath: "themeDirections[].pillar", entryType: "confirmed_decision", evidenceLevel: "ai_inferred", weight: 74, contentAvgLen: 39, contentTopics: ["内容支柱主题", "内容栏目规划", "内容系列方向"] },
    ],
  },
];

// ── ★ 扩展字段（长期品牌运营中自然出现）───────────────
// 基于真实 schema 结构，模拟品牌运营半年后的 DM 增量

const EXTENDED_FIELDS_BY_STAGE: Record<number, FieldConfig[]> = {
  // S3 扩展：市场更新数据（季度/年度刷新）
  3: [
    { fieldPath: "marketUpdate.quarterlyGrowth[].data", entryType: "confirmed_fact", evidenceLevel: "search_backed", weight: 8, contentAvgLen: 65, contentTopics: ["季度市场增速更新", "最新行业报告数据", "竞争格局变化信号"] },
    { fieldPath: "marketUpdate.newEntrants[].entrant", entryType: "confirmed_fact", evidenceLevel: "search_backed", weight: 5, contentAvgLen: 55, contentTopics: ["新进入者动态", "新品牌入局", "跨界竞争者"] },
    { fieldPath: "marketUpdate.consumerTrendShift[]", entryType: "hypothesis", evidenceLevel: "search_snippet", weight: 5, contentAvgLen: 70, contentTopics: ["消费者偏好变化信号", "新兴消费趋势萌芽", "搜索热词变化"] },
  ],
  // S4 扩展：受众细分与内容反馈
  4: [
    { fieldPath: "audienceSegment.earlyAdopter[].insight", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 8, contentAvgLen: 85, contentTopics: ["早期用户特征", "种子用户行为", "核心粉丝画像"] },
    { fieldPath: "audienceSegment.secondarySegment[].insight", entryType: "hypothesis", evidenceLevel: "ai_inferred", weight: 5, contentAvgLen: 90, contentTopics: ["潜在扩展人群", "次要受众特征", "跨品类消费者"] },
    { fieldPath: "contentFeedback.topPerformer[].analysis", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 8, contentAvgLen: 100, contentTopics: ["高互动内容特征", "爆款内容要素", "用户共鸣点"] },
    { fieldPath: "contentFeedback.underperformer[].reason", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 5, contentAvgLen: 80, contentTopics: ["低效内容原因", "用户流失信号", "内容疲劳迹象"] },
  ],
  // S5 扩展：竞品动态追踪
  5: [
    { fieldPath: "competitorUpdate.newMove[].action", entryType: "confirmed_fact", evidenceLevel: "search_snippet", weight: 6, contentAvgLen: 75, contentTopics: ["竞品新品发布", "竞品营销动作", "竞品定价调整", "竞品渠道扩张"] },
    { fieldPath: "competitorUpdate.shareShift[].data", entryType: "hypothesis", evidenceLevel: "search_snippet", weight: 4, contentAvgLen: 65, contentTopics: ["市场份额变化", "竞品此消彼长", "品类集中度变化"] },
  ],
  // S6 扩展：战略迭代记录
  6: [
    { fieldPath: "iterationDecisions.pivot[].decision", entryType: "confirmed_decision", evidenceLevel: "ai_inferred", weight: 5, contentAvgLen: 100, contentTopics: ["品牌策略微调", "定位话术迭代", "价值主张优先级调整"] },
    { fieldPath: "iterationDecisions.keep[].rationale", entryType: "confirmed_decision", evidenceLevel: "ai_inferred", weight: 5, contentAvgLen: 80, contentTopics: ["保持策略的原因", "验证后坚持的方向", "核心战略不变的理由"] },
  ],
  // S8 扩展：内容效果数据
  8: [
    { fieldPath: "performanceMetrics.engagementRate[].data", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 8, contentAvgLen: 55, contentTopics: ["用户互动率数据", "内容传播数据", "粉丝增长趋势"] },
    { fieldPath: "performanceMetrics.conversionRate[].data", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 5, contentAvgLen: 50, contentTopics: ["内容转化效果", "用户下单路径", "内容引导购买数据"] },
    { fieldPath: "audienceFeedback.recurringTheme[].theme", entryType: "confirmed_fact", evidenceLevel: "ai_inferred", weight: 8, contentAvgLen: 85, contentTopics: ["用户反复提到的话题", "用户高频问题", "用户心中品牌联想"] },
  ],
};

// ── 内容生成器 ──────────────────────────────────────────

/** 基于真实平均长度生成模拟内容 */
function generateContent(field: FieldConfig, index: number): string {
  const topic = field.contentTopics[index % field.contentTopics.length];
  const targetLen = field.contentAvgLen + Math.floor(Math.random() * 40 - 20); // ±20 chars

  // 使用确定性的模板保证内容看起来真实
  const templates: Record<string, string[]> = {
    "创始动机": [
      `创始人在${topic}过程中，发现行业普遍存在X问题，决定通过Y方式解决用户的Z痛点`,
      `基于${topic}的经历，创始人观察到消费者在A场景下的B需求未被现有方案满足`,
    ],
    "用户行为观察": [
      `消费者在${topic}时表现出明显的A倾向，与行业常见的B假设形成反差，这表明用户真正的需求可能是C而非D`,
      `在${topic}方面，用户实际行为与自我报告的偏好存在差距，具体表现为E和F之间的不一致`,
    ],
    "消费趋势变化": [
      `${topic}正在从A向B转变，消费者从关注价格转向关注体验质量，从功能性需求升级为情感性需求`,
      `数据显示${topic}呈现加速趋势，新一代消费者在C维度的偏好显著区别于上一代`,
    ],
    "竞品定位分析": [
      `竞品: ${topic} — 定位: 面向X人群的Y品类，主打Z差异化，核心卖点为W`,
      `${topic}品牌以A为切入点，在B维度建立了较强的用户认知，但在C方面存在明显弱点`,
    ],
    "品牌定位声明": [
      `为${topic}提供X解决方案，通过Y方式实现Z价值，让用户在A场景下获得B体验`,
    ],
    "心智空位判断": [
      `在当前竞争格局中，${topic}维度存在明显的用户期待与实际供给之间的落差，消费者渴望X但市场上无人提供，这构成了品牌可以占据的心智空位`,
    ],
    "消费者画像": [
      `${topic}消费者画像: 年龄X-Y岁，城市中产，关注A和B，在C场景下有强烈的D需求，目前通过E方式勉强满足`,
    ],
    "身份认同需求": [
      `消费者通过品牌选择表达${topic}的身份认同，渴望被认可为X类型的人，希望品牌帮助他们成为理想中的Y形象`,
      `${topic}不仅仅是功能需求，更反映了消费者对Z生活方式的向往和对W价值观的认同`,
    ],
  };

  // 选择模板
  const templateKeys = Object.keys(templates).filter(k => k.includes(topic) || topic.includes(k));
  const template = templateKeys.length > 0
    ? templates[templateKeys[0]][index % templates[templateKeys[0]].length]
    : `${topic}相关数据和分析结论，基于${index + 1}个来源交叉验证`;

  // 根据目标长度填充或截断
  let content = template.replace(/[XYZABCDEFW]/g, () => {
    const words = ["体验", "品质", "价值", "效率", "创新", "专业", "信任", "审美", "健康", "可持续", "个性化", "差异化", "高端", "性价比", "便捷"];
    return words[Math.floor(Math.random() * words.length)];
  });

  // 扩展至目标长度
  while (content.length < targetLen - 20) {
    const suffixes = [
      "。进一步的用户调研显示这一趋势具有持续性",
      "，与竞品在该维度的表现形成显著差异",
      "。这一发现对品牌战略方向选择具有关键参考价值",
      "，预计未来12个月内该趋势将进一步强化",
    ];
    content += suffixes[Math.floor(Math.random() * suffixes.length)];
  }

  // 截断
  if (content.length > targetLen + 50) {
    content = content.slice(0, targetLen + 50);
  }

  return content;
}

// ── 数据集生成 ──────────────────────────────────────────

interface DMEntry {
  id: string;
  projectId: string;
  stageSource: number;
  entryType: string;
  content: string;
  fieldPath: string;
  evidenceLevel: string;
  confirmedAt: Date;
}

function generateId(): string {
  return "synth_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function generateDataset(targetSize: number): DMEntry[] {
  const entries: DMEntry[] = [];
  const baseProjectId = `proj_extended_${targetSize}`;

  // 构建所有可用字段的加权列表
  const allFields: { field: FieldConfig; stage: number }[] = [];

  for (const sc of STAGE_CONFIGS) {
    for (const f of sc.fields) {
      // 根据阶段权重 × 字段权重计算总权重
      const totalWeight = sc.weight * f.weight;
      for (let i = 0; i < totalWeight; i++) {
        allFields.push({ field: f, stage: sc.stage });
      }
    }
    // 添加扩展字段
    const extended = EXTENDED_FIELDS_BY_STAGE[sc.stage];
    if (extended) {
      for (const f of extended) {
        const totalWeight = sc.weight * f.weight * 0.3; // 扩展字段频率为原生字段的 30%
        for (let i = 0; i < Math.max(1, Math.floor(totalWeight)); i++) {
          allFields.push({ field: f, stage: sc.stage });
        }
      }
    }
  }

  // 随机采样生成目标数量的条目
  const totalWeight = allFields.length;
  for (let i = 0; i < targetSize; i++) {
    const pick = allFields[Math.floor(Math.random() * totalWeight)];
    const { field, stage } = pick;

    entries.push({
      id: generateId(),
      projectId: baseProjectId,
      stageSource: stage,
      entryType: field.entryType,
      content: generateContent(field, i),
      fieldPath: field.fieldPath.replace("[]", `[${Math.floor(Math.random() * 5)}]`),
      evidenceLevel: field.evidenceLevel,
      confirmedAt: new Date(Date.now() - Math.random() * 180 * 24 * 3600 * 1000), // 随机过去 180 天
    });
  }

  return entries;
}

// ── 数据质量验证 ────────────────────────────────────────

function validateDataset(entries: DMEntry[], label: string) {
  console.log(`\n=== Dataset Validation: ${label} ===`);
  console.log(`Total entries: ${entries.length}`);

  // Stage distribution
  const stageDist: Record<number, number> = {};
  for (const e of entries) {
    stageDist[e.stageSource] = (stageDist[e.stageSource] || 0) + 1;
  }
  console.log(`Stage distribution: ${Object.entries(stageDist).sort((a,b) => +a[0]-+b[0]).map(([k,v]) => `S${k}=${v}`).join(", ")}`);

  // EntryType distribution
  const typeDist: Record<string, number> = {};
  for (const e of entries) {
    typeDist[e.entryType] = (typeDist[e.entryType] || 0) + 1;
  }
  console.log(`EntryType: ${Object.entries(typeDist).map(([k,v]) => `${k}=${(v/entries.length*100).toFixed(0)}%`).join(", ")}`);

  // Content length
  const lengths = entries.map(e => e.content.length).sort((a,b) => a-b);
  const avg = lengths.reduce((a,b) => a+b, 0) / lengths.length;
  console.log(`Content length: min=${lengths[0]}, max=${lengths[lengths.length-1]}, avg=${avg.toFixed(0)}`);

  // Unique fieldPaths
  const paths = new Set(entries.map(e => e.fieldPath.replace(/\[\d+\]/g, "[]")));
  console.log(`Unique fieldPaths: ${paths.size}`);
}

// ── 保存 ────────────────────────────────────────────────

import * as fs from "fs";
import * as path from "path";

async function main() {
  const sizes = [500, 5000];
  const outputDir = path.join(__dirname, "..", "test-results", "dm-datasets");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const size of sizes) {
    console.log(`\nGenerating ${size} entries...`);
    const dataset = generateDataset(size);
    validateDataset(dataset, `${size} entries`);

    const outputPath = path.join(outputDir, `dm-synthetic-${size}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));
    console.log(`Saved to ${outputPath}`);
  }

  // 输出业务分布说明
  console.log(`\n=== Schema Coverage ===`);
  const allPaths = new Set<string>();
  for (const sc of STAGE_CONFIGS) {
    for (const f of sc.fields) {
      allPaths.add(f.fieldPath);
    }
    const extended = EXTENDED_FIELDS_BY_STAGE[sc.stage];
    if (extended) {
      for (const f of extended) {
        allPaths.add(`★ ${f.fieldPath}`);
      }
    }
  }
  console.log(`Core field paths: ${STAGE_CONFIGS.reduce((s, sc) => s + sc.fields.length, 0)}`);
  console.log(`Extended field paths: ${Object.values(EXTENDED_FIELDS_BY_STAGE).reduce((s, fs) => s + fs.length, 0)}`);
  console.log(`Total unique field types: ${allPaths.size}`);
}

main().catch(err => {
  console.error("Generation failed:", err);
  process.exit(1);
});
