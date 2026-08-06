/**
 * Phase 2.3 测试: S2 商业背景 prompt 增强
 *
 * 运行: npx tsx tests/quick-test-s2-enhanced.ts
 */

import { loadPrompt } from "../src/lib/ai/loader";

let pass = 0, fail = 0;
function check(name: string, c: boolean) {
  if (c) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

const s2 = loadPrompt({ stage: 2, mode: "consultation", variables: { "品牌名": "T", "品类": "C" } });

console.log("1. C1-C3 shared rules:");
check("C1: Hypothesis Anchor", s2.includes("Internal Hypothesis Anchor"));
check("C1: S2 source (S1 确认总结)", s2.includes("S1 确认总结（创始动机、观察、用户假设、资源约束）"));
check("C2: Want vs Should Want", s2.includes("Want vs Should Want 检测"));
check("C2: S2 套话", s2.includes("这个市场很大") && s2.includes("是蓝海"));
check("C2: S2 破局问题", s2.includes("你亲眼看到的、让你确信该现在动手的那个信号是什么"));
check("C3: Red Flags", s2.includes("Self-Monitoring Red Flags"));
check("C3: S2 专属", s2.includes("在用过大的词包装有限的信息"));

console.log("\n2. S2 original rules preserved:");
check("Role", s2.includes("商业战略顾问"));
check("话题边界", s2.includes("话题边界") && s2.includes("明令禁止的提问方向"));
check("禁止二选一", s2.includes("禁止二选一或多选一提问"));
check("Exploration Framework", s2.includes("行业环境") && s2.includes("为什么是现在"));
check("Confirmation Summary", s2.includes("商业背景：") && s2.includes("核心挑战：") && s2.includes("品牌战略方向："));

console.log("\n3. Placeholders:");
check("No {SHARED_RULES}", !s2.includes("{SHARED_RULES}"));
check("No {BREAKTHROUGH_QUESTION}", !s2.includes("{BREAKTHROUGH_QUESTION}"));

console.log("\n4. Converge isolation:");
const s2c = loadPrompt({ stage: 2, mode: "converge" });
check("Converge no shared rules", !s2c.includes("Internal Hypothesis Anchor"));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail > 0 ? 1 : 0);
