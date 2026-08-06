/** Phase 3.2: S4 消费者洞察 prompt 增强. Run: npx tsx tests/quick-test-s4-enhanced.ts */
import { loadPrompt } from "../src/lib/ai/loader";

let p=0,f=0;
function ck(n:string,c:boolean){if(c){p++;console.log(`  ✅ ${n}`)}else{f++;console.log(`  ❌ ${n}`)}}

const s4=loadPrompt({stage:4,mode:"consultation",variables:{"品牌名":"T","品类":"C"}});

console.log("1. C1-C3:");
ck("C1 Hypothesis Anchor", s4.includes("Internal Hypothesis Anchor"));
ck("C1 S4 source (S1+S2+S3)", s4.includes("S1+S2+S3 确认总结"));
ck("C2 Want vs Should Want", s4.includes("Want vs Should Want 检测"));
ck("C2 S4 套话", s4.includes("用户想要更好的体验") && s4.includes("精神消费"));
ck("C2 S4 破局问题", s4.includes("能想起一个具体的用户吗"));
ck("C3 Red Flags", s4.includes("Self-Monitoring Red Flags"));
ck("C3 S4 专属 — Path B", s4.includes("Path B 三轮后仍然在追问"));

console.log("\n2. B1-B4:");
ck("B1 禁止二选一", s4.includes("禁止二选一/多选一提问"));
ck("B2 非诱导规则", s4.includes("给用户说\"没有\"的空间"));
ck("B3 追问递进 (S4 三层+PathB)", s4.includes("场景层") && s4.includes("Path B 降级路径"));
ck("B4 方向饱和信号", s4.includes("方向饱和信号"));

console.log("\n3. S4 original:");
ck("Role", s4.includes("消费者研究员"));
ck("Path A/B 分支", s4.includes("Path A") && s4.includes("Path B"));
ck("不接受人口标签", s4.includes("不接受单纯人口标签"));
ck("三层需求", s4.includes("功能需求分析") && s4.includes("情感与身份需求分析"));
ck("Summary Language Rules", s4.includes("铲屎官觉得猫不玩玩具很挫败"));
ck("No {SHARED_RULES}", !s4.includes("{SHARED_RULES}"));
ck("No {BREAKTHROUGH_QUESTION}", !s4.includes("{BREAKTHROUGH_QUESTION}"));
ck("Converge clean", !loadPrompt({stage:4,mode:"converge"}).includes("Internal Hypothesis Anchor"));

console.log(`\n${p}/${p+f} passed`);
process.exit(f>0?1:0);
