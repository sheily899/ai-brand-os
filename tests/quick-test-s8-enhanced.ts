/** Phase 2.4: S8 内容策略 prompt 增强. Run: npx tsx tests/quick-test-s8-enhanced.ts */
import { loadPrompt } from "../src/lib/ai/loader";

let p = 0, f = 0;
function ck(n: string, c: boolean) { if (c) { p++; console.log(`  ✅ ${n}`); } else { f++; console.log(`  ❌ ${n}`); } }

const s8 = loadPrompt({ stage: 8, mode: "consultation", variables: { "品牌名": "T", "品类": "C" } });

console.log("1. C1-C3:");
ck("C1 Hypothesis Anchor", s8.includes("Internal Hypothesis Anchor"));
ck("C1 S8 source (S6+S7)", s8.includes("S6 品牌核心战略"));
ck("C2 Want vs Should Want", s8.includes("Want vs Should Want 检测"));
ck("C2 S8 套话", s8.includes("提供有价值的内容") && s8.includes("建立品牌认知"));
ck("C2 S8 破局问题", s8.includes("她会填什么词"));
ck("C3 Red Flags", s8.includes("Self-Monitoring Red Flags"));
ck("C3 S8 专属", s8.includes("内容方向只是产品宣传的变体") && s8.includes("品牌故事是内容的核心素材"));

console.log("\n2. S8 original:");
ck("Role", s8.includes("内容策略师"));
ck("不讨论流量", s8.includes("不讨论流量、涨粉、爆款、算法等运营指标"));
ck("Exploration", s8.includes("品牌内容角色") && s8.includes("用户认知阶段"));
ck("Confirmation Summary", s8.includes("内容核心方向"));
ck("No {SHARED_RULES}", !s8.includes("{SHARED_RULES}"));
ck("No {BREAKTHROUGH_QUESTION}", !s8.includes("{BREAKTHROUGH_QUESTION}"));

console.log("\n3. Converge:");
ck("Converge clean", !loadPrompt({stage:8,mode:"converge"}).includes("Internal Hypothesis Anchor"));

console.log(`\n${p}/${p+f} passed`);
process.exit(f > 0 ? 1 : 0);
