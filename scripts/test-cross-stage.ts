/**
 * Task 3.3 Cross Stage Context Check smoke test
 *
 * Validates:
 * 1. Layer A: checkReferenceIntegrityLight (no DB)
 * 2. Layer B: buildSemanticCheckPrompt generation
 * 3. audit-engine integration (skip DB path)
 *
 * Run: npx tsx scripts/test-cross-stage.ts
 */

import {
  checkReferenceIntegrityLight,
  buildSemanticCheckPrompt,
} from "../src/lib/audit/cross-stage";
import { runStageAudit, canAdvance, needsReoptimize, isBlocked } from "../src/lib/audit/audit-engine";

let passed = 0;
let failed = 0;
const queue: Promise<void>[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  queue.push(
    (async () => {
      try {
        await fn();
        passed++;
        console.log(`  [PASS] ${name}`);
      } catch (e: any) {
        failed++;
        console.log(`  [FAIL] ${name}: ${e.message}`);
      }
    })()
  );
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

console.log("\n=== Task 3.3 Cross Stage Context Check Smoke Test ===\n");

// --- Layer A: Light Reference Check ---
console.log("Layer A: Reference Integrity (Light)");

test("S6 reasoning all traced -> no issues", () => {
  const output = {
    reasoning: {
      marketOpportunityReference: "引用自 S3 marketOverview: 精品咖啡市场年增速 15%，线上渠道占比持续提升",
      consumerInsightReference: "引用自 S4 deepNeeds.identityNeed: 消费者希望通过咖啡消费表达精致生活态度",
      competitiveGapReference: "引用自 S5 competitiveGap.marketOpportunity: 现有品牌在体验感和社区归属感方面存在明显缺口",
    },
  };
  const issues = checkReferenceIntegrityLight(6, output);
  assert(issues.length === 0, `Expected 0 issues, got ${issues.length}: ${JSON.stringify(issues)}`);
});

test("S6 reasoning all untraceable -> 3 errors", () => {
  const output = {
    reasoning: {
      marketOpportunityReference: "未追溯到前序数据——该定位要素可能为AI独立推断，需人工复核",
      consumerInsightReference: "未追溯到前序数据",
      competitiveGapReference: "未追溯",
    },
  };
  const issues = checkReferenceIntegrityLight(6, output);
  assert(issues.length === 3, `Expected 3 issues, got ${issues.length}`);
  assert(
    issues.every((i) => i.severity === "error"),
    "All should be severity=error"
  );
  assert(
    issues.some((i) => i.upstreamField === "opportunityDirections"),
    "Should flag S3 reference"
  );
  assert(
    issues.some((i) => i.upstreamField === "deepNeeds.identityNeed"),
    "Should flag S4 reference"
  );
  assert(
    issues.some((i) => i.upstreamField === "competitiveGap.marketOpportunity"),
    "Should flag S5 reference"
  );
});

test("S6 reasoning partial trace -> partial errors", () => {
  const output = {
    reasoning: {
      marketOpportunityReference: "引用自 S3: valid data here enough length",
      consumerInsightReference: "未追溯",
      competitiveGapReference: "valid reference to S5 data with sufficient length",
    },
  };
  const issues = checkReferenceIntegrityLight(6, output);
  assert(issues.length === 1, `Expected 1 issue, got ${issues.length}`);
  assert(issues[0].upstreamField === "deepNeeds.identityNeed", "Should flag S4 only");
});

test("S6 reasoning empty strings -> errors", () => {
  const output = {
    reasoning: {
      marketOpportunityReference: "",
      consumerInsightReference: "short",
      competitiveGapReference: "valid reference with enough content here",
    },
  };
  const issues = checkReferenceIntegrityLight(6, output);
  // "" is empty, "short" is < 10 chars -> both errors
  assert(issues.length === 2, `Expected 2 issues, got ${issues.length}`);
});

test("S1 (no upstream) -> no issues", () => {
  const output = { founderMotivation: { content: "test" } };
  const issues = checkReferenceIntegrityLight(1, output);
  assert(issues.length === 0, "S1 has no upstream dependencies");
});

// --- Layer B: Prompt Generation ---
console.log("\nLayer B: Semantic Check Prompt");

test("S6 with upstream context -> non-empty prompt", () => {
  const context = "### 已确认事实\n- [S3] 精品咖啡市场年增速15%\n### 已确认决策\n- [S4] 消费者身份认同: 精致生活表达";
  const prompt = buildSemanticCheckPrompt(6, context);
  assert(prompt.length > 100, `Prompt should be substantial, got ${prompt.length} chars`);
  assert(prompt.includes("跨阶段语义连贯性"), "Should mention cross-stage semantics");
  assert(prompt.includes("crossStageSemantics"), "Should mention output field");
  assert(prompt.includes("S3"), "Should reference S3");
  assert(prompt.includes("S4"), "Should reference S4");
  assert(prompt.includes("S5"), "Should reference S5");
});

test("S1 (no deps) -> empty prompt", () => {
  const prompt = buildSemanticCheckPrompt(1, "some context");
  assert(prompt === "", "S1 has no dependencies, prompt should be empty");
});

test("empty context -> empty prompt", () => {
  const prompt = buildSemanticCheckPrompt(6, "");
  assert(prompt === "", "Empty context should yield empty prompt");
});

// --- audit-engine integration (skip Cross Stage DB) ---
console.log("\naudit-engine Integration");

test("Rule error + ref error -> block", async () => {
  const emptyOutput = {};
  const report = await runStageAudit("test-project", 6, emptyOutput, {
    skipAI: true,
    skipCrossStage: false,
  });
  // Rule Check: empty output -> error -> block
  assert(report.gateDecision === "block", `Expected block, got ${report.gateDecision}`);
  assert(isBlocked(report), "isBlocked should be true");
});

test("Valid output with ref errors -> reoptimize", async () => {
  const outputWithRefError = {
    positioning: "对于追求品质生活的中产女性而言本品牌是精品咖啡中能够实现日常仪式感的选择",
    valuePropositions: [
      { proposition: "严选全球顶级咖啡豆确保品质", level: "functional", soWhatDerivation: "因为x所以y" },
      { proposition: "带来情感满足和仪式感", level: "emotional", soWhatDerivation: "因为x所以y" },
      { proposition: "彰显品味身份连接", level: "social", soWhatDerivation: "因为x所以y" },
    ],
    brandStory: { struggleMoment: "都市人每天忙于奔波无暇顾及生活品质", brandAction: "创造一个可以慢下来的咖啡空间", brandRelationship: "成为日常生活中的仪式时刻" },
    brandPersonality: [
      { trait: "精致", dos: "注重每一处细节", donts: "绝不粗糙敷衍" },
      { trait: "内敛", dos: "低调表达品质", donts: "不张扬喧哗" },
      { trait: "专业", dos: "严谨品质标准", donts: "不随意妥协" },
      { trait: "温暖", dos: "亲切对待客人", donts: "不冷漠疏远" },
      { trait: "现代", dos: "融合当代审美", donts: "不守旧过时" },
    ],
    reasoning: {
      marketOpportunityReference: "引用自 S3 marketOverview: valid market data reference with enough content",
      consumerInsightReference: "未追溯到前序数据——该定位要素可能为AI独立推断，需人工复核",
      competitiveGapReference: "引用自 S5 competitiveGap: valid competitive gap reference with enough data here",
    },
  };

  const report = await runStageAudit("test-project", 6, outputWithRefError, {
    skipAI: true,
    skipCrossStage: false,
  });

  // Rule Check passes (only 1 of 3 未追溯 -> just warnings, not all-three error)
  // Layer A finds 1 ref error -> reoptimize
  assert(
    report.gateDecision === "reoptimize",
    `Expected reoptimize, got ${report.gateDecision}. RuleCheck passed=${report.ruleCheck.passed}, refIssues=${report.referenceIssues.length}`
  );
  assert(report.referenceIssues.length >= 1, `Expected >=1 ref issue, got ${report.referenceIssues.length}`);
  assert(needsReoptimize(report), "needsReoptimize should be true");
  assert(!canAdvance(report), "canAdvance should be false");
  assert(!isBlocked(report), "isBlocked should be false");
});

test("AuditReport includes crossStage field", async () => {
  const output = {
    positioning: "Valid positioning text here enough length for test",
    valuePropositions: [
      { proposition: "Functional", level: "functional", soWhatDerivation: "x" },
      { proposition: "Emotional", level: "emotional", soWhatDerivation: "y" },
      { proposition: "Social", level: "social", soWhatDerivation: "z" },
    ],
    brandStory: { struggleMoment: "A", brandAction: "B", brandRelationship: "C" },
    brandPersonality: [
      { trait: "A", dos: "do a", donts: "not x" },
      { trait: "B", dos: "do b", donts: "not y" },
      { trait: "C", dos: "do c", donts: "not z" },
      { trait: "D", dos: "do d", donts: "not w" },
      { trait: "E", dos: "do e", donts: "not v" },
    ],
    reasoning: {
      marketOpportunityReference: "Valid reference to S3 market data with sufficient length for test",
      consumerInsightReference: "Valid reference to S4 consumer insight data with sufficient length here",
      competitiveGapReference: "Valid reference to S5 competitive gap data with sufficient length for testing",
    },
  };

  const report = await runStageAudit("test-project", 6, output, {
    skipAI: true,
    skipCrossStage: true,  // skip DB-dependent Layer A
  });

  assert(report.crossStage === null, "crossStage should be null when skipped");
  assert(Array.isArray(report.referenceIssues), "referenceIssues should be array");
  assert(report.gateDecision === "advance", `Expected advance, got ${report.gateDecision}`);
});

// --- Run all ---
async function main() {
  await Promise.all(queue);
  console.log(`\n${"-".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"-".repeat(40)}\n`);
}

main().then(() => process.exit(failed > 0 ? 1 : 0));
