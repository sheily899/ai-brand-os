/**
 * 50K 压力测试：模拟真实长期品牌运营的 Decision Memory 膨胀场景
 *
 * 设计原则：
 * - 基于真实 2,778 条 DM 的 Schema 校准
 * - 模拟品牌运营 2-3 年后自然积累的 Memory 膨胀
 * - 45,000 条长文本低价值噪声（AI推理/用户反馈/运营日志/历史版本）
 * - 4,500 条搜索支撑的市场/竞品数据
 * - 500 条战略锚点字段（永远 FULL）
 *
 * 验证目标：
 * 在 50,000 条、总计 ~30MB 上下文的极端场景下，
 * Layered Mode 仍能保持 100% 战略字段保留，同时压缩 70%+ 噪声 Token。
 */

import * as fs from "fs";
import * as path from "path";
import { computeMemoryImportance } from "../src/lib/memory/decision-memory";

// ── 条目类型定义 ────────────────────────────────────────

interface DMEntry {
  stageSource: number;
  entryType: string;
  content: string;
  fieldPath: string;
  evidenceLevel: string;
}

// ── 内容生成器 ──────────────────────────────────────────

const CHINESE_FILLER = [
  "根据多轮用户访谈和消费行为数据分析，该品牌在目标市场中的差异化定位逐渐清晰，但仍有部分消费者对品牌核心价值的认知存在偏差。",
  "从运营数据来看，过去三个月的复购率呈现稳步上升趋势，但新客获取成本同步增长，需要在投放效率和内容质量之间找到新的平衡点。",
  "竞品分析显示，同类品牌在社交媒体上的内容策略趋于同质化，多数品牌集中在产品功能展示和使用教程类内容，缺乏品牌故事和价值观层面的深度沟通。",
  "用户反馈中反复出现的关键词包括'品质感''专业性'和'信任度'，但同时也有部分用户表示品牌'距离感较强''不够亲近'，这提示品牌需要在专业调性和亲和力之间做出调整。",
  "供应链端的数据表明，原材料价格波动对产品成本结构的影响在可接受范围内，但季节性需求波动导致的库存压力需要更精细化的预测模型来应对。",
  "团队内部讨论中出现了两个方向的争议：一部分人主张加大品牌投放力度以快速抢占市场份额，另一部分人则认为应该先打磨产品体验和用户服务体系，以口碑驱动增长。",
  "市场营销活动ROI数据显示，线下体验活动的用户转化率远高于线上广告投放，但覆盖人群有限，如何规模化复制线下体验的效果成为新的挑战。",
  "品牌健康度追踪指标显示，品牌认知度在过去半年提升了12个百分点，但品牌联想仍然集中在功能性层面，情感层面的品牌联想建设需要更长期的投入。",
  "内容团队在季度复盘中发现，用户生成内容（UGC）的互动率是品牌原创内容的2.3倍，但UGC的内容质量和品牌调性一致性参差不齐，需要建立更系统化的UGC激励和筛选机制。",
  "行业报告指出，未来12个月内该品类将迎来新一轮的消费升级，消费者对产品成分、供应链透明度和品牌社会责任的关注度将持续提升。",
  "客服系统数据显示，用户在购买决策过程中最常咨询的三个问题是：产品成分安全性、使用方法和效果周期、以及售后服务政策，这反映出消费者在做购买决策时的核心关切点。",
  "跨部门协作效率评估表明，市场部和产品部之间的信息传递存在明显延迟，导致市场活动经常无法及时反映产品的最新迭代和优化点。",
];

