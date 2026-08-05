/**
 * Phase 3: Full Mode vs Layered Mode Comparison Experiment
 *
 * 对 3 个数据集规模（真实 2778 + 合成 500 + 合成 5000）运行对比实验，
 * 测量：
 * ① 核心战略信息保留率
 * ② Token 压缩率
 * ③ 评分分布变化
 */

import * as fs from "fs";
import * as path from "path";
import { db, decisionMemoryEntry } from "../src/lib/db";
import { buildMemoryContext, computeMemoryImportance } from "../src/lib/memory/decision-memory";

interface DMEntry {
  id: string;
  projectId: string;
  stageSource: number;
  entryType: string;
  content: string;
  fieldPath: string;
  evidenceLevel: string;
}

interface ExperimentResult {
  datasetLabel: string;
  totalEntries: number;
  fullMode: {
    charCount: number;
    estimatedTokens: number;
    entryCount: number;
  };
  layeredMode: {
    charCount: number;
    estimatedTokens: number;
    fullEntries: number;
    summaryEntries: number;
  };
  compressionRate: string;
  strategicRetention: {
    totalStrategic: number;
    retainedFull: number;
    retentionRate: string;
  };
  scoreDistribution: Record<string, number>;
}

const CORE_STRATEGIC_FIELDS = [
  "founderMotivation.content",
  "deepNeeds.identityNeed",
  "deepNeeds.functionalNeed",
  "whitespaceOpportunity",
  "competitiveGap.marketOpportunity",
  "positioning",
  "brandStory.struggleMoment",
  "brandStory.brandAction",
  "brandStory.brandRelationship",
  "coreConcept",
  "coreDirection",
];

function countStrategicFields(entries: DMEntry[]): number {
  return entries.filter(e =>
    CORE_STRATEGIC_FIELDS.some(sf => e.fieldPath.includes(sf))
  ).length;
}

function countStrategicFull(entries: DMEntry[]): number {
  return entries.filter(e =>
    CORE_STRATEGIC_FIELDS.some(sf => e.fieldPath.includes(sf)) &&
    computeMemoryImportance(e) >= 4
  ).length;
}

async function loadRealEntries(): Promise<DMEntry[]> {
  const rows = await db.select().from(decisionMemoryEntry).orderBy(decisionMemoryEntry.confirmedAt) as any;
  return rows.map((r: any) => ({
    id: r.id,
    projectId: r.projectId,
    stageSource: r.stageSource,
    entryType: r.entryType,
    content: r.content,
    fieldPath: r.fieldPath,
    evidenceLevel: r.evidenceLevel,
  }));
}

