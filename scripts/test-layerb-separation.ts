/**
 * scripts/test-layerb-separation.ts — Layer B 分离效果验证
 *
 * 测试：同一份 S6 JSON，分别用「含 Layer B prompt」和「不含 Layer B prompt」
 * 调用 runAIQualityAudit，比较四维评分差异。
 *
 * 改动前：S6 含 Layer B = 80，不含 = 100（20 分差距）
 * 改动后期望：两者接近（差距 < 10 分），Layer B 发现记录在 crossStageSemantics 中
 *
 * 用法：npx tsx scripts/test-layerb-separation.ts <projectId>
 */
import { readFileSync } from "fs";
const c = readFileSync("D:/brand-intelligence-os/.env.local", "utf8");
for (const l of c.split("\n")) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

const PROJECT_ID = process.argv[2];
if (!PROJECT_ID) { console.error("用法: npx tsx scripts/test-layerb-separation.ts <projectId>"); process.exit(1); }

async function main() {
  const { db } = await import("../src/lib/db/index");
  const { stageRecord } = await import("../src/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { runAIQualityAudit, STAGE_AUDIT_CONFIGS } = await import("../src/lib/audit/ai-quality");
  const { buildSemanticCheckPrompt } = await import("../src/lib/audit/cross-stage");
  const { buildMemoryContext } = await import("../src/lib/memory/decision-memory");

  process.env.AUDIT_MODEL = "deepseek-chat";

  console.log("═".repeat(72));
  console.log("  Layer B 分离效果验证");
  console.log("═".repeat(72));
  console.log(`项目: ${PROJECT_ID}\n`);

  // 测试 S6（之前差距最大的阶段）和 S7
  const stages = [6, 7];

  for (const stage of stages) {
    const rows = await db.select().from(stageRecord)
      .where(and(eq(stageRecord.projectId, PROJECT_ID), eq(stageRecord.stageNumber, stage)))
      .limit(1);
    const output = rows[0]?.structuredOutput as any;
    if (!output) { console.log(`S${stage}: 无数据\n`); continue; }

    const config = STAGE_AUDIT_CONFIGS[stage];
    const threshold = config?.advanceThreshold ?? 70;

    // 构建 Layer B prompt
    let crossStagePrompt: string | undefined;
    try {
      const upstreamContext = await buildMemoryContext(PROJECT_ID, stage);
      crossStagePrompt = buildSemanticCheckPrompt(stage, upstreamContext);
    } catch (e: any) {
      console.log(`  构建 Layer B prompt 失败: ${e.message}`);
    }

    console.log(`S${stage}「${config.stageName}」(阈值 ${threshold})`);
    console.log(`  Layer B prompt 长度: ${crossStagePrompt?.length ?? 0} 字符`);
    console.log("");

    // Run 1: 不含 Layer B（纯四维评分基线）
    process.stdout.write("  [无 Layer B] 审计中...");
    const r1 = await runAIQualityAudit(stage, output);
    console.log(` ${r1.totalScore} (${r1.gateRecommendation})`);
    const d1: Record<string, number> = {};
    for (const ds of r1.dimensionScores) d1[ds.dimension] = ds.score;
    console.log(`    S:${d1.specificity} D:${d1.differentiation} A:${d1.actionability} E:${d1.evidence}`);

    // Run 2: 含 Layer B（模拟 inline audit）
    process.stdout.write("  [含 Layer B] 审计中...");
    const r2 = await runAIQualityAudit(stage, output, undefined, crossStagePrompt);
    console.log(` ${r2.totalScore} (${r2.gateRecommendation})`);
    const d2: Record<string, number> = {};
    for (const ds of r2.dimensionScores) d2[ds.dimension] = ds.score;
    console.log(`    S:${d2.specificity} D:${d2.differentiation} A:${d2.actionability} E:${d2.evidence}`);

    // 差异分析
    const scoreDiff = r2.totalScore - r1.totalScore;
    const dimDiffs: string[] = [];
    for (const dim of ["specificity", "differentiation", "actionability", "evidence"]) {
      const diff = (d2[dim] || 0) - (d1[dim] || 0);
      if (diff !== 0) dimDiffs.push(`${dim}:${diff > 0 ? "+" : ""}${diff}`);
    }

    console.log("");
    console.log(`  四维总分差: ${scoreDiff > 0 ? "+" : ""}${scoreDiff} 分`);
    console.log(`  维度变化: ${dimDiffs.length > 0 ? dimDiffs.join(" ") : "无变化"}`);
    console.log(`  Gate: ${r1.gateRecommendation} → ${r2.gateRecommendation}`);

    // Layer B 发现
    if (r2.crossStageSemantics) {
      const cs = r2.crossStageSemantics;
      console.log(`  Layer B 语义检查: ${cs.hasIssues ? `⚠️ 发现 ${cs.issues.length} 个问题` : "✅ 无问题"}`);
      for (const issue of cs.issues) {
        console.log(`    - [${issue.severity}] ${issue.currentStageField} ↔ ${issue.upstreamField}: ${issue.description.slice(0, 100)}`);
      }
    } else {
      console.log(`  Layer B 语义检查: 未触发`);
    }

    // 判定
    const absDiff = Math.abs(scoreDiff);
    if (absDiff <= 5) {
      console.log(`  ✅ 分离成功：四维评分几乎不受 Layer B 影响 (|diff|=${absDiff} ≤ 5)`);
    } else if (absDiff <= 10) {
      console.log(`  ⚡ 部分改善：差距 ${absDiff} 分，比改动前 (20分) 好但仍有影响`);
    } else {
      console.log(`  ❌ 分离失败：差距 ${absDiff} 分，Layer B 仍在影响四维评分`);
    }

    console.log("\n" + "─".repeat(72) + "\n");
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
