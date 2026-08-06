/** Phase 3.3: S1 用户访谈 prompt 增强 (Phase 3 最后一个). Run: npx tsx tests/quick-test-s1-enhanced.ts */
import { loadPrompt } from "../src/lib/ai/loader";

let p=0,f=0;
function ck(n:string,c:boolean){if(c){p++;console.log(`  ✅ ${n}`)}else{f++;console.log(`  ❌ ${n}`)}}

const s1=loadPrompt({stage:1,mode:"consultation",variables:{"品牌名":"慢象咖啡","品类":"精品咖啡"}});

console.log("1. NEW C1-C3 (not in original S1):");
ck("C1 Hypothesis Anchor", s1.includes("Internal Hypothesis Anchor"));
ck("C1 置信度区间", s1.includes("10-20") && s1.includes("90+"));
ck("C2 Want vs Should Want", s1.includes("Want vs Should Want 检测"));
ck("C2 S1 破局问题", s1.includes("如果抛开品牌定位这些概念"));
ck("C3 Red Flags", s1.includes("Self-Monitoring Red Flags"));
ck("C3 S1 专属 — 创作驱动型不问", s1.includes("创作驱动型不问这个问题"));

console.log("\n2. S1 original EXISTING rules preserved:");
ck("二选一禁句式 (B1)", s1.includes("是因为 A，还是因为 B？"));
ck("非诱导规则 (B2)", s1.includes("给用户说\"没有\"的空间"));
ck("追问递进 (B3)", s1.includes("事实层")&&s1.includes("原因层")&&s1.includes("意义层"));
ck("访谈收敛机制 (B4)", s1.includes("访谈收敛机制"));
ck("场景分支 (问题驱动/创作驱动)", s1.includes("问题驱动型") && s1.includes("创作驱动型"));
ck("Opening Message", s1.includes("很多品牌开始之前"));
ck("Confirmation Summary", s1.includes("如果以上内容准确，请回复确认"));

console.log("\n3. Placeholders + isolation:");
ck("No {SHARED_RULES}", !s1.includes("{SHARED_RULES}"));
ck("No {BREAKTHROUGH_QUESTION}", !s1.includes("{BREAKTHROUGH_QUESTION}"));
ck("Converge clean", !loadPrompt({stage:1,mode:"converge"}).includes("Internal Hypothesis Anchor"));

console.log(`\n${p}/${p+f} passed`);
process.exit(f>0?1:0);
