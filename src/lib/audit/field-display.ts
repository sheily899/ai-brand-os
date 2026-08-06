/**
 * 审计字段名 → 用户可读业务概念名映射
 *
 * 供前端组件和后端 audit 模块共享使用。
 * 此文件不引入任何 Node.js / 数据库依赖，可安全在客户端导入。
 */

/** 将内部 fieldPath 映射为用户可理解的业务概念名 */
const FIELD_DISPLAY_NAMES: Record<string, string> = {
  "founderMotivation.content": "创始人动机",
  "founderMotivation": "创始人动机",
  "confirmedProblems": "确认的核心问题",
  "observations": "市场观察",
  "constraints": "已知约束",
  "businessBackground.marketContext": "商业背景·市场环境",
  "businessBackground": "商业背景",
  "strategicChallenge": "核心战略挑战",
  "businessModel": "商业模式",
  "currentStage": "当前阶段判断",
  "opportunityDirections": "市场机会方向",
  "marketSize": "市场规模判断",
  "marketTrend": "市场趋势判断",
  "marketGap": "市场缺口判断",
  "categoryDefinition": "品类定义",
  "growthDriver": "增长驱动因素",
  "deepNeeds.functionalNeed": "功能层需求",
  "functionalNeed": "功能层需求",
  "deepNeeds.identityNeed": "身份认同层需求",
  "identityNeed": "身份认同层需求",
  "deepNeeds": "深层需求",
  "strategicWindow": "战略时机判断",
  "evidenceLevel": "证据等级",
  "userPersona": "用户画像",
  "decisionMotive": "决策动机",
  "behaviorPattern": "行为模式",
  "consumptionScenario": "消费场景",
  "competitiveGap.marketOpportunity": "竞争空位判断",
  "competitiveGap": "竞争空位",
  "competitorMap": "竞品格局",
  "competitivePosition": "竞争定位",
  "mindshareGap": "心智空位",
  "differentiationAngle": "差异化角度",
  "positioning": "品牌定位",
  "valueProposition": "价值主张",
  "brandPersonality": "品牌人格",
  "brandStory": "品牌故事",
  "rtb": "信任理由",
  "targetAudience": "目标受众",
  "coreConcept": "核心视觉概念",
  "visualSystem": "视觉系统",
  "visualDirection": "视觉方向",
  "coreDirection": "内容核心方向",
  "themeDirections": "内容主题方向",
  "contentPillars": "内容支柱",
  "reasoning.marketOpportunityReference": "市场机会引用依据",
  "reasoning.consumerInsightReference": "消费者洞察引用依据",
  "reasoning.competitiveGapReference": "竞争空位引用依据",
  "reasoning": "战略推导依据",
  "coreChallenges.externalChallenges": "外部挑战",
  "externalChallenges": "外部挑战",
  "coreChallenges": "核心挑战",
  "strategicDirection.directionHypothesis": "战略方向假设",
  "strategicDirection": "战略方向",
  "marketOverview": "市场概况",
  "marketOverview.marketStage": "市场阶段",
  "marketStage": "市场阶段",
  "marketOverview.growthRate": "增长率",
  "growthRate": "增长率",
  "targetConsumer.definition": "目标消费者定义",
  "targetConsumer.idealSelfReflection": "理想自我映射",
  "targetConsumer": "目标消费者",
  "idealSelfReflection": "理想自我映射",
  "competitiveGap.unmetNeeds": "未满足需求",
  "competitors": "竞品分析",
  "unmetNeeds": "未满足需求",
  "marketOpportunity": "市场机会",
  "opportunityGap": "机会缺口",
  "valuePropositions": "价值主张",
  "brandStory.brandAction": "品牌行动",
  "brandAction": "品牌行动",
  "brandStory.struggleMoment": "困境时刻",
  "struggleMoment": "困境时刻",
  "visualSystem.form": "形态语言",
  "visualSystem.color": "色彩语言",
  "visualSystem.typography": "字体语言",
  "visualSystem.imagery": "图像语言",
  "visualSystem.material": "材质语言",
  "restrictions": "视觉禁区",
  "channelStrategy": "渠道策略",
  "contentValueSystem": "内容价值体系",
  "keywords": "视觉关键词",
  // S1
  "founderType": "创始人类型",
  "motivation": "创始人动机",
  "creation_driven": "创造驱动型",
  "problem_driven": "问题驱动型",
  "source": "来源",
  "subject": "观察对象",
  "context": "观察情境",
  "behavior": "观察行为",
  "result": "观察结果",
  "budget": "预算约束",
  "team": "团队约束",
  "timeline": "时间约束",
  // S2
  "drivingForces": "市场驱动因素",
  "internalChallenges": "内部挑战",
  "workingPriorities": "阶段工作重点",
  "dataSources": "数据来源",
  "dimension": "数据维度",
  "sourceType": "来源类型",
  "url": "来源链接",
  "title": "来源标题",
  "retrievedAt": "检索时间",
  // S3
  "industryTrend": "行业趋势",
  "channelAnalysis": "渠道分析",
  "regulatoryEnvironment": "监管环境",
  "categoryStatus": "品类现状",
  "experienceGaps": "体验缺口",
  "channelStructure": "渠道结构",
  "currentTrends": "当前流行趋势",
  "longTermTrends": "长期演变趋势",
  "mainChannels": "主流售卖渠道",
  "trafficRules": "流量规则",
  "acquisitionPatterns": "起盘路径案例",
  "policies": "政策要求",
  "risks": "合规风险",
  "definition": "品类定义",
  "currentState": "供给格局现状",
  "trends": "品类趋势",
  "gap": "供需错配点",
  "currentAlternative": "现有替代方案",
  "severity": "严重程度",
  "direction": "机会方向",
  "rationale": "战略判断依据",
  "summary": "摘要",
  "type": "来源类型",
  // S4
  "existingSolutions": "现有解决方案",
  "solutionType": "解决路径类型",
  "examples": "采用产品/行为示例",
  "failReason": "方案失效原因",
  // S5
  "competitiveLandscape": "竞争格局",
  "dimensions": "竞争维度",
  "representativeBrands": "代表品牌",
  "coreStrategy": "核心打法",
  "consumerNeed": "满足的消费者需求",
  "convergenceAndDivergence": "品类趋同与分化",
  "name": "品牌名称",
  "slogan": "品牌 Slogan",
  "priceRange": "价格带",
  "heroProducts": "明星产品",
  "sellingPoint": "差异化卖点",
  "communication": "传播分析",
  "platforms": "主要传播平台",
  "contentDirection": "内容方向",
  "userPraise": "用户好评",
  "theme": "好评主题",
  "excerpt": "好评原文",
  "userComplaints": "用户差评",
  "strengths": "竞品优势",
  "weaknesses": "竞品短板",
  "sources": "信息来源",
  "logo": "Logo 特征",
  "color": "色彩体系",
  "packaging": "包装风格",
  // S6
  "proposition": "价值主张内容",
  "level": "价值层级",
  "soWhatDerivation": "So What 推导",
  "brandRelationship": "品牌关系",
  "trait": "人格关键词",
  "dos": "应做行为",
  "donts": "禁做行为",
  "directionHypothesis": "战略方向假设",
  // 价值主张三个层级（精确匹配中英混杂表述）
  "functional 层": "功能层",
  "emotional 层": "情绪层",
  "social 层": "社会层",
  // 裸层级名（用于斜杠/或字分隔的文本，如 "functional/emotional/social"）
  // 注意：functionalNeed/identityNeeds 等更长键会先替换，不会误伤
  "functionalNeeds": "功能层需求",
  "identityNeeds": "身份认同层需求",
  "functional": "功能层",
  "emotional": "情绪层",
  "social": "社会层",
  // 用户旅程阶段
  "awareness": "认知阶段",
  "interest": "兴趣阶段",
  "trust": "信任阶段",
  "decision": "决策阶段",
  // 中文平台拼音
  "xiaohongshu": "小红书",
  "douyin": "抖音",
  "wechat": "微信",
  // 通用
  "root": "阶段输出",
  "vs": "对比",
  "weakness": "竞品短板",
  "moodboard": "情绪板",
  "checklist": "检查清单",
  "explicit": "明确的",
  // 常见枚举值翻译
  "error": "错误",
  "minor": "轻微",
  "major": "严重",
  "critical": "严重",
  "verified": "已验证",
  "ai_inferred": "AI 推断",
  "search_snippet": "搜索片段",
  // S7
  "choice": "方向选择",
  "exclusions": "应避免方向",
  "perceptualTone": "感知基调",
  "exclusion": "视觉禁区方向",
  "strategicRationale": "禁区战略理由",
  "keyword": "视觉关键词",
  // S8
  "userStage": "用户阶段",
  "userProblem": "用户问题",
  "contentValue": "内容价值",
  "pillar": "内容支柱名称",
  "corePurpose": "支柱核心目的",
  "topicDirections": "选题方向",
  "platform": "平台",
  "contentFormat": "内容形式",
  "expressionFocus": "表达重点",
};

