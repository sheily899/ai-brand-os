/** Phase 4: S7 视觉策略 prompt 增强. Run: npx tsx tests/quick-test-s7-enhanced.ts */
import { loadPrompt } from "../src/lib/ai/loader";

let p=0,f=0;
function ck(n:string,c:boolean){if(c){p++;console.log(`  ✅ ${n}`)}else{f++;console.log(`  ❌ ${n}`)}}

const s7=loadPrompt({stage:7,mode:"consultation",variables:{"品牌名":"T","品类":"C"}});

console.log("1. C1-C3:");
ck("C1 Hypothesis Anchor", s7.includes("Internal Hypothesis Anchor"));
ck("C1 S7 source (S6)", s7.includes("S6 品牌核心战略"));
ck("C2 Want vs Should Want", s7.includes("Want vs Should Want 检测"));
ck("C2 S7 破局问题", s7.includes("如果不说高级感"));
ck("C3 Red Flags", s7.includes("Self-Monitoring Red Flags"));
ck("C3 S7 专属 — 视觉禁区少于3", s7.includes("视觉禁区少于 3 个"));

console.log("\n2. S7 original:");
ck("Role", s7.includes("视觉策略师"));
ck("追溯S6", s7.includes("Stage 6 品牌定位") && s7.includes("Stage 6 品牌人格"));
ck("不使用报告字段词", s7.includes("不使用\"视觉策略\"\"视觉语言系统\"\"视觉编码\"等报告字段词"));
ck("Exploration", s7.includes("第一印象") && s7.includes("五类视觉语言"));
ck("Confirmation Summary", s7.includes("视觉核心概念") && s7.includes("视觉禁区"));
ck("No {SHARED_RULES}", !s7.includes("{SHARED_RULES}"));
ck("No {BREAKTHROUGH_QUESTION}", !s7.includes("{BREAKTHROUGH_QUESTION}"));
ck("Converge clean", !loadPrompt({stage:7,mode:"converge"}).includes("Internal Hypothesis Anchor"));

console.log(`\n${p}/${p+f} passed`);
process.exit(f>0?1:0);
