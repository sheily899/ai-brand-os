// scripts/test-s4-anchors-raw.ts — 输出每次审计的原始 JSON 响应
import { readFileSync, writeFileSync } from "fs";
const c = readFileSync("D:/brand-intelligence-os/.env.local", "utf8");
for (const l of c.split("\n")) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

async function main() {
  const { db } = await import("../src/lib/db/index");
  const { stageRecord } = await import("../src/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { runAIQualityAudit, STAGE_AUDIT_CONFIGS } = await import("../src/lib/audit/ai-quality");

  // 读取 S4 输入
  const rows = await db.select().from(stageRecord)
    .where(and(eq(stageRecord.projectId, "qbt_bOs495Sa5_74"), eq(stageRecord.stageNumber, 4))).limit(1);
  const output = rows[0]?.structuredOutput as any;
  if (!output) { console.log("S4: 无数据"); process.exit(1); }

  const config = STAGE_AUDIT_CONFIGS[4];
  const out: string[] = [];

  out.push("# S4 审计原始 JSON 输出\n");
  out.push(`项目: qbt_bOs495Sa5_74 | 阈值: ${config.advanceThreshold}\n`);

  // ── S4 输入 JSON ──
  out.push(`\n---\n`);
  out.push(`## S4 输入：消费者洞察 (Structured Output)\n`);
  out.push("```json\n" + JSON.stringify(output, null, 2) + "\n```\n");
  out.push(`\n---\n`);

  const models = ["deepseek-chat", "deepseek-chat", "deepseek-chat", "deepseek-v4-flash"];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    process.env.AUDIT_MODEL = model;
    const label = `${model} #${i+1}`;
    process.stdout.write(`${label}...`);

    const r = await runAIQualityAudit(4, output);
    process.stdout.write(` ${r.totalScore} (${r.gateRecommendation})`);

    // 维度原始分
    const dims: Record<string, number> = {};
    const reasons: Record<string, string> = {};
    for (const ds of r.dimensionScores) {
      dims[ds.dimension] = ds.score;
      reasons[ds.dimension] = ds.reason;
    }
    process.stdout.write(` S:${dims.specificity}/${reasons.specificity.slice(0,40)}...`);
    process.stdout.write(` D:${dims.differentiation}`);
    process.stdout.write(` A:${dims.actionability}`);
    process.stdout.write(` E:${dims.evidence}\n`);

    out.push(`## ${label}\n`);
    out.push(`**总分: ${r.totalScore} | 门禁: ${r.gateRecommendation}**\n`);

    out.push(`### 四维评分\n`);
    out.push(`| 维度 | 分数 | 理由 |`);
    out.push(`|------|:----:|------|`);
    for (const ds of r.dimensionScores) {
      out.push(`| ${ds.dimension} | ${ds.score} | ${ds.reason} |`);
    }

    out.push(`\n### 改进建议\n`);
    for (const ds of r.dimensionScores) {
      if (ds.improvements.length > 0) {
        out.push(`- **${ds.dimension}:** ${ds.improvements.join("；")}`);
      }
    }

    out.push(`\n### 问题\n`);
    if (r.issues.length > 0) {
      for (const issue of r.issues) {
        out.push(`- [${issue.severity}] ${issue.dimension}: ${issue.description}`);
      }
    } else {
      out.push(`(无)`);
    }

    // Layer B
    if (r.crossStageSemantics) {
      out.push(`\n### Layer B 语义检查\n`);
      out.push(`hasIssues: ${r.crossStageSemantics.hasIssues}`);
      if (r.crossStageSemantics.issues.length > 0) {
        for (const iss of r.crossStageSemantics.issues) {
          out.push(`- [${iss.severity}] ${iss.currentStageField} ↔ ${iss.upstreamField}: ${iss.description}`);
        }
      }
    }

    out.push(`\n---\n`);
  }

  const outFile = `temp/s4-raw-json-${Date.now()}.md`;
  writeFileSync(outFile, out.join("\n"), "utf8");
  console.log(`\n✅ ${outFile}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