/** 将内部 fieldPath 转为用户可读的业务概念名 */
export function displayFieldName(path: string): string {
  // 精确匹配
  if (FIELD_DISPLAY_NAMES[path]) return FIELD_DISPLAY_NAMES[path];
  // 去掉所有方括号索引后匹配（兼容数字 [0] 和字符串 [functional]）
  const normalized = path.replace(/\[[^\]]*\]/g, "[]");
  if (FIELD_DISPLAY_NAMES[normalized]) return FIELD_DISPLAY_NAMES[normalized];
  // 尝试单独匹配最后一段（如 visualSystem.typography → typography）
  const lastSegment = path.split(".").pop()?.replace(/\[[^\]]*\]/g, "") ?? path;
  if (FIELD_DISPLAY_NAMES[lastSegment]) return FIELD_DISPLAY_NAMES[lastSegment];
  return path;
}

/**
 * 将消息文本中的内部字段路径替换为用户可读的业务概念名，
 * 同时清理技术标记（[Sn]、Decision Memory 等）。
 */
export function localizeFieldNames(text: string): string {
  let result = text;
  // 按 fieldPath 长度降序排列，避免短名称误匹配长名称
  const entries = Object.entries(FIELD_DISPLAY_NAMES)
    .sort((a, b) => b[0].length - a[0].length);
  for (const [fieldPath, display] of entries) {
    // 只对纯英文标识符使用 \b 词边界，避免子串误匹配
    // （如 "weakness" 不应匹配 "weaknesses"，"proposition" 不应匹配 "valueProposition"）
    const escaped = fieldPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isIdentifier = /^[a-zA-Z_]\w*$/.test(fieldPath);
    const pattern = isIdentifier ? `\\b${escaped}\\b` : escaped;
    result = result.replace(new RegExp(pattern, "g"), display);
  }
  // 清理技术标记
  result = result.replace(/\[S(\d+)\]/g, "S$1");
  result = result.replace(/Decision Memory/g, "战略记忆");
  return result;
}

/**
 * 将技术依赖路径转为人读格式，只保留阶段 + 顶层字段。
 * 例: "S1.founderMotivation.content → S2.businessBackground.marketContext"
 *   → "S1 创始人动机 → S2 商业背景"
 */
export function displayDependencyPath(path: string): string {
  if (!path || typeof path !== "string") return "";

  return path
    .split(" → ")
    .map((side) => {
      const match = side.match(/^(S\d+)\.(.+)$/);
      if (!match) return side;
      const stageLabel = match[1];
      const fieldPath = match[2];

      // 只取顶层字段名（第一段）
      const topField = fieldPath.split(".")[0];
      const display = FIELD_DISPLAY_NAMES[topField] ?? topField;

      return `${stageLabel} ${display}`;
    })
    .join(" → ");
}
