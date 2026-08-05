/**
 * scripts/compare-audit.ts — 严格对照审计实验
 *
 * 用同一份 stage output JSON，分别测：
 *   A) 跨模型差异: deepseek-chat vs v4-flash
 *   B) 单模型噪音: deepseek-chat 独立调用两次
 *
 * 用法：npx tsx scripts/compare-audit.ts <projectId>
 */

import { readFileSync } from "fs";
const envPath = "D:/brand-intelligence-os/.env.local";
const c = readFileSync(envPath, "utf8");
for (const l of c.split("\n")) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

const PROJECT_ID = process.argv[2];
if (!PROJECT_ID) { console.error("用法: npx tsx scripts/compare-audit.ts <projectId>"); process.exit(1); }

const STAGE_NAMES: Record<number, string> = {
  1: "用户访谈", 2: "商业背景分析", 3: "市场机会分析", 4: "消费者洞察",
  5: "竞争判断", 6: "品牌核心战略", 7: "视觉策略", 8: "内容规划",
};

const DIM_LABELS: Record<string, string> = {
  specificity: "具体度", differentiation: "差异化", actionability: "可执行性", evidence: "证据",
};

interface AuditRun {
  model: string;
  run: number;
  score: number;
  dims: Record<string, number>;
  gate: string;
  issues: number;
}

async function auditOnce(stage: number, output: Record<string, any>, model: string, runLabel: number): Promise<AuditRun> {
  // Force specific audit model
  process.env.AUDIT_MODEL = model;

  const { runAIQualityAudit } = await import("../src/lib/audit/ai-quality");

  const result = await runAIQualityAudit(stage, output);
  const dims: Record<string, number> = {};
  for (const ds of result.dimensionScores) {
    dims[ds.dimension] = ds.score;
  }

  return {
    model,
    run: runLabel,
    score: result.totalScore,
    dims,
    gate: result.gateRecommendation,
    issues: result.issues.length,
  };
}

