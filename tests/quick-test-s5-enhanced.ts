/**
 * Phase 2.1 测试: S5 竞争判断 prompt 增强
 *
 * 验证:
 * 1. S5 consultation prompt 中包含共用规则（C1-C3）
 * 2. S5 专属补充规则存在
 * 3. {SHARED_RULES} 占位符被正确替换
 * 4. S5 原有核心规则未被覆盖
 *
 * 运行: npx tsx tests/quick-test-s5-enhanced.ts
 */

import { loadPrompt } from "../src/lib/ai/loader";

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean) {
  if (condition) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}`);
  }
}

// ── 加载 S5 consultation prompt ───────────────────────

const s5Prompt = loadPrompt({
  stage: 5,
  mode: "consultation",
  variables: { "品牌名": "测试品牌", "品类": "测试品类" },
});

console.log(`S5 prompt length: ${s5Prompt.length.toLocaleString()} chars\n`);

// ── 1. 共用规则 C1-C3 存在 ────────────────────────────

console.log("1. Shared rules (C1-C3):");

check("C1: Internal Hypothesis Anchor", s5Prompt.includes("Internal Hypothesis Anchor"));
check("C1: S5 前序信息 source", s5Prompt.includes("S1+S2+S3+S4 确认总结"));
check("C1: 置信度区间表", s5Prompt.includes("10-20") && s5Prompt.includes("90+"));

check("C2: Want vs Should Want", s5Prompt.includes("Want vs Should Want 检测"));
check("C2: S5 套话 — 竞品没有创新", s5Prompt.includes("竞品没有创新") && s5Prompt.includes("竞品做得不好"));
check("C2: S5 破局问题", s5Prompt.includes("哪个环节现在没有任何品牌做好"));

check("C3: Self-Monitoring Red Flags", s5Prompt.includes("Self-Monitoring Red Flags"));
check("C3: 通用 Red Flag", s5Prompt.includes("批处理，不是访谈"));
check("C3: S5 专属 — 只分析了直接竞品", s5Prompt.includes("只分析了直接竞品，没有追问替代方案"));

// ── 2. 共用规则 B1-B4 存在 ────────────────────────────

console.log("\n2. Shared rules (B1-B4):");

check("B1: 禁止二选一", s5Prompt.includes("禁止二选一/多选一提问"));
check("B1: 禁句式", s5Prompt.includes("是因为 A，还是因为 B？"));

check("B2: 非诱导规则", s5Prompt.includes("给用户说\"没有\"的空间"));

check("B3: 追问递进规则", s5Prompt.includes("追问递进规则"));
check("B3: S5 三层定义", s5Prompt.includes("事实层") && s5Prompt.includes("逻辑层") && s5Prompt.includes("空位层"));

check("B4: 方向饱和信号", s5Prompt.includes("方向饱和信号"));

// ── 3. S5 原有核心规则未被覆盖 ────────────────────────

console.log("\n3. S5 original rules preserved:");

check("Role intact", s5Prompt.includes("你是竞争分析师"));
check("Goal intact", s5Prompt.includes("4.1 竞争方向"));
check("不直接询问竞争优势", s5Prompt.includes("不直接询问\"你的竞争优势是什么\""));
check("不引导回答更好", s5Prompt.includes("不引导用户回答\"我们比别人更好\""));
check("Exploration Framework", s5Prompt.includes("竞争类型识别"));
check("Follow-up Logic", s5Prompt.includes('"我们比竞品更好"'));
check("Boundary Control", s5Prompt.includes("禁止深入：品牌定位输出"));
check("Confirmation Summary", s5Prompt.includes("竞争方向："));
check("Summary Language Rules", s5Prompt.includes("吊打") && s5Prompt.includes("秒杀"));
check("Output Restriction", s5Prompt.includes("聊天阶段只输出一个问题"));

// ── 4. {SHARED_RULES} 占位符 ──────────────────────────

console.log("\n4. {SHARED_RULES} placeholder:");

check("No unreplaced {SHARED_RULES}", !s5Prompt.includes("{SHARED_RULES}"));
check("No unreplaced {LAYER_DEFINITIONS}", !s5Prompt.includes("{LAYER_DEFINITIONS}"));
check("No unreplaced {KNOWN_INFO_SOURCE}", !s5Prompt.includes("{KNOWN_INFO_SOURCE}"));
check("No unreplaced {STAGE_BUZZWORDS}", !s5Prompt.includes("{STAGE_BUZZWORDS}"));
check("No unreplaced {BREAKTHROUGH_QUESTION}", !s5Prompt.includes("{BREAKTHROUGH_QUESTION}"));
check("No unreplaced {STAGE_SPECIFIC_RED_FLAGS}", !s5Prompt.includes("{STAGE_SPECIFIC_RED_FLAGS}"));

// ── 5. Converge mode DOESN'T inject shared rules ──────

console.log("\n5. Converge mode isolation:");

const s5Converge = loadPrompt({ stage: 5, mode: "converge" });
check("Converge has NO shared rules", !s5Converge.includes("Internal Hypothesis Anchor"));
check("Converge has NO Want vs Should Want", !s5Converge.includes("Want vs Should Want"));

// ── 总结 ─────────────────────────────────────────────

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail > 0 ? 1 : 0);
