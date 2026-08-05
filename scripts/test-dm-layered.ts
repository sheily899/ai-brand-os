/**
 * 机会 1 DM 双层结构 — 验证脚本
 *
 * 1. computeMemoryImportance 单元测试
 * 2. buildMemoryContext full vs layered 对比（用真实项目 DM 数据）
 */

import { buildMemoryContext, computeMemoryImportance } from "../src/lib/memory/decision-memory";

// ── 1. 单元测试 ────────────────────────────────────────

const testCases = [
  // S6 positioning: confirmed_decision(+3) + ai_inferred(0) + 战略字段(+2) + 长内容(+1) = 6
  { entryType: "confirmed_decision", evidenceLevel: "ai_inferred", fieldPath: "positioning", content: "为敏感肌人群提供先修护再功效的护肤方案，目标人群25-35岁都市女性，区别于传统功效护肤品牌的功能堆砌路线。".repeat(3), expect: ">=4" },
  // S4 identityNeed: hypothesis(0) + ai_inferred(0) + 战略字段(+2) + 短内容(0) = 2
  { entryType: "hypothesis", evidenceLevel: "ai_inferred", fieldPath: "deepNeeds.identityNeed", content: "消费者渴望被认可为理性的护肤决策者", expect: "<4" },
  // S5 竞品弱点(search_backed+长): confirmed_fact(+2) + search_backed(+2) + 非战略(0) + 长(+1) = 5
  { entryType: "confirmed_fact", evidenceLevel: "search_backed", fieldPath: "competitors[0]", content: "竞品: 修丽可 — 定位: 专业院线级抗氧化".repeat(3), expect: ">=4" },
  // S3 opportunity hypothesis: hypothesis(0) + search_backed(+2) + 非战略(0) + 短(0) = 2
  { entryType: "hypothesis", evidenceLevel: "search_backed", fieldPath: "opportunityDirections[0].direction", content: "屏障修护+功效成分的复合配方市场存在空白", expect: "<4" },
  // S6 brandPersonality: confirmed_decision(+3) + ai_inferred(0) + 非战略(0) + 短(0) = 3
  { entryType: "confirmed_decision", evidenceLevel: "ai_inferred", fieldPath: "brandPersonality", content: "品牌人格特质: 专业、克制、真诚", expect: "<4" },
  // S1 founderMotivation: confirmed_fact(+2) + ai_inferred(0) + 战略(+2) + 短(0) = 4
  { entryType: "confirmed_fact", evidenceLevel: "ai_inferred", fieldPath: "founderMotivation.content", content: "创始人在欧莱雅做了7年配方研发，观察到行业在成分浓度上竞争但消费者皮肤屏障在恶化", expect: ">=4" },
  // Short observation: confirmed_fact(+2) + ai_inferred(0) + 非战略(0) + 短(0) = 2
  { entryType: "confirmed_fact", evidenceLevel: "ai_inferred", fieldPath: "observations[0]", content: "用户在选购护肤品时频繁查阅成分表", expect: "<4" },
];

console.log("=== computeMemoryImportance 单元测试 ===\n");
let passed = 0;
let failed = 0;
for (const tc of testCases) {
  const score = computeMemoryImportance(tc);
  const ok = tc.expect === ">=4" ? score >= 4 : score < 4;
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} score=${score} ${tc.expect.padEnd(4)} | ${tc.fieldPath.padEnd(35)} | ${tc.entryType}/${tc.evidenceLevel}`);
  if (ok) passed++;
  else failed++;
}
console.log(`\n${passed}/${passed + failed} passed`);

// ── 2. 真实 DM 对比 ────────────────────────────────────

async function compareRealProject() {
  const db = (await import("../src/lib/db")).db;
  const { decisionMemoryEntry } = await import("../src/lib/db");
  const { eq } = await import("drizzle-orm");

  // 找最近有 DM 数据的项目
  const rows = await db
    .select({ projectId: decisionMemoryEntry.projectId })
    .from(decisionMemoryEntry)
    .groupBy(decisionMemoryEntry.projectId)
    .limit(1) as any;

  if (rows.length === 0) {
    console.log("\n⚠️  数据库中没有 Decision Memory 数据，跳过真实项目对比");
    return;
  }

  const projectId = rows[0].projectId;
  console.log(`\n=== buildMemoryContext full vs layered (project: ${projectId.slice(0, 8)}...) ===\n`);

  // 计算 S8 时的 DM 上下文（注入 S1-S7 全部条目）
  const full = await buildMemoryContext(projectId, 8, { mode: "full" });
  const layered = await buildMemoryContext(projectId, 8, { mode: "layered" });

  console.log(`mode=full:    ${full.length} chars, ~${Math.round(full.length / 4)} tokens`);
  console.log(`mode=layered: ${layered.length} chars, ~${Math.round(layered.length / 4)} tokens`);

  if (full.length > 0) {
    const reduction = ((1 - layered.length / full.length) * 100).toFixed(1);
    console.log(`压缩率: ${reduction}%`);
  }

  // 统计 layered 模式下各条目使用 summary vs fullContent
  const { getEntries } = await import("../src/lib/memory/decision-memory");
  const all = await getEntries(projectId);
  const relevant = all.filter((e: any) => e.stageSource < 8);
  const fullCount = relevant.filter((e: any) => computeMemoryImportance(e) >= 4).length;
  const summaryCount = relevant.length - fullCount;
  console.log(`\n条目分布: ${fullCount} fullContent / ${summaryCount} summary / ${relevant.length} total`);

  // 列出每个条目的评分
  console.log("\n--- 条目评分明细 ---");
  const sorted = [...relevant].sort((a: any, b: any) => computeMemoryImportance(b) - computeMemoryImportance(a));
  for (const e of sorted) {
    const score = computeMemoryImportance(e);
    const label = score >= 4 ? "FULL" : "SUM";
    const preview = (e as any).content.slice(0, 60).replace(/\n/g, " ");
    console.log(`  [${label}] score=${score} [S${(e as any).stageSource}] ${(e as any).entryType.padEnd(20)} | ${(e as any).fieldPath.padEnd(35)} | ${preview}...`);
  }

  // 采样输出对比
  console.log("\n--- 输出采样 (前 500 chars) ---");
  console.log("\n[full]:");
  console.log(full.slice(0, 500));
  console.log("\n[layered]:");
  console.log(layered.slice(0, 500));
}

compareRealProject().catch((err) => {
  console.error("对比失败:", err.message);
  process.exit(1);
});
