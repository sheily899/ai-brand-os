/**
 * Phase 1.3 验证：慢象咖啡 S1 共用规则注入前后对比
 *
 * 对比维度：
 * 1. 是否出现二选一提问（应该消失）
 * 2. 是否出现预设性追问（应该减少）
 * 3. 系统 prompt 结构变化（C1-C3 是否注入）
 *
 * 运行: npx tsx tests/quick-test-shared-rules.ts  (已通过)
 *       npx tsx tests/phase1-3-compare.ts
 */

// 加载 .env.local（Next.js 不会为 tsx 脚本自动加载）
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
} catch {}

import { getLLMProvider } from "../src/lib/ai/provider";
import { loadPrompt } from "../src/lib/ai/loader";

const PROMPTS_DIR = resolve(process.cwd(), "src/lib/ai/prompts");

// ── 构造 "before" prompt（无共用规则）──────────────────
function buildBeforePrompt(): string {
  let raw = readFileSync(resolve(PROMPTS_DIR, "stage1-consultation.md"), "utf8");
  // 只做变量注入，不加共用规则
  raw = raw.split("{品牌名}").join("慢象咖啡");
  raw = raw.split("{品类}").join("精品咖啡");
  return raw;
}

// ── 构造 "after" prompt（含共用规则）───────────────────
function buildAfterPrompt(): string {
  return loadPrompt({
    stage: 1,
    mode: "consultation",
    variables: { "品牌名": "慢象咖啡", "品类": "精品咖啡" },
  });
}

// ── 检测函数 ──────────────────────────────────────────

/** 检测是否包含二选一/多选一句式 */
function hasBinaryQuestion(text: string): string[] {
  const patterns = [
    /是因为.*还是/,
    /更像.*还是/,
    /是.*还是.*那个/,
    /是来自.*还是/,
    /是.*的原因.*还是/,
    /A.*还是.*B/,
    /或者/,
    /还是.*还是/,
  ];
  return patterns.filter((p) => p.test(text));
}

/** 检测是否包含预设性追问 */
function hasPresumptiveQuestion(text: string): string[] {
  const patterns = [
    /缺少了什么/,
    /哪里让你不满意/,
    /你是不是觉得/,
    /这个过程中缺少了/,
  ];
  return patterns.filter((p) => p.test(text));
}

/** 检测是否包含问句 */
function countQuestions(text: string): number {
  // 简单统计问号（排除模板中的示例）
  return (text.match(/[？?]/g) || []).length;
}

// ── 主测试 ────────────────────────────────────────────

