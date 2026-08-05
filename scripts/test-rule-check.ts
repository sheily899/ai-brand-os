/**
 * Task 3.1 Rule Check 烟雾测试
 *
 * 验证逻辑冲突检测和字段一致性检查。
 * 运行: npx tsx scripts/test-rule-check.ts
 */

// 直接内联测试，避免 DB 连接
import { runRuleCheck } from "../src/lib/audit/rule-check";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

console.log("\n📋 Task 3.1 Rule Check 烟雾测试\n");

// ── S6: 高端定位 + 性价比矛盾（应为 error）────────────
console.log("【S6 逻辑冲突】");
test("高端定位+性价比主张 → error", () => {
  const output = {
    positioning: "对于追求品质生活的中产女性而言，本品牌是精品咖啡领域能够实现高端品质享受的选择",
    valuePropositions: [
      { proposition: "性价比极高，实惠好喝", level: "functional", soWhatDerivation: "因为xxx所以xxx" },
      { proposition: "带来情感满足", level: "emotional", soWhatDerivation: "因为xxx所以xxx" },
      { proposition: "彰显品味身份", level: "social", soWhatDerivation: "因为xxx所以xxx" },
    ],
    brandStory: { struggleMoment: "", brandAction: "", brandRelationship: "" },
    brandPersonality: [{ trait: "精致", dos: "注重细节", donts: "不粗糙" }],
    reasoning: {
      marketOpportunityReference: "引用自 S3 marketOverview：精品咖啡市场年增速 15%",
      consumerInsightReference: "引用自 S4 identityNeed：消费者希望展示品味",
      competitiveGapReference: "引用自 S5 competitiveGap：现有品牌差异化不足",
    },
  };
  const result = runRuleCheck(output, undefined, ["positioning", "valuePropositions", "reasoning"], 6);
  const hasError = result.issues.some(
    (i) => i.field.includes("valuePropositions") && i.severity === "error"
  );
  assert(hasError, "应该检测到高端定位与性价比矛盾");
});

test("S6 reasoning 全部未追溯 → error", () => {
  const output = {
    positioning: "对于目标消费者而言的品牌定位陈述文本在这里",
    valuePropositions: [
      { proposition: "功能层面价值主张", level: "functional", soWhatDerivation: "因为xxx所以xxx" },
      { proposition: "情感层面价值主张", level: "emotional", soWhatDerivation: "因为xxx所以xxx" },
      { proposition: "社会层面价值主张", level: "social", soWhatDerivation: "因为xxx所以xxx" },
    ],
    brandStory: { struggleMoment: "", brandAction: "", brandRelationship: "" },
    brandPersonality: [{ trait: "专业", dos: "严谨可靠", donts: "不随意" }],
    reasoning: {
      marketOpportunityReference: "未追溯到前序数据——该定位要素可能为AI独立推断，需人工复核",
      consumerInsightReference: "未追溯到前序数据——该定位要素可能为AI独立推断，需人工复核",
      competitiveGapReference: "未追溯到前序数据——该定位要素可能为AI独立推断，需人工复核",
    },
  };
  const result = runRuleCheck(output, undefined, [], 6);
  const hasError = result.issues.some(
    (i) => i.field === "reasoning" && i.severity === "error"
  );
  assert(hasError, "应该检测到三个引用全部未追溯");
});

test("S6 brandPersonality 矛盾特质 → error", () => {
  const output = {
    positioning: "对于目标消费者而言的品牌定位陈述文本在这里",
    valuePropositions: [
      { proposition: "功能价值", level: "functional", soWhatDerivation: "xxx" },
      { proposition: "情感价值", level: "emotional", soWhatDerivation: "xxx" },
      { proposition: "社会价值", level: "social", soWhatDerivation: "xxx" },
    ],
    brandStory: { struggleMoment: "", brandAction: "", brandRelationship: "" },
    brandPersonality: [
      { trait: "大胆前卫", dos: "敢于突破常规", donts: "不墨守成规" },
      { trait: "沉稳内敛", dos: "深思熟虑", donts: "不张扬浮夸" },
    ],
    reasoning: {
      marketOpportunityReference: "引用自 S3：xxx",
      consumerInsightReference: "引用自 S4：xxx",
      competitiveGapReference: "引用自 S5：xxx",
    },
  };
  const result = runRuleCheck(output, undefined, [], 6);
  const personalityIssues = result.issues.filter(
    (i) => i.field === "brandPersonality" && i.severity === "error"
  );
  assert(personalityIssues.length > 0, `应该检测到品牌人格矛盾，实际 issues: ${JSON.stringify(result.issues)}`);
});

// ── S5: weaknesses 包含比较级词（应为 error）────────────
console.log("\n【S5 逻辑冲突】");
test("竞品 weaknesses 包含比较级词 → error", () => {
  const output = {
    competitiveLandscape: {
      dimensions: [{ type: "传统品牌", coreStrategy: "xxx", consumerNeed: "xxx" }],
      convergenceAndDivergence: "趋同与分化描述文本至少十个字",
    },
    competitors: [{
      name: "品牌A",
      positioning: "大众咖啡",
      priceRange: "中端 15-30元",
      heroProducts: [{ name: "拿铁", sellingPoint: "香浓" }],
      visualSystem: { logo: "信息不足", color: "信息不足", typography: "信息不足", packaging: "信息不足" },
      communication: {
        platforms: ["小红书"],
        contentDirection: ["种草"],
        userPraise: [{ theme: "好喝", excerpt: "味道很好很喜欢每天都要喝" }],
        userComplaints: [{ theme: "贵", excerpt: "价格有点高不如隔壁便宜好喝" }],
      },
      strengths: ["品牌知名度高"],
      weaknesses: ["价格更好，口味不如竞品"],
      opportunityGap: "没有满足健康需求",
      sources: [{ url: "https://example.com", title: "来源", type: "snippet" as const }],
    }],
    competitiveGap: { unmetNeeds: ["健康需求"], marketOpportunity: "市场机会描述至少十个字在这里" },
    dataSources: [{ url: "https://example.com", title: "来源", type: "snippet" as const, summary: "xxx" }],
  };
  const result = runRuleCheck(output, undefined, [], 5);
  const hasError = result.issues.some(
    (i) => i.field.includes("weaknesses") && i.severity === "error"
  );
  assert(hasError, "应该检测到比较级评价词");
});