async function main() {
  const { db } = await import("../src/lib/db/index");
  const { stageRecord } = await import("../src/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { STAGE_AUDIT_CONFIGS } = await import("../src/lib/audit/ai-quality");

  console.log("项目:", PROJECT_ID);
  console.log("");

  const allRuns: Record<number, AuditRun[]> = {};

  for (let stage = 1; stage <= 8; stage++) {
    const rows = await db
      .select()
      .from(stageRecord)
      .where(and(eq(stageRecord.projectId, PROJECT_ID), eq(stageRecord.stageNumber, stage)))
      .limit(1);

    const record = rows[0];
    if (!record?.structuredOutput) {
      console.log(`S${stage} ⚠️ 无结构化输出`);
      continue;
    }

    const output = record.structuredOutput as Record<string, any>;
    const config = STAGE_AUDIT_CONFIGS[stage];
    const threshold = config?.advanceThreshold ?? 70;

    const runs: AuditRun[] = [];

    // Step A: 跨模型对比
    // deepseek-chat (run 1)
    process.stdout.write(`S${stage} chat#1...`);
    runs.push(await auditOnce(stage, output, "deepseek-chat", 1));
    process.stdout.write(` ${runs[runs.length-1].score} `);

    // deepseek-v4-flash (run 1)
    process.stdout.write(`v4-flash...`);
    runs.push(await auditOnce(stage, output, "deepseek-v4-flash", 1));
    process.stdout.write(` ${runs[runs.length-1].score} `);

    // Step B: 单模型噪音基线
    // deepseek-chat (run 2 — 独立调用)
    process.stdout.write(`chat#2...`);
    runs.push(await auditOnce(stage, output, "deepseek-chat", 2));
    process.stdout.write(` ${runs[runs.length-1].score}\n`);

    allRuns[stage] = runs;
  }

  // ── 输出报告 ──────────────────────────────────────────
  console.log("\n" + "═".repeat(80));
  console.log("  实验 A: 跨模型对比 (deepseek-chat#1 vs v4-flash#1)");
  console.log("═".repeat(80));

  console.log("\n阶段      阈值  chat A  flash  A   分差     chat Gate  flash Gate");
  console.log("────────  ────  ───────  ────────  ─────  ─────────  ──────────");

  let totalDiff = 0;
  let gateMismatch = 0;

  for (let stage = 1; stage <= 8; stage++) {
    const runs = allRuns[stage];
    if (!runs) continue;
    const chatA = runs.find(r => r.model === "deepseek-chat" && r.run === 1)!;
    const flash = runs.find(r => r.model === "deepseek-v4-flash")!;
    const config = STAGE_AUDIT_CONFIGS[stage];
    const threshold = config?.advanceThreshold ?? 70;
    const diff = flash.score - chatA.score;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    const gateC = chatA.gate === "advance" ? "✅" : chatA.gate === "reoptimize" ? "⚠️" : "⛔";
    const gateF = flash.gate === "advance" ? "✅" : flash.gate === "reoptimize" ? "⚠️" : "⛔";
    const mm = chatA.gate !== flash.gate ? " ⚡" : "";

    console.log(`S${stage} ${STAGE_NAMES[stage].padEnd(6)} ${String(threshold).padStart(4)}  ${String(chatA.score).padStart(7)}  ${String(flash.score).padStart(8)}  ${diffStr.padStart(5)}  ${gateC.padEnd(9)}  ${gateF}${mm}`);

    totalDiff += Math.abs(diff);
    if (chatA.gate !== flash.gate) gateMismatch++;
  }

  console.log("");
  console.log(`  平均绝对分差: ${(totalDiff / 8).toFixed(1)}  |  Gate 不一致: ${gateMismatch}/8`);

  // ── 实验 B ──────────────────────────────────────────
  console.log("\n" + "═".repeat(80));
  console.log("  实验 B: 单模型噪音基线 (deepseek-chat#1 vs deepseek-chat#2)");
  console.log("═".repeat(80));

  console.log("\n阶段      chat#1   chat#2   分差     四维差异详情");
  console.log("────────  ───────  ───────  ─────  ───────────────────");

  let totalNoise = 0;
  let noiseGateMismatch = 0;

  for (let stage = 1; stage <= 8; stage++) {
    const runs = allRuns[stage];
    if (!runs) continue;
    const chat1 = runs.find(r => r.model === "deepseek-chat" && r.run === 1)!;
    const chat2 = runs.find(r => r.model === "deepseek-chat" && r.run === 2)!;
    const diff = chat2.score - chat1.score;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    const gate1 = chat1.gate === "advance" ? "✅" : chat1.gate === "reoptimize" ? "⚠️" : "⛔";
    const gate2 = chat2.gate === "advance" ? "✅" : chat2.gate === "reoptimize" ? "⚠️" : "⛔";

    // Dimension diffs
    const dimDiffs: string[] = [];
    for (const dim of ["specificity", "differentiation", "actionability", "evidence"]) {
      const d1 = chat1.dims[dim] || 0;
      const d2 = chat2.dims[dim] || 0;
      const dd = d2 - d1;
      if (dd !== 0) dimDiffs.push(`${DIM_LABELS[dim]}:${dd > 0 ? "+" : ""}${dd}`);
    }
    const dimStr = dimDiffs.length > 0 ? dimDiffs.join(" ") : "完全一致";
    const mm = chat1.gate !== chat2.gate ? " ⚡" : "";

    console.log(`S${stage} ${STAGE_NAMES[stage].padEnd(6)} ${String(chat1.score).padStart(7)}  ${String(chat2.score).padStart(7)}  ${diffStr.padStart(5)}  ${dimStr}${mm}`);

    totalNoise += Math.abs(diff);
    if (chat1.gate !== chat2.gate) noiseGateMismatch++;
  }

  console.log("");
  console.log(`  平均绝对分差: ${(totalNoise / 8).toFixed(1)}  |  Gate 不一致: ${noiseGateMismatch}/8`);

  // ── 综合结论 ──────────────────────────────────────────
  console.log("\n" + "═".repeat(80));
  console.log("  综合结论");
  console.log("═".repeat(80));
  console.log(`  跨模型平均分差: ${(totalDiff / 8).toFixed(1)}  (chat vs flash)`);
  console.log(`  单模型噪音基线: ${(totalNoise / 8).toFixed(1)}  (chat#1 vs chat#2)`);
  console.log(`  跨模型 - 噪音 = ${(totalDiff / 8 - totalNoise / 8).toFixed(1)}  (真实的模型间差异)`);
  if (totalDiff / 8 - totalNoise / 8 < 3) {
    console.log("  ⚠️ 模型间差异接近噪音水平，换审计模型无实质效果");
  } else if (totalDiff / 8 - totalNoise / 8 < 8) {
    console.log("  ⚡ 模型间差异略高于噪音，换模型有微弱效果");
  } else {
    console.log("  ✅ 模型间差异明显高于噪音，换审计模型有效果");
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
