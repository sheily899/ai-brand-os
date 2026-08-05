// scripts/test-s8-generic.ts — S8 通用版测试（无锚点）
import { readFileSync, writeFileSync } from "fs";
const c = readFileSync("D:/brand-intelligence-os/.env.local", "utf8");
for (const l of c.split("\n")) { const m = l.match(/^([^=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }

function dimLabel(d: string) {
  const map: Record<string, string> = { specificity: "具体度", differentiation: "差异化", actionability: "可执行性", evidence: "证据" };
  return map[d] || d;
}

async function main() {
  const { db } = await import("../src/lib/db/index");
  const { stageRecord } = await import("../src/lib/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { runAIQualityAudit, STAGE_AUDIT_CONFIGS } = await import("../src/lib/audit/ai-quality");

  const rows = await db.select().from(stageRecord)
    .where(and(eq(stageRecord.projectId, "qbt_bOs495Sa5_74"), eq(stageRecord.stageNumber, 8)))
    .limit(1);
  const output = rows[0]?.structuredOutput as any;
  if (!output) { console.log("S8: 无数据"); process.exit(1); }

  const config = STAGE_AUDIT_CONFIGS[8];
  const hasAnchors = !!config.scoringAnchors;

  const out: string[] = [];
  out.push("# S8 通用版测试 — 完整审计结果\n");
  out.push(`项目: qbt_bOs495Sa5_74 | 阈值: ${config.advanceThreshold} | 锚点: ${hasAnchors ? "✅ 已启用" : "❌ 未启用"}\n`);
  out.push(`测试时间: ${new Date().toISOString()}\n`);
  out.push(`\n---\n## S8 输入 (Structured Output)\n`);
  out.push("```json\n" + JSON.stringify(output, null, 2) + "\n```\n");

  const models = ["deepseek-chat", "deepseek-chat", "deepseek-chat", "deepseek-v4-flash"];
  const results: any[] = [];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    process.env.AUDIT_MODEL = model;
    const label = `${model} #${i + 1}`;
    process.stdout.write(`${label}...`);
    const r = await runAIQualityAudit(8, output);
    results.push({ model, label, result: r });
    const dims: Record<string, number> = {};
    for (const ds of r.dimensionScores) dims[ds.dimension] = ds.score;
    process.stdout.write(` ${r.totalScore} (${r.gateRecommendation}) S:${dims.specificity} D:${dims.differentiation} A:${dims.actionability} E:${dims.evidence}\n`);
  }

  for (const { model, label, result: r } of results) {
    out.push(`\n---\n## ${label}\n`);
    out.push(`| 项目 | 值 |\n|------|-----|\n| 模型 | ${model} |\n| 总分 | ${r.totalScore} |\n| 门禁 | ${r.gateRecommendation} |\n`);
    out.push(`\n### 四维评分\n| 维度 | 分数 | 理由 |\n|------|:----:|------|`);
    for (const ds of r.dimensionScores) out.push(`| ${ds.dimension} | ${ds.score} | ${ds.reason} |`);
    out.push(`\n### 改进建议`);
    for (const ds of r.dimensionScores) { if (ds.improvements.length > 0) out.push(`- **${ds.dimension}:** ${ds.improvements.join("；")}`); }
    out.push(`\n### 问题`);
    if (r.issues.length > 0) { for (const iss of r.issues) out.push(`- [${iss.severity}] ${iss.dimension}: ${iss.description}`); }
    else out.push(`(无)`);
    out.push(`\n---\n`);
  }

  out.push(`\n---\n## 汇总分析\n`);
  const chatResults = results.slice(0, 3);
  const flashResult = results[3];
  out.push(`### 同模型一致性 (deepseek-chat ×3)\n| 维度 | Run 1 | Run 2 | Run 3 | 波动范围 |\n|------|-------|-------|-------|----------|`);
  const dims = ["specificity", "differentiation", "actionability", "evidence"];
  for (const dim of dims) {
    const vals = chatResults.map((x: any) => x.result.dimensionScores.find((d: any) => d.dimension === dim)?.score ?? "?");
    const range = Math.max(...vals) - Math.min(...vals);
    out.push(`| ${dimLabel(dim)} | ${vals[0]} | ${vals[1]} | ${vals[2]} | ${range} ${range === 0 ? "✅" : range === 1 ? "⚡" : "❌"} |`);
  }
  const chatScores = chatResults.map((x: any) => x.result.totalScore);
  const chatGate = chatResults.map((x: any) => x.result.gateRecommendation);
  out.push(`| **总分** | **${chatScores[0]}** | **${chatScores[1]}** | **${chatScores[2]}** | **${Math.max(...chatScores) - Math.min(...chatScores)}** |`);
  out.push(`| **Gate** | ${chatGate[0]} | ${chatGate[1]} | ${chatGate[2]} | ${new Set(chatGate).size === 1 ? "✅ 一致" : "❌ 不一致"} |\n`);

  out.push(`### 跨模型对比 (chat 均值 vs v4-flash)\n| 维度 | chat 均值 | flash | 差异 |\n|------|-----------|-------|------|`);
  for (const dim of dims) {
    const chatAvg = chatResults.reduce((s: number, x: any) => s + (x.result.dimensionScores.find((d: any) => d.dimension === dim)?.score ?? 0), 0) / 3;
    const flashVal = flashResult.result.dimensionScores.find((d: any) => d.dimension === dim)?.score ?? 0;
    out.push(`| ${dimLabel(dim)} | ${chatAvg.toFixed(1)} | ${flashVal} | ${(flashVal - chatAvg).toFixed(1)} |`);
  }
  const chatAvgScore = chatScores.reduce((a: number, b: number) => a + b, 0) / 3;
  const flashScore = flashResult.result.totalScore;
  out.push(`| **总分** | **${chatAvgScore.toFixed(1)}** | **${flashScore}** | **${(flashScore - chatAvgScore).toFixed(1)}** |`);
  out.push(`| **Gate** | ${[...new Set(chatGate)].join("/")} | ${flashResult.result.gateRecommendation} | ${chatGate.includes(flashResult.result.gateRecommendation) ? "✅" : "❌"} |`);

  const outFile = `temp/s8-generic-test-${Date.now()}.md`;
  writeFileSync(outFile, out.join("\n"), "utf8");
  console.log(`\n✅ ${outFile}`);
  console.log("\n═══ 终端摘要 ═══");
  console.log(`chat 3次: ${chatScores.join("/")} (max diff: ${Math.max(...chatScores) - Math.min(...chatScores)})`);
  console.log(`chat 均值 vs flash: ${chatAvgScore.toFixed(1)} vs ${flashScore} (diff: ${Math.abs(flashScore - chatAvgScore).toFixed(1)})`);
  const allGates = [...chatGate, flashResult.result.gateRecommendation];
  console.log(`Gate: ${new Set(allGates).size === 1 ? "✅ 全部一致" : "❌ 不一致"} (${allGates.join("/")})`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
