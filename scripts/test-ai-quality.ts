/**
 * Task 3.2 AI Quality Audit smoke test
 *
 * Validates:
 * 1. Stage config completeness
 * 2. Gate decision merge logic
 * 3. AuditReport structure
 *
 * Run: npx tsx scripts/test-ai-quality.ts
 */

import { STAGE_AUDIT_CONFIGS } from "../src/lib/audit/ai-quality";
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

console.log("\n=== Task 3.2 AI Quality Audit Smoke Test ===\n");

// --- Stage config validation ---
console.log("Stage Config Completeness");

test("8 stages all configured", () => {
  for (let i = 1; i <= 8; i++) {
    const config = STAGE_AUDIT_CONFIGS[i];
    assert(config !== undefined, `Stage ${i} missing config`);
    assert(config.stageName.length > 0, `Stage ${i} stageName empty`);
    assert(config.objective.length > 0, `Stage ${i} objective empty`);

    const weights = config.weights;
    const totalWeight =
      weights.specificity +
      weights.differentiation +
      weights.actionability +
      weights.evidence;
    assert(
      Math.abs(totalWeight - 1.0) < 0.01,
      `Stage ${i} weight sum = ${totalWeight}, expected 1.0`
    );
  }
});

test("stage weights match spec", () => {
  assert(STAGE_AUDIT_CONFIGS[1].weights.specificity === 0.35, "S1 specificity 35%");
  assert(STAGE_AUDIT_CONFIGS[5].weights.differentiation === 0.40, "S5 differentiation 40%");
  assert(STAGE_AUDIT_CONFIGS[8].weights.actionability === 0.45, "S8 actionability 45%");
  assert(STAGE_AUDIT_CONFIGS[3].weights.evidence === 0.35, "S3 evidence 35%");
});

test("stage thresholds match spec", () => {
  assert(STAGE_AUDIT_CONFIGS[1].advanceThreshold === 70, "S1 advance >=70");
  assert(STAGE_AUDIT_CONFIGS[6].advanceThreshold === 75, "S6 advance >=75");
  assert(STAGE_AUDIT_CONFIGS[7].advanceThreshold === 75, "S7 advance >=75");
  assert(STAGE_AUDIT_CONFIGS[8].advanceThreshold === 70, "S8 advance >=70");
});

// --- audit-engine decision merge ---
console.log("\naudit-engine Decision Merge");

test("rule check fail -> block (skip AI)", async () => {
  const report = await runStageAudit("test-project", 6, {}, { skipAI: true });
  assert(report.gateDecision === "block", `expected block, got ${report.gateDecision}`);
  assert(isBlocked(report), "isBlocked should be true");
  assert(!canAdvance(report), "canAdvance should be false");
});

test("rule check pass + no AI -> advance", async () => {
  const validOutput = {
    positioning: "For quality-conscious urbanites, this brand offers daily ritual through specialty coffee",
    valuePropositions: [
      { proposition: "Functional value", level: "functional", soWhatDerivation: "because x" },
      { proposition: "Emotional value", level: "emotional", soWhatDerivation: "because y" },
      { proposition: "Social value", level: "social", soWhatDerivation: "because z" },
    ],
    brandStory: { struggleMoment: "Busy city life", brandAction: "Create slow moments", brandRelationship: "Ritual" },
    brandPersonality: [
      { trait: "Refined", dos: "Attention to detail", donts: "Not rough" },
      { trait: "Understated", dos: "Quiet confidence", donts: "Not loud" },
      { trait: "Professional", dos: "Quality first", donts: "No shortcuts" },
      { trait: "Warm", dos: "Welcoming", donts: "Not cold" },
      { trait: "Modern", dos: "Contemporary", donts: "Not dated" },
    ],
    reasoning: {
      marketOpportunityReference: "Ref S3: market growing 15%",
      consumerInsightReference: "Ref S4: identity expression",
      competitiveGapReference: "Ref S5: experience gap",
    },
  };

  const report = await runStageAudit("test-project", 6, validOutput, { skipAI: true });
  assert(report.gateDecision === "advance", `expected advance, got ${report.gateDecision}`);
  assert(canAdvance(report), "canAdvance should be true");
  assert(!needsReoptimize(report), "needsReoptimize should be false");
  assert(!isBlocked(report), "isBlocked should be false");
});

test("AuditReport structure integrity", async () => {
  const output = { positioning: "Test positioning text with minimum length" };
  const report = await runStageAudit("test-project", 1, output, { skipAI: true });

  assert(typeof report.projectId === "string", "projectId is string");
  assert(typeof report.stageNumber === "number", "stageNumber is number");
  assert(report.ruleCheck !== undefined, "ruleCheck exists");
  assert(Array.isArray(report.allIssues), "allIssues is array");
  assert(typeof report.needsHumanReview === "boolean", "needsHumanReview is boolean");
  assert(report.executedAt instanceof Date, "executedAt is Date");
});

test("conflicting output -> needsHumanReview", async () => {
  const conflictingOutput = {
    positioning: "对于高端轻奢消费者而言的奢侈品牌定位在这里文字至少十五字",
    valuePropositions: [
      { proposition: "性价比极高实惠好用便宜划算", level: "functional", soWhatDerivation: "因为x" },
      { proposition: "情感价值", level: "emotional", soWhatDerivation: "因为y" },
      { proposition: "社会价值", level: "social", soWhatDerivation: "因为z" },
    ],
    brandStory: { struggleMoment: "", brandAction: "", brandRelationship: "" },
    brandPersonality: [
      { trait: "大胆前卫", dos: "打破常规", donts: "不守旧" },
      { trait: "沉稳内敛", dos: "深思熟虑", donts: "不张扬" },
    ],
    reasoning: {
      marketOpportunityReference: "未追溯到前序数据——可能为AI独立推断",
      consumerInsightReference: "未追溯到前序数据——可能为AI独立推断",
      competitiveGapReference: "未追溯到前序数据——可能为AI独立推断",
    },
  };

  const report = await runStageAudit("test-project", 6, conflictingOutput, { skipAI: true });
  assert(report.needsHumanReview === true, "conflicts should flag needsHumanReview");
  assert(report.ruleCheck.issues.length > 0, "should have rule check issues");
});

// --- Run all and report ---
async function main() {
await Promise.all(queue);
console.log(`\n${"-".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"-".repeat(40)}\n`);
}

main().then(() => process.exit(failed > 0 ? 1 : 0));
