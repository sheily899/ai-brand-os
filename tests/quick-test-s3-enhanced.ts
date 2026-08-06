/**
 * Phase 2.2 测试: S3 市场机会 prompt 增强
 *
 * 验证:
 * 1. S3 consultation prompt 中包含共用规则（C1-C3）
 * 2. S3 阶段专属值正确注入（KNOWN_INFO_SOURCE/LAYERS/BUZZWORDS/QUESTION/FLAGS）
 * 3. {SHARED_RULES} 占位符被正确替换
 * 4. S3 原有核心规则未被覆盖
 *
 * 运行: npx tsx tests/quick-test-s3-enhanced.ts
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

// ── 加载 S3 consultation prompt ───────────────────────

const s3Prompt = loadPrompt({
  stage: 3,
  mode: "consultation",
  variables: { "品牌名": "测试品牌", "品类": "测试品类" },
});

console.log(`S3 prompt length: ${s3Prompt.length.toLocaleString()} chars\n`);

// ── 1. 共用规则 C1-C3 存在 ────────────────────────────

console.log("1. Shared rules (C1-C3):");

check("C1: Internal Hypothesis Anchor", s3Prompt.includes("Internal Hypothesis Anchor"));
check("C1: S3 source (S1+S2)", s3Prompt.includes("S1+S2 确认总结"));
check("C1: 置信度区间表", s3Prompt.includes("10-20") && s3Prompt.includes("90+"));

check("C2: Want vs Should Want", s3Prompt.includes("Want vs Should Want 检测"));
check("C2: S3 套话", s3Prompt.includes("这是个蓝海，没人做") && s3Prompt.includes("消费者在等待更好的产品"));
check("C2: S3 破局问题", s3Prompt.includes("消费者现在最无奈的是什么"));

check("C3: Self-Monitoring Red Flags", s3Prompt.includes("Self-Monitoring Red Flags"));
check("C3: S3 专属 — 市场规模说不出来源", s3Prompt.includes("市场规模几百亿") && s3Prompt.includes("说不出数据来源"));

// ── 2. 共用规则 B1-B4 存在 ────────────────────────────

console.log("\n2. Shared rules (B1-B4):");

check("B1: 禁止二选一", s3Prompt.includes("禁止二选一/多选一提问"));
check("B2: 非诱导规则", s3Prompt.includes("给用户说\"没有\"的空间"));
check("B3: 追问递进规则", s3Prompt.includes("追问递进规则"));
check("B3: S3 三层定义（事实/原因/判断）", s3Prompt.includes("品类中正在发生什么") && s3Prompt.includes("为什么存在这些体验缺口"));
check("B4: 方向饱和信号", s3Prompt.includes("方向饱和信号"));

// ── 3. S3 原有核心规则未被覆盖 ────────────────────────

console.log("\n3. S3 original rules preserved:");

check("Role intact", s3Prompt.includes("你是市场策略师"));
check("JTBD reference", s3Prompt.includes("Jobs to be Done"));
check("品类现状 goal", s3Prompt.includes("品类现状"));
check("体验不足 goal", s3Prompt.includes("当前体验不足"));
check("品牌机会方向 goal", s3Prompt.includes("品牌机会方向"));
check("不使用报告字段词", s3Prompt.includes("不使用\"品类现状\"\"体验不足\"\"机会方向\"等报告字段词"));
check("Exploration Framework", s3Prompt.includes("品类状态探索"));
check("消费行为与替代方案", s3Prompt.includes("消费行为与替代方案"));
check("Follow-up Logic", s3Prompt.includes("个案包装成普遍现象"));
check("Boundary Control", s3Prompt.includes("禁止深入：竞品详细定位分析"));
check("Confirmation Summary", s3Prompt.includes("品类现状："));
check("Summary Language Rules", s3Prompt.includes("蓝海") && s3Prompt.includes("风口"));
check("Output Restriction", s3Prompt.includes("聊天阶段只输出一个问题"));

// ── 4. {SHARED_RULES} 占位符 ──────────────────────────

console.log("\n4. Placeholder replacement:");

check("No unreplaced {SHARED_RULES}", !s3Prompt.includes("{SHARED_RULES}"));
check("No unreplaced {LAYER_DEFINITIONS}", !s3Prompt.includes("{LAYER_DEFINITIONS}"));
check("No unreplaced {BREAKTHROUGH_QUESTION}", !s3Prompt.includes("{BREAKTHROUGH_QUESTION}"));
check("No unreplaced {STAGE_SPECIFIC_RED_FLAGS}", !s3Prompt.includes("{STAGE_SPECIFIC_RED_FLAGS}"));

// ── 5. Converge mode isolation ────────────────────────

console.log("\n5. Converge mode isolation:");

const s3Converge = loadPrompt({ stage: 3, mode: "converge" });
check("Converge has NO shared rules", !s3Converge.includes("Internal Hypothesis Anchor"));

// ── 总结 ─────────────────────────────────────────────

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail > 0 ? 1 : 0);
