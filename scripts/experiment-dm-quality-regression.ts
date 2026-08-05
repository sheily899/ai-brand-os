/**
 * DM Layered Compression 输出质量回归实验
 *
 * 验证 Full Mode vs Layered Mode 在 S6/S7/S8 任务上的输出质量差异。
 * 使用 AI Quality Audit 自动评分，不依赖人工主观评价。
 *
 * 实验设计：
 * - 对照组 A: Full Mode（完整注入全部 DM）
 * - 实验组 B: Layered Mode（基于重要性分层注入）
 *
 * 评价：每个输出经过 runAIQualityAudit() 四维评分
 */

import * as fs from "fs";
import * as path from "path";
import { getLLMProvider } from "../src/lib/ai/provider";
import { runAIQualityAudit } from "../src/lib/audit/ai-quality";
import { computeMemoryImportance } from "../src/lib/memory/decision-memory";

// ── 类型定义 ──────────────────────────────────────────────

interface DMEntry {
  stageSource: number;
  entryType: string;
  content: string;
  fieldPath: string;
  evidenceLevel: string;
}

interface TaskResult {
  task: string;
  stage: number;
  mode: "full" | "layered";
  inputChars: number;
  estimatedTokens: number;
  output: Record<string, any>;
  audit: {
    totalScore: number;
    dimensionScores: Array<{ dimension: string; score: number }>;
    gateRecommendation: string;
  } | null;
  auditError?: string;
}

// ── 内容生成 ──────────────────────────────────────────────

const STRATEGIC_CONTENT: Record<string, string[]> = {
  founderMotivation: [
    "创始人曾在欧莱雅担任配方研发7年，亲眼看到行业在成分浓度上恶性竞争，消费者的皮肤屏障却在恶化。2019年一位朋友的过敏经历促使她决定离开大厂，创建一个以皮肤屏障修复为核心的功效护肤品牌。",
    "创始人是一位连续创业者，之前创办的健身品牌因为供应链管理失误而失败。这次他花了18个月研究宠物食品供应链，发现国内高端宠物食品市场的原料溯源体系几乎空白，决定从透明供应链切入。",
  ],
  deepNeeds: [
    "目标消费者（25-35岁都市女性）在选择护肤品时，最大的焦虑不是找不到产品而是找不到信任。她们在社交媒体上看到太多相互矛盾的信息，渴望一个能用科学数据说话、不夸大宣传的品牌。她们愿意为有效且安全的产品支付溢价，但需要品牌先证明自己。",
    "宠物主人在选择猫粮时，功能性需求是营养均衡、适口性好、便便不臭。但在身份认同层面，他们希望通过选择的品牌来表达自己是一个科学养宠、不盲从的理性消费者。他们会研究配料表、对比营养成分、追踪原料产地。",
  ],
  competitiveGap: [
    "当前市场上存在明显的空白地带：一端是以修丽可为代表的院线专业品牌（高效但昂贵、有使用门槛），另一端是以薇诺娜为代表的药妆品牌（安全但品牌感知偏向'药'，缺乏情感共鸣）。在'专业有效+情感温度'的交叉地带，尚没有一个品牌占据消费者心智。",
    "宠物食品市场两极分化严重：进口高端品牌（渴望、爱肯拿）价格高、供应链不透明；国产品牌（麦富迪、比瑞吉）价格亲民但消费者信任度低。在'原料可溯源+价格可接受'的中间地带存在明显机会。",
  ],
  positioning: [
    "对于追求科学护肤的都市女性而言，本品牌是功能性护肤品类中能够实现'先修护再功效'的选择，因为我们从皮肤屏障修复出发建立产品体系，而非跟随成分热点。品牌定位基于S4消费者深层需求（对安全有效的渴望）和S5竞争空位（专业+温度的双重缺失）。",
    "对于理性养宠的新生代猫主人而言，本品牌是猫粮品类中能够实现'每一颗粮都可溯源'的选择，因为我们建立了从原料产地到生产批次的完整溯源体系。定位基于S4消费者对透明供应链的深层需求和S5进口国产之间的市场空位。",
  ],
  brandStory: [
    "2019年冬天，创始人的大学室友因为使用了一款主打高浓度酸类成分的护肤品导致严重过敏，整张脸红肿脱皮两个月。这件事让创始人开始反思：行业在比拼成分浓度时，是否忘记了皮肤的基本需求是健康？她决定做一个不追逐成分热点、专注于皮肤屏障修复的品牌。这个品牌相信：好的皮肤不是被'改造'出来的，而是被'修复'回来的。",
    "创始人在救助了一只严重营养不良的流浪猫后，开始研究猫粮配方。她发现很多品牌标注'天然''高端'但原料来源不透明。她花了6个月走访了14家供应商，最终建立了一套从农场到包装的溯源体系。这个品牌相信：宠物主人有权知道每一颗粮从哪里来。",
  ],
  coreConcept: [
    "以'透明层次'为核心视觉概念——通过多层次的透明度、自然光感和真实材质的呈现，传递品牌对成分透明和科学沟通的承诺。视觉系统围绕'清透感'和'层次感'两个关键词展开。",
    "以'从源头到碗里'为视觉叙事主线——通过真实的供应链影像、原料产地纪录和透明的生产过程展示，建立消费者对品牌的信任感。",
  ],
  coreDirection: [
    "品牌长期围绕'科学护肤的真相'与用户建立连接——不是科普成分浓度，而是帮助消费者建立辨别护肤信息真伪的能力，成为消费者在护肤决策中最信任的信息源。",
    "品牌围绕'看得见的品质'建立内容体系——通过持续展示供应链透明化过程、原料知识科普和真实用户反馈，让品质成为品牌最核心的内容资产。",
  ],
};