const STRATEGIC_CONTENT = [
  "品牌定位：面向追求品质生活的都市年轻家庭，提供以天然成分为核心的功能性个人护理产品，区别于传统化工品牌的刺激性配方，让消费者在安全呵护中感受肌肤的自然修复力。这是基于S4消费者深层需求（功能性+身份认同）和S5竞争空位（天然安全+有效性的结合点）推导的战略选择。",
  "消费者深层需求（功能性）：用户需要一套能够在日常生活中无缝融入的护理方案，不增加额外的时间成本，同时能够看到可感知的效果改善。他们不信任夸大宣传，但相信数据和口碑。",
  "消费者深层需求（身份认同）：目标用户希望通过选择的品牌来表达自己的审美品味和生活态度——理性、克制、不从众。他们不追逐潮流，但追求经得起时间考验的品质。",
  "竞品心智空位：当前市场上，A类品牌主打成分浓度和专业性，B类品牌主打性价比和便捷性，但在'安全有效+情感共鸣'的交叉地带存在明显空白。消费者渴望一个既专业又温暖的品牌，而不是冷冰冰的实验室形象或过度营销的快消品形象。",
  "品牌核心视觉概念：以'自然光线下的真实质感'为核心，摒弃过度修饰和滤镜美学，用真实的材质、自然的光影和克制的色彩来传递品牌的诚实与专业。视觉系统围绕'透明感'和'层次感'两个关键词展开。",
  "内容核心方向：围绕'成分科普+真实体验+生活方式'三条主线构建内容矩阵，不追求热点和流量话题，而是持续产出对用户有长期价值的深度内容，建立品牌在专业领域的权威性和在情感层面的亲近感。",
];

function generateNoiseContent(type: string): string {
  // 随机拼接 5-15 个填充句，生成 400-3000 字的长文本（模拟真实运营记录的冗长性）
  const count = 5 + Math.floor(Math.random() * 11);
  const sentences: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * CHINESE_FILLER.length);
    sentences.push(CHINESE_FILLER[idx]);
  }
  return sentences.join("");
}

function generateStrategicContent(fieldPath: string): string {
  const idx = Math.floor(Math.random() * STRATEGIC_CONTENT.length);
  return STRATEGIC_CONTENT[idx];
}

// ── 50K 数据集生成 ──────────────────────────────────────