async function main() {
  console.log("=== Phase 1.3: 慢象咖啡 S1 共用规则 A/B 对比 ===\n");

  // 1. Prompt 结构对比
  console.log("── 1. System Prompt 结构对比 ──\n");

  const before = buildBeforePrompt();
  const after = buildAfterPrompt();

  console.log(`Before 长度: ${before.length.toLocaleString()} chars`);
  console.log(`After  长度: ${after.length.toLocaleString()} chars`);
  console.log(`增量: +${((after.length - before.length) / before.length * 100).toFixed(1)}%\n`);

  // 检查 C1-C3 是否在 after 中存在
  const checks = [
    { name: "C1: Internal Hypothesis Anchor", text: "Internal Hypothesis Anchor" },
    { name: "C1: 置信度区间表", text: "10-20" },
    { name: "C2: Want vs Should Want", text: "Want vs Should Want" },
    { name: "C2: 破局问题", text: "如果抛开品牌定位这些概念" },
    { name: "C3: Self-Monitoring Red Flags", text: "Self-Monitoring Red Flags" },
    { name: "C3: 通用 Red Flag", text: "批处理，不是访谈" },
    { name: "C3: S1 专属 Red Flag", text: "创作驱动型不问这个问题" },
  ];

  for (const c of checks) {
    const inBefore = before.includes(c.text);
    const inAfter = after.includes(c.text);
    console.log(`  ${c.name}: Before=${inBefore ? "✅" : "❌"} After=${inAfter ? "✅" : "❌"}`);
  }

  // 2. AI 行为对比（首轮）
  console.log("\n── 2. AI 首轮响应对比 ──\n");

  const provider = getLLMProvider();
  const userMessage = "品牌名是慢象咖啡，做精品咖啡";

  // Before 组
  console.log("▶ Before（无共用规则）:");
  const beforeMessages = [
    { role: "system" as const, content: before },
    { role: "user" as const, content: userMessage },
  ];
  const beforeResponse = await provider.chat(beforeMessages, { temperature: 0.7 });

  console.log(`  响应 (${beforeResponse.length} chars):`);
  console.log(`  ${beforeResponse.slice(0, 500)}${beforeResponse.length > 500 ? "..." : ""}\n`);

  // 检查
  const beforeBinary = hasBinaryQuestion(beforeResponse);
  const beforePresume = hasPresumptiveQuestion(beforeResponse);
  const beforeQCount = countQuestions(beforeResponse);
  console.log(`  问句数: ${beforeQCount}`);
  console.log(`  二选一/多选一: ${beforeBinary.length > 0 ? `⚠️ ${beforeBinary.length} 处` : "✅ 无"}`);
  console.log(`  预设性追问: ${beforePresume.length > 0 ? `⚠️ ${beforePresume.length} 处` : "✅ 无"}`);

  // After 组
  console.log("\n▶ After（含共用规则）:");
  const afterMessages = [
    { role: "system" as const, content: after },
    { role: "user" as const, content: userMessage },
  ];
  const afterResponse = await provider.chat(afterMessages, { temperature: 0.7 });

  console.log(`  响应 (${afterResponse.length} chars):`);
  console.log(`  ${afterResponse.slice(0, 500)}${afterResponse.length > 500 ? "..." : ""}\n`);

  const afterBinary = hasBinaryQuestion(afterResponse);
  const afterPresume = hasPresumptiveQuestion(afterResponse);
  const afterQCount = countQuestions(afterResponse);
  console.log(`  问句数: ${afterQCount}`);
  console.log(`  二选一/多选一: ${afterBinary.length > 0 ? `⚠️ ${afterBinary.length} 处` : "✅ 无"}`);
  console.log(`  预设性追问: ${afterPresume.length > 0 ? `⚠️ ${afterPresume.length} 处` : "✅ 无"}`);

  // 3. 总结
  console.log("\n── 3. 对比总结 ──\n");

  const improvements: string[] = [];
  const regressions: string[] = [];
  const unchanged: string[] = [];

  if (beforeBinary.length > 0 && afterBinary.length === 0) {
    improvements.push("✅ 二选一/多选一提问: 已消除");
  } else if (beforeBinary.length === 0 && afterBinary.length === 0) {
    unchanged.push("➖ 二选一/多选一提问: 两组均未出现");
  } else if (afterBinary.length > 0) {
    regressions.push(`❌ 二选一/多选一提问: After 仍有 ${afterBinary.length} 处`);
  }

  if (beforePresume.length > 0 && afterPresume.length === 0) {
    improvements.push("✅ 预设性追问: 已消除");
  } else if (beforePresume.length === 0 && afterPresume.length === 0) {
    unchanged.push("➖ 预设性追问: 两组均未出现");
  }

  if (beforeQCount > 1 && afterQCount === 1) {
    improvements.push(`✅ 问句数: ${beforeQCount} → ${afterQCount}（符合一次一问）`);
  } else if (beforeQCount === 1 && afterQCount === 1) {
    unchanged.push("➖ 问句数: 两组均为 1（符合一次一问）");
  }

  // Response quality
  if (afterResponse.length > 100) {
    unchanged.push("➖ After 响应长度正常（非空响应）");
  }

  for (const imp of improvements) console.log(imp);
  for (const unc of unchanged) console.log(unc);
  for (const reg of regressions) console.log(reg);

  if (regressions.length === 0 && improvements.length > 0) {
    console.log("\n🏆 结论: 共用规则注入有效改善了追问质量");
  } else if (regressions.length === 0) {
    console.log("\n✅ 结论: 共用规则注入未引入退化，原有质量保持");
  } else {
    console.log("\n⚠️ 结论: 发现退化，需要进一步分析");
  }

  // Token info
  console.log(`\nToken: Before=${provider.lastUsage ? provider.lastUsage.totalTokens : '?'}, After 的 token 需从第二次调用获取`);
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
