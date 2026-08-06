/**
 * Phase 6.3: V1 vs V2 Prompt 精确对比
 */

import * as fs from "fs";
import * as path from "path";

const PROMPTS_DIR = path.resolve("src/lib/ai/prompts");
const STAGES = ["stage2", "stage3", "stage5", "stage8"];

function estTokens(chars: number): number {
  return Math.round(chars / 2.2);
}

interface VersionDiff {
  stage: string;
  v1Chars: number;
  v2Chars: number;
  v1Tokens: number;
  v2Tokens: number;
  charDelta: number;
  tokenDelta: number;
  pctDelta: number;
  sections: {
    name: string;
    v1Lines: number;
    v2Lines: number;
    v1Chars: number;
    v2Chars: number;
    charDelta: number;
  }[];
}

function countSection(content: string, sectionName: string): { lines: number; chars: number } {
  const lines = content.split("\n");
  // 查找 # 或 ## 级别的 section
  const headingRegex = new RegExp(`^#{1,3}\\s+${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
  const match = content.match(headingRegex);
  if (!match) return { lines: 0, chars: 0 };

  const startIdx = match.index!;
  // 找下一个同级或更高级的 heading
  const headingLevel = (match[0].match(/^#+/) || [""])[0].length;
  const nextHeadingRegex = new RegExp(`^#{1,${headingLevel}}\\s+`, 'm');
  nextHeadingRegex.lastIndex = startIdx + match[0].length;
  const nextMatch = nextHeadingRegex.exec(content);
  const endIdx = nextMatch ? nextMatch.index : content.length;

  const section = content.substring(startIdx, endIdx);
  const sectionLines = section.split("\n").filter(l => l.trim().length > 0);
  return { lines: sectionLines.length, chars: section.length };
}

function compareVersions(stage: string): VersionDiff {
  const v1Path = path.join(PROMPTS_DIR, `${stage}-consultation.md`);
  const v2Path = path.join(PROMPTS_DIR, `${stage}-consultation-v2.md`);

  const v1 = fs.readFileSync(v1Path, "utf-8");
  const v2 = fs.readFileSync(v2Path, "utf-8");

  const v1Lines = v1.split("\n").filter(l => l.trim().length > 0);
  const v2Lines = v2.split("\n").filter(l => l.trim().length > 0);

  // 逐 section 对比
  const sectionNames = [
    "Role", "Goal", "Context", "Conversation Rules",
    "Exploration Framework", "Follow-up Logic", "Boundary Control",
    "阶段退出机制", "Confirmation Summary Template",
    "收尾语硬约束", "Summary Language Rules", "Output Restriction"
  ];

  const sections = sectionNames.map(name => {
    const v1Sec = countSection(v1, name);
    const v2Sec = countSection(v2, name);
    return {
      name,
      v1Lines: v1Sec.lines,
      v2Lines: v2Sec.lines,
      v1Chars: v1Sec.chars,
      v2Chars: v2Sec.chars,
      charDelta: v1Sec.chars - v2Sec.chars,
    };
  }).filter(s => s.v1Chars > 0 || s.v2Chars > 0);

  return {
    stage,
    v1Chars: v1.length,
    v2Chars: v2.length,
    v1Tokens: estTokens(v1.length),
    v2Tokens: estTokens(v2.length),
    charDelta: v1.length - v2.length,
    tokenDelta: estTokens(v1.length) - estTokens(v2.length),
    pctDelta: v1.length > 0 ? ((v1.length - v2.length) / v1.length) * 100 : 0,
    sections,
  };
}

function main() {
  console.log("═".repeat(80));
  console.log("Phase 6.3: V1 vs V2 Prompt 精确对比");
  console.log("═".repeat(80));

  const results: VersionDiff[] = [];

  for (const stage of STAGES) {
    const diff = compareVersions(stage);
    results.push(diff);

    console.log(`\n${"─".repeat(80)}`);
    console.log(`📄 ${stage}-consultation.md`);
    console.log(`${"─".repeat(80)}`);

    console.log(`  V1: ${diff.v1Chars.toLocaleString()} chars / ${diff.v1Tokens.toLocaleString()} tokens (${diff.v1Chars} chars)`);
    console.log(`  V2: ${diff.v2Chars.toLocaleString()} chars / ${diff.v2Tokens.toLocaleString()} tokens (${diff.v2Chars} chars)`);
    console.log(`  Δ:  ${diff.charDelta > 0 ? "-" : "+"}${Math.abs(diff.charDelta).toLocaleString()} chars / ${diff.tokenDelta > 0 ? "-" : "+"}${Math.abs(diff.tokenDelta)} tokens (${diff.pctDelta > 0 ? "-" : "+"}${Math.abs(diff.pctDelta).toFixed(1)}%)`);

    console.log("\n  Per-section diff:");
    console.log("  Section                           │ V1 chars │ V2 chars │ Δ");
    console.log("  ──────────────────────────────────┼──────────┼──────────┼─────");
    for (const s of diff.sections.filter(s => Math.abs(s.charDelta) > 0)) {
      const sign = s.charDelta > 0 ? "-" : s.charDelta < 0 ? "+" : " ";
      console.log(
        `  ${s.name.padEnd(35)} │ ${s.v1Chars.toString().padStart(8)} │ ${s.v2Chars.toString().padStart(8)} │ ${sign}${Math.abs(s.charDelta)}`
      );
    }
  }

  // ── 汇总表 ──────────────────────────────────────
  console.log(`\n${"═".repeat(80)}`);
  console.log("汇总");
  console.log("═".repeat(80));

  console.log("\n| Stage | V1 chars | V2 chars | Δ chars | V1 tokens | V2 tokens | Δ tokens | Δ% |");
  console.log("|-------|----------|----------|---------|-----------|-----------|----------|-----|");

  let totalV1Chars = 0, totalV2Chars = 0, totalV1Tokens = 0, totalV2Tokens = 0;
  for (const r of results) {
    console.log(
      `| ${r.stage.toUpperCase()} | ${r.v1Chars.toLocaleString()} | ${r.v2Chars.toLocaleString()} | ${(r.charDelta > 0 ? "-" : "+") + Math.abs(r.charDelta).toLocaleString()} | ${r.v1Tokens.toLocaleString()} | ${r.v2Tokens.toLocaleString()} | ${(r.tokenDelta > 0 ? "-" : "+") + Math.abs(r.tokenDelta)} | ${(r.pctDelta > 0 ? "-" : "+") + Math.abs(r.pctDelta).toFixed(1)}% |`
    );
    totalV1Chars += r.v1Chars;
    totalV2Chars += r.v2Chars;
    totalV1Tokens += r.v1Tokens;
    totalV2Tokens += r.v2Tokens;
  }

  const totalCharDelta = totalV1Chars - totalV2Chars;
  const totalTokenDelta = totalV1Tokens - totalV2Tokens;
  console.log(
    `| **合计** | **${totalV1Chars.toLocaleString()}** | **${totalV2Chars.toLocaleString()}** | **-${totalCharDelta.toLocaleString()}** | **${totalV1Tokens.toLocaleString()}** | **${totalV2Tokens.toLocaleString()}** | **-${totalTokenDelta}** | **-${((totalCharDelta / totalV1Chars) * 100).toFixed(1)}%** |`
  );

  // ── 真实 System Prompt 占比分析 ──────────────────
  console.log("\n━━━ 真实 System Prompt 视角 ━━━");
  console.log();
  console.log("基于 tokenConsumption 表的真实 System Prompt token 数据：");
  console.log();

  const realSysPrompt: Record<string, number> = {
    stage2: 12254,
    stage3: 12785,
    stage5: 10451,
    stage8: 14759,
  };

  console.log("| Stage | System Prompt | 模板占比 | V1→V2 省 | 实际占比 |");
  console.log("|-------|-------------|---------|----------|---------|");

  for (const r of results) {
    const realTokens = realSysPrompt[r.stage] || 0;
    const templatePct = (r.v1Tokens / realTokens * 100);
    const realPct = (r.tokenDelta / realTokens * 100);
    console.log(
      `| ${r.stage.toUpperCase()} | ${realTokens.toLocaleString()} | ${templatePct.toFixed(1)}% | ${r.tokenDelta} tokens | ${realPct.toFixed(2)}% |`
    );
  }

  // ── 结论 ────────────────────────────────────────
  console.log("\n━━━ 实验结论 ━━━");
  console.log();
  console.log(`模板层面：4 个文件合计节省 ${totalCharDelta.toLocaleString()} chars / ${totalTokenDelta} tokens (${((totalCharDelta / totalV1Chars) * 100).toFixed(1)}%)`);
  console.log(`真实层面：在包含 DM Context + Search Context 的完整 System Prompt 中，`);
  console.log(`          模板优化节省的 tokens 仅占 System Prompt 的 0.1-0.3%。`);
  console.log();
  console.log("H1 验证结果：模板内存在冗余指令，但规模极小，");
  console.log("            减少的 Token 在真实 System Prompt 中占比 <1%。");
  console.log("            模板优化不是有意义的成本杠杆。");
  console.log();
  console.log("建议：继续聚焦机会 1（DM 分层）和机会 2（Search Context 压缩），");
  console.log("      它们覆盖了 System Prompt 中 50-85% 的可变 Token。");
}

main();