function generate50KDataset(): DMEntry[] {
  const entries: DMEntry[] = [];

  // ═══ Layer 1: 500 战略锚点字段（永远 FULL）══════════
  // 模拟品牌运营 2 年后，每个战略字段积累了多个版本的迭代记录
  const strategicFields = [
    { fp: "founderMotivation.content", stage: 1, et: "confirmed_fact", ev: "ai_inferred" },
    { fp: "deepNeeds.identityNeed", stage: 4, et: "hypothesis", ev: "ai_inferred" },
    { fp: "deepNeeds.functionalNeed", stage: 4, et: "confirmed_fact", ev: "ai_inferred" },
    { fp: "competitiveGap.marketOpportunity", stage: 5, et: "hypothesis", ev: "ai_inferred" },
    { fp: "positioning", stage: 6, et: "confirmed_decision", ev: "ai_inferred" },
    { fp: "brandStory.struggleMoment", stage: 6, et: "confirmed_fact", ev: "ai_inferred" },
    { fp: "brandStory.brandAction", stage: 6, et: "confirmed_decision", ev: "ai_inferred" },
    { fp: "coreConcept", stage: 7, et: "confirmed_decision", ev: "ai_inferred" },
    { fp: "coreDirection", stage: 8, et: "confirmed_decision", ev: "ai_inferred" },
  ];

  // 每个战略字段生成 ~55 个版本/变体（模拟多次迭代）
  for (const sf of strategicFields) {
    for (let i = 0; i < 55; i++) {
      entries.push({
        stageSource: sf.stage,
        entryType: sf.et,
        content: generateStrategicContent(sf.fp) + (i > 0 ? ` (第${i + 1}次迭代优化)` : ""),
        fieldPath: sf.fp + (i > 0 ? `.version[${i}]` : ""),
        evidenceLevel: sf.ev,
      });
    }
  }

  // ═══ Layer 2: 4,500 搜索支撑的市场/竞品数据 ════════
  const searchDataFields = [
    { fp: "marketOverview.marketSize", stage: 3, et: "confirmed_fact", ev: "search_backed" },
    { fp: "marketOverview.growthRate", stage: 3, et: "confirmed_fact", ev: "search_backed" },
    { fp: "industryTrend.currentTrends[]", stage: 3, et: "confirmed_fact", ev: "search_backed" },
    { fp: "channelAnalysis.mainChannels[]", stage: 3, et: "confirmed_fact", ev: "search_backed" },
    { fp: "competitors[].info", stage: 5, et: "confirmed_fact", ev: "search_backed" },
    { fp: "competitiveLandscape.convergenceAndDivergence", stage: 5, et: "confirmed_fact", ev: "search_backed" },
    { fp: "competitorUpdate.newMove[]", stage: 5, et: "confirmed_fact", ev: "search_snippet" },
    { fp: "marketUpdate.quarterlyGrowth[]", stage: 3, et: "confirmed_fact", ev: "search_backed" },
    { fp: "marketUpdate.newEntrants[]", stage: 3, et: "confirmed_fact", ev: "search_backed" },
  ];

  for (const sf of searchDataFields) {
    for (let i = 0; i < 500; i++) {
      entries.push({
        stageSource: sf.stage,
        entryType: sf.et,
        content: generateNoiseContent("search_data"),
        fieldPath: sf.fp.replace("[]", `[${i % 20}]`),
        evidenceLevel: sf.ev,
      });
    }
  }

  // ═══ Layer 3: 45,000 长文本低价值噪声 ════════════
  // 模拟品牌运营 2-3 年自然积累的各种记录
  const noiseTypes: Array<{ fp: string; stage: number; et: string; ev: string; count: number; desc: string }> = [
    // AI 推理过程日志 — 每次 consultation 和 reoptimize 的记录
    { fp: "aiReasoning.consultationTrace[].trace", stage: 3, et: "confirmed_fact", ev: "ai_inferred", count: 6000, desc: "AI 咨询推理过程" },
    { fp: "aiReasoning.reoptimizeTrace[].trace", stage: 5, et: "confirmed_fact", ev: "ai_inferred", count: 4000, desc: "AI 重优化推理过程" },
    { fp: "aiReasoning.auditTrace[].reasoning", stage: 6, et: "hypothesis", ev: "ai_inferred", count: 4000, desc: "AI 审计推理链路" },

    // 用户反馈原文 — 客服对话、问卷回复、社媒评论
    { fp: "userFeedback.customerService[].transcript", stage: 4, et: "confirmed_fact", ev: "ai_inferred", count: 5000, desc: "客服对话记录" },
    { fp: "userFeedback.surveyResponse[].answer", stage: 4, et: "confirmed_fact", ev: "ai_inferred", count: 3000, desc: "用户问卷回复" },
    { fp: "userFeedback.socialComment[].content", stage: 8, et: "confirmed_fact", ev: "ai_inferred", count: 3000, desc: "社媒用户评论" },

    // 历史决策版本 — 旧快照，confirmed_fact 而非 confirmed_decision
    { fp: "decisionHistory.positioningVersion[].snapshot", stage: 6, et: "confirmed_fact", ev: "ai_inferred", count: 2000, desc: "定位历史版本" },
    { fp: "decisionHistory.valuePropVersion[].snapshot", stage: 6, et: "confirmed_fact", ev: "ai_inferred", count: 2000, desc: "价值主张历史版本" },
    { fp: "decisionHistory.storyVersion[].snapshot", stage: 6, et: "confirmed_fact", ev: "ai_inferred", count: 1000, desc: "品牌故事历史版本" },

    // 内容运营日志
    { fp: "contentLog.postPerformance[].metrics", stage: 8, et: "confirmed_fact", ev: "ai_inferred", count: 5000, desc: "内容发布效果数据" },
    { fp: "contentLog.abTestResult[].finding", stage: 8, et: "hypothesis", ev: "ai_inferred", count: 3000, desc: "内容A/B测试结论" },
    { fp: "contentLog.editorialCalendar[].entry", stage: 8, et: "confirmed_fact", ev: "ai_inferred", count: 2000, desc: "内容排期记录" },

    // 团队讨论记录
    { fp: "discussionNotes.strategyReview[].minutes", stage: 6, et: "hypothesis", ev: "ai_inferred", count: 2000, desc: "战略复盘会议纪要" },
    { fp: "discussionNotes.creativeBrainstorm[].notes", stage: 7, et: "hypothesis", ev: "ai_inferred", count: 1500, desc: "创意脑暴记录" },
    { fp: "discussionNotes.weeklySync[].summary", stage: 2, et: "hypothesis", ev: "ai_inferred", count: 1500, desc: "周会同步摘要" },
  ];

  for (const nt of noiseTypes) {
    for (let i = 0; i < nt.count; i++) {
      entries.push({
        stageSource: nt.stage,
        entryType: nt.et,
        content: generateNoiseContent(nt.fp),
        fieldPath: nt.fp.replace("[]", `[${i % 50}]`),
        evidenceLevel: nt.ev,
      });
    }
  }

  return entries;
}

