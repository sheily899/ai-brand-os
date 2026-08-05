// scripts/noise-baseline.ts — temperature=0 噪音基线测试
import { readFileSync } from "fs";
const c = readFileSync("D:/brand-intelligence-os/.env.local", "utf8");
for (const l of c.split("\n")) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

async function main() {
  const { db } = await import("../src/lib/db/index");
  const { stageRecord } = await import("../src/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { runAIQualityAudit, STAGE_AUDIT_CONFIGS } = await import("../src/lib/audit/ai-quality");

  const PROJECT = "qbt_bOs495Sa5_74";
  const STAGES = [7];
  const RUNS = 3;

  console.log("temperature=0 噪音基线 (每阶段 " + RUNS + " 次独立调用)\n");

  for (const stage of STAGES) {
    const rows = await db.select().from(stageRecord)
      .where(and(eq(stageRecord.projectId, PROJECT), eq(stageRecord.stageNumber, stage))).limit(1);
    const output = rows[0]?.structuredOutput as any;
    if (!output) { console.log("S" + stage + ": 无数据\n"); continue; }

    const config = STAGE_AUDIT_CONFIGS[stage];
    const threshold = config?.advanceThreshold ?? 70;
    const scores: number[] = [];
    const gates: string[] = [];
    const dimsList: Record<string, number>[] = [];

    console.log("S" + stage + " (阈值" + threshold + "):");
    for (let r = 1; r <= RUNS; r++) {
      process.env.AUDIT_MODEL = "deepseek-chat";
      const result = await runAIQualityAudit(stage, output);
      scores.push(result.totalScore);
      gates.push(result.gateRecommendation);
      const dims: Record<string, number> = {};
      for (const ds of result.dimensionScores) dims[ds.dimension] = ds.score;
      dimsList.push(dims);
      console.log("  #" + r + ": " + result.totalScore + " (" + result.gateRecommendation + ") S:" + (dims.specificity ?? "-") + " D:" + (dims.differentiation ?? "-") + " A:" + (dims.actionability ?? "-") + " E:" + (dims.evidence ?? "-"));
    }

    const maxDiff = Math.max(...scores) - Math.min(...scores);
    console.log("  波动: " + scores.join(" → ") + " (max diff: " + maxDiff + ")");
    console.log("  Gate: " + gates.join(" / "));
    if (new Set(gates).size > 1) console.log("  ⚡ Gate 不一致!");
    console.log("");
  }
  process.exit(0);
}
main();
