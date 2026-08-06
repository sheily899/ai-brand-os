/** Phase 3.1: S6 品牌核心战略 prompt 增强. Run: npx tsx tests/quick-test-s6-enhanced.ts */
import { loadPrompt } from "../src/lib/ai/loader";

let p = 0, f = 0;
function ck(n: string, c: boolean) { if (c) { p++; console.log(`  ✅ ${n}`); } else { f++; console.log(`  ❌ ${n}`); } }

const s6 = loadPrompt({ stage: 6, mode: "consultation", variables: { "品牌名": "T", "品类": "C" } });

console.log("1. C1-C3 shared rules:");
ck("C1 Hypothesis Anchor", s6.includes("Internal Hypothesis Anchor"));
ck("C1 S6 source (全部前序)", s6.includes("S1+S2+S3+S4+S5 确认总结"));
ck("C1 置信度区间", s6.includes("10-20") && s6.includes("90+"));
ck("C2 Want vs Should Want", s6.includes("Want vs Should Want 检测"));
ck("C2 S6 套话", s6.includes("我们想做高端品牌") && s6.includes("打造核心竞争力"));
ck("C2 S6 破局问题", s6.includes("你心里最想让消费者用一句话向朋友推荐你的时候"));
ck("C3 Red Flags", s6.includes("Self-Monitoring Red Flags"));
ck("C3 S6 专属 — 接受了高端不追问品类", s6.includes("接受了\"高端\"\"生活方式\"等词作为定位方向而不追问品类锚定"));

console.log("\n2. B1-B4 shared rules:");
ck("B1 禁止二选一", s6.includes("禁止二选一/多选一提问"));
ck("B2 非诱导规则", s6.includes("给用户说\"没有\"的空间"));
ck("B3 追问递进 (S6 四模块)", s6.includes("定位 → 价值主张拆解 → 品牌故事 → 品牌人格"));
ck("B4 方向饱和信号", s6.includes("方向饱和信号"));

console.log("\n3. S6 unique features preserved:");
ck("Role", s6.includes("品牌策略师"));
ck("空话禁令", s6.includes("差异化竞争") && s6.includes("重新定义"));
ck("禁模板句式", s6.includes("定义 XX 体验") && s6.includes("打造 XX"));
ck("品类锚定", s6.includes("品类锚定原则"));
ck("Exploration Framework", s6.includes("品类框架") && s6.includes("核心价值选择"));
ck("Follow-up Logic", s6.includes("更懂用户"));
ck("Boundary Control", s6.includes("禁止深入：视觉设计执行"));
ck("Confirmation Summary", s6.includes("品牌定位") && s6.includes("品牌人格"));

console.log("\n4. Placeholders:");
ck("No {SHARED_RULES}", !s6.includes("{SHARED_RULES}"));
ck("No {BREAKTHROUGH_QUESTION}", !s6.includes("{BREAKTHROUGH_QUESTION}"));
ck("No {STAGE_SPECIFIC_RED_FLAGS}", !s6.includes("{STAGE_SPECIFIC_RED_FLAGS}"));

console.log("\n5. Converge:");
ck("Converge clean", !loadPrompt({stage:6,mode:"converge"}).includes("Internal Hypothesis Anchor"));

console.log(`\n${p}/${p+f} passed`);
process.exit(f > 0 ? 1 : 0);
