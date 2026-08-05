/**
 * 成本分析 CLI 脚本
 *
 * 用法：
 *   npx tsx scripts/cost-analysis.ts [projectId]
 *
 * 输出：
 *   JSON 格式的完整成本分析报告到 stdout。
 *   包含：阶段成本、调用类型成本、Prompt 开销、冗余标记。
 *
 * 示例：
 *   npx tsx scripts/cost-analysis.ts > cost-report.json
 *   npx tsx scripts/cost-analysis.ts proj_abc123
 */

// ── 第一步：加载环境变量（必须在任何静态 import 之前）──
// 使用动态 import 避免静态 import 在 env 加载前执行
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
    console.error("[cost-analysis] .env.local 已加载");
  } catch {
    console.error("[cost-analysis] .env.local 未找到，使用已有环境变量");
  }
}

// 在导入 db 模块前加载 env
loadEnvFile(resolve(process.cwd(), ".env.local"));

// ── 第二步：动态导入（确保 env 已设置）──

async function main() {
  const projectId = process.argv[2] || undefined;

  // 动态 import，确保 DATABASE_URL 已在 process.env 中
  const { generateCostReport } = await import("@/lib/ai/cost-analysis");
  type CostAnalysisReport = import("@/lib/ai/cost-analysis").CostAnalysisReport;

  console.error(`[cost-analysis] 正在生成成本分析报告...${projectId ? ` (project=${projectId})` : " (全项目)"}`);

  const report = await generateCostReport(projectId);

  // ── 输出 JSON ─────────────────────────────────────────
  console.log(JSON.stringify(report, null, 2));

  // ── 可读摘要到 stderr ────────────────────────────────
  printSummary(report as any);
}

function printSummary(report: any) {
  const { summary, stageCosts, callTypeCosts, redundancyFlags } = report;

  const lines = [
    "",
    "═══════════════════════════════════════════",
    "  Token 成本分析报告",
    "═══════════════════════════════════════════",
    `  生成时间: ${report.generatedAt}`,
    report.projectId ? `  项目: ${report.projectId}` : "  范围: 全部项目",
    "",
    "── 全局汇总 ──",
    `  总调用次数: ${summary.totalCalls.toLocaleString()}`,
    `  总 Input Tokens:  ${summary.totalInputTokens.toLocaleString()}`,
    `  总 Output Tokens: ${summary.totalOutputTokens.toLocaleString()}`,
    `  总 Tokens:        ${summary.totalTokens.toLocaleString()}`,
    `  估算成本:         $${summary.estimatedCostUSD.toFixed(4)}`,
    "",
    "── 各阶段成本 ──",
  ];

  if (stageCosts.length === 0) {
    lines.push("  (无数据 — 请先运行完整咨询流程以产生 Token 记录)");
  } else {
    lines.push(`  ${"阶段".padEnd(6)} ${"调用".padStart(6)} ${"Input".padStart(12)} ${"Output".padStart(12)} ${"Total".padStart(12)} ${"均Token".padStart(10)}`);
    lines.push(`  ${"─".repeat(60)}`);
    for (const sc of stageCosts) {
      lines.push(
        `  S${String(sc.stageNumber).padEnd(4)} ${String(sc.totalCalls).padStart(6)} ${sc.totalInputTokens.toLocaleString().padStart(12)} ${sc.totalOutputTokens.toLocaleString().padStart(12)} ${sc.totalTokens.toLocaleString().padStart(12)} ${sc.avgTokensPerCall.toLocaleString().padStart(10)}`,
      );
    }
  }

  lines.push("");
  lines.push("── 按调用类型 ──");

  if (callTypeCosts.length === 0) {
    lines.push("  (无数据)");
  } else {
    lines.push(`  ${"类型".padEnd(16)} ${"调用".padStart(6)} ${"Tokens".padStart(14)} ${"占比".padStart(8)} ${"阶段数".padStart(6)}`);
    lines.push(`  ${"─".repeat(56)}`);
    for (const ct of callTypeCosts) {
      lines.push(
        `  ${ct.callType.padEnd(16)} ${String(ct.totalCalls).padStart(6)} ${ct.totalTokens.toLocaleString().padStart(14)} ${(ct.percentage + "%").padStart(8)} ${String(ct.stageCount).padStart(6)}`,
      );
    }
  }

  lines.push("");
  lines.push("── 成本优化机会 ──");

  if (redundancyFlags.length === 0) {
    lines.push("  ✅ 未发现明显的成本冗余。");
  } else {
    for (const flag of redundancyFlags) {
      const sevIcon = flag.severity === "high" ? "🔴" : flag.severity === "medium" ? "🟡" : "🟢";
      lines.push(`  ${sevIcon} [${flag.severity.toUpperCase()}] ${flag.type}`);
      lines.push(`     ${flag.detail}`);
      lines.push(`     预估可节省: ~${flag.estimatedSavingPct}% 相关 Token`);
      lines.push(`     建议: ${flag.recommendation}`);
      lines.push("");
    }
  }

  lines.push("═══════════════════════════════════════════");

  console.error(lines.join("\n"));
}

main().catch((e) => {
  console.error("[cost-analysis] 失败:", e.message);
  process.exit(1);
});