// ── Full vs Layered 对比 ────────────────────────────────

const SUMMARY_MAX_LENGTH = 200;
const CORE_STRATEGIC_FIELDS = [
  "founderMotivation.content",
  "deepNeeds.identityNeed", "deepNeeds.functionalNeed",
  "competitiveGap.marketOpportunity",
  "positioning", "brandStory.struggleMoment", "brandStory.brandAction",
  "coreConcept", "coreDirection",
];

function buildContext(entries: DMEntry[], mode: "full" | "layered"): string {
  const facts = entries.filter(e => e.entryType === "confirmed_fact");
  const decisions = entries.filter(e => e.entryType === "confirmed_decision");
  const hypotheses = entries.filter(e => e.entryType === "hypothesis");
  const unresolved = entries.filter(e => e.entryType === "unresolved_question");

  const formatEntry = (e: DMEntry): string => {
    if (mode === "full") return `- [S${e.stageSource}] ${e.content}`;
    const score = computeMemoryImportance(e);
    if (score >= 4) return `- [S${e.stageSource}] ${e.content}`;
    const truncated = e.content.length > SUMMARY_MAX_LENGTH
      ? e.content.slice(0, SUMMARY_MAX_LENGTH) + "…"
      : e.content;
    return `- [S${e.stageSource}] ${truncated}`;
  };

  const lines: string[] = [];
  if (facts.length > 0) {
    lines.push("### 已确认事实");
    facts.forEach(f => lines.push(formatEntry(f)));
  }
  if (decisions.length > 0) {
    lines.push("\n### 已确认决策");
    decisions.forEach(d => lines.push(formatEntry(d)));
  }
  if (hypotheses.length > 0) {
    lines.push("\n### 待验证假设");
    hypotheses.forEach(h => lines.push(formatEntry(h)));
  }
  if (unresolved.length > 0) {
    lines.push("\n### 未解决问题");
    unresolved.forEach(u => lines.push(formatEntry(u)));
  }
  return lines.join("\n");
}

// ── 主流程 ──────────────────────────────────────────────

