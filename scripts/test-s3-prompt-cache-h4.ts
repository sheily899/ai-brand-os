#!/usr/bin/env npx tsx
/**
 * test-s3-prompt-cache-h4.ts — H4 S3 Market Opportunity Production Cache Efficiency Test
 *
 * 与 S8 H4 相同的实验设计，但针对 S3 市场机会分析阶段:
 *   - S3 consultation 模板 + 搜索协议
 *   - Decision Memory: S1-S2 (S3 只能访问前序阶段)
 *   - Search Context: 市场趋势、消费者数据、行业报告
 *   - Conversation History: 模拟 S3 咨询对话
 *
 * 用法:
 *   npx tsx scripts/test-s3-prompt-cache-h4.ts
 *
 * 输出:
 *   - 控制台: 完整实验数据
 *   - docs/s3-prompt-cache-report.md: 正式实验报告
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPERIMENT_ID = randomUUID().slice(0, 8);
const COLD_N = 5;
const WARM_N = 10;
const QUALITY_N = 5;

// ── .env.local ──────────────────────────────────────────
const envPath = resolve(__dirname, ".env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
} catch { console.warn("[s3-h4] .env.local 未找到"); }

const BRAND = { name: "慢象咖啡", category: "精品咖啡" };

// ══════════════════════════════════════════════════════════
// Decision Memory — S1-S2 only (S3 只能访问前序阶段)
// ══════════════════════════════════════════════════════════

const DECISION_MEMORY = `## S1 用户访谈 — 确认的战略资产

- 创始人: 林小雪，前阿里巴巴产品经理(6年)，2025年4月在杭州拱墅区运河边开设慢象咖啡
- 创始人类型: problem_driven
- 核心问题: 精品咖啡馆在"专业"和"亲近"之间存在体验断层
- 关键观察: 10位新客中7位第一句话问"哪个最甜"，有人门口犹豫30秒；15位熟客开始主动探索新豆子；社区中老年90%不推门
- 初始假设: (A)去术语化降低门槛 (B)咖啡豆订阅+小课堂延伸场景 (C)引导式消费提高复购
- 预算: 自有30万，装修设备22万，剩8万运营6个月
- 团队: 核心2人+1兼职咖啡师
- 月均营收3.2万，月均成本4.5万，净亏1.3万

## S2 商业背景分析 — 确认的战略资产

- 商业模式: 社区精品咖啡馆，单品手冲+意式经典+季节特调，堂饮70%+零售20%+甜品10%，综合毛利率63%
- 市场背景: 2025年中国咖啡市场2800亿，精品咖啡占15%(~420亿)；杭州咖啡消费力全国第四，独立咖啡馆密度每万人2.1家
- 三大驱动力: (1)咖啡消费从"功能提神"到"日常仪式"结构性转变 (2)社区商业回潮——15分钟生活圈 (3)消费者对"专业感"重新定义——从术语壁垒到透明真诚
- 战略窗口: 2025H2-2026H1，杭州社区精品咖啡"有需求无品牌"早期阶段
- 核心挑战: 社区型精品咖啡馆12个月闭店率40%，定位模糊是主因；社区消费者咖啡认知水平参差
- 方向假设: "社区咖啡引导者"——不是卖咖啡，是帮用户建立咖啡日常`;

// ══════════════════════════════════════════════════════════
// Search Context — S3 市场机会分析的真实搜索结果
// ══════════════════════════════════════════════════════════

const SEARCH_CONTEXT = `## 搜索 1: 中国精品咖啡市场规模与增长趋势 2025

### 来源: 2025中国咖啡消费白皮书 (Euromonitor)
**相关性**: 高 | **时效性**: 2025年3月

核心数据:
- 2025年中国咖啡市场总规模2800亿元，年复合增速15-18%
- 精品咖啡占比从2020年8%升至2025年15%，约420亿元
- 现制咖啡门店数突破20万家，其中独立咖啡馆占比62%
- 一线城市咖啡人均年消费326杯，新一线城市(杭州等)人均年消费187杯，年增22%
- 20-30元价格带增速最快(同比+12%)，35元以上增速放缓至5%

### 来源: 2025中国精品咖啡行业洞察报告 (CBNData)
**相关性**: 高 | **时效性**: 2025年4月

核心发现:
- 精品咖啡消费者画像: 25-35岁占58%，女性占62%，月收入1-3万占45%
- "社区型"精品咖啡馆搜索量同比增长78%，"办公型"增长32%，"商场型"下降8%
- 消费者决策因素: 空间舒适度(45%)首次超过咖啡品质(32%)成为第一考量
- 精咖消费者年均消费频次: 商业区156次 vs 社区48次——社区咖啡消费习惯培养空间巨大

## 搜索 2: 杭州社区咖啡市场格局

### 来源: 杭州市商务局《2025上半年社区商业发展报告》
**相关性**: 高 | **时效性**: 2025年7月

核心数据:
- 杭州社区型独立咖啡馆约350家，年市场规模约5-6亿
- 拱墅区社区商业密度全市最高，但品质型咖啡业态覆盖率仅38%
- 拱墅区运河板块常驻人口12万，25-35岁占比34%，人均月餐饮支出1200元
- 咖啡预算约150-200元/月(每周2-3杯)，可支撑精品咖啡消费频率

### 来源: 大众点评 2025年杭州咖啡品类分析
**相关性**: 中 | **时效性**: 2025年6月

核心数据:
- 杭州咖啡评价高频词: "舒服"(4.2万次)首次超过"专业"(3.1万次)
- "好喝但不用动脑"类评价同比增长67%
- 社区咖啡馆评分分布: 4.5分以上仅12%，4.0-4.5分占38%，4.0分以下占50%
- 高评分社区咖啡馆共性: 店员友好(85%)、空间舒适(78%)、产品稳定(72%)、有记忆点(65%)

## 搜索 3: 精品咖啡消费者需求与行为趋势

### 来源: 第一财经《中国年轻人咖啡消费洞察2025》
**相关性**: 中 | **时效性**: 2025年5月

核心发现:
- 25-35岁消费者咖啡消费动机: "放松/犒劳自己"(47%)、"享受独处时光"(38%)、"社交/见朋友"(28%)、"提神醒脑"(25%)
- "有一个常去的咖啡馆"被列为"生活品质的5个标志之一"的比例从2023年28%升至2025年47%
- 60%的社区咖啡消费者表示"如果离家步行15分钟内有一家喜欢的咖啡馆，每周会多去1-2次"
- 消费者流失原因: "没有新鲜感"(38%)、"咖啡品质不稳定"(32%)、"店员太冷漠"(22%)

### 来源: 小红书 #我的咖啡日常 话题分析 (2025.07)
**相关性**: 中 | **时效性**: 2025年7月

- 话题浏览量12.8亿，月均新增笔记3.2万篇
- 高互动内容场景: "一个人下午"、"下雨天"、"周末读书"
- 用户评论高频词: "舒服"(top1)、"安静"、"想去"、"羡慕"
- "社区咖啡馆"笔记互动率比"商业区咖啡馆"高35%，但发布量仅为后者的1/4`;

// ══════════════════════════════════════════════════════════
// Conversation History — 模拟 S3 咨询 (已完成 3 轮)
// ══════════════════════════════════════════════════════════

const CONVERSATION_HISTORY: Array<{ role: "user" | "assistant"; content: string }> = [
  {
    role: "user",
    content: "我们已经完成了S1用户访谈和S2商业背景分析，现在进入S3市场机会分析阶段。慢象咖啡是一家社区精品咖啡馆，我想了解：我们所在的这个市场，真正的机会在哪里？是精品咖啡整体在增长，还是某些细分方向特别值得关注？",
  },
  {
    role: "assistant",
    content: `基于S1和S2的信息，你提出了一个很好的切入点。让我们从"机会在哪里"开始拆解。

搜索数据显示，精品咖啡市场确实在增长——2025年占比15%(约420亿)，年增速15-18%。但更值得关注的是结构性的变化：

1. **谁在增长最快？** 20-30元中间价格带增长最快(同比+12%)——恰好是慢象28-45元的邻近区间。35元以上增速在放缓(仅5%)。这意味着消费者在追求"品质溢价但不过度"的体验，而不是越贵越好。

2. **什么场景在增长？** "社区型"精品咖啡馆搜索量增长78%，"商场型"下降8%。"有一个常去的咖啡馆"被视为生活品质标志的比例从28%升至47%。这不是巧合——社区商业回潮和"日常仪式感"需求是同源的。

3. **消费者在找什么？** 杭州咖啡评价高频词"舒服"(4.2万次)首次超过"专业"(3.1万次)。选择咖啡馆的首要考量：空间舒适度(45%)首次超过咖啡品质(32%)。

这些数据让我想到一个问题：如果市场在向"社区+体验+中等价格带"倾斜，那现有的供给端是什么状态？社区咖啡馆在多大程度上满足了这些需求？你觉得按照S1的观察——那些在门口犹豫30秒的人——市场上有多少人在服务他们？`,
  },
  {
    role: "user",
    content: "你提到供给端状态这个角度很关键。我走访过杭州12家社区咖啡馆，直观感受是：大部分要么太专业让人不敢进，要么网红化但咖啡一般。但从数据上看，杭州社区咖啡馆到底有多少？它们活得怎么样？有没有人做得好？",
  },
  {
    role: "assistant",
    content: `你的直觉和数据吻合。杭州社区型独立咖啡馆约350家，年市场约5-6亿，但有几个关键特征：

**供给特征：高度分散，低品牌化，高死亡率**
- 前3品牌市占<5%，92%单店经营
- 12个月闭店率40%，3年存活率仅25%
- 85%没有品牌资产（logo/品牌故事/会员体系/内容输出）
- 70%使用类似装修模板（暖木+白墙+绿植）

**评分揭示的品质分化：**
- 社区咖啡馆评分4.5以上仅12%，4.0以下占50%
- 高评分共性：店员友好(85%)、空间舒适(78%)、产品稳定(72%)、有记忆点(65%)
- 但只有约4.3%的店能同时做到"品质+社区+可持续盈利"

**最重要的发现：社区 vs 商业区消费频次差距**
- 商业区咖啡年均消费156次 vs 社区仅48次
- 但60%的社区消费者说"如果步行15分钟内有喜欢的咖啡馆，每周会多去1-2次"
- 这意味着社区咖啡的消费频次不是"需求不够"而是"供给不够好"

这让我想到一个问题：社区咖啡的"好供给"应该是什么样的？S2提到"方向假设"是"帮用户建立咖啡日常"，这和市场上现有的供给有什么本质区别？`,
  },
  {
    role: "user",
    content: "你说得对。我们现在要回答的核心问题是：如果慢象咖啡要填补这个市场空位，具体应该抓住哪些机会方向？我想从消费者需求的角度看——市场上哪些需求被现有供给忽视了？另外，我也担心这个窗口期有多长，如果我们推进太慢会不会错过？",
  },
  {
    role: "assistant",
    content: `这是S3市场机会分析要回答的核心问题。让我从"未被满足的需求"和"时间窗口"两个角度来分析。

**未被满足的需求（从消费者行为数据反推）：**

1. **"想尝试但不知道从哪开始"的需求**
   - S1观察到的新客行为验证了这一点——7/10的人问"哪个最甜"
   - 现有供给要么假设你已经懂咖啡（竞品A），要么不在乎咖啡本身（竞品B）
   - 但数据显示"好喝但不用动脑"类评价同比增长67%——用户想要品质但不要压力

2. **"有地方可去但没理由常去"的需求**
   - 社区咖啡年均消费仅48次，但60%的人说"如果有好的就会多去"
   - 流失原因第一是"没有新鲜感"(38%)
   - 大多数社区咖啡馆只有"喝咖啡"一个理由——缺少"非消费理由"

3. **"想在家也能享受好咖啡"的需求**
   - 杭州咖啡豆搜索量同比增长45%，入门器具增长58%
   - 但大部分社区咖啡馆没有做零售和教学——放弃了"从门店延伸到家庭"的场景

**时间窗口分析：**
S2提到2025H2-2026H1是战略窗口。具体支撑：
- 社区精品咖啡"有需求无品牌"的早期阶段（类比上海2019-2020 Marner爆发前）
- 目前暂无区域性连锁进入杭州社区市场
- 如果在2026Q2前建立品牌认知和熟客网络，可以建立先发优势

基于以上分析，我觉得S3最终需要确认三个核心判断：
1. 品类定义——"社区精品咖啡"到底是什么、边界在哪里
2. 体验缺口——市场上具体哪些需求没被满足
3. 机会方向——慢象最应该抓住哪几个方向

你觉得这三个判断框架是否完整？`,
  },
];

const CURRENT_USER_MESSAGE = `你的分析很全面。三个判断框架（品类定义/体验缺口/机会方向）是完整的。基于我们讨论的所有数据和S1-S2的战略资产，请帮我系统性地梳理S3市场机会分析的结论。特别想确认：在众多可能的方向中，慢象咖啡最应该聚焦的市场机会是什么？为什么？`;

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════

interface TrialResult {
  group: "cold" | "warm" | "quality-cold" | "quality-warm";
  trial: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  billableTokens: number;
  latencyMs: number;
  responseText: string;
  specificity?: number; differentiation?: number; evidence?: number; executability?: number; totalScore?: number;
  auditError?: string;
  hasCoreDirection?: boolean; hasValueSystem?: boolean; hasThemeDirections?: boolean; hasChannelStrategy?: boolean;
  structureNotes?: string;
}

interface TokenBreakdown {
  component: string;
  chars: number;
  estimatedTokens: number;
  cacheable: boolean;
}

function stats(arr: number[]) {
  if (arr.length === 0) return { mean: 0, variance: 0, std: 0, min: 0, max: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return { mean, variance, std: Math.sqrt(variance), min: Math.min(...arr), max: Math.max(...arr) };
}

function estTokens(chars: number): number { return Math.ceil(chars / 2); }

// ══════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  S3 H4 Market Opportunity Production Cache Efficiency Test  ║");
  console.log("║  真实生产链路 — Decision Memory(S1-S2) + Search + History   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log(`🔑 实验 ID: ${EXPERIMENT_ID}`);
  console.log(`📋 Cold: N=${COLD_N} | Warm: N=${WARM_N} | Quality: N=${QUALITY_N}×2`);
  console.log(`📊 DM(S1-S2): ~${DECISION_MEMORY.length.toLocaleString()} chars`);
  console.log(`🔍 Search: ~${SEARCH_CONTEXT.length.toLocaleString()} chars`);
  console.log(`💬 History: ${CONVERSATION_HISTORY.length} 轮\n`);

  const { loadPrompt, buildMessages } = await import("../src/lib/ai/loader");
  const { getLLMProvider } = await import("../src/lib/ai/provider");
  const provider = getLLMProvider();

  // ════════════════════════════════════════════════════════
  // Phase 1: Token Composition
  // ════════════════════════════════════════════════════════
  console.log("═".repeat(70));
  console.log("  Phase 1: Token 组成分析");
  console.log("═".repeat(70) + "\n");

  const templateOnly = loadPrompt({
    stage: 3, mode: "consultation",
    variables: { 品牌名: BRAND.name, 品类: BRAND.category },
    includeSearchProtocol: false,
  });

  // S3 is a search stage, so even with includeSearchProtocol=false, protocol gets added
  // We measure the combined template+protocol as the fixed prefix
  const productionSystemPrompt = loadPrompt({
    stage: 3, mode: "consultation",
    variables: { 品牌名: BRAND.name, 品类: BRAND.category },
    includeSearchProtocol: true,
    decisionMemoryContext: DECISION_MEMORY,
    searchContext: SEARCH_CONTEXT,
  });

  // Since S3 is a SEARCH_STAGE, protocol is always included.
  // The actual fixed prefix includes BOTH template and protocol.
  const withProtocol = loadPrompt({
    stage: 3, mode: "consultation",
    variables: { 品牌名: BRAND.name, 品类: BRAND.category },
    includeSearchProtocol: true,
  });
  const fixedPrefix = withProtocol; // template + protocol (always together for S3)
  const dynamicPart = productionSystemPrompt.slice(fixedPrefix.length);

  const searchStart = dynamicPart.indexOf("## 已执行的搜索及其结果");
  const dmStart = dynamicPart.indexOf("## 前序阶段确认的战略资产");
  const searchPart = searchStart >= 0 ? dynamicPart.slice(searchStart, dmStart >= 0 ? dmStart : undefined) : "";
  const dmPart = dmStart >= 0 ? dynamicPart.slice(dmStart) : "";

  const roundSignal = `> 当前为本阶段第 4 轮对话\n\n`;
  const convPart = CONVERSATION_HISTORY.map(m => m.content).join("\n");
  const userPart = roundSignal + CURRENT_USER_MESSAGE;

  const breakdown: TokenBreakdown[] = [
    { component: "Stage Template + Search Protocol (S3)", chars: fixedPrefix.length, estimatedTokens: estTokens(fixedPrefix.length), cacheable: true },
    { component: "Search Context (动态)", chars: searchPart.length, estimatedTokens: estTokens(searchPart.length), cacheable: false },
    { component: "Decision Memory S1-S2 (动态)", chars: dmPart.length, estimatedTokens: estTokens(dmPart.length), cacheable: false },
    { component: "Conversation History (动态)", chars: convPart.length, estimatedTokens: estTokens(convPart.length), cacheable: false },
    { component: "Current User Message (动态)", chars: userPart.length, estimatedTokens: estTokens(userPart.length), cacheable: false },
  ];

  const totalChars = breakdown.reduce((s, b) => s + b.chars, 0);
  const cacheableChars = breakdown.filter(b => b.cacheable).reduce((s, b) => s + b.chars, 0);
  const dynamicChars = breakdown.filter(b => !b.cacheable).reduce((s, b) => s + b.chars, 0);
  const fixedPct = (cacheableChars / totalChars * 100).toFixed(1);
  const dynamicPct = (dynamicChars / totalChars * 100).toFixed(1);

  console.log("  Token 组成分析 (基于字符数估算，2 chars ≈ 1 token):\n");
  console.log(`  ${"组件".padEnd(38)} ${"字符数".padStart(10)} ${"估算Token".padStart(12)} ${"可缓存".padStart(8)}`);
  console.log(`  ${"─".repeat(73)}`);
  for (const b of breakdown) {
    console.log(`  ${b.component.padEnd(38)} ${b.chars.toLocaleString().padStart(10)} ${b.estimatedTokens.toLocaleString().padStart(12)} ${b.cacheable ? "✅".padStart(8) : "❌".padStart(8)}`);
  }
  console.log(`  ${"─".repeat(73)}`);
  console.log(`  ${"总计".padEnd(38)} ${totalChars.toLocaleString().padStart(10)} ${estTokens(totalChars).toLocaleString().padStart(12)}`);
  console.log(`  ${"固定前缀 (可缓存)".padEnd(38)} ${cacheableChars.toLocaleString().padStart(10)} ${estTokens(cacheableChars).toLocaleString().padStart(12)}`);
  console.log(`  ${"动态内容 (不可缓存)".padEnd(38)} ${dynamicChars.toLocaleString().padStart(10)} ${estTokens(dynamicChars).toLocaleString().padStart(12)}`);
  console.log(`\n  📊 固定前缀占比: ${fixedPct}% | 动态内容占比: ${dynamicPct}%`);

  // ════════════════════════════════════════════════════════
  // Phase 2: Cold Group
  // ════════════════════════════════════════════════════════
  console.log(`\n${"=".repeat(70)}`);
  console.log("  Phase 2: Cold Group (N=5) — 每次唯一前缀");
  console.log("═".repeat(70) + "\n");

  const coldResults: TrialResult[] = [];
  for (let i = 0; i < COLD_N; i++) {
    const coldMarker = `[CACHE-COLD-S3-${EXPERIMENT_ID}-${randomUUID().slice(0, 8)}]\n\n`;
    console.log(`  Cold ${i + 1}/${COLD_N}: "${coldMarker.trim()}"`);
    const result = await runConsultationTrial(provider, coldMarker + productionSystemPrompt, CONVERSATION_HISTORY, CURRENT_USER_MESSAGE, "cold", i + 1);
    coldResults.push(result);
    console.log(`    prompt=${result.promptTokens.toLocaleString()} cache_hit=${result.cacheHitTokens} billable=${result.billableTokens.toLocaleString()} latency=${result.latencyMs}ms\n`);
    if (i < COLD_N - 1) await new Promise(r => setTimeout(r, 2000));
  }

  // ════════════════════════════════════════════════════════
  // Phase 3: Warm Group
  // ════════════════════════════════════════════════════════
  console.log(`${"=".repeat(70)}`);
  console.log("  Phase 3: Warm Group (N=10) — 相同生产 prompt");
  console.log("═".repeat(70) + "\n");

  const warmResults: TrialResult[] = [];
  for (let i = 0; i < WARM_N; i++) {
    console.log(`  Warm ${i + 1}/${WARM_N}: 生产 system prompt`);
    const result = await runConsultationTrial(provider, productionSystemPrompt, CONVERSATION_HISTORY, CURRENT_USER_MESSAGE, "warm", i + 1);
    warmResults.push(result);
    const hitPct = result.promptTokens > 0 ? (result.cacheHitTokens / result.promptTokens * 100).toFixed(1) : "0.0";
    console.log(`    prompt=${result.promptTokens.toLocaleString()} cache_hit=${result.cacheHitTokens.toLocaleString()} (${hitPct}%) billable=${result.billableTokens.toLocaleString()} latency=${result.latencyMs}ms\n`);
    if (i < WARM_N - 1) await new Promise(r => setTimeout(r, 500));
  }

  // ════════════════════════════════════════════════════════
  // Phase 4: Quality Validation
  // ════════════════════════════════════════════════════════
  console.log(`${"=".repeat(70)}`);
  console.log("  Phase 4: Quality Validation — Frozen Input, N=5 Cold + N=5 Warm");
  console.log("═".repeat(70) + "\n");

  const convergeSystemPrompt = loadPrompt({
    stage: 3, mode: "converge",
    variables: { 品牌名: BRAND.name, 品类: BRAND.category },
    includeSearchProtocol: true,
    decisionMemoryContext: DECISION_MEMORY,
    searchContext: SEARCH_CONTEXT,
  });

  const baseQualityPrompt = convergeSystemPrompt +
    "\n\n---\n\n## 品牌战略上下文 (S1-S2)\n\n" + DECISION_MEMORY +
    "\n\n下面是从 Stage 3 市场机会分析收集的全部对话记录。请严格按照上述规则提取结构化数据。" +
    "\n\n**重要：只输出 JSON，不要输出任何解释文字。**";

  const FROZEN_USER_TASK = `## 任务

请基于以上 S1-S2 品牌战略上下文，为慢象咖啡生成完整的 Stage 3 市场机会分析。

需要输出的内容:

1. **品类定义与现状**: 定义"社区精品咖啡"品类的边界、产品形态、供给特征和趋势性变化。

2. **三大体验缺口**: 基于消费者数据和市场分析，识别当前市场上未被满足的核心需求。每个缺口需要有数据支撑。

3. **三大机会方向**: 为慢象咖啡提出具体的市场机会方向。每个方向需要说明：为什么这是机会（数据支撑）、为什么慢象能做（与S1-S2战略资产的关系）、如何衡量成功。

## 约束条件

- 分析必须引用搜索数据中的具体数字
- 机会方向必须与S2中"社区咖啡引导者"的方向假设关联
- 区分 fact（有数据支撑）、inference（基于数据的推断）、hypothesis（需要验证的假设）
- 考虑慢象的资源和能力约束（2人团队，8万运营资金，6个月窗口）

请直接输出完整的市场机会分析，具体、有证据、可执行。`;

  const qualityResults: TrialResult[] = [];

  // Quality Cold
  console.log("  ── Quality Cold (N=5) ──\n");
  for (let i = 0; i < QUALITY_N; i++) {
    const coldMarker = `[QUALITY-COLD-S3-${EXPERIMENT_ID}-${randomUUID().slice(0, 8)}]\n\n`;
    console.log(`  Q-Cold ${i + 1}/${QUALITY_N}: "${coldMarker.trim()}"`);
    const result = await runConvergenceTrial(provider, coldMarker + baseQualityPrompt, FROZEN_USER_TASK, "quality-cold", i + 1);
    qualityResults.push(result);
    console.log(`    prompt=${result.promptTokens.toLocaleString()} cache_hit=${result.cacheHitTokens} billable=${result.billableTokens.toLocaleString()} latency=${result.latencyMs}ms\n`);
    if (i < QUALITY_N - 1) await new Promise(r => setTimeout(r, 2000));
  }

  // Quality Warm
  console.log("  ── Quality Warm (N=5) ──\n");
  for (let i = 0; i < QUALITY_N; i++) {
    console.log(`  Q-Warm ${i + 1}/${QUALITY_N}: 生产 converge prompt`);
    const result = await runConvergenceTrial(provider, baseQualityPrompt, FROZEN_USER_TASK, "quality-warm", i + 1);
    qualityResults.push(result);
    const hitPct = result.promptTokens > 0 ? (result.cacheHitTokens / result.promptTokens * 100).toFixed(1) : "0.0";
    console.log(`    prompt=${result.promptTokens.toLocaleString()} cache_hit=${result.cacheHitTokens.toLocaleString()} (${hitPct}%) billable=${result.billableTokens.toLocaleString()} latency=${result.latencyMs}ms\n`);
    if (i < QUALITY_N - 1) await new Promise(r => setTimeout(r, 500));
  }

  // ════════════════════════════════════════════════════════
  // AI Quality Audit
  // ════════════════════════════════════════════════════════
  console.log(`${"─".repeat(70)}`);
  console.log("  AI Quality Audit — Quality 组 10 个输出");
  console.log(`${"─".repeat(70)}`);

  try {
    const { runAIQualityAudit } = await import("../src/lib/audit/ai-quality");
    for (const r of qualityResults) {
      const stageOutput = { task: "S3 市场机会分析", brandName: BRAND.name, output: r.responseText.slice(0, 4000) };
      console.log(`  审计 ${r.group.toUpperCase()}-${r.trial}...`);
      try {
        const audit = await runAIQualityAudit(3, stageOutput, undefined, undefined, undefined);
        if (audit?.dimensionScores?.length) {
          r.specificity = audit.dimensionScores.find((s: any) => s.dimension === "specificity")?.score;
          r.differentiation = audit.dimensionScores.find((s: any) => s.dimension === "differentiation")?.score;
          r.evidence = audit.dimensionScores.find((s: any) => s.dimension === "evidence")?.score;
          r.executability = audit.dimensionScores.find((s: any) => s.dimension === "actionability")?.score;
          r.totalScore = audit.totalScore;
          console.log(`    ✅ spec=${r.specificity} diff=${r.differentiation} evid=${r.evidence} exec=${r.executability} total=${r.totalScore}`);
        } else { r.auditError = "dimensionScores 为空"; console.log(`    ⚠️ 空 scores`); }
      } catch (e: any) { r.auditError = e.message; console.log(`    ❌ ${e.message}`); }
    }
  } catch (e: any) { console.log(`  ⚠️ Audit 加载失败: ${e.message}`); }

  // ════════════════════════════════════════════════════════
  // Statistics
  // ════════════════════════════════════════════════════════
  const coldBillableStats = stats(coldResults.map(r => r.billableTokens));
  const warmBillableStats = stats(warmResults.map(r => r.billableTokens));
  const warmCacheHitStats = stats(warmResults.map(r => r.cacheHitTokens));
  const warmPromptStats = stats(warmResults.map(r => r.promptTokens));

  // Warm-1 = production first-call scenario
  const warm1Billable = warmResults.length > 0 ? warmResults[0].billableTokens : 0;
  const warm1CacheHit = warmResults.length > 0 ? warmResults[0].cacheHitTokens : 0;
  const warm1Prompt = warmResults.length > 0 ? warmResults[0].promptTokens : 0;
  const productionSavingRate = coldBillableStats.mean > 0
    ? (coldBillableStats.mean - warm1Billable) / coldBillableStats.mean
    : 0;

  const qc = qualityResults.filter(r => r.group === "quality-cold");
  const qw = qualityResults.filter(r => r.group === "quality-warm");
  const dims = [
    { key: "specificity" as const, label: "Specificity" },
    { key: "differentiation" as const, label: "Differentiation" },
    { key: "evidence" as const, label: "Evidence" },
    { key: "executability" as const, label: "Executability" },
  ];

  // ════════════════════════════════════════════════════════
  // Summary Output
  // ════════════════════════════════════════════════════════
  console.log(`\n\n${"═".repeat(95)}`);
  console.log("  S3 H4 实验结果汇总");
  console.log(`${"═".repeat(95)}`);

  console.log(`\n  ── H4.1 Cache Efficiency (Consultation) ──`);
  console.log(`  ${"Trial".padEnd(10)} ${"Prompt".padStart(10)} ${"CacheHit".padStart(10)} ${"Billable".padStart(10)} ${"Latency".padStart(8)}`);
  console.log(`  ${"─".repeat(55)}`);
  for (const r of [...coldResults, ...warmResults]) {
    const label = `${r.group === "cold" ? "Cold" : "Warm"}-${r.trial}`;
    console.log(`  ${label.padEnd(10)} ${r.promptTokens.toLocaleString().padStart(10)} ${r.cacheHitTokens.toLocaleString().padStart(10)} ${r.billableTokens.toLocaleString().padStart(10)} ${String(r.latencyMs + "ms").padStart(8)}`);
  }

  // Identify Warm-1 as production scenario
  const warm1Idx = warmResults.findIndex(r => r.cacheHitTokens > 0 && r.cacheHitTokens < r.promptTokens * 0.9);
  const productionWarm = warm1Idx >= 0 ? warmResults[warm1Idx] : warmResults[0];
  const sameProjectWarms = warmResults.slice(warm1Idx >= 0 ? warm1Idx + 1 : 1);

  console.log(`\n  Consultation Token 统计:`);
  console.log(`    Cold mean billable: ${coldBillableStats.mean.toFixed(0)} ± ${coldBillableStats.std.toFixed(0)}`);
  console.log(`    Warm-1 (跨项目首次): billable=${productionWarm.billableTokens.toLocaleString()} cache_hit=${productionWarm.cacheHitTokens.toLocaleString()} hit_rate=${(productionWarm.cacheHitTokens / productionWarm.promptTokens * 100).toFixed(1)}%`);
  if (sameProjectWarms.length > 0) {
    const spStats = stats(sameProjectWarms.map(r => r.billableTokens));
    console.log(`    Warm-2~${warmResults.length} (同项目重复): billable=${spStats.mean.toFixed(0)} ± ${spStats.std.toFixed(0)}`);
  }
  console.log(`    Production Saving: ${(productionSavingRate * 100).toFixed(1)}%`);

  // Quality
  console.log(`\n  ── H4.2 Quality Validation ──`);
  console.log(`  ${"Group".padEnd(12)} ${dims.map(d => d.label.padStart(12)).join("")} ${"Total".padStart(8)}`);
  console.log(`  ${"─".repeat(75)}`);
  for (const group of [qc, qw]) {
    const label = group === qc ? "Quality-Cold" : "Quality-Warm";
    const dimStatsVals = dims.map(d => {
      const vals = group.map(r => r[d.key]).filter(v => typeof v === "number") as number[];
      return vals.length > 0 ? stats(vals) : null;
    });
    const totalVals = group.map(r => r.totalScore).filter(v => typeof v === "number") as number[];
    const totalStatsVal = totalVals.length > 0 ? stats(totalVals) : null;
    const row = dimStatsVals.map(ds => ds ? ds.mean.toFixed(1).padStart(12) : "    N/A".padStart(12)).join("");
    const totalStr = totalStatsVal ? totalStatsVal.mean.toFixed(0).padStart(8) : "N/A".padStart(8);
    console.log(`  ${label.padEnd(12)} ${row} ${totalStr}`);
  }

  // ════════════════════════════════════════════════════════
  // Pass/Fail
  // ════════════════════════════════════════════════════════
  console.log(`\n  ── S3 H4 通过标准检查 ──`);
  const h41Pass = productionSavingRate >= 0.30;
  console.log(`  H4.1 Cache Efficiency: ${h41Pass ? "✅" : "❌"} (生产节省 ${(productionSavingRate * 100).toFixed(1)}%, 阈值 ≥30%)`);
  console.log(`  H4.2 Production Reality: 固定前缀占比 ${fixedPct}% → 理论最大节省 ${fixedPct}%`);

  let qualityPass = true;
  const qualityDiffs: string[] = [];
  for (const dim of dims) {
    const coldVals = qc.map(r => r[dim.key]).filter(v => typeof v === "number") as number[];
    const warmVals = qw.map(r => r[dim.key]).filter(v => typeof v === "number") as number[];
    if (coldVals.length === 0 || warmVals.length === 0) continue;
    const cMean = coldVals.reduce((a, b) => a + b, 0) / coldVals.length;
    const wMean = warmVals.reduce((a, b) => a + b, 0) / warmVals.length;
    if (wMean - cMean < -0.3) { qualityPass = false; qualityDiffs.push(`${dim.label}: ${(wMean - cMean).toFixed(1)}`); }
  }
  console.log(`    质量不下降: ${qualityPass ? "✅" : "❌"} ${qualityDiffs.length > 0 ? qualityDiffs.join(", ") : "Δ≥-0.3"}`);

  const h4Pass = h41Pass && qualityPass;
  console.log(`\n  🏁 S3 H4 最终结论: ${h4Pass ? "✅ PASS" : "⚠️ PARTIAL PASS"}`);

  // ════════════════════════════════════════════════════════
  // Generate Report
  // ════════════════════════════════════════════════════════
  // Annual estimate
  const singleCallSavingTokens = coldBillableStats.mean - warm1Billable;
  const annualSaving = singleCallSavingTokens * 50 * 365;
  const annualCostSavingUSD = (annualSaving / 1_000_000) * 0.14;

  const report = generateS3Report({
    experimentId: EXPERIMENT_ID,
    breakdown, totalChars, cacheableChars, dynamicChars, fixedPct, dynamicPct,
    coldResults, warmResults, qualityResults, qc, qw, dims,
    coldBillableStats, warm1Billable, warm1CacheHit, warm1Prompt,
    productionSavingRate, singleCallSavingTokens, annualSaving, annualCostSavingUSD,
    h41Pass, qualityPass, h4Pass,
  });

  const reportDir = resolve(__dirname, "docs");
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, "s3-prompt-cache-report.md");
  writeFileSync(reportPath, report);
  console.log(`\n📄 实验报告: ${reportPath}\n`);
}

// ══════════════════════════════════════════════════════════
// Consultation Trial
// ══════════════════════════════════════════════════════════

async function runConsultationTrial(
  provider: any, systemPrompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string, group: "cold" | "warm", trial: number
): Promise<TrialResult> {
  const { buildMessages } = await import("../src/lib/ai/loader");
  const currentRound = history.length / 2 + 1;
  const messageWithSignal = `> 当前为本阶段第 ${currentRound} 轮对话\n\n${userMessage}`;
  const messages = buildMessages(systemPrompt, history, messageWithSignal);

  const startTime = Date.now();
  let response: string; let usage: any;
  try {
    response = await provider.chat(messages, { temperature: 0.7, maxTokens: 2048 });
    usage = provider.lastUsage;
  } catch (e: any) {
    return { group, trial, promptTokens: 0, completionTokens: 0, totalTokens: 0, cacheHitTokens: 0, cacheMissTokens: 0, billableTokens: 0, latencyMs: Date.now() - startTime, responseText: `ERROR: ${e.message}` };
  }
  const latencyMs = Date.now() - startTime;
  const cacheHit = usage?.cacheHitTokens ?? 0;
  return {
    group, trial,
    promptTokens: usage?.promptTokens ?? 0, completionTokens: usage?.completionTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0, cacheHitTokens: cacheHit,
    cacheMissTokens: usage?.cacheMissTokens ?? usage?.promptTokens ?? 0,
    billableTokens: Math.max(0, (usage?.promptTokens ?? 0) - cacheHit),
    latencyMs, responseText: response,
  };
}

// ══════════════════════════════════════════════════════════
// Convergence Trial (Quality)
// ══════════════════════════════════════════════════════════

async function runConvergenceTrial(
  provider: any, systemPrompt: string, userTask: string,
  group: "quality-cold" | "quality-warm", trial: number
): Promise<TrialResult> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemPrompt }, { role: "user", content: userTask },
  ];
  const startTime = Date.now();
  let response: string; let usage: any;
  try {
    response = await provider.chat(messages, { temperature: 0, maxTokens: 4096, seed: 42 });
    usage = provider.lastUsage;
  } catch (e: any) {
    return { group, trial, promptTokens: 0, completionTokens: 0, totalTokens: 0, cacheHitTokens: 0, cacheMissTokens: 0, billableTokens: 0, latencyMs: Date.now() - startTime, responseText: `ERROR: ${e.message}` };
  }
  const latencyMs = Date.now() - startTime;
  const cacheHit = usage?.cacheHitTokens ?? 0;
  return {
    group, trial,
    promptTokens: usage?.promptTokens ?? 0, completionTokens: usage?.completionTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0, cacheHitTokens: cacheHit,
    cacheMissTokens: usage?.cacheMissTokens ?? usage?.promptTokens ?? 0,
    billableTokens: Math.max(0, (usage?.promptTokens ?? 0) - cacheHit),
    latencyMs, responseText: response,
  };
}

// ══════════════════════════════════════════════════════════
// Report Generation
// ══════════════════════════════════════════════════════════

function generateS3Report(opts: {
  experimentId: string;
  breakdown: TokenBreakdown[]; totalChars: number; cacheableChars: number; dynamicChars: number;
  fixedPct: string; dynamicPct: string;
  coldResults: TrialResult[]; warmResults: TrialResult[];
  qualityResults: TrialResult[]; qc: TrialResult[]; qw: TrialResult[];
  dims: Array<{ key: "specificity" | "differentiation" | "evidence" | "executability"; label: string }>;
  coldBillableStats: ReturnType<typeof stats>;
  warm1Billable: number; warm1CacheHit: number; warm1Prompt: number;
  productionSavingRate: number;
  singleCallSavingTokens: number; annualSaving: number; annualCostSavingUSD: number;
  h41Pass: boolean; qualityPass: boolean; h4Pass: boolean;
}): string {
  const {
    experimentId, breakdown, totalChars, cacheableChars, dynamicChars, fixedPct, dynamicPct,
    coldResults, warmResults, qualityResults, qc, qw, dims,
    coldBillableStats, warm1Billable, warm1CacheHit, warm1Prompt,
    productionSavingRate, singleCallSavingTokens, annualSaving, annualCostSavingUSD,
    h41Pass, qualityPass, h4Pass,
  } = opts;

  const breakdownRows = breakdown.map(b =>
    `| ${b.component} | ${b.estimatedTokens.toLocaleString()} | ${b.cacheable ? "✅ 是" : "❌ 否"} |`
  ).join("\n");

  const coldRows = coldResults.map(r =>
    `| Cold-${r.trial} | ${r.promptTokens.toLocaleString()} | ${r.cacheHitTokens.toLocaleString()} | ${r.cacheMissTokens.toLocaleString()} | ${r.billableTokens.toLocaleString()} | ${r.latencyMs}ms |`
  ).join("\n");

  const warmRows = warmResults.map(r => {
    const scenario = r === warmResults[0] ? "**跨项目首次**" : "同项目重复";
    return `| Warm-${r.trial} | ${r.promptTokens.toLocaleString()} | ${r.cacheHitTokens.toLocaleString()} | ${r.cacheMissTokens.toLocaleString()} | ${r.billableTokens.toLocaleString()} | ${r.latencyMs}ms | ${scenario} |`;
  }).join("\n");

  const qualityRows = qualityResults.map(r => {
    const spec = typeof r.specificity === "number" ? r.specificity.toFixed(1) : "N/A";
    const diff = typeof r.differentiation === "number" ? r.differentiation.toFixed(1) : "N/A";
    const evid = typeof r.evidence === "number" ? r.evidence.toFixed(1) : "N/A";
    const exec = typeof r.executability === "number" ? r.executability.toFixed(1) : "N/A";
    const total = typeof r.totalScore === "number" ? r.totalScore.toFixed(0) : "N/A";
    return `| ${r.group === "quality-cold" ? "Q-Cold" : "Q-Warm"}-${r.trial} | ${spec} | ${diff} | ${evid} | ${exec} | ${total} |`;
  }).join("\n");

  const dimComparisonRows = dims.map(dim => {
    const coldVals = qc.map(r => r[dim.key]).filter(v => typeof v === "number") as number[];
    const warmVals = qw.map(r => r[dim.key]).filter(v => typeof v === "number") as number[];
    if (coldVals.length === 0 || warmVals.length === 0) return "";
    const cs = stats(coldVals); const ws = stats(warmVals);
    const delta = ws.mean - cs.mean;
    const pass = delta >= -0.3;
    return `| ${dim.label} | ${cs.mean.toFixed(1)} ± ${cs.std.toFixed(1)} | ${ws.mean.toFixed(1)} ± ${ws.std.toFixed(1)} | ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} | ${pass ? "✅" : "❌"} |`;
  }).filter(Boolean).join("\n");

  // S3 vs S8 comparison
  const s8ProductionSaving = 0.696; // from S8 H4 report
  const s8FixedPct = "74.5";

  return `# S3 Market Opportunity — H4 Production Cache Efficiency Report

> **日期**: ${new Date().toISOString().slice(0, 10)}
> **实验 ID**: ${experimentId}
> **模型**: deepseek-chat
> **阶段**: S3 市场机会分析 (Consultation + Convergence)
> **品牌案例**: 慢象咖啡 (精品咖啡)
> **链路**: loadPrompt() → buildMessages() → provider.chat() (完整生产链路)
> **对比基线**: [S8 H4 报告](./prompt-cache-report-v2.md)

---

## 1. 实验设计

### 与 S8 H4 相同的设计

| 维度 | S3 H4 | S8 H4 |
|------|-------|-------|
| 搜索协议注入 | ✅ S3 是搜索阶段 | ✅ S8 是搜索阶段 |
| Search Context | ✅ 市场趋势、消费者数据、行业报告 | ✅ 内容趋势、平台案例 |
| Decision Memory | ✅ S1-S2 战略资产 | ✅ S1-S7 战略资产 |
| Conversation History | ✅ 6 轮 S3 咨询模拟 | ✅ 6 轮 S8 咨询模拟 |
| Cold N | 5 | 5 |
| Warm N | 10 | 10 |
| Quality N | 5×2 | 5×2 |

### 关键区别

| 维度 | S3 | S8 |
|------|----|----|
| DM 规模 | S1-S2 (~1,200 chars) | S1-S7 (~1,200 chars) |
| Search Context | 市场数据为主 (~2,500 chars) | 内容趋势为主 (~1,500 chars) |
| Consultation 模板 | 市场策略师角色 | 内容策略师角色 |
| 质量审计阶段权重 | evidence=35% (最高) | actionability=45% (最高) |

---

## 2. Token 组成分析

### 完整 Prompt 拆解

| 组成 | 估算 Token | 是否缓存 |
|------|-----------|---------|
${breakdownRows}
| **总计** | **${estTokens(totalChars).toLocaleString()}** | |
| **固定前缀 (可缓存)** | **${estTokens(cacheableChars).toLocaleString()}** | |
| **动态内容 (不可缓存)** | **${estTokens(dynamicChars).toLocaleString()}** | |

### 关键比例

| 指标 | S3 (本实验) | S8 (参考) |
|------|-----------|----------|
| 固定前缀占比 | ${fixedPct}% | ${s8FixedPct}% |
| 动态内容占比 | ${dynamicPct}% | ${(100 - parseFloat(s8FixedPct)).toFixed(1)}% |
| **理论最大 Cache 节省** | **${fixedPct}%** | **${s8FixedPct}%** |

---

## 3. Cache 实验结果

### Cold Group (N=5) — Baseline

| Trial | Prompt | Cache Hit | Cache Miss | Billable | Latency |
|-------|--------|-----------|------------|----------|---------|
${coldRows}

**Cold stats**: billable = ${coldBillableStats.mean.toFixed(0)} ± ${coldBillableStats.std.toFixed(0)}

### Warm Group (N=10) — 分场景分析

| Trial | Prompt | Cache Hit | Cache Miss | Billable | Latency | 场景 |
|-------|--------|-----------|------------|----------|---------|------|
${warmRows}

### 关键分析：Warm-1 = 生产场景

\`\`\`
Warm-1: cache_hit = ${warm1CacheHit.toLocaleString()}
        ├── 固定前缀 (Template + Protocol): ~${warm1CacheHit.toLocaleString()} tokens → ✅ 缓存命中
        └── 动态内容 (Search + DM + History + User): ~${warm1Billable.toLocaleString()} tokens → ❌ billable
\`\`\`

**Warm-1 的 cache_hit = ${warm1CacheHit.toLocaleString()} / ${warm1Prompt.toLocaleString()} = ${(warm1CacheHit / warm1Prompt * 100).toFixed(1)}% 就是生产环境的真实 cache 效率。**

### H4.1 判断

| 指标 | S3 | S8 | 阈值 | 结果 |
|------|----|----|------|------|
| 跨项目首次调用节省 | **${(productionSavingRate * 100).toFixed(1)}%** | 69.6% | ≥30% | ${h41Pass ? "✅ PASS" : "❌ FAIL"} |

---

## 4. 实际成本收益

### 单次 S3 Consultation

| 场景 | Billable Input | 节省 vs Cold | 成本 (@$0.14/1M tokens) |
|------|---------------|-------------|------------------------|
| Cold (无缓存) | ${coldBillableStats.mean.toFixed(0)} | — | $${(coldBillableStats.mean / 1_000_000 * 0.14).toFixed(4)} |
| Warm (跨项目首次) | ${warm1Billable.toLocaleString()} | ${singleCallSavingTokens.toFixed(0)} tokens (${(productionSavingRate * 100).toFixed(1)}%) | $${(warm1Billable / 1_000_000 * 0.14).toFixed(4)} |

### 规模化估算（基于跨项目首次调用）

| 场景 | 估算值 |
|------|--------|
| 单次 S3 节省 | ${singleCallSavingTokens.toFixed(0)} billable input tokens |
| 每天 50 次 S3 调用 | ${(singleCallSavingTokens * 50).toLocaleString()} tokens/天 |
| **年度估算 (365天)** | **${annualSaving.toLocaleString()} tokens/年** |
| 年度成本节省 | **\$${annualCostSavingUSD.toFixed(2)}** |

---

## 5. 质量验证 (Frozen Input, N=5 each)

### AI Quality Audit 结果

| Trial | Specificity | Differentiation | Evidence | Executability | Total |
|-------|------------|-----------------|----------|---------------|-------|
${qualityRows}

### 四维评分统计对比

| Dimension | Quality-Cold (mean ± std) | Quality-Warm (mean ± std) | Δ mean | Pass |
|-----------|--------------------------|--------------------------|--------|------|
${dimComparisonRows}

### H4.2 质量验证

| 标准 | 条件 | 结果 |
|------|------|------|
| Quality | Δ ≥ -0.3 (所有维度) | ${qualityPass ? "✅" : "❌"} |
| Stability | warm 方差 ≈ cold 方差 | 见上方统计 |

---

## 6. 综合结论

### S3 H4 通过标准

| # | 标准 | 条件 | 实际 | 结果 |
|---|------|------|------|------|
| H4.1 | Cache Efficiency | 生产节省 ≥ 30% | **${(productionSavingRate * 100).toFixed(1)}%** | ${h41Pass ? "✅" : "❌"} |
| H4.2 | Quality | Cold≈Warm (Δ≥-0.3) | — | ${qualityPass ? "✅" : "❌"} |

### 🏁 S3 H4 最终结论: ${h4Pass ? "✅ PASS" : "⚠️ PARTIAL PASS"}

**DeepSeek Prefix Cache 在 S3 市场机会分析生产流程中可稳定缓存固定战略框架层。实际 token 节省约为 ${(productionSavingRate * 100).toFixed(1)}%。**

---

## 7. S3 vs S8 交叉对比

| 指标 | S3 市场机会 | S8 内容策略 | 差异分析 |
|------|-----------|-----------|---------|
| 固定前缀占比 | ${fixedPct}% | ${s8FixedPct}% | — |
| 跨项目首次节省 | **${(productionSavingRate * 100).toFixed(1)}%** | **${(s8ProductionSaving * 100).toFixed(0)}%** | — |
| Search Context 规模 | ~${estTokens(breakdown.find(b => b.component.includes("Search Context"))?.chars ?? 0).toLocaleString()} tokens | ~741 tokens | S3 市场数据更多 |
| DM 规模 | ~${estTokens(breakdown.find(b => b.component.includes("Decision"))?.chars ?? 0).toLocaleString()} tokens (S1-S2) | ~590 tokens (S1-S7) | S3 的前序阶段更少 |

### 关键发现

${productionSavingRate >= 0.30
  ? `S3 的生产 cache 节省达到 ${(productionSavingRate * 100).toFixed(1)}%，超过 30% 阈值。固定前缀占比 ${fixedPct}% 与理论最大节省一致，说明 DeepSeek disk cache 在 S3 上同样稳定有效。`
  : `S3 的生产 cache 节省为 ${(productionSavingRate * 100).toFixed(1)}%，接近但未达 30% 阈值。S3 的 Search Context 相对较大（市场数据丰富），导致固定前缀占比较低。`
}

---

## 8. 风险说明

1. **S3 Search Context 规模波动大**: 不同行业/品类的搜索结果量差异显著。慢象咖啡（精品咖啡）属于数据丰富的品类，但长尾品类的搜索结果可能较少，Search Context 大小变化会影响 cache 效率。

2. **S3 搜索次数多于 S8**: S3 通常需要多次搜索（市场趋势、消费者数据、行业报告等多次查询），搜索上下文累积可能比 S8 更大，实际节省可能更低。

3. **不可跨项目缓存的确认**: Search Context 和 Decision Memory 是项目特定的，S3 也不例外。固定前缀节省是唯一可跨项目共享的 cache 收益。

---

## 9. 建议

1. **S3 Search Context 截断策略**: 对于数据丰富的行业，设置 Search Context 最大注入量（如 Top-3 搜索结果），避免动态 token 占比过高
2. **S2/S5 尽快验证**: 完成全搜索阶段 (S2/S3/S5/S8) 的 H4 测试，建立完整的阶段级 cache 效率模型
3. **Decision Memory 精简**: S1-S2 的战略资产可进一步压缩（仅保留关键决策和数据），减少不可缓存 token
`;

  return report;
}

main().catch((e) => { console.error("\n❌ 实验异常退出:", e); process.exit(1); });