function loadSyntheticEntries(filename: string): DMEntry[] {
  const filePath = path.join(__dirname, "..", "test-results", "dm-datasets", filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

async function runExperiment(entries: DMEntry[], label: string): Promise<ExperimentResult> {
  // 模拟 S8 场景（注入 S1-S7 全部条目）
  const priorStageEntries = entries.filter(e => e.stageSource < 8);

  // Full Mode
  const fullCtx = buildMemoryContextFor(priorStageEntries, "full");
  const fullTokens = Math.round(fullCtx.length / 4); // ~4 chars/token for Chinese

  // Layered Mode
  const layeredCtx = buildMemoryContextFor(priorStageEntries, "layered");
  const layeredTokens = Math.round(layeredCtx.length / 4);

  // Compression rate
  const compressionRate = fullCtx.length > 0
    ? ((1 - layeredCtx.length / fullCtx.length) * 100).toFixed(1)
    : "0.0";

  // Strategic retention
  const totalStrategic = countStrategicFields(priorStageEntries);
  const retainedFull = countStrategicFull(priorStageEntries);
  const retentionRate = totalStrategic > 0
    ? (retainedFull / totalStrategic * 100).toFixed(1)
    : "N/A";

  // Score distribution
  const scoreDist: Record<string, number> = {};
  for (const e of priorStageEntries) {
    const score = computeMemoryImportance(e);
    const key = score >= 4 ? "FULL" : "SUM";
    scoreDist[key] = (scoreDist[key] || 0) + 1;
  }

  return {
    datasetLabel: label,
    totalEntries: priorStageEntries.length,
    fullMode: {
      charCount: fullCtx.length,
      estimatedTokens: fullTokens,
      entryCount: priorStageEntries.length,
    },
    layeredMode: {
      charCount: layeredCtx.length,
      estimatedTokens: layeredTokens,
      fullEntries: scoreDist["FULL"] || 0,
      summaryEntries: scoreDist["SUM"] || 0,
    },
    compressionRate,
    strategicRetention: {
      totalStrategic,
      retainedFull,
      retentionRate,
    },
    scoreDistribution: scoreDist,
  };
}

/** 直接构造上下文文本（不依赖 DB，纯内存计算） */
function buildMemoryContextFor(entries: DMEntry[], mode: "full" | "layered"): string {
  const facts = entries.filter(e => e.entryType === "confirmed_fact");
  const decisions = entries.filter(e => e.entryType === "confirmed_decision");
  const hypotheses = entries.filter(e => e.entryType === "hypothesis");
  const unresolved = entries.filter(e => e.entryType === "unresolved_question");

  const SUMMARY_MAX_LENGTH = 200;

  const formatEntry = (e: DMEntry): string => {
    if (mode === "full") return `- [S${e.stageSource}] ${e.content}`;
    const importance = computeMemoryImportance(e);
    if (importance >= 4) return `- [S${e.stageSource}] ${e.content}`;
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

// ── 生成报告 ────────────────────────────────────────────

async function main() {
  // Load all datasets
  console.log("Loading datasets...");
  const realEntries = await loadRealEntries();
  const synth500 = loadSyntheticEntries("dm-synthetic-500.json");
  const synth5000 = loadSyntheticEntries("dm-synthetic-5000.json");

  // Run experiments
  const results: ExperimentResult[] = [];
  results.push(await runExperiment(realEntries, "真实数据 (2,778 条)"));
  results.push(await runExperiment(synth500, "合成数据 Small (500 条)"));
  results.push(await runExperiment(synth5000, "合成数据 Large (5,000 条)"));

  // ── 输出报告 ──────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║     Decision Memory 分层压缩 — Full vs Layered 对比实验      ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // 1. Token 压缩率
  console.log("━━━ ① Token 压缩率 ━━━\n");
  console.log("数据集              │ Full Mode      │ Layered Mode   │ 压缩率");
  console.log("────────────────────┼─────────────────┼─────────────────┼────────");
  for (const r of results) {
    const label = r.datasetLabel.padEnd(18);
    const full = `${r.fullMode.charCount.toLocaleString()} chars`.padEnd(15);
    const layered = `${r.layeredMode.charCount.toLocaleString()} chars`.padEnd(15);
    const cr = `${r.compressionRate}%`.padStart(6);
    console.log(`${label} │ ${full} │ ${layered} │ ${cr}`);
  }
  console.log();

  // 2. 战略字段保留率
  console.log("━━━ ② 核心战略信息保留率 ━━━\n");
  console.log("数据集              │ 战略字段总数 │ FULL保留  │ 保留率");
  console.log("────────────────────┼─────────────┼──────────┼────────");
  for (const r of results) {
    const label = r.datasetLabel.padEnd(18);
    const total = String(r.strategicRetention.totalStrategic).padStart(11);
    const retained = String(r.strategicRetention.retainedFull).padStart(8);
    const rate = `${r.strategicRetention.retentionRate}%`.padStart(6);
    console.log(`${label} │ ${total} │ ${retained} │ ${rate}`);
  }
  console.log();

  // 3. FULL/SUMMARY 分布
  console.log("━━━ ③ 条目分类分布 ━━━\n");
  console.log("数据集              │ FULL       │ SUMMARY    │ FULL 占比");
  console.log("────────────────────┼────────────┼────────────┼──────────");
  for (const r of results) {
    const label = r.datasetLabel.padEnd(18);
    const full = String(r.layeredMode.fullEntries).padStart(10);
    const sum = String(r.layeredMode.summaryEntries).padStart(10);
    const ratio = `${(r.layeredMode.fullEntries / r.totalEntries * 100).toFixed(1)}%`.padStart(7);
    console.log(`${label} │ ${full} │ ${sum} │ ${ratio}`);
  }
  console.log();

  // 4. 每个阶段的详细对比
  console.log("━━━ ④ 按阶段 Token 占比 ━━━\n");
  if (results.length > 0) {
    const entries = synth5000; // Use largest dataset for stage breakdown
    const byStage = new Map<number, DMEntry[]>();
    for (const e of entries) {
      if (e.stageSource >= 8) continue;
      if (!byStage.has(e.stageSource)) byStage.set(e.stageSource, []);
      byStage.get(e.stageSource)!.push(e);
    }
    console.log("阶段 │ 条目数 │ Full chars │ Layered chars │ 压缩率 │ FULL率");
    console.log("─────┼───────┼────────────┼───────────────┼────────┼───────");
    for (const [stage, stageEntries] of [...byStage.entries()].sort((a,b) => a[0]-b[0])) {
      const fullCtx = buildMemoryContextFor(stageEntries, "full");
      const layeredCtx = buildMemoryContextFor(stageEntries, "layered");
      const cr = fullCtx.length > 0 ? ((1 - layeredCtx.length / fullCtx.length) * 100).toFixed(0) : "0";
      const fullCount = stageEntries.filter(e => computeMemoryImportance(e) >= 4).length;
      const fullRatio = (fullCount / stageEntries.length * 100).toFixed(0);
      console.log(` S${stage}  │ ${String(stageEntries.length).padStart(5)} │ ${String(fullCtx.length).padStart(8)} │ ${String(layeredCtx.length).padStart(11)} │ ${cr}%  │ ${fullRatio}%`);
    }
  }
  console.log();

  // 5. 通过标准判定
  console.log("━━━ ⑤ 通过标准判定 ━━━\n");
  const largeResult = results[2]; // 5000 条
  const crValue = parseFloat(largeResult.compressionRate);
  const retentionValue = parseFloat(largeResult.strategicRetention.retentionRate);

  console.log(`Token 压缩率:  ${largeResult.compressionRate}% ${crValue >= 20 ? "✅" : "⚠️ 未达标"} (目标 ≥20%)`);
  console.log(`战略字段保留: ${largeResult.strategicRetention.retentionRate}% ${retentionValue >= 95 ? "✅" : "⚠️ 未达标"} (目标 ≥95%)`);

  if (crValue >= 20 && retentionValue >= 95) {
    console.log("\n✅ 实验通过 — layered mode 可进入生产验证");
  } else {
    console.log("\n⚠️ 需调整参数 — 检查 SUMMARY_MAX_LENGTH 或评分阈值");
  }

  // Save report
  const reportPath = path.join(__dirname, "..", "test-results", "dm-datasets", "comparison-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n详细数据已保存至 ${reportPath}`);
}

main().catch(err => {
  console.error("Experiment failed:", err);
  process.exit(1);
});