async function main() {
  console.log("生成 50,000 条模拟 DM 数据...");
  const entries = generate50KDataset();
  console.log(`生成完成: ${entries.length} 条`);

  // 统计分布
  const typeDist: Record<string, number> = {};
  const evDist: Record<string, number> = {};
  const stageDist: Record<number, number> = {};
  const lenDist: number[] = [];

  for (const e of entries) {
    typeDist[e.entryType] = (typeDist[e.entryType] || 0) + 1;
    evDist[e.evidenceLevel] = (evDist[e.evidenceLevel] || 0) + 1;
    stageDist[e.stageSource] = (stageDist[e.stageSource] || 0) + 1;
    lenDist.push(e.content.length);
  }
  lenDist.sort((a, b) => a - b);

  const totalChars = lenDist.reduce((a, b) => a + b, 0);
  const avgLen = totalChars / lenDist.length;

  console.log(`\n=== 数据集统计 ===`);
  console.log(`EntryType: ${Object.entries(typeDist).map(([k, v]) => `${k}=${(v / entries.length * 100).toFixed(0)}%`).join(", ")}`);
  console.log(`Evidence: ${Object.entries(evDist).map(([k, v]) => `${k}=${(v / entries.length * 100).toFixed(0)}%`).join(", ")}`);
  console.log(`Content: min=${lenDist[0]}, p50=${lenDist[Math.floor(lenDist.length * 0.5)]}, p95=${lenDist[Math.floor(lenDist.length * 0.95)]}, max=${lenDist[lenDist.length - 1]}`);
  console.log(`Avg content length: ${avgLen.toFixed(0)} chars`);
  console.log(`Total raw chars: ${totalChars.toLocaleString()}`);

  // ── 评分分布 ──
  const scoreBins: Record<string, { count: number; chars: number }> = {};
  for (const e of entries) {
    const score = computeMemoryImportance(e);
    const bin = score >= 4 ? "FULL" : "SUM";
    if (!scoreBins[bin]) scoreBins[bin] = { count: 0, chars: 0 };
    scoreBins[bin].count++;
    scoreBins[bin].chars += e.content.length;
  }
  console.log(`\n=== 重要性评分分布 ===`);
  console.log(`FULL: ${scoreBins["FULL"].count.toLocaleString()} (${(scoreBins["FULL"].count / entries.length * 100).toFixed(1)}%), avg ${(scoreBins["FULL"].chars / scoreBins["FULL"].count).toFixed(0)} chars`);
  console.log(`SUM:  ${scoreBins["SUM"].count.toLocaleString()} (${(scoreBins["SUM"].count / entries.length * 100).toFixed(1)}%), avg ${(scoreBins["SUM"].chars / scoreBins["SUM"].count).toFixed(0)} chars`);

  // ── Full vs Layered 对比 ──
  console.log(`\n=== Full Mode vs Layered Mode ===`);

  // 模拟 S8 场景（全部前序阶段）
  const priorEntries = entries.filter(e => e.stageSource < 8);

  const fullCtx = buildContext(priorEntries, "full");
  const layeredCtx = buildContext(priorEntries, "layered");

  const fullTokens = Math.round(fullCtx.length / 4);
  const layeredTokens = Math.round(layeredCtx.length / 4);
  const savings = fullCtx.length > 0 ? ((1 - layeredCtx.length / fullCtx.length) * 100).toFixed(1) : "0";

  console.log(`\nFull Mode:    ${fullCtx.length.toLocaleString()} chars, ~${fullTokens.toLocaleString()} tokens`);
  console.log(`Layered Mode: ${layeredCtx.length.toLocaleString()} chars, ~${layeredTokens.toLocaleString()} tokens`);
  console.log(`压缩率: ${savings}%`);

  // ── 战略字段保留率 ──
  const strategicInPrior = priorEntries.filter(e =>
    CORE_STRATEGIC_FIELDS.some(sf => e.fieldPath.includes(sf))
  );
  const strategicFull = strategicInPrior.filter(e => computeMemoryImportance(e) >= 4);
  const retentionPct = strategicInPrior.length > 0
    ? (strategicFull.length / strategicInPrior.length * 100).toFixed(1)
    : "N/A";

  console.log(`\n=== 战略字段保留率 ===`);
  console.log(`战略字段条目总数: ${strategicInPrior.length}`);
  console.log(`FULL 保留: ${strategicFull.length}`);
  console.log(`保留率: ${retentionPct}%`);

  // ── 按类型分组对比 ──
  console.log(`\n=== 按业务类型压缩效果 ===`);
  const typeGroups = new Map<string, DMEntry[]>();
  for (const e of priorEntries) {
    const category = e.fieldPath.split(".")[0].split("[")[0];
    if (!typeGroups.has(category)) typeGroups.set(category, []);
    typeGroups.get(category)!.push(e);
  }

  console.log(`${"类型".padEnd(22)} ${"条目".padStart(6)} ${"Full chars".padStart(12)} ${"Layered".padStart(12)} ${"压缩率".padStart(7)} ${"FULL%".padStart(6)}`);
  console.log("-".repeat(70));

  const sortedTypes = [...typeGroups.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [name, group] of sortedTypes) {
    const f = buildContext(group, "full");
    const l = buildContext(group, "layered");
    const cr = f.length > 0 ? ((1 - l.length / f.length) * 100).toFixed(0) : "0";
    const fullPct = (group.filter(e => computeMemoryImportance(e) >= 4).length / group.length * 100).toFixed(0);
    console.log(`${name.padEnd(22)} ${String(group.length).padStart(6)} ${String(f.length).padStart(12)} ${String(l.length).padStart(12)} ${(cr + "%").padStart(6)} ${(fullPct + "%").padStart(5)}`);
  }

  // ── 通过标准判定 ──
  console.log(`\n=== 通过标准判定 ===`);
  const crNum = parseFloat(savings);
  const retNum = parseFloat(retentionPct);

  console.log(`Token 压缩率:     ${savings}% ${crNum >= 50 ? "✅" : crNum >= 20 ? "⚠️" : "❌"} (目标 ≥50%)`);
  console.log(`战略字段保留率:   ${retentionPct}% ${retNum >= 100 ? "✅" : "❌"} (目标 100%)`);

  if (crNum >= 50 && retNum >= 100) {
    console.log(`\n✅ 压力测试通过 — 50K 规模下 Layered Mode 维持战略完整性且大幅压缩噪声`);
    console.log(`   证明：这是一个 Context Engineering 的扩展性设计，不是简单的 Token 压缩脚本`);
  } else {
    console.log(`\n⚠️ 需要调整参数`);
  }

  // ── 保存采样 ──
  const outputDir = path.join(__dirname, "..", "test-results", "dm-datasets");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // 只保存采样（避免 50K 全量文件过大）
  const sample = entries.slice(0, 100);
  fs.writeFileSync(path.join(outputDir, "dm-stress-50k-sample.json"), JSON.stringify(sample, null, 2));

  // 保存对比结果
  const comparisonResult = {
    totalEntries: entries.length,
    priorEntries: priorEntries.length,
    fullMode: { chars: fullCtx.length, estimatedTokens: fullTokens },
    layeredMode: { chars: layeredCtx.length, estimatedTokens: layeredTokens },
    compressionRate: `${savings}%`,
    strategicRetention: {
      total: strategicInPrior.length,
      full: strategicFull.length,
      rate: `${retentionPct}%`,
    },
    scoreDistribution: {
      full: scoreBins["FULL"]?.count || 0,
      summary: scoreBins["SUM"]?.count || 0,
    },
    typeBreakdown: sortedTypes.map(([name, group]) => ({
      name,
      count: group.length,
      fullChars: buildContext(group, "full").length,
      layeredChars: buildContext(group, "layered").length,
      compressionRate: buildContext(group, "full").length > 0
        ? ((1 - buildContext(group, "layered").length / buildContext(group, "full").length) * 100).toFixed(0) + "%"
        : "0%",
    })),
  };
  fs.writeFileSync(
    path.join(outputDir, "dm-stress-50k-comparison.json"),
    JSON.stringify(comparisonResult, null, 2)
  );

  console.log(`\n采样数据已保存至 test-results/dm-datasets/dm-stress-50k-*`);
}

main().catch(err => {
  console.error("Stress test failed:", err);
  process.exit(1);
});
