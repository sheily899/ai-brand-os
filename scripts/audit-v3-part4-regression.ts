/**
 * scripts/audit-v3-part4-regression.ts — Part 4 多模型 + Part 6 回归
 *
 * Part 4: deepseek-chat vs deepseek-v4-flash × 3 cases × 8 stages × 5 runs
 * Part 6: 回归 — V3.0 配置模拟 vs V3.1
 *
 * 用法：npx tsx scripts/audit-v3-part4-regression.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const envPath = join(process.cwd(), ".env.local");
try {
  const c = readFileSync(envPath, "utf8");
  for (const l of c.split("\n")) {
    const m = l.match(/^([^=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch { console.error("❌ .env.local 未找到"); process.exit(1); }

const FIXTURES = [
  { name: "Case A 慢象咖啡", file: "case-a-slow-elephant-coffee.json", level: "high" },
  { name: "Case B 快享茶饮", file: "case-b-quick-sip-tea.json", level: "medium" },
  { name: "Case C YoungLife", file: "case-c-younglife.json", level: "low" },
];

function loadFixture(f: string) {
  return JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures", f), "utf8"));
}

function mean(arr: number[]) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function stdDev(arr: number[]) { const m = mean(arr); return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length); }
function computeStats(runs: any[]) {
  const scores = runs.map((r: any) => r.score);
  const dimStats: any = {};
  for (const dim of ["specificity", "differentiation", "actionability", "evidence"]) {
    const vals = runs.map((r: any) => r.dims[dim] ?? 0);
    dimStats[dim] = { mean: mean(vals) };
  }
  const gd: any = {};
  for (const r of runs) gd[r.gate] = (gd[r.gate] || 0) + 1;
  return { mean: mean(scores), stdDev: stdDev(scores), dimStats, gateDistribution: gd };
}

async function auditOnce(stage: number, output: any, model: string): Promise<any> {
  process.env.AUDIT_MODEL = model;
  const { runAIQualityAudit } = await import("../src/lib/audit/ai-quality");
  const r = await runAIQualityAudit(stage, output);
  const dims: any = {}, weighted: any = {};
  for (const ds of r.dimensionScores) { dims[ds.dimension] = ds.score; weighted[ds.dimension] = ds.weightedScore; }
  return { score: r.totalScore, dims, weighted, gate: r.gateRecommendation };
}

async function runPart4() {
  console.log("\n" + "=".repeat(70));
  console.log("  Part 4: 多模型对比 — deepseek-chat vs deepseek-v4-flash × 5 runs");
  console.log("=".repeat(70));
  const models = ["deepseek-chat", "deepseek-v4-flash"];
  const allResults: any = {};

  for (const fixture of FIXTURES) {
    const data = loadFixture(fixture.file);
    const caseResults: any = {};
    for (const model of models) {
      const modelRuns: any = {};
      process.stdout.write(`  ${fixture.name} (${model.slice(9)}): `);
      for (let stage = 1; stage <= 8; stage++) {
        const output = data.stages[String(stage)];
        if (!output) continue;
        const runs = [];
        for (let r = 1; r <= 5; r++) { process.stdout.write("."); runs.push(await auditOnce(stage, output, model)); }
        modelRuns[String(stage)] = runs;
      }
      caseResults[model] = modelRuns;
      const avg = mean(Object.values(modelRuns).flatMap((r: any) => r.map((x: any) => x.score)));
      console.log(` μ=${avg.toFixed(1)}`);
    }

    console.log(`\n  chat vs flash 对比:`);
    let totalDiff = 0, gateMismatch = 0;
    for (let stage = 1; stage <= 8; stage++) {
      const c1 = caseResults["deepseek-chat"]?.[String(stage)];
      const c2 = caseResults["deepseek-v4-flash"]?.[String(stage)];
      if (!c1 || !c2) continue;
      const s1 = computeStats(c1), s2 = computeStats(c2);
      const diff = Math.abs(s1.mean - s2.mean); totalDiff += diff;
      const g1 = Object.keys(s1.gateDistribution)[0] || "?", g2 = Object.keys(s2.gateDistribution)[0] || "?";
      const mm = g1 !== g2 ? " ⚡" : "";
      console.log(`    S${stage}: ${s1.mean.toFixed(1)} vs ${s2.mean.toFixed(1)} diff=${diff.toFixed(1)} gate=${g1}/${g2}${mm}`);
      if (g1 !== g2) gateMismatch++;
    }
    const avgDiff = totalDiff / 8;
    console.log(`  平均分差: ${avgDiff.toFixed(1)} | Gate 不一致: ${gateMismatch}/8 ${avgDiff < 8 ? "✅" : "⚠️"}`);
    allResults[fixture.name] = { avgDiff, gateMismatch };
  }
  return allResults;
}

async function runPart6() {
  console.log("\n" + "=".repeat(70));
  console.log("  Part 6: 回归 — 引用前面已获取的 chat 结果 vs 验收基线");
  console.log("=".repeat(70));

  // 回归检查：使用 Part 1 的 chat 结果（已在前面获取）
  // 这里重新跑一遍 chat 以确保独立数据
  const model = "deepseek-chat";
  const caseStats: any = {};

  for (const fixture of FIXTURES) {
    const data = loadFixture(fixture.file);
    const stats: any = {};
    for (let stage = 1; stage <= 8; stage++) {
      const output = data.stages[String(stage)];
      if (!output) continue;
      const runs = [];
      for (let r = 1; r <= 5; r++) { process.stdout.write("."); runs.push(await auditOnce(stage, output, model)); }
      stats[stage] = computeStats(runs);
    }
    caseStats[fixture.name] = stats;
  }

  const checks: any[] = [];

  // 1. Case A S6 不天花板
  const a6 = caseStats["Case A 慢象咖啡"]?.[6];
  checks.push({ name: "Case A S6 ≤ 90 (not ceiling)", passed: a6 && a6.mean <= 90, detail: `μ=${a6?.mean?.toFixed(1)}` });

  // 2. Case C Evidence avg ≤ 2.5
  const cStats = caseStats["Case C YoungLife"];
  const cEvs: number[] = [];
  for (let s = 1; s <= 8; s++) if (cStats[s]) cEvs.push(cStats[s].dimStats.evidence.mean);
  checks.push({ name: "Case C Evidence ≤ 2.5 avg", passed: mean(cEvs) <= 2.5, detail: `μ=${mean(cEvs).toFixed(1)}` });

  // 3. Case A vs C 区分度 ≥ 30
  const aScores: number[] = [], cScores: number[] = [];
  for (let s = 1; s <= 8; s++) {
    if (caseStats["Case A 慢象咖啡"]?.[s]) aScores.push(caseStats["Case A 慢象咖啡"][s].mean);
    if (caseStats["Case C YoungLife"]?.[s]) cScores.push(caseStats["Case C YoungLife"][s].mean);
  }
  const diff = mean(aScores) - mean(cScores);
  checks.push({ name: "A-C 区分度 ≥ 30", passed: diff >= 30, detail: `${mean(aScores).toFixed(1)} - ${mean(cScores).toFixed(1)} = ${diff.toFixed(1)}` });

  // 4. Case A S3 Evidence > Case B S3 Evidence
  const a3Ev = caseStats["Case A 慢象咖啡"]?.[3]?.dimStats?.evidence?.mean ?? 0;
  const b3Ev = caseStats["Case B 快享茶饮"]?.[3]?.dimStats?.evidence?.mean ?? 0;
  checks.push({ name: "S3 Evidence: A > B (by ≥1.5)", passed: a3Ev - b3Ev >= 1.5, detail: `A=${a3Ev.toFixed(1)} B=${b3Ev.toFixed(1)} Δ=${(a3Ev-b3Ev).toFixed(1)}` });

  // 5. 各案例总分区间
  for (const f of FIXTURES) {
    const st = caseStats[f.name];
    if (!st) continue;
    const sc: number[] = [];
    for (let s = 1; s <= 8; s++) if (st[s]) sc.push(st[s].mean);
    const avg = mean(sc);
    let range: [number, number];
    if (f.level === "high") range = [85, 95];
    else if (f.level === "medium") range = [60, 75];
    else range = [20, 40];
    checks.push({ name: `${f.name} avg ∈ [${range[0]},${range[1]}]`, passed: avg >= range[0] && avg <= range[1], detail: `μ=${avg.toFixed(1)}` });
  }

  console.log("\n  回归检查:");
  for (const c of checks) console.log(`    ${c.passed ? "✅" : "🔴"} ${c.name}: ${c.detail}`);
  return { checks };
}

async function main() {
  const startTime = Date.now();
  const allResults: any = {};

  try { allResults.part4 = await runPart4(); } catch (e: any) { console.error("Part 4 失败:", e.message); }
  try { allResults.part6 = await runPart6(); } catch (e: any) { console.error("Part 6 失败:", e.message); }

  const reportDir = join(process.cwd(), "tests", "reports");
  try { mkdirSync(reportDir, { recursive: true }); } catch {}
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const report = {
    title: "AI Quality Audit V3.1 — Part 4 (多模型) + Part 6 (回归)",
    timestamp: new Date().toISOString(),
    elapsed_minutes: parseFloat(elapsed),
    results: allResults,
  };
  const reportPath = join(reportDir, `audit-v3-p4-p6-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n完成! 耗时 ${elapsed} 分钟 | 报告: ${reportPath}`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
