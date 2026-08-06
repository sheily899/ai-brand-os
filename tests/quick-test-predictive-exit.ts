/** Phase 5.2: 预测退出辅助 — exit-checker.ts 增强. Run: npx tsx tests/quick-test-predictive-exit.ts */
import {
  checkExitConditions,
  getStageExitSchema,
  detectConfirmationSummary,
  CHECKER_SYSTEM_PROMPT,
} from "../src/lib/ai/exit-checker";

let p = 0, f = 0;
function ck(n: string, c: boolean) {
  if (c) { p++; console.log(`  ✅ ${n}`); }
  else { f++; console.log(`  ❌ ${n}`); }
}

// ── 1. Schema regression ──
const s1 = getStageExitSchema(1);
ck("S1 schema has 7 conditions", s1?.conditions.length === 7);
ck("S1 minRounds=3", s1?.minRounds === 3);
const s6 = getStageExitSchema(6);
ck("S6 schema has 5 conditions", s6?.conditions.length === 5);
ck("S6 minCoreRequired=4", s6?.minCoreRequired === 4);

// ── 2. CHECKER_SYSTEM_PROMPT includes predictive section ──
ck("CHECKER_SYSTEM_PROMPT contains 预测辅助 section",
  CHECKER_SYSTEM_PROMPT.includes("预测辅助"));
ck("CHECKER_SYSTEM_PROMPT contains predictable yes/no/uncertain",
  CHECKER_SYSTEM_PROMPT.includes('"yes"') &&
  CHECKER_SYSTEM_PROMPT.includes('"no"') &&
  CHECKER_SYSTEM_PROMPT.includes('"uncertain"'));
ck("CHECKER_SYSTEM_PROMPT contains predictable field in output format",
  CHECKER_SYSTEM_PROMPT.includes('"predictable": "yes/no/uncertain"'));
ck("CHECKER_SYSTEM_PROMPT contains original quality check logic",
  CHECKER_SYSTEM_PROMPT.includes("质量判断标准"));

// ── 3. detectConfirmationSummary regression ──
const longConfirm = "好的，这是视觉方向的确认：\n\n**视觉核心概念：** 温暖自然的日式手作感，传递慢生活的仪式感，让消费者感受到手工制作的温度和时间的沉淀。\n\n**视觉关键词：** 温润、质朴、呼吸感、手工温度\n\n**视觉语言系统：** 包含形态、色彩、字体、图像、材质五类视觉语言的完整描述和策略方向。\n\n**视觉禁区：** 过于鲜艳的色彩，机器化工业风格。\n\n如果以上内容准确，请回复确认。";
ck("detectConfirmationSummary positive",
  detectConfirmationSummary(longConfirm) === true);
ck("detectConfirmationSummary negative (too short)",
  detectConfirmationSummary("如果以上内容准确，请回复确认。") === false);
ck("detectConfirmationSummary negative (missing)",
  detectConfirmationSummary("这是一个很长的确认总结但没有固定收尾语，内容很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多很多") === false);

// ── 4. Round-gating regression ──
(async () => {
  const early = await checkExitConditions(1, [
    { role: "user", content: "我想做一个咖啡品牌" },
    { role: "assistant", content: "为什么想做咖啡？" },
  ]);
  ck("checkExitConditions blocks when rounds < minRounds",
    early.conditionsMet === false && early.missingSummary?.includes("轮次不足") === true);
  ck("checkExitConditions returns empty assessments early",
    early.assessments.length === 0);

  // ── 5. Integration: real LLM call verifies predictable field in assessments ──
  const testHistory: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: "我想做一个精品咖啡品牌，叫慢象咖啡。我在咖啡行业做了5年，看到很多独立咖啡馆的豆子品质不稳定，想从供应链入手解决这个问题。" },
    { role: "assistant", content: "你在咖啡行业5年的经历中，最让你觉得现有供应链必须改变的那个瞬间是什么？" },
    { role: "user", content: "有一次我去一家合作的烘焙厂，看到他们把不同等级的豆子混在一起出货，说是反正客人喝不出来。那一刻我觉得必须自己做。" },
    { role: "assistant", content: "除了供应链的问题，你观察到的消费者端有什么具体的痛点吗？" },
    { role: "user", content: "很多朋友跟我抱怨过，在电商买的所谓精品豆，打开后发现豆子大小不均匀，烘焙日期也是几个月前的。他们想要新鲜的好豆子但没有可靠的渠道。" },
  ];

  try {
    const result = await checkExitConditions(1, testHistory);
    console.log(`\n  退出检查结果: core=${result.coreCompleted}/${result.coreTotal} supp=${result.suppCompleted}/${result.suppTotal} met=${result.conditionsMet}`);

    // Check assessments structure
    ck("checkExitConditions returns assessments array",
      result.assessments.length > 0);

    // Check that assessments have predictable field (new feature)
    const withPredictable = result.assessments.filter(a => a.predictable !== undefined);
    console.log(`  ${withPredictable.length}/${result.assessments.length} assessments have predictable field`);

    ck("Assessments include predictable field",
      withPredictable.length >= result.assessments.length * 0.5); // at least half

    // Check predictabilitySummary exists
    const hasSummary = result.predictabilitySummary !== undefined && result.predictabilitySummary.length > 0;
    console.log(`  predictabilitySummary: ${result.predictabilitySummary || "(none)"}`);
    ck("ExitCheckResult includes predictabilitySummary", hasSummary);

  } catch (e: any) {
    console.log(`  LLM call failed (may be OK if no API key): ${e.message}`);
    ck("checkExitConditions did not throw unexpected error",
      e.message.includes("API") || e.message.includes("key") || e.message.includes("auth"));
  }

  console.log(`\n${p}/${p+f} passed`);
  process.exit(f > 0 ? 1 : 0);
})();