// ── S4: functionalNeed 包含身份层表述 ─────────────────
console.log("\n【S4 逻辑冲突】");
test("functionalNeed 含身份认同关键词 → warning", () => {
  const output = {
    targetConsumer: {
      definition: "25-35岁都市白领女性，习惯在上班路上买咖啡",
      idealSelfReflection: "希望成为一个懂生活的精致女性",
    },
    existingSolutions: [{
      solutionType: "喝速溶咖啡",
      examples: "雀巢速溶",
      failReason: "口感差且没有仪式感，缺失品质体验，造成将就感",
    }],
    deepNeeds: {
      functionalNeed: "需要一杯能彰显身份和品味的咖啡来获得圈层归属感",
      identityNeed: "消费者希望通过咖啡消费表达自己的精致生活态度",
    },
  };
  const result = runRuleCheck(output, undefined, [], 4);
  const hasWarning = result.issues.some(
    (i) => i.field === "deepNeeds.functionalNeed" && i.severity === "warning"
  );
  assert(hasWarning, `应该检测到 functionalNeed 含身份层表述，实际: ${JSON.stringify(result.issues)}`);
});

// ── S7: 视觉系统冷暖矛盾 ───────────────────────────
console.log("\n【S7 逻辑冲突】");
test("visualSystem 冷暖调共存 → warning", () => {
  const output = {
    coreConcept: "简约而不简单的现代东方美学视觉体系表述",
    keywords: [{ keyword: "简约", rationale: "体现品牌的克制态度" }],
    visualSystem: {
      form: { choice: "简洁线条", exclusions: "复杂", perceptualTone: "冷静理性" },
      color: { choice: "暖色调为主", exclusions: "荧光色", perceptualTone: "温暖亲切" },
      typography: { choice: "无衬线字体", exclusions: "花体", perceptualTone: "现代中性" },
      imagery: { choice: "自然光影", exclusions: "过度修图", perceptualTone: "真实自然" },
      material: { choice: "哑光质感", exclusions: "亮面", perceptualTone: "低调内敛" },
    },
    restrictions: [{ exclusion: "霓虹色", strategicRationale: "不符合克制的品牌调性" }],
  };
  const result = runRuleCheck(output, undefined, [], 7);
  const hasWarning = result.issues.some(
    (i) => i.field === "visualSystem" && i.severity === "warning"
  );
  assert(hasWarning, `应该检测到冷暖调矛盾，实际: ${JSON.stringify(result.issues)}`);
});

// ── 验证正常输出不应误报 ────────────────────────────
console.log("\n【误报验证】");
test("正常 S6 输出不误报", () => {
  const output = {
    positioning: "对于追求品质生活的中产女性而言，本品牌是精品咖啡领域能够实现高端品质享受的选择",
    valuePropositions: [
      { proposition: "严选全球顶级咖啡豆，确保每一杯都达到专业品鉴水准", level: "functional", soWhatDerivation: "因为xxx所以xxx" },
      { proposition: "在忙碌日常中创造片刻宁静与自我对话的仪式感", level: "emotional", soWhatDerivation: "因为xxx所以xxx" },
      { proposition: "成为品味社群的入场券，让消费者与同类人产生归属连接", level: "social", soWhatDerivation: "因为xxx所以xxx" },
    ],
    brandStory: { struggleMoment: "都市人每天忙于奔波", brandAction: "创造一个慢下来的空间", brandRelationship: "成为生活中的仪式时刻" },
    brandPersonality: [
      { trait: "精致", dos: "注重每一个细节", donts: "绝不粗糙敷衍" },
      { trait: "内敛", dos: "低调表达品质", donts: "不张扬喧哗" },
      { trait: "专业", dos: "严谨对待品质", donts: "不随意妥协" },
      { trait: "温暖", dos: "亲切对待客人", donts: "不冷漠疏离" },
      { trait: "现代", dos: "融合当代审美", donts: "不守旧过时" },
    ],
    reasoning: {
      marketOpportunityReference: "引用自 S3 marketOverview.marketSize: 精品咖啡市场年增速 15%",
      consumerInsightReference: "引用自 S4 deepNeeds.identityNeed: 消费者希望通过咖啡消费表达精致生活态度",
      competitiveGapReference: "引用自 S5 competitiveGap.marketOpportunity: 现有品牌在体验感方面存在明显缺口",
    },
  };
  const result = runRuleCheck(output, undefined, [], 6);
  const errors = result.issues.filter((i) => i.severity === "error");
  assert(errors.length === 0, `正常输出不应有 error，实际: ${JSON.stringify(errors)}`);
});

// ── 汇总 ────────────────────────────────────────────
console.log(`\n${"─".repeat(40)}`);
console.log(`结果: ${passed} 通过, ${failed} 失败`);
console.log(`${"─".repeat(40)}\n`);

process.exit(failed > 0 ? 1 : 0);
