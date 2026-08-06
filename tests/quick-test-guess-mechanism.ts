/**
 * Phase 5.1 测试: Guess 机制可选注入
 *
 * 验证:
 * 1. 默认不启用 Guess → prompt 不含 Guess 规则
 * 2. includeGuessMechanism=true → S5 prompt 包含 Guess 规则
 * 3. includeGuessMechanism=false → S5 prompt 不含 Guess 规则
 * 4. Converge 模式不注入 Guess
 * 5. Guess 规则内容完整性
 *
 * 运行: npx tsx tests/quick-test-guess-mechanism.ts
 */

import { loadPrompt } from "../src/lib/ai/loader";

let p = 0, f = 0;
function ck(n: string, c: boolean) {
  if (c) { p++; console.log(`  ✅ ${n}`); }
  else { f++; console.log(`  ❌ ${n}`); }
}

const vars = { "品牌名": "T", "品类": "C" };

// ── 测试 1: 默认不启用 ──────────────────────────────

console.log("1. Default (disabled):");

const s5default = loadPrompt({ stage: 5, mode: "consultation", variables: vars });
ck("Default: NO Guess header", !s5default.includes("可选 Guess 机制"));
ck("Default: NO Guess condition", !s5default.includes("前序 4 个阶段的关键信息已全部存在于 Decision Memory"));
ck("Default: NO Guess example", !s5default.includes("基于前面的信息，我猜"));

// ── 测试 2: 显式禁用 ────────────────────────────────

console.log("\n2. Explicitly disabled:");

const s5off = loadPrompt({ stage: 5, mode: "consultation", variables: vars, includeGuessMechanism: false });
ck("Off: NO Guess header", !s5off.includes("可选 Guess 机制"));
ck("Off: S5 prompt still valid", s5off.includes("竞争分析师"));

// ── 测试 3: 启用 Guess 机制 ──────────────────────────

console.log("\n3. Enabled:");

const s5on = loadPrompt({ stage: 5, mode: "consultation", variables: vars, includeGuessMechanism: true });
ck("On: HAS Guess header", s5on.includes("可选 Guess 机制"));
ck("On: HAS conditions", s5on.includes("前序 4 个阶段的关键信息已全部存在于 Decision Memory"));
ck("On: HAS 猜测格式", s5on.includes("基于前面的信息，我猜……但我不确定"));
ck("On: HAS 停止条件 — 连续猜错", s5on.includes("连续猜错两次 → 停止使用"));
ck("On: HAS 停止条件 — 明确纠正", s5on.includes("创始人明确纠正 → 该维度不再使用 Guess"));
ck("On: HAS 使用限制", s5on.includes("不在同一个竞争维度上连续使用超过 2 次"));
ck("On: HAS example", s5on.includes("你觉得呢？"));
ck("On: S5 core still intact", s5on.includes("竞争分析师") && s5on.includes("竞争类型识别"));

// ── 测试 4: Guess long enough to be meaningful ──────

console.log("\n4. Guess content size:");

const s5offLen = s5off.length;
const s5onLen = s5on.length;
const delta = s5onLen - s5offLen;
ck(`Guess adds meaningful content (+${delta} chars)`, delta > 200);
console.log(`   Off: ${s5offLen.toLocaleString()} chars`);
console.log(`   On:  ${s5onLen.toLocaleString()} chars`);

// ── 测试 5: Converge 不注入 ──────────────────────────

console.log("\n5. Converge isolation:");

const s5convOn = loadPrompt({ stage: 5, mode: "converge", includeGuessMechanism: true });
ck("Converge NO Guess", !s5convOn.includes("可选 Guess 机制"));

// ── 测试 6: Non-S5 stages 不注入 Guess ──────────────

console.log("\n6. Non-S5 isolation:");

const s3on = loadPrompt({ stage: 3, mode: "consultation", variables: vars, includeGuessMechanism: true });
ck("S3 NO Guess even when enabled", !s3on.includes("可选 Guess 机制"));

// ── 总结 ─────────────────────────────────────────────

console.log(`\n${p}/${p + f} passed`);
process.exit(f > 0 ? 1 : 0);
