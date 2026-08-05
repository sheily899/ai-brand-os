/**
 * scripts/audit-v3-validation.ts — AI Quality Audit V3.1 完整自动化验证
 *
 * 覆盖：
 *   Part 1: 样本测试 — 3 cases × 8 stages × N runs（默认 5，可用 --runs 调整）
 *   Part 2: 阶段专项 — S3 Evidence Presence / S4 Insight Depth / S5 Evidence Derivation
 *            S6 Derivation Chain / S7 Strategic Alignment
 *   Part 3: 稳定性 — 同模型多次调用统计（含在 Part 1 中）
 *   Part 4: 多模型 — chat vs v4-flash 跨模型对比
 *   Part 6: 回归 — V3.0 配置模拟 vs V3.1
 *
 * 用法：
 *   npx tsx scripts/audit-v3-validation.ts                    # 默认 5 次，仅 chat
 *   npx tsx scripts/audit-v3-validation.ts --runs 10           # 10 次
 *   npx tsx scripts/audit-v3-validation.ts --models chat,flash # 多模型
 *   npx tsx scripts/audit-v3-validation.ts --skip-regression   # 跳过回归
 *   npx tsx scripts/audit-v3-validation.ts --parts 1,2         # 只跑 Part 1 和 2
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ── 加载环境变量 ──────────────────────────────────────────
const envPath = join(process.cwd(), ".env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {
  console.error("❌ 未找到 .env.local，请确保已配置 API Key");
  process.exit(1);
}

// ── 参数解析 ──────────────────────────────────────────────
const args = process.argv.slice(2);
const RUNS = parseInt(args[args.indexOf("--runs") + 1] || "5", 10);
const MODELS_ARG = args.includes("--models") ? args[args.indexOf("--models") + 1] : "chat";
const MODELS = MODELS_ARG.split(",").map((m) => m.trim());
const SKIP_REGRESSION = args.includes("--skip-regression");
const PARTS_ARG = args.includes("--parts") ? args[args.indexOf("--parts") + 1] : "1,2,3,4,6";
const PARTS = new Set(PARTS_ARG.split(",").map((p) => parseInt(p.trim(), 10)));

// 模型映射
const MODEL_MAP: Record<string, string> = {
  chat: "deepseek-chat",
  flash: "deepseek-v4-flash",
  reasoner: "deepseek-reasoner",
};

const ACTIVE_MODELS = MODELS.map((m) => MODEL_MAP[m] || m);

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║  AI Quality Audit V3.1 — 自动化验证                    ║");
console.log("╠══════════════════════════════════════════════════════╣");
console.log(`║  每阶段运行次数: ${RUNS}                                    ║`);
console.log(`║  模型: ${ACTIVE_MODELS.join(", ")}                  ║`);
console.log(`║  执行 Parts: ${Array.from(PARTS).sort().join(", ")}                              ║`);
console.log(`║  回归测试: ${SKIP_REGRESSION ? "跳过" : "执行"}                                  ║`);
console.log("╚══════════════════════════════════════════════════════╝\n");

// ── 类型 ────────────────────────────────────────────────
interface AuditRun {
  model: string;
  run: number;
  score: number;
  dims: Record<string, number>;
  weighted: Record<string, number>;
  gate: string;
  issues: number;
  duration: number;
}

interface StageResult {
  caseName: string;
  stage: number;
  stageName: string;
  threshold: number;
  runs: AuditRun[];
  stats: {
    mean: number;
    median: number;
    min: number;
    max: number;
    stdDev: number;
    range: number;
  };
  dimStats: Record<string, { mean: number; stdDev: number }>;
  gateDistribution: Record<string, number>;
}

interface StageTest {
  id: string;
  label: string;
  stage: number;
  versionA: Record<string, any>;
  versionB: Record<string, any>;
  expectHighDimension: string;
}

// ── Fixtures ─────────────────────────────────────────────
const FIXTURES = [
  { name: "Case A 慢象咖啡", file: "case-a-slow-elephant-coffee.json", level: "high" },
  { name: "Case B 快享茶饮", file: "case-b-quick-sip-tea.json", level: "medium" },
  { name: "Case C YoungLife", file: "case-c-younglife.json", level: "low" },
] as const;

function loadFixture(filename: string) {
  const raw = readFileSync(join(process.cwd(), "tests/fixtures", filename), "utf8");
  return JSON.parse(raw);
}

// ── 辅助函数 ────────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

function clamp(num: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, num));
}

// ── 单次审计 ────────────────────────────────────────────
async function auditOnce(
  stage: number,
  output: Record<string, any>,
  model: string,
  runLabel: number
): Promise<AuditRun> {
  process.env.AUDIT_MODEL = model;
  const { runAIQualityAudit, STAGE_AUDIT_CONFIGS } = await import(
    "../src/lib/audit/ai-quality"
  );

  const start = Date.now();
  const result = await runAIQualityAudit(stage, output);
  const duration = Date.now() - start;

  const dims: Record<string, number> = {};
  const weighted: Record<string, number> = {};
  for (const ds of result.dimensionScores) {
    dims[ds.dimension] = ds.score;
    weighted[ds.dimension] = ds.weightedScore;
  }

  return {
    model,
    run: runLabel,
    score: result.totalScore,
    dims,
    weighted,
    gate: result.gateRecommendation,
    issues: result.issues.length,
    duration,
  };
}

// ── 统计 ────────────────────────────────────────────────
function computeStats(runs: AuditRun[]) {
  const scores = runs.map((r) => r.score);
  const dimStats: Record<string, { mean: number; stdDev: number }> = {};
  for (const dim of ["specificity", "differentiation", "actionability", "evidence"]) {
    const vals = runs.map((r) => r.dims[dim] ?? 0);
    dimStats[dim] = { mean: mean(vals), stdDev: stdDev(vals) };
  }
  const gateDist: Record<string, number> = {};
  for (const r of runs) {
    gateDist[r.gate] = (gateDist[r.gate] || 0) + 1;
  }

  return {
    mean: mean(scores),
    median: median(scores),
    min: Math.min(...scores),
    max: Math.max(...scores),
    stdDev: stdDev(scores),
    range: Math.max(...scores) - Math.min(...scores),
    dimStats,
    gateDistribution: gateDist,
  };
}

// ── 打印分隔 ────────────────────────────────────────────
function hr(title: string) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(70)}`);
}

// ══════════════════════════════════════════════════════════
// PART 1 & 3: 样本测试 + 稳定性
// ══════════════════════════════════════════════════════════
async function runPart1(): Promise<StageResult[]> {
  const allResults: StageResult[] = [];

  // 只使用第一个模型（默认 deepseek-chat）
  const model = ACTIVE_MODELS[0];

  for (const fixture of FIXTURES) {
    hr(`Part 1: ${fixture.name} (${fixture.level}) — ${model} × ${RUNS} runs`);

    const data = loadFixture(fixture.file);
    const stageNames: Record<number, string> = {
      1: "用户访谈", 2: "商业背景", 3: "市场机会", 4: "消费者洞察",
      5: "竞争判断", 6: "品牌战略", 7: "视觉策略", 8: "内容规划",
    };

    for (let stage = 1; stage <= 8; stage++) {
      const output = data.stages[String(stage)];
      if (!output) {
        console.log(`  S${stage} ⚠️ 无数据`);
        continue;
      }

      const runs: AuditRun[] = [];
      process.stdout.write(`  S${stage} ${stageNames[stage].padEnd(6)} `);

      for (let r = 1; r <= RUNS; r++) {
        process.stdout.write(".");
        const run = await auditOnce(stage, output, model, r);
        runs.push(run);
      }

      const stats = computeStats(runs);
      const gateOk =
        stats.gateDistribution["advance"] === RUNS
          ? "✅"
          : stats.gateDistribution["advance"]! >= RUNS * 0.9
            ? "⚠️"
            : "🔴";

      const gateStr = Object.entries(stats.gateDistribution)
        .map(([k, v]) => `${k}:${v}`)
        .join(" ");

      console.log(
        ` μ=${stats.mean.toFixed(1)} σ=${stats.stdDev.toFixed(1)} range=${stats.range.toFixed(0)} ${gateStr} ${gateOk}`
      );

      allResults.push({
        caseName: fixture.name,
        stage,
        stageName: stageNames[stage],
        threshold: 70,
        runs,
        stats,
        dimStats: stats.dimStats,
        gateDistribution: stats.gateDistribution,
      });
    }
  }

  return allResults;
}

// ══════════════════════════════════════════════════════════
// PART 2: 阶段专项
// ══════════════════════════════════════════════════════════
async function runPart2(): Promise<Record<string, any>> {
  hr("Part 2: 阶段专项测试");
  const model = ACTIVE_MODELS[0];
  const results: Record<string, any> = {};

  // ── S3 Evidence Presence ─────────────────────────────
  const s3Base = {
    categoryStatus: {
      definition: "新式茶饮市场",
      currentState: "竞争激烈，健康化趋势明显",
      trends: [{ trend: "年轻人关注健康", source: "行业常识" }],
    },
    experienceGaps: [
      { gap: "健康选项不够多", currentAlternative: "少糖版本", severity: "medium" },
    ],
    opportunityDirections: [
      {
        direction: "做健康茶饮品牌",
        rationale: "健康是趋势",
        evidenceLevel: "inferred",
      },
    ],
  };

  const s3NoData = { ...s3Base };
  const s3WithData = {
    categoryStatus: {
      definition: "新式健康茶饮——用天然食材替代添加剂的茶饮品类，规模约800亿",
      currentState:
        "2025年低糖/无糖食品年增速23%，25-35岁贡献58%增量（《2025中国食品消费趋势报告》）。Q1天猫'低糖茶饮'搜索量同比增67%。便利店低糖饮品SKU从2024Q4的8个增至2025Q2的22个。",
      trends: [
        {
          trend: "低糖茶饮搜索量同比增长67%，消费者主动寻找健康选项",
          source: "天猫《2025Q1茶饮消费报告》",
        },
        {
          trend: "便利店渠道低糖饮品SKU翻倍增长，线下渠道正在跟进",
          source: "便利蜂《2025上半年消费品趋势》",
        },
      ],
    },
    experienceGaps: [
      {
        gap: "现有健康茶饮要么用代糖（口感差），要么只减糖（不算健康），缺少用天然食材真正实现好喝又健康的产品",
        currentAlternative:
          "少糖版本——糖少了但味道也淡了，消费者会自己加糖浆（失去了健康意义）",
        severity: "high",
      },
    ],
    opportunityDirections: [
      {
        direction:
          "用天然甜味食材（罗汉果/红枣/椰枣）替代精制糖，开发真正好喝且低GI的茶饮产品线",
        rationale:
          "数据支撑：天猫低糖茶饮搜索+67%、便利店SKU翻倍——消费者在用搜索行为投票。同时代糖口感问题未解决（小红书'代糖茶饮'相关吐槽笔记1.2万篇），天然食材替代是差异化机会",
        evidenceLevel: "verified",
        source: "天猫《2025Q1茶饮消费报告》+ 小红书平台数据分析",
      },
    ],
  };

  console.log("  S3 Evidence Presence: 无数据 vs 有数据");
  const s3a: AuditRun[] = [];
  const s3b: AuditRun[] = [];
  for (let r = 1; r <= 5; r++) {
    process.stdout.write(".");
    s3a.push(await auditOnce(3, s3NoData, model, r));
    s3b.push(await auditOnce(3, s3WithData, model, r));
  }
  results.s3_evidence = { noData: computeStats(s3a), withData: computeStats(s3b) };
  console.log(
    `\n    无数据: μ=${results.s3_evidence.noData.mean.toFixed(1)} E=${results.s3_evidence.noData.dimStats.evidence.mean.toFixed(1)}`
  );
  console.log(
    `    有数据: μ=${results.s3_evidence.withData.mean.toFixed(1)} E=${results.s3_evidence.withData.dimStats.evidence.mean.toFixed(1)}`
  );
  const s3EDiff =
    results.s3_evidence.withData.dimStats.evidence.mean -
    results.s3_evidence.noData.dimStats.evidence.mean;
  console.log(`    Evidence 分差: ${s3EDiff.toFixed(1)} ${s3EDiff >= 2 ? "✅ ≥2" : "🔴 <2"}`);

  // ── S4 Insight Depth ────────────────────────────────
  const s4Shallow = {
    targetConsumer: {
      definition: "25-35岁女性，喜欢香薰和生活方式产品，注重生活品质",
      behaviorPatterns: ["经常购买香薰产品"],
      decisionMotives: ["喜欢好闻的味道"],
    },
    functionalNeeds: [{ need: "好闻的香薰产品", brandImplication: "产品香味要好" }],
    identityNeeds: [{ need: "体现个人品味" }],
    existingSolutions: [
      {
        solutionType: "商场香薰店",
        failReason: "选择少",
      },
    ],
    idealSelfReflection: "我喜欢好闻的香薰",
  };

  const s4Deep = {
    targetConsumer: {
      definition:
        "25-35岁独居女性，在高压工作后通过睡前香薰建立情绪恢复仪式。她们购买的不仅是香味，是用可控的感官体验来标记从'工作角色'到'自我角色'的心理切换——这15分钟的嗅觉仪式是一天中唯一完全属于自己的时间",
      behaviorPatterns: [
        "每天晚上睡前使用香薰15-30分钟，已成为雷打不动的习惯",
        "会在小红书搜索香薰测评，购买前平均看5-8篇笔记",
        "愿意为'对的味道'支付溢价（预算150-400元/月），但会先买小样试用",
      ],
      decisionMotives: [
        "情绪切换——需要一个明确的信号告诉大脑'今天的工作结束了'",
        "自我奖赏——在承受了一天的压力后，给自己一个可控的、确定的小愉悦",
      ],
    },
    functionalNeeds: [
      {
        need: "香味好闻但不廉价——不需要像香水一样复杂，但需要让人觉得'这个味道有品味'",
        brandImplication:
          "香型设计介于商业香薰（太普通）和沙龙香水（太复杂）之间，找到'容易喜欢但不平庸'的平衡点",
      },
    ],
    identityNeeds: [
      {
        need: "成为一个'懂得照顾自己的人'——通过香薰这个行为告诉自己：我的幸福感是重要的",
        evidence:
          "小红书#睡前仪式 话题3200万浏览，其中香薰相关内容占28%。用户在笔记中最常使用的情绪词是'治愈'(35%)和'属于自己的时间'(28%)",
        brandImplication:
          "品牌不卖'香味'，卖'睡前的15分钟属于自己的时间'——产品的核心价值是情绪恢复而非嗅觉体验",
      },
    ],
    existingSolutions: [
      {
        solutionType: "商业香薰品牌（如野兽派/观夏等）",
        failReason:
          "已满足：品牌调性和审美。缺失：（1）价格偏高（300-600元）增加了试错成本——怕买错所以不买；（2）香味描述过于文学化（'昆仑煮雪'/'窗台上的莫吉托'），用户看不懂导致选择焦虑。造成的摩擦：用户在页面上停留但不下单——不是不喜欢，是不确定",
      },
    ],
    idealSelfReflection:
      "洗完澡后点燃蜡烛，窝在沙发上看一集不用动脑的剧。蜡烛的味道淡淡的——不是'香'，是'舒服'。这15分钟让我觉得：今天虽然有够烂的事，但至少现在这一刻是我的。",
  };

  console.log("\n  S4 Insight Depth: 浅 vs 深");
  const s4a: AuditRun[] = [];
  const s4b: AuditRun[] = [];
  for (let r = 1; r <= 5; r++) {
    process.stdout.write(".");
    s4a.push(await auditOnce(4, s4Shallow, model, r));
    s4b.push(await auditOnce(4, s4Deep, model, r));
  }
  results.s4_insight = { shallow: computeStats(s4a), deep: computeStats(s4b) };
  console.log(
    `\n    浅: μ=${results.s4_insight.shallow.mean.toFixed(1)} S=${results.s4_insight.shallow.dimStats.specificity.mean.toFixed(1)} D=${results.s4_insight.shallow.dimStats.differentiation.mean.toFixed(1)}`
  );
  console.log(
    `    深: μ=${results.s4_insight.deep.mean.toFixed(1)} S=${results.s4_insight.deep.dimStats.specificity.mean.toFixed(1)} D=${results.s4_insight.deep.dimStats.differentiation.mean.toFixed(1)}`
  );

  // ── S5 Evidence Derivation ─────────────────────────
  const s5NoEvidence = {
    competitiveLandscape: {
      dimensions: ["价格", "品质"],
      convergenceAndDivergence: "茶饮市场竞争激烈",
    },
    directCompetitors: [
      {
        name: "A品牌",
        positioning: "高端茶饮",
        keySellingPoint: "品牌知名",
        weakness: "价格高",
      },
      {
        name: "B品牌",
        positioning: "平价茶饮",
        keySellingPoint: "便宜方便",
        weakness: "不够健康",
      },
    ],
    whitespaceOpportunity: "中档健康茶饮",
  };

  const s5WithEvidence = {
    competitiveLandscape: {
      dimensions: ["价格带", "健康度", "品牌忠诚度"],
      convergenceAndDivergence:
        "头部品牌在15-35元价格带密集竞争，30元以上有喜茶奈雪，15元以下有蜜雪一点点。20-25元健康茶饮细分仅占整体茶饮市场的8%，但增速是最快的22%（美团《2025茶饮品类报告》）。消费者在'好喝'和'健康'之间的妥协需求尚未被有效服务。",
    },
    directCompetitors: [
      {
        name: "喜茶",
        positioning: "高端新式茶饮开创者",
        keySellingPoint: "品牌势能+产品创新",
        weakness:
          "健康化更多是营销概念——大众点评2025年评价分析：提及'健康'的好评中68%用户表示'少糖版本依然很甜'；实际热量数据（上海市消保委2025年抽检）：一款标注'轻负担'的饮品含糖量仍达32g（相当于7块方糖）。消费者在支付35元溢价后并未获得真正的健康产品",
      },
      {
        name: "某主打0卡糖的中端茶饮品牌",
        positioning: "0卡糖茶饮专家",
        keySellingPoint: "0卡糖替代传统糖浆",
        weakness:
          "代糖口感是硬伤——小红书'代糖茶饮 难喝'话题下1.2万篇笔记，高频关键词：'后味苦''像药''不如不加'。技术限制：目前食品工业的天然代糖（赤藓糖醇/甜菊糖）在高浓度茶饮中均存在明显后苦味，2-3年内难以突破",
      },
    ],
    whitespaceOpportunity:
      "用天然甜味食材（红枣/椰枣/罗汉果/雪梨）替代精制糖和代糖——既不牺牲口感（天然食材的甜是'好喝的甜'），也实现低GI健康目标。这个方向目前没有被头部品牌覆盖（喜茶在用糖浆+代糖，平价品牌在用果糖），是一个有技术壁垒且消费者能直接感知的差异化机会。与大品牌相比的优势：他们船大难掉头（供应链改造涉及全国2000+门店的糖浆采购体系），我们可以从第一天就用天然食材作为产品基础",
  };

  console.log("\n  S5 Evidence Derivation: 无证据 vs 有竞争依据");
  const s5a: AuditRun[] = [];
  const s5b: AuditRun[] = [];
  for (let r = 1; r <= 5; r++) {
    process.stdout.write(".");
    s5a.push(await auditOnce(5, s5NoEvidence, model, r));
    s5b.push(await auditOnce(5, s5WithEvidence, model, r));
  }
  results.s5_evidence = { noEvidence: computeStats(s5a), withEvidence: computeStats(s5b) };
  console.log(
    `\n    无证据: μ=${results.s5_evidence.noEvidence.mean.toFixed(1)} E=${results.s5_evidence.noEvidence.dimStats.evidence.mean.toFixed(1)}`
  );
  console.log(
    `    有证据: μ=${results.s5_evidence.withEvidence.mean.toFixed(1)} E=${results.s5_evidence.withEvidence.dimStats.evidence.mean.toFixed(1)}`
  );

  // ── S6 Derivation Chain ──────────────────────────
  const s6NoChain = {
    positioning:
      "对于追求品质的年轻人，这是一个有温度的生活方式品牌。我们提供独特的产品体验，让日常生活更有感觉。不同于传统品牌，我们更懂得年轻人的审美和需求。",
    valuePropositions: [
      {
        level: "functional",
        proposition: "高品质产品",
        soWhatDerivation: "年轻人要品质",
      },
      {
        level: "emotional",
        proposition: "有感觉的体验",
        soWhatDerivation: "消费不只是买东西",
      },
      {
        level: "social",
        proposition: "体现品味",
        soWhatDerivation: "需要表达自己",
      },
    ],
    brandStory: {
      struggleMoment: "市面上没有年轻人喜欢的品牌",
      brandAction: "做一个年轻人喜欢的品牌",
      brandRelationship: "成为年轻人生活的一部分",
    },
    brandPersonality: [
      { trait: "年轻", dos: "年轻化", donts: "不老气" },
      { trait: "有品味", dos: "设计好看", donts: "不low" },
    ],
    reasoning: {
      marketOpportunityReference: "市场很大（未引用具体字段）",
      consumerInsightReference: "年轻人喜欢（未引用具体字段）",
      competitiveGapReference: "竞品不够好（未引用具体字段）",
    },
  };

  const s6WithChain = {
    positioning:
      "对于25-35岁独居城市女性，这是一个用嗅觉帮助她们建立'属于自己的15分钟'的生活仪式品牌。不同于追求奢华的沙龙香薰，我们用'去术语化'的香味描述降低选择门槛；不同于商业香薰的廉价嗅觉体验，我们保持小众沙龙的品质感。在这里，选择一款香薰像选择今晚的心情一样自然——不是'你需要懂香'，是'你值得被好好对待'",
    valuePropositions: [
      {
        level: "functional",
        proposition:
          "用'像什么'描述替代香调术语——像'雨后的森林'/'刚出炉的面包'/'晒过太阳的被子'。每款蜡烛有明确的情绪标签（放松/专注/温暖/清醒），不用'前调佛手柑、中调茉莉、后调檀木'这种只有专业人士看得懂的描述",
        soWhatDerivation:
          "S4发现：消费者在小红书上停留但不购买的核心原因是'不确定实际香味'——文学化描述制造了选择焦虑。去术语化直接解决这一痛点，将购买从'需要知识'变为'需要感受'。引用 S4 functionalNeeds #1：'好闻但不廉价，容易喜欢但不平庸'",
      },
      {
        level: "emotional",
        proposition:
          "睡前的15分钟属于自己的时间——不是'放松'（太泛），是'一天结束了，现在什么都不用想了'的心理切换仪式",
        soWhatDerivation:
          "S4 identityNeeds #1：用户想成为'懂得照顾自己的人'——在承受一天压力后给自己可控的小愉悦。引用 S4 idealSelfReflection：'洗完澡后点燃蜡烛窝在沙发上的15分钟，让我觉得至少现在这一刻是我的'",
      },
      {
        level: "social",
        proposition:
          "一种不言自明的品味——朋友来你家闻到香味问'这是什么牌子'，你不需要解释'这是一个小众独立品牌'，因为味道本身已经替你说了",
        soWhatDerivation:
          "S4 decisionMotives #3：用户需要'不需要解释的品味表达'。S5 whitespaceOpportunity：用天然食材替代代糖/精制糖的差异化方向——这个差异化消费者能直接感知，不需要教育",
      },
    ],
    brandStory: {
      struggleMoment:
        "创始人小雨在广告公司做创意总监的第五年，发现每天最期待的不是拿奖，是回家后点燃蜡烛然后什么都不想的15分钟。她开始关注香薰，但发现买蜡烛好累——要么太贵不敢试（300-600元买错了心疼），要么香料描述看不懂（'木质东方调'是什么味道）。她想要一个'选蜡烛像选今天晚餐一样自然'的品牌——不需要专业知识、不用承担试错成本、但每一款都有品质感",
      brandAction:
        "用广告人的产品思维重新设计香薰消费体验：1）推出'小样先试'——9.9元买3个小样，找到喜欢的味道再买正装；2）香味描述去术语化——每款用生活场景和情绪代替香料名称（'像躺在刚晒过的被子里'）；3）建立'情绪蜡烛'产品逻辑——不是按香型分类，是按'你现在需要什么'分类（需要放松/需要专注/需要温暖）",
      brandRelationship:
        "不是品牌和顾客——是你家那个永远在的好朋友。你累的时候它用气味给你一个温暖的拥抱，你开心的时候它安静地陪着。你不买的时候不会觉得愧疚（因为小样已经让你试过），你买的时候不会觉得冒险（因为你知道这是你喜欢的味道）。这种关系是：不是因为需要才买，是因为喜欢才想拥有",
    },
    brandPersonality: [
      {
        trait: "温柔",
        dos: "每一句文案像朋友之间的对话；产品包装可以当礼物送（不算太贵但有品味）；售后服务不设障碍（不满意直接退）",
        donts: "不制造焦虑（'再不买就没了'）；不judge用户（'你不懂香'）；不用命令式语气（'你必须拥有'）",
      },
      {
        trait: "诚实",
        dos: "告诉用户这个香味的真实成分和可能不喜欢它的原因（'这款偏木质，如果你喜欢甜香不要选它'）；定价逻辑公开（原料成本+手工费用+合理利润=价格，不编故事加溢价）",
        donts: "不编造香料故事（'来自喜马拉雅的千年古法'）；不虚标原料纯度（写'100%天然'就要真的100%）",
      },
      {
        trait: "有主见",
        dos: "不跟风——如果今年流行玫瑰香但不是我们喜欢的表达方式，我们不做；坚持'让对方感受更好'的产品哲学——不好闻的蜡烛不配叫香薰",
        donts: "不因为某个香型在抖音爆了就快速跟进；不因为'这个成本更低'而妥协品质",
      },
    ],
    reasoning: {
      marketOpportunityReference:
        "引用 S3 experienceGap #1：'现有健康茶饮要么用代糖（口感差），要么只减糖（不算健康）'——这个gap在香薰行业的类比是'要么太贵试错成本太高（沙龙香），要么太廉价品质差（商业香）'。S3 opportunityDirections #1：用天然食材替代的差异化方向——映射到香薰行业的'小样先试+去术语化'降低试错成本的策略",
      consumerInsightReference:
        "引用 S4 identityNeeds #1：用户想成为'懂得照顾自己的人'——在香薰语境下这是'我值得被好好对待的15分钟'。S4 targetConsumer 行为特征：愿意为'对的味道'支付溢价但先买小样——这是'S6小样先试'策略的直接依据。S4 existingSolutions：沙龙香太贵太复杂→我们的小样+去术语化直接解决",
      competitiveGapReference:
        "引用 S5 whitespaceOpportunity：'用天然食材替代的差异化方向——这个消费者能直接感知的差异化目前未被覆盖'。在香薰行业这个逻辑不变：消费者能感知的不是'这是天然香料'（知识），是'这个味道闻起来很舒服'（感受）。我们的差异化是：用'情绪分类'替代'香型分类'——竞品在按香料品种划分市场，我们在按情绪需求划分市场",
    },
  };

  console.log("\n  S6 Derivation Chain: 无推导 vs 完整推导");
  const s6a: AuditRun[] = [];
  const s6b: AuditRun[] = [];
  for (let r = 1; r <= 5; r++) {
    process.stdout.write(".");
    s6a.push(await auditOnce(6, s6NoChain, model, r));
    s6b.push(await auditOnce(6, s6WithChain, model, r));
  }
  results.s6_chain = { noChain: computeStats(s6a), withChain: computeStats(s6b) };
  console.log(
    `\n    无推导: μ=${results.s6_chain.noChain.mean.toFixed(1)} E=${results.s6_chain.noChain.dimStats.evidence.mean.toFixed(1)}`
  );
  console.log(
    `    完整推导: μ=${results.s6_chain.withChain.mean.toFixed(1)} E=${results.s6_chain.withChain.dimStats.evidence.mean.toFixed(1)}`
  );
  const s6EDiff =
    results.s6_chain.withChain.dimStats.evidence.mean -
    results.s6_chain.noChain.dimStats.evidence.mean;
  console.log(`    Evidence 分差: ${s6EDiff.toFixed(1)} ${s6EDiff >= 2 ? "✅ ≥2" : "🔴 <2"}`);

  // ── S7 Strategic Alignment ─────────────────────────
  const s7Unaligned = {
    coreConcept: "极简高级感——用最少的元素传达最大的气场",
    keywords: [
      { keyword: "极简", rationale: "少即是多" },
      { keyword: "高级", rationale: "传达品质感" },
    ],
    visualSystem: {
      form: {
        choice: "几何感极强的直线造型，黑白为主的空间设计，强调建筑感和雕塑感",
        exclusions: "避免多余装饰",
        perceptualTone: "冷峻现代",
      },
      color: {
        choice: "黑白灰为主，点缀金属银",
        exclusions: "不用暖色",
        perceptualTone: "克制冷静",
      },
      typography: {
        choice: "细黑体，文字小而精致",
        exclusions: "不用圆体/手写体",
        perceptualTone: "疏离精致",
      },
      imagery: {
        choice: "高对比度黑白摄影，强调光影和结构的几何关系",
        exclusions: "不用暖调/自然光",
        perceptualTone: "现代艺术感",
      },
      material: {
        choice: "不锈钢、玻璃、抛光石材——光滑、冰冷、精确的表面",
        exclusions: "不用木材/亚麻/陶瓷",
        perceptualTone: "冷感精致",
      },
    },
    restrictions: [
      {
        exclusion: "不用任何暖色",
        strategicRationale: "保持视觉的纯粹和克制",
      },
    ],
  };

  const s7Aligned = {
    coreConcept: "温柔的日常——不是'高级极简'（太冷），不是'日式杂货'（太流行），而是'被仔细照顾但不张扬'的视觉。像一间有阳光的厨房：窗台上晾着洗干净的玻璃杯、木制砧板上有使用痕迹、空气里有淡淡的柠檬味——不是设计给谁看的，只是生活本来的样子",
    keywords: [
      {
        keyword: "温柔",
        rationale: "与S6品牌人格'温柔'对应——每一个视觉元素传递'你可以放松'而非'请注意'",
      },
      {
        keyword: "诚实",
        rationale: "与S6品牌人格'诚实'对应——材质真实不伪装，颜色温暖不造作",
      },
      {
        keyword: "选择",
        rationale: "与S6品牌人格'有主见'对应——不盲从流行，视觉在世界观内自成体系",
      },
    ],
    visualSystem: {
      form: {
        choice: "圆润造型——蜡烛杯为圆角方形（像一块打磨过的鹅卵石），包装盒为圆角，标签为椭圆。整体避免任何锐角（锐角在视觉心理学中=危险/攻击性）。陈列设计：蜡烛不是排列在货架上，而是分散在空间各处——像放在家里不同角落的样子",
        exclusions: "避免锐角几何、避免机械直线、避免'展示柜'式的密集排列",
        perceptualTone: "被温柔包裹——像用手捧着一杯温水",
      },
      color: {
        choice: "暖调中性色——米白（像牛奶）、奶油黄（像早晨的阳光）、鼠尾草绿（像阳台上植物）、浅灰蓝（像多云天空）。品牌主色：暖杏色。整体色谱饱和度不超过15%——不是'没颜色'，是'颜色刚好够'。每种颜色在Pantone色卡中有对应，不是描述性的'温暖'而是可交付的色值",
        exclusions: "不用纯黑（太沉重）、不用荧光/霓虹（太激进）、不用高饱和暖色（太刺激）",
        perceptualTone: "下午3点照进房间的阳光——暖而不热，让一切都看起来更温柔",
      },
      typography: {
        choice: "正文使用温暖的衬线体（如Cormorant Garamond/方正书宋），保留手写质感。中文标题使用稍粗的宋体（笔画有温度），英文使用Humanist Sans-serif（有人文温度的现代感）。字号偏大（正文11pt）、行距偏宽（1.8倍）——让阅读慢下来",
        exclusions: "不用黑体（太冷/效率感）、不用极细字体（太'高级'/有距离）",
        perceptualTone: "读一封手写信的节奏——从容、真实",
      },
      imagery: {
        choice: "自然光摄影——拍摄对象是蜡烛在使用状态下的场景：黄昏窗台上蜡烛的光晕、泡澡时浴缸边蜡烛的微光、看书时茶几上蜡烛的陪伴。构图：中景和特写为主（不是产品图——是使用场景），光来自蜡烛本身（不是补光灯）。色调：暖调但不加滤镜——让真实的温暖色温说话",
        exclusions: "不用白底产品图（太电商）、不用45度俯拍（太Instagram）、不用精修到失真",
        perceptualTone: "朋友发来的一张照片——'今天下午在家，这个蜡烛的光好好看'",
      },
      material: {
        choice: "蜡烛杯：哑光陶瓷（白色和米色，保留轻微手工痕迹）。包装盒：再生纸（米色，表面有植物纤维纹理，像手工纸）。标签：棉纸，手撕边缘（不用机器裁切——保留一点不完美）。填充物：碎纸丝（回收纸制成），不是塑料泡沫。设计理念：每一样东西触感温暖——不是'看起来很贵'，是'摸起来很舒服'",
        exclusions: "不用亮面/镜面/金属/塑料/亚克力——这些材料在触觉上是冷的、在视觉上是'展示'的",
        perceptualTone: "拆开礼物的过程——纸张的沙沙声、棉线的触感、一切都是温的",
      },
    },
    restrictions: [
      {
        exclusion: "不使用纯黑色",
        strategicRationale:
          "与S6品牌人格'温柔'冲突——黑色在视觉心理学中=终结/沉重/距离。即使在文字中，最深色用深灰（#2C2C2C）而非纯黑（#000）",
      },
      {
        exclusion: "不使用金属/镜面材质",
        strategicRationale:
          "与S6品牌人格'诚实'冲突——金属反射的不是真实，是环境的扭曲。用户需要的是'真实'的触感，不是'看起来高级'的假象",
      },
      {
        exclusion: "不在包装上写slogan或品牌声明",
        strategicRationale:
          "与S6品牌人格'有主见'和'诚实'一致——好产品不需要大声说'我是好的'。用户拆开包装时第一感受应该是'这个蜡烛闻起来真好'，不是'这个品牌真有态度'。S4 identityNeeds #1：用户想成为'懂得照顾自己的人'——不是'被品牌教育的人'",
      },
    ],
  };

  console.log("\n  S7 Strategic Alignment: 无关联 vs 战略一致");
  const s7a: AuditRun[] = [];
  const s7b: AuditRun[] = [];
  for (let r = 1; r <= 5; r++) {
    process.stdout.write(".");
    s7a.push(await auditOnce(7, s7Unaligned, model, r));
    s7b.push(await auditOnce(7, s7Aligned, model, r));
  }
  results.s7_alignment = { unaligned: computeStats(s7a), aligned: computeStats(s7b) };
  console.log(
    `\n    无关联: μ=${results.s7_alignment.unaligned.mean.toFixed(1)} E=${results.s7_alignment.unaligned.dimStats.evidence.mean.toFixed(1)}`
  );
  console.log(
    `    一致:   μ=${results.s7_alignment.aligned.mean.toFixed(1)} E=${results.s7_alignment.aligned.dimStats.evidence.mean.toFixed(1)}`
  );
  const s7EDiff =
    results.s7_alignment.aligned.dimStats.evidence.mean -
    results.s7_alignment.unaligned.dimStats.evidence.mean;
  console.log(`    Evidence 分差: ${s7EDiff.toFixed(1)} ${s7EDiff >= 2 ? "✅ ≥2" : "🔴 <2"}`);

  return results;
}

// ══════════════════════════════════════════════════════════
// PART 4: 多模型对比
// ══════════════════════════════════════════════════════════
async function runPart4(): Promise<Record<string, any>> {
  hr(`Part 4: 多模型对比 — ${ACTIVE_MODELS.join(" vs ")} × 5 runs`);

  const results: Record<string, any> = {};

  for (const fixture of FIXTURES) {
    const data = loadFixture(fixture.file);
    const caseResults: Record<string, Record<string, AuditRun[]>> = {};

    for (const model of ACTIVE_MODELS) {
      const modelRuns: Record<string, AuditRun[]> = {};
      process.stdout.write(`  ${fixture.name} (${model}): `);

      for (let stage = 1; stage <= 8; stage++) {
        const output = data.stages[String(stage)];
        if (!output) continue;

        const runs: AuditRun[] = [];
        for (let r = 1; r <= 5; r++) {
          process.stdout.write(".");
          runs.push(await auditOnce(stage, output, model, r));
        }
        modelRuns[String(stage)] = runs;
      }
      caseResults[model] = modelRuns;
      console.log(" ✓");
    }

    // 比较
    if (ACTIVE_MODELS.length >= 2) {
      const m1 = ACTIVE_MODELS[0];
      const m2 = ACTIVE_MODELS[1];
      console.log(`\n  ${m1} vs ${m2}:`);

      let totalDiff = 0;
      let gateMismatch = 0;
      for (let stage = 1; stage <= 8; stage++) {
        const r1 = caseResults[m1]?.[String(stage)];
        const r2 = caseResults[m2]?.[String(stage)];
        if (!r1 || !r2) continue;

        const s1 = computeStats(r1);
        const s2 = computeStats(r2);
        const diff = Math.abs(s1.mean - s2.mean);
        totalDiff += diff;

        const g1 = Object.keys(s1.gateDistribution)[0] || "?";
        const g2 = Object.keys(s2.gateDistribution)[0] || "?";
        const mm = g1 !== g2 ? " ⚡" : "";

        console.log(
          `    S${stage} ${s1.mean.toFixed(1)} vs ${s2.mean.toFixed(1)} diff=${diff.toFixed(1)} gate=${g1}/${g2}${mm}`
        );
        if (g1 !== g2) gateMismatch++;
      }

      const avgDiff = totalDiff / 8;
      results[fixture.name] = {
        avgDiff: avgDiff.toFixed(1),
        gateMismatch: `${gateMismatch}/8`,
        status: avgDiff < 8 && gateMismatch <= 1 ? "✅" : "⚠️",
      };
      console.log(
        `  平均分差: ${avgDiff.toFixed(1)} | Gate不一致: ${gateMismatch}/8 ${results[fixture.name].status}`
      );
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════
// PART 6: 回归 — V3.0 vs V3.1
// ══════════════════════════════════════════════════════════
async function runPart6(): Promise<Record<string, any>> {
  hr("Part 6: 回归测试 — V3.0 模拟 vs V3.1");

  // V3.0 模拟：通过临时修改 STAGE_AUDIT_CONFIGS 来实现
  // 注：V3.0 的核心差异是：
  //   1. 权重更均分（S6 四维均衡、Evidence 权重低）
  //   2. 无 Evidence 三维模型
  //   3. 无 stage-specific 评分锚点
  //   4. S6 advanceThreshold = 80（V3.1 为 75）
  //
  // 由于我们不能在运行时修改已导入的模块，这里采用：
  //   直接对比 V3.1 在三个案例上的实际表现与预期基线
  //   + 检查关键回归信号：
  //     a) Case A S6 不能接近满分（如果均分 >90 = 回归失败）
  //     b) Case C Evidence 不能接近及格（如果均分 >2 = 回归失败）
  //     c) Case A S3 Evidence 应该高于 Case B S3 Evidence（区分度）

  const model = ACTIVE_MODELS[0];
  const results: Record<string, any> = {};
  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];

  for (const fixture of FIXTURES) {
    const data = loadFixture(fixture.file);
    const caseStats: Record<number, ReturnType<typeof computeStats>> = {};

    for (let stage = 1; stage <= 8; stage++) {
      const output = data.stages[String(stage)];
      if (!output) continue;
      const runs: AuditRun[] = [];
      for (let r = 1; r <= 5; r++) {
        runs.push(await auditOnce(stage, output, model, r));
      }
      caseStats[stage] = computeStats(runs);
    }

    results[fixture.name] = caseStats;

    // 检查 1: Case A S6 不能接近满分
    if (fixture.level === "high") {
      const s6 = caseStats[6];
      if (s6) {
        const ok = s6.mean <= 90;
        checks.push({
          name: `Case A S6 not ceiling (≤90)`,
          passed: ok,
          detail: `S6 mean=${s6.mean.toFixed(1)}`,
        });
      }
    }

    // 检查 2: Case C Evidence 不能接近及格
    if (fixture.level === "low") {
      const evScores: number[] = [];
      for (let s = 1; s <= 8; s++) {
        const st = caseStats[s];
        if (st) evScores.push(st.dimStats.evidence?.mean ?? 0);
      }
      const avgEvidence = mean(evScores);
      const ok = avgEvidence <= 2.5;
      checks.push({
        name: `Case C Evidence ≤2.5 avg`,
        passed: ok,
        detail: `avg Evidence=${avgEvidence.toFixed(1)}`,
      });
    }
  }

  // 检查 3: 区分度 — Case A vs Case C 总分差异
  const caseA = results["Case A 慢象咖啡"];
  const caseC = results["Case C YoungLife"];
  if (caseA && caseC) {
    const aScores: number[] = [];
    const cScores: number[] = [];
    for (let s = 1; s <= 8; s++) {
      if (caseA[s]) aScores.push(caseA[s].mean);
      if (caseC[s]) cScores.push(caseC[s].mean);
    }
    const aAvg = mean(aScores);
    const cAvg = mean(cScores);
    const diff = aAvg - cAvg;
    checks.push({
      name: "High vs Low differentiation (A-C ≥30)",
      passed: diff >= 30,
      detail: `Case A avg=${aAvg.toFixed(1)} Case C avg=${cAvg.toFixed(1)} diff=${diff.toFixed(1)}`,
    });
  }

  // 检查 4: Case A S3 Evidence > Case B S3 Evidence
  const caseB = results["Case B 快享茶饮"];
  if (caseA && caseB) {
    const aS3Ev = caseA[3]?.dimStats.evidence?.mean ?? 0;
    const bS3Ev = caseB[3]?.dimStats.evidence?.mean ?? 0;
    const evDiff = aS3Ev - bS3Ev;
    checks.push({
      name: "S3 Evidence: Case A > Case B",
      passed: evDiff >= 1.5,
      detail: `Case A S3 E=${aS3Ev.toFixed(1)} Case B S3 E=${bS3Ev.toFixed(1)} diff=${evDiff.toFixed(1)}`,
    });
  }

  // 检查 5: 各案例总分区间
  for (const fixture of FIXTURES) {
    const stats = results[fixture.name];
    if (!stats) continue;
    const scores: number[] = [];
    for (let s = 1; s <= 8; s++) {
      if (stats[s]) scores.push(stats[s].mean);
    }
    const avgAll = mean(scores);
    let expected: [number, number];
    if (fixture.level === "high") expected = [85, 95];
    else if (fixture.level === "medium") expected = [60, 75];
    else expected = [20, 40];
    const inRange = avgAll >= expected[0] && avgAll <= expected[1];
    checks.push({
      name: `${fixture.name} avg in [${expected[0]},${expected[1]}]`,
      passed: inRange,
      detail: `avg=${avgAll.toFixed(1)}`,
    });
  }

  console.log("\n  回归检查结果:");
  for (const c of checks) {
    console.log(`    ${c.passed ? "✅" : "🔴"} ${c.name}: ${c.detail}`);
  }

  return { checks, results };
}

// ══════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════
async function main() {
  const startTime = Date.now();
  const allResults: Record<string, any> = {};

  // Part 1+3: 样本测试 + 稳定性
  if (PARTS.has(1) || PARTS.has(3)) {
    try {
      allResults.part1 = await runPart1();
    } catch (e: any) {
      console.error("Part 1 失败:", e.message);
      allResults.part1_error = e.message;
    }
  }

  // Part 2: 阶段专项
  if (PARTS.has(2)) {
    try {
      allResults.part2 = await runPart2();
    } catch (e: any) {
      console.error("Part 2 失败:", e.message);
      allResults.part2_error = e.message;
    }
  }

  // Part 4: 多模型
  if (PARTS.has(4) && ACTIVE_MODELS.length >= 2) {
    try {
      allResults.part4 = await runPart4();
    } catch (e: any) {
      console.error("Part 4 失败:", e.message);
      allResults.part4_error = e.message;
    }
  }

  // Part 6: 回归
  if (PARTS.has(6) && !SKIP_REGRESSION) {
    try {
      allResults.part6 = await runPart6();
    } catch (e: any) {
      console.error("Part 6 失败:", e.message);
      allResults.part6_error = e.message;
    }
  }

  // ── 保存报告 ──────────────────────────────────────
  const reportDir = join(process.cwd(), "tests", "reports");
  try { mkdirSync(reportDir, { recursive: true }); } catch {}

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const report = {
    title: "AI Quality Audit V3.1 — 自动化验证报告",
    timestamp: new Date().toISOString(),
    config: {
      runs: RUNS,
      models: ACTIVE_MODELS,
      parts: Array.from(PARTS),
      elapsed_minutes: parseFloat(elapsed),
    },
    results: allResults,
  };

  const reportPath = join(reportDir, `audit-v3-report-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // ── 终端总结 ──────────────────────────────────────
  hr("验证完成");
  console.log(`  耗时: ${elapsed} 分钟`);
  console.log(`  报告: ${reportPath}`);
  console.log("");

  // Part 1 摘要
  if (allResults.part1) {
    const p1 = allResults.part1 as StageResult[];
    console.log("  Part 1+3 摘要:");
    for (const level of ["high", "medium", "low"]) {
      const levelResults = p1.filter((r) => {
        if (level === "high") return r.caseName.includes("Case A");
        if (level === "medium") return r.caseName.includes("Case B");
        return r.caseName.includes("Case C");
      });
      const scores = levelResults.map((r) => r.stats.mean);
      const sigmas = levelResults.map((r) => r.stats.stdDev);
      if (scores.length > 0) {
        const avgScore = mean(scores);
        const avgSigma = mean(sigmas);
        const allStable = sigmas.every((s) => s < 5);
        console.log(
          `    ${level}: μ=${avgScore.toFixed(1)} σ_avg=${avgSigma.toFixed(1)} stable=${allStable ? "✅" : "🔴"}`
        );
      }
    }
  }

  // Part 2 摘要
  if (allResults.part2) {
    console.log("  Part 2 阶段专项:");
    const p2 = allResults.part2;
    if (p2.s3_evidence) {
      const diff =
        p2.s3_evidence.withData.dimStats.evidence.mean -
        p2.s3_evidence.noData.dimStats.evidence.mean;
      console.log(`    S3 Evidence区分: ${diff.toFixed(1)} ${diff >= 2 ? "✅" : "🔴"}`);
    }
    if (p2.s6_chain) {
      const diff =
        p2.s6_chain.withChain.dimStats.evidence.mean -
        p2.s6_chain.noChain.dimStats.evidence.mean;
      console.log(`    S6 推导链区分: ${diff.toFixed(1)} ${diff >= 2 ? "✅" : "🔴"}`);
    }
    if (p2.s7_alignment) {
      const diff =
        p2.s7_alignment.aligned.dimStats.evidence.mean -
        p2.s7_alignment.unaligned.dimStats.evidence.mean;
      console.log(`    S7 战略一致性区分: ${diff.toFixed(1)} ${diff >= 2 ? "✅" : "🔴"}`);
    }
  }

  // Part 6 摘要
  if (allResults.part6) {
    const p6 = allResults.part6;
    if (p6.checks) {
      const passed = p6.checks.filter((c: any) => c.passed).length;
      const total = p6.checks.length;
      console.log(`  Part 6 回归: ${passed}/${total} ${passed === total ? "✅" : "🔴"}`);
    }
  }

  console.log("");
  process.exit(0);
}

main().catch((e) => {
  console.error("验证脚本异常:", e);
  process.exit(1);
});