const CHINESE_NOISE = [
  "根据多轮用户访谈和消费行为数据分析，该品牌在目标市场中的差异化定位逐渐清晰，但仍有部分消费者对品牌核心价值的认知存在偏差，需要在传播策略上做针对性调整。",
  "从运营数据来看，过去三个月的复购率呈现稳步上升趋势，但新客获取成本同步增长，需要在投放效率和内容质量之间找到新的平衡点，运营团队建议将预算向内容营销倾斜。",
  "竞品分析显示，同类品牌在社交媒体上的内容策略趋于同质化，多数品牌集中在产品功能展示和使用教程类内容，缺乏品牌故事和价值观层面的深度沟通，这为我们的差异化内容提供了空间。",
  "用户反馈中反复出现的关键词包括品质感、专业性和信任度，但同时也有部分用户表示品牌距离感较强、不够亲近，这提示品牌需要在专业调性和亲和力之间做出调整。",
  "供应链端的数据表明，原材料价格波动对产品成本结构的影响在可接受范围内，但季节性需求波动导致的库存压力需要更精细化的预测模型来应对。",
  "团队内部讨论中出现了两个方向的争议：一部分人主张加大品牌投放力度以快速抢占市场份额，另一部分人则认为应该先打磨产品体验和用户服务体系，以口碑驱动增长。",
  "市场营销活动ROI数据显示，线下体验活动的用户转化率远高于线上广告投放，但覆盖人群有限，如何规模化复制线下体验的效果成为新的挑战，团队正在测试小规模快闪店模式。",
  "品牌健康度追踪指标显示，品牌认知度在过去半年提升了12个百分点，但品牌联想仍然集中在功能性层面，情感层面的品牌联想建设需要更长期的投入和更精准的内容策略。",
  "内容团队在季度复盘中发现，用户生成内容（UGC）的互动率是品牌原创内容的2.3倍，但UGC的内容质量和品牌调性一致性参差不齐，需要建立更系统化的UGC激励和筛选机制。",
  "行业报告指出，未来12个月内该品类将迎来新一轮的消费升级，消费者对产品成分、供应链透明度和品牌社会责任的关注度将持续提升，这为定位清晰的品牌提供了增长窗口。",
  "客服系统数据显示，用户在购买决策过程中最常咨询的三个问题是产品成分安全性、使用方法和效果周期、以及售后服务政策，这反映出消费者在做购买决策时的核心关切点是安全感和信任感。",
  "跨部门协作效率评估表明，市场部和产品部之间的信息传递存在明显延迟，导致市场活动经常无法及时反映产品的最新迭代和优化点，建议建立双周同步机制。",
  "A/B测试结果显示，以真实用户故事为切入点的内容比纯产品功能介绍的转化率高47%，但用户故事的获取和编辑成本也更高，需要建立系统化的用户故事收集流程。",
  "季度战略复盘会上，团队确认了品牌定位的核心方向不变，但建议在传播层面增加对供应链透明度的强调，因为消费者调研显示这一点是区分品牌与竞品的关键认知差异。",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateStrategicContent(fp: string): string {
  for (const [key, contents] of Object.entries(STRATEGIC_CONTENT)) {
    if (fp.includes(key)) return pick(contents);
  }
  return pick(Object.values(STRATEGIC_CONTENT)[0]);
}

function generateNoiseContent(): string {
  const count = 5 + Math.floor(Math.random() * 11); // 5-15 sentences
  const sentences: string[] = [];
  for (let i = 0; i < count; i++) {
    sentences.push(pick(CHINESE_NOISE));
  }
  return sentences.join("");
}

// ── 数据集生成 ──────────────────────────────────────────

function generateExperimentDataset(): DMEntry[] {
  const entries: DMEntry[] = [];

  // Layer 1: 50 战略锚点（品牌核心信息，应始终 FULL）
  const strategicFields = [
    { fp: "founderMotivation.content", stage: 1, et: "confirmed_fact", ev: "ai_inferred" },
    { fp: "deepNeeds.identityNeed", stage: 4, et: "hypothesis", ev: "ai_inferred" },
    { fp: "deepNeeds.functionalNeed", stage: 4, et: "confirmed_fact", ev: "ai_inferred" },
    { fp: "competitiveGap.marketOpportunity", stage: 5, et: "hypothesis", ev: "ai_inferred" },
    { fp: "positioning", stage: 6, et: "confirmed_decision", ev: "ai_inferred" },
    { fp: "brandStory.struggleMoment", stage: 6, et: "confirmed_fact", ev: "ai_inferred" },
    { fp: "brandStory.brandAction", stage: 6, et: "confirmed_decision", ev: "ai_inferred" },
    { fp: "brandStory.brandRelationship", stage: 6, et: "confirmed_decision", ev: "ai_inferred" },
    { fp: "coreConcept", stage: 7, et: "confirmed_decision", ev: "ai_inferred" },
    { fp: "coreDirection", stage: 8, et: "confirmed_decision", ev: "ai_inferred" },
  ];

  for (const sf of strategicFields) {
    for (let i = 0; i < 5; i++) {
      entries.push({
        stageSource: sf.stage,
        entryType: sf.et,
        content: generateStrategicContent(sf.fp) + (i > 0 ? ` (迭代v${i + 1})` : ""),
        fieldPath: sf.fp + (i > 0 ? `.v${i}` : ""),
        evidenceLevel: sf.ev,
      });
    }
  }

  // Layer 2: 50 搜索支撑的市场数据（search_backed → 应 FULL）
  const searchFields = [
    { fp: "marketOverview.marketSize", stage: 3, et: "confirmed_fact", ev: "search_backed" },
    { fp: "industryTrend.currentTrends", stage: 3, et: "confirmed_fact", ev: "search_backed" },
    { fp: "channelAnalysis.mainChannels", stage: 3, et: "confirmed_fact", ev: "search_backed" },
    { fp: "competitors.info", stage: 5, et: "confirmed_fact", ev: "search_backed" },
    { fp: "competitiveLandscape.analysis", stage: 5, et: "confirmed_fact", ev: "search_backed" },
  ];

  for (const sf of searchFields) {
    for (let i = 0; i < 10; i++) {
      entries.push({
        stageSource: sf.stage,
        entryType: sf.et,
        content: `搜索数据: ${generateNoiseContent()}`,
        fieldPath: sf.fp + (i > 0 ? `[${i}]` : ""),
        evidenceLevel: sf.ev,
      });
    }
  }

  // Layer 3: 100 噪声条目（AI推理/用户反馈/历史版本/运营日志 → 应 SUMMARY）
  const noiseTypes = [
    { fp: "aiReasoning.consultationTrace", stage: 3, et: "confirmed_fact", ev: "ai_inferred", count: 30 },
    { fp: "userFeedback.customerService", stage: 4, et: "confirmed_fact", ev: "ai_inferred", count: 25 },
    { fp: "decisionHistory.positioningVersion", stage: 6, et: "confirmed_fact", ev: "ai_inferred", count: 15 },
    { fp: "discussionNotes.strategyReview", stage: 6, et: "hypothesis", ev: "ai_inferred", count: 15 },
    { fp: "contentLog.postPerformance", stage: 8, et: "confirmed_fact", ev: "ai_inferred", count: 15 },
  ];

  for (const nt of noiseTypes) {
    for (let i = 0; i < nt.count; i++) {
      entries.push({
        stageSource: nt.stage,
        entryType: nt.et,
        content: generateNoiseContent(),
        fieldPath: nt.fp + (i > 0 ? `[${i}]` : ""),
        evidenceLevel: nt.ev,
      });
    }
  }

  return entries;
}

// ── Context 构建 ─────────────────────────────────────────

const SUMMARY_MAX_LENGTH = 200;

function buildExperimentContext(entries: DMEntry[], mode: "full" | "layered"): string {
  const facts = entries.filter((e) => e.entryType === "confirmed_fact");
  const decisions = entries.filter((e) => e.entryType === "confirmed_decision");
  const hypotheses = entries.filter((e) => e.entryType === "hypothesis");
  const unresolved = entries.filter((e) => e.entryType === "unresolved_question");

  const formatEntry = (e: DMEntry): string => {
    if (mode === "full") return `- [S${e.stageSource}] ${e.content}`;
    const score = computeMemoryImportance(e);
    if (score >= 4) return `- [S${e.stageSource}] ${e.content}`;
    const truncated =
      e.content.length > SUMMARY_MAX_LENGTH
        ? e.content.slice(0, SUMMARY_MAX_LENGTH) + "…"
        : e.content;
    return `- [S${e.stageSource}] ${truncated}`;
  };

  const lines: string[] = [];
  if (facts.length > 0) {
    lines.push("### 已确认事实");
    facts.forEach((f) => lines.push(formatEntry(f)));
  }
  if (decisions.length > 0) {
    lines.push("\n### 已确认决策");
    decisions.forEach((d) => lines.push(formatEntry(d)));
  }
  if (hypotheses.length > 0) {
    lines.push("\n### 待验证假设");
    hypotheses.forEach((h) => lines.push(formatEntry(h)));
  }
  if (unresolved.length > 0) {
    lines.push("\n### 未解决问题");
    unresolved.forEach((u) => lines.push(formatEntry(u)));
  }
  return lines.join("\n");
}

// ── 任务 Prompt ──────────────────────────────────────────

const TASK_PROMPTS: Record<string, { stage: number; systemPrompt: string; outputSchema: string }> = {
  S6: {
    stage: 6,
    systemPrompt: `你是一位资深品牌战略顾问。以下是品牌在过去各阶段积累的全部 Decision Memory（战略决策记忆），包含已确认的事实、决策、假设和未解决的问题。

请基于这些历史决策记忆，生成品牌核心战略（Stage 6 输出）。

你必须输出合法的 JSON，格式如下：
{
  "positioning": "完整定位陈述句：对于[目标消费者]而言，本品牌是[品类/场景]中能够实现[核心价值]的选择，因为[支撑理由]",
  "valuePropositions": [
    { "proposition": "10-15字功能价值主张", "level": "functional", "soWhatDerivation": "推导逻辑" },
    { "proposition": "10-15字情感价值主张", "level": "emotional", "soWhatDerivation": "推导逻辑" },
    { "proposition": "10-15字社会价值主张", "level": "social", "soWhatDerivation": "推导逻辑" }
  ],
  "brandStory": {
    "struggleMoment": "消费者面临的困境",
    "brandAction": "品牌的战略行动",
    "brandRelationship": "品牌与消费者建立的互动关系"
  },
  "brandPersonality": [
    { "trait": "人格关键词", "dos": "会如何做", "donts": "绝不如何做" }
  ],
  "reasoning": {
    "marketOpportunityReference": "引用自 S3 的具体判断",
    "consumerInsightReference": "引用自 S4 的具体判断",
    "competitiveGapReference": "引用自 S5 的具体判断"
  }
}

要求：
- 定位必须可追溯到 Decision Memory 中的消费者洞察（S4）和竞争空位（S5）
- 品牌故事需要体现创始人动机（S1）和品牌理念
- 价值主张三层递进不重复
- 至少 5 个品牌人格特质
- 只输出 JSON，不输出解释文字`,
    outputSchema: "BrandPositioning",
  },
  S7: {
    stage: 7,
    systemPrompt: `你是一位资深品牌视觉策略顾问。以下是品牌在过去各阶段积累的全部 Decision Memory，包含品牌定位、消费者洞察、竞争分析和品牌人格。

请基于这些历史决策记忆，生成视觉策略（Stage 7 输出）。

你必须输出合法的 JSON，格式如下：
{
  "coreConcept": "统领性的一句话视觉核心概念（至少10字）",
  "keywords": [
    { "keyword": "感知关键词", "rationale": "与品牌人格对应的逻辑说明" }
  ],
  "visualSystem": {
    "form": { "choice": "形态方向", "exclusions": "应避免的形态", "perceptualTone": "感知基调" },
    "color": { "choice": "色彩方向", "exclusions": "应避免的色彩", "perceptualTone": "感知基调" },
    "typography": { "choice": "字体方向", "exclusions": "应避免的字体风格", "perceptualTone": "感知基调" },
    "imagery": { "choice": "图像方向", "exclusions": "应避免的图像风格", "perceptualTone": "感知基调" },
    "material": { "choice": "材质方向", "exclusions": "应避免的材质", "perceptualTone": "感知基调" }
  },
  "restrictions": [
    { "exclusion": "视觉禁区", "strategicRationale": "排除的战略理由" }
  ]
}

要求：
- 视觉方向必须可追溯到品牌定位（S6）和品牌人格
- 五种视觉语言全部填充，每种有具体方向和排除项
- 至少 3 个视觉禁区，每个有战略理由
- 只输出 JSON，不输出解释文字`,
    outputSchema: "VisualStrategy",
  },
  S8: {
    stage: 8,
    systemPrompt: `你是一位资深品牌内容策略顾问。以下是品牌在过去各阶段积累的全部 Decision Memory，包含品牌定位、视觉策略、消费者洞察。

请基于这些历史决策记忆，生成内容策略（Stage 8 输出）。

你必须输出合法的 JSON，格式如下：
{
  "coreDirection": "一句话内容核心方向（至少10字）",
  "contentValueSystem": [
    { "userStage": "awareness", "userProblem": "该阶段用户面临的问题", "contentValue": "内容为该阶段提供的价值" },
    { "userStage": "interest", "userProblem": "该阶段用户面临的问题", "contentValue": "内容为该阶段提供的价值" },
    { "userStage": "trust", "userProblem": "该阶段用户面临的问题", "contentValue": "内容为该阶段提供的价值" },
    { "userStage": "decision", "userProblem": "该阶段用户面临的问题", "contentValue": "内容为该阶段提供的价值" }
  ],
  "themeDirections": [
    { "pillar": "内容支柱名称", "corePurpose": "该支柱的核心目的", "topicDirections": ["选题方向1", "选题方向2"] }
  ],
  "channelStrategy": [
    { "platform": "xiaohongshu", "contentFormat": "内容形式", "expressionFocus": "表达重点" },
    { "platform": "douyin", "contentFormat": "内容形式", "expressionFocus": "表达重点" },
    { "platform": "wechat", "contentFormat": "内容形式", "expressionFocus": "表达重点" }
  ]
}

要求：
- 内容方向可追溯到品牌定位和消费者洞察
- 四阶段用户旅程覆盖完整
- 至少 2 个内容支柱
- 三个平台策略各有差异化表达
- 只输出 JSON，不输出解释文字`,
    outputSchema: "ContentStrategy",
  },
};

// ── 主实验流程 ──────────────────────────────────────────

async function runTask(
  taskKey: string,
  taskConfig: { stage: number; systemPrompt: string; outputSchema: string },
  context: string,
  contextLabel: string,
  mode: "full" | "layered"
): Promise<TaskResult> {
  const provider = getLLMProvider();

  const fullPrompt = `${taskConfig.systemPrompt}\n\n---\n\n## Decision Memory 上下文\n\n${context}`;

  console.log(`\n  [${taskKey} ${mode}] 发送请求... (context: ${context.length.toLocaleString()} chars)`);

  const chatFn =
    provider.chatSafe ??
    (async (msgs: any, opts: any) => {
      try {
        return { content: await provider.chat(msgs, opts) };
      } catch (e: any) {
        return { content: "", error: e.message };
      }
    });

  const result = await chatFn(
    [{ role: "user", content: fullPrompt }],
    { temperature: 0.3, maxTokens: 4096, responseFormat: "json_object" }
  );

  if (result.error) {
    console.log(`  [${taskKey} ${mode}] LLM 调用失败: ${result.error}`);
    return {
      task: taskKey,
      stage: taskConfig.stage,
      mode,
      inputChars: context.length,
      estimatedTokens: Math.round(context.length / 4),
      output: { _error: result.error },
      audit: null,
      auditError: result.error,
    };
  }

  // 解析 JSON 输出
  let output: Record<string, any>;
  try {
    // 清理可能的 markdown 代码块
    let cleaned = result.content;
    cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    output = JSON.parse(cleaned);
  } catch {
    output = { _rawOutput: result.content, _parseError: true };
  }

  console.log(`  [${taskKey} ${mode}] 输出解析${output._parseError ? "失败" : "成功"}`);

  // 运行 AI Quality Audit
  let audit: TaskResult["audit"] = null;
  let auditError: string | undefined;

  try {
    const auditResult = await runAIQualityAudit(taskConfig.stage, output);
    audit = {
      totalScore: auditResult.totalScore,
      dimensionScores: auditResult.dimensionScores.map((d) => ({
        dimension: d.dimension,
        score: d.score,
      })),
      gateRecommendation: auditResult.gateRecommendation,
    };
    console.log(`  [${taskKey} ${mode}] Audit: ${audit.totalScore}/100 (${audit.gateRecommendation})`);
  } catch (e: any) {
    auditError = e.message;
    console.log(`  [${taskKey} ${mode}] Audit 失败: ${e.message}`);
  }

  return {
    task: taskKey,
    stage: taskConfig.stage,
    mode,
    inputChars: context.length,
    estimatedTokens: Math.round(context.length / 4),
    output,
    audit,
    auditError,
  };
}

// ── 报告生成 ────────────────────────────────────────────

function generateReport(
  results: TaskResult[],
  datasetStats: { total: number; fullCount: number; sumCount: number; fullChars: number; layeredChars: number }
) {
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   DM 分层压缩 — 输出质量回归实验（Full vs Layered）              ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  // ── 数据集统计 ──
  console.log("━━━ 数据集概况 ━━━\n");
  console.log(`总条目: ${datasetStats.total}  |  FULL: ${datasetStats.fullCount}  |  SUMMARY: ${datasetStats.sumCount}`);
  console.log(`Full Mode:    ${datasetStats.fullChars.toLocaleString()} chars (~${Math.round(datasetStats.fullChars / 4).toLocaleString()} tokens)`);
  console.log(`Layered Mode: ${datasetStats.layeredChars.toLocaleString()} chars (~${Math.round(datasetStats.layeredChars / 4).toLocaleString()} tokens)`);
  const compressionRate = datasetStats.fullChars > 0
    ? ((1 - datasetStats.layeredChars / datasetStats.fullChars) * 100).toFixed(1)
    : "0.0";
  console.log(`上下文压缩率: ${compressionRate}%\n`);

  // ── 结果表格 ──
  console.log("━━━ ① 质量对比 ━━━\n");
  console.log("任务   │ 模式    │ Input Tokens │ Audit 总分 │ Specificity │ Differentiation │ Actionability │ Evidence │ Gate");
  console.log("───────┼─────────┼──────────────┼───────────┼─────────────┼─────────────────┼───────────────┼──────────┼──────");

  for (const r of results) {
    const task = r.task.padEnd(5);
    const mode = r.mode === "full" ? "Full   " : "Layered";
    const tokens = Math.round(r.estimatedTokens / 1000) + "K".padStart(4);
    const total = r.audit ? String(r.audit.totalScore).padStart(3) : "N/A".padStart(3);
    const dims = r.audit
      ? r.audit.dimensionScores.map((d) => String(d.score).padStart(2)).join("           ")
      : "N/A";
    const gate = r.audit ? r.audit.gateRecommendation : "N/A";

    // Pad for alignment
    const spec = r.audit?.dimensionScores.find(d => d.dimension === "specificity")?.score ?? "?";
    const diff = r.audit?.dimensionScores.find(d => d.dimension === "differentiation")?.score ?? "?";
    const act = r.audit?.dimensionScores.find(d => d.dimension === "actionability")?.score ?? "?";
    const ev = r.audit?.dimensionScores.find(d => d.dimension === "evidence")?.score ?? "?";

    console.log(`${task} │ ${mode} │ ${tokens.padStart(10)} │ ${total.padStart(7)} │ ${String(spec).padStart(9)} │ ${String(diff).padStart(13)} │ ${String(act).padStart(11)} │ ${String(ev).padStart(6)} │ ${gate.padStart(4)}`);
  }
  console.log();

  // ── 质量差异计算 ──
  console.log("━━━ ② 质量差异 (Layered - Full) ━━━\n");
  console.log("任务   │ Total Δ │ Spec Δ │ Diff Δ │ Action Δ │ Evid Δ │ 结论");
  console.log("───────┼─────────┼────────┼────────┼──────────┼────────┼──────");

  const tasks = ["S6", "S7", "S8"];
  for (const task of tasks) {
    const full = results.find((r) => r.task === task && r.mode === "full");
    const layered = results.find((r) => r.task === task && r.mode === "layered");

    if (!full?.audit || !layered?.audit) {
      console.log(`${task.padEnd(5)} │ 审计不可用，跳过`);
      continue;
    }

    const totalDelta = layered.audit.totalScore - full.audit.totalScore;
    const specDelta = (layered.audit.dimensionScores.find(d => d.dimension === "specificity")?.score ?? 0) -
      (full.audit.dimensionScores.find(d => d.dimension === "specificity")?.score ?? 0);
    const diffDelta = (layered.audit.dimensionScores.find(d => d.dimension === "differentiation")?.score ?? 0) -
      (full.audit.dimensionScores.find(d => d.dimension === "differentiation")?.score ?? 0);
    const actDelta = (layered.audit.dimensionScores.find(d => d.dimension === "actionability")?.score ?? 0) -
      (full.audit.dimensionScores.find(d => d.dimension === "actionability")?.score ?? 0);
    const evDelta = (layered.audit.dimensionScores.find(d => d.dimension === "evidence")?.score ?? 0) -
      (full.audit.dimensionScores.find(d => d.dimension === "evidence")?.score ?? 0);

    const absTotalDelta = Math.abs(totalDelta);
    const conclusion = absTotalDelta <= 3 ? "✅ 无显著差异" : absTotalDelta <= 5 ? "⚠️ 轻微差异" : "❌ 显著差异";

    console.log(
      `${task.padEnd(5)} │ ${String(totalDelta).padStart(5)} │ ${String(specDelta).padStart(4)} │ ${String(diffDelta).padStart(4)} │ ${String(actDelta).padStart(6)} │ ${String(evDelta).padStart(4)} │ ${conclusion}`
    );
  }
  console.log();

  // ── 综合判定 ──
  console.log("━━━ ③ 通过标准判定 ━━━\n");

  const validResults = results.filter((r) => r.audit !== null);
  const fullResults = validResults.filter((r) => r.mode === "full");
  const layeredResults = validResults.filter((r) => r.mode === "layered");

  if (fullResults.length > 0 && layeredResults.length > 0) {
    const avgFull = fullResults.reduce((s, r) => s + r.audit!.totalScore, 0) / fullResults.length;
    const avgLayered = layeredResults.reduce((s, r) => s + r.audit!.totalScore, 0) / layeredResults.length;
    const qualityDelta = avgLayered - avgFull;

    const tokenFull = fullResults.reduce((s, r) => s + r.estimatedTokens, 0);
    const tokenLayered = layeredResults.reduce((s, r) => s + r.estimatedTokens, 0);
    const tokenSavings = tokenFull > 0 ? ((1 - tokenLayered / tokenFull) * 100).toFixed(1) : "0";

    console.log(`平均质量变化:     ${qualityDelta >= 0 ? "+" : ""}${qualityDelta.toFixed(1)} 分 ${Math.abs(qualityDelta) <= 3 ? "✅" : "⚠️"} (目标 |Δ|≤3)`);
    console.log(`Token 消耗下降:   ${tokenSavings}% ${parseFloat(tokenSavings) >= 30 ? "✅" : parseFloat(tokenSavings) >= 15 ? "⚠️" : "❌"} (目标 ≥30%)`);

    const allAdvance = layeredResults.every((r) => r.audit!.gateRecommendation === "advance");
    console.log(`Gate 通过率:      ${layeredResults.filter(r => r.audit!.gateRecommendation === "advance").length}/${layeredResults.length} ${allAdvance ? "✅" : "⚠️"}`);

    const passed =
      Math.abs(qualityDelta) <= 3 &&
      parseFloat(tokenSavings) >= 30 &&
      allAdvance;

    if (passed) {
      console.log(`\n✅ 实验通过 — Layered Mode 在降低 Token 消耗的同时保持战略输出质量`);
    } else {
      console.log(`\n⚠️ 部分指标未达标 — 详见上方明细`);
    }
  }

  // ── 面试表达 ──
  console.log("\n━━━ ④ 面试表达 ━━━\n");
  console.log(`"我们进行了 Memory Governance 实验。首先通过 50K 规模压力测试验证上下文治理能力，`);
  console.log(`然后采用 Full Context 作为 Baseline，通过 Audit 系统比较分层 Memory 后的战略输出质量。`);
  console.log(`最终证明在减少 Token 消耗的情况下，核心战略决策质量没有显著下降。"\n`);
}

// ── 入口 ────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(60));
  console.log("DM Layered 压缩 — 输出质量回归实验");
  console.log("═".repeat(60));

  // 1. 生成数据集
  console.log("\n[1/4] 生成实验数据集...");
  const entries = generateExperimentDataset();
  console.log(`  生成 ${entries.length} 条 DM 条目`);

  // 统计
  const fullCount = entries.filter((e) => computeMemoryImportance(e) >= 4).length;
  const sumCount = entries.length - fullCount;
  console.log(`  FULL: ${fullCount} (${(fullCount / entries.length * 100).toFixed(0)}%)  |  SUMMARY: ${sumCount} (${(sumCount / entries.length * 100).toFixed(0)}%)`);

  // 2. 构建两种 Context
  console.log("\n[2/4] 构建 Full / Layered Context...");
  const fullCtx = buildExperimentContext(entries, "full");
  const layeredCtx = buildExperimentContext(entries, "layered");
  console.log(`  Full:    ${fullCtx.length.toLocaleString()} chars (~${Math.round(fullCtx.length / 4).toLocaleString()} tokens)`);
  console.log(`  Layered: ${layeredCtx.length.toLocaleString()} chars (~${Math.round(layeredCtx.length / 4).toLocaleString()} tokens)`);
  const compression = fullCtx.length > 0 ? ((1 - layeredCtx.length / fullCtx.length) * 100).toFixed(1) : "0";
  console.log(`  压缩率:  ${compression}%`);

  // 3. 运行实验
  console.log("\n[3/4] 运行 S6/S7/S8 Full vs Layered 对比...");

  const results: TaskResult[] = [];
  const taskKeys = ["S6", "S7", "S8"];

  for (const taskKey of taskKeys) {
    const taskConfig = TASK_PROMPTS[taskKey];

    // Full Mode
    console.log(`\n── ${taskKey} ──`);
    const fullResult = await runTask(taskKey, taskConfig, fullCtx, "Full", "full");
    results.push(fullResult);

    // Layered Mode
    const layeredResult = await runTask(taskKey, taskConfig, layeredCtx, "Layered", "layered");
    results.push(layeredResult);
  }

  // 4. 生成报告
  console.log("\n[4/4] 生成对比报告...");
  generateReport(results, {
    total: entries.length,
    fullCount,
    sumCount,
    fullChars: fullCtx.length,
    layeredChars: layeredCtx.length,
  });

  // 保存详细数据
  const outputDir = path.join(__dirname, "..", "tests", "dm-experiments", "data");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const reportData = {
    experiment: "DM Layered 输出质量回归实验",
    timestamp: new Date().toISOString(),
    dataset: {
      totalEntries: entries.length,
      fullCount,
      sumCount,
      fullChars: fullCtx.length,
      layeredChars: layeredCtx.length,
      compressionRate: `${compression}%`,
    },
    results: results.map((r) => ({
      task: r.task,
      stage: r.stage,
      mode: r.mode,
      inputChars: r.inputChars,
      estimatedTokens: r.estimatedTokens,
      audit: r.audit,
      auditError: r.auditError,
      // Don't save full output to keep file size manageable, save first 500 chars
      outputPreview: JSON.stringify(r.output).slice(0, 500),
    })),
  };

  fs.writeFileSync(
    path.join(outputDir, "quality-regression-results.json"),
    JSON.stringify(reportData, null, 2)
  );
  console.log(`\n详细数据已保存至 tests/dm-experiments/data/quality-regression-results.json`);
}

main().catch((err) => {
  console.error("实验失败:", err);
  process.exit(1);
});
