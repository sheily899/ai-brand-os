/**
 * Task 3.4 Quality Gate smoke test
 *
 * Validates:
 * 1. Three-way gate decision (advance / reoptimize / block)
 * 2. Decision merge logic: Rule errors > Layer A ref errors > AI Audit score
 * 3. AuditReport contains all required fields for gate integration
 * 4. reoptimize vs block distinction
 *
 * Run: npx tsx scripts/test-quality-gate.ts
 */

import { runStageAudit, canAdvance, needsReoptimize, isBlocked } from "../src/lib/audit/audit-engine";
import type { AuditReport } from "../src/lib/audit/audit-engine";

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

console.log("\n=== Task 3.4 Quality Gate Smoke Test ===\n");

// --- Three-way gate decision: block ---
console.log("Gate Decision: block");

test("empty output -> Rule Check error -> block", async () => {
  const report = await runStageAudit("test-project", 6, {}, {
    skipAI: true,
    skipCrossStage: true,
  });
  assert(report.gateDecision === "block", `Expected block, got ${report.gateDecision}`);
  assert(isBlocked(report), "isBlocked should be true");
  assert(!canAdvance(report), "canAdvance should be false");
  assert(!needsReoptimize(report), "needsReoptimize should be false (block > reoptimize)");
});

test("S6 conflicting output -> Rule Check error -> block", async () => {
  const conflictingOutput = {
    positioning: "高端轻奢定位文字填充至少十五字",
    valuePropositions: [
      { proposition: "极致性价比便宜实惠划算好用", level: "functional", soWhatDerivation: "因为x" },
      { proposition: "情感价值", level: "emotional", soWhatDerivation: "因为y" },
      { proposition: "社会价值", level: "social", soWhatDerivation: "因为z" },
    ],
    brandStory: { struggleMoment: "a", brandAction: "b", brandRelationship: "c" },
    brandPersonality: [
      { trait: "大胆前卫", dos: "打破常规", donts: "避免保守" },
      { trait: "沉稳内敛", dos: "深思熟虑", donts: "避免张扬" },
    ],
    reasoning: {
      marketOpportunityReference: "未追溯",
      consumerInsightReference: "未追溯",
      competitiveGapReference: "未追溯",
    },
  };

  const report = await runStageAudit("test-project", 6, conflictingOutput, {
    skipAI: true,
    skipCrossStage: true,
  });
  assert(report.gateDecision === "block", `Expected block, got ${report.gateDecision}`);
  assert(report.ruleCheck.issues.length > 0, "Should have Rule Check issues");
  // brandPersonality conflict (bold+restrained) should be detected
  const personalityConflicts = report.ruleCheck.issues.filter(
    (i) => i.field === "brandPersonality" || i.message.includes("品牌人格")
  );
  assert(personalityConflicts.length > 0, "Should detect brandPersonality conflict");
});

// --- Three-way gate decision: reoptimize ---
console.log("\nGate Decision: reoptimize");

test("valid output + Layer A ref error -> reoptimize", async () => {
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

  assert(report.gateDecision === "reoptimize", `Expected reoptimize, got ${report.gateDecision}`);
  assert(needsReoptimize(report), "needsReoptimize should be true");
  assert(!canAdvance(report), "canAdvance should be false");
  assert(!isBlocked(report), "isBlocked should be false (reoptimize != block)");
  assert(report.referenceIssues.length >= 1, "Should have reference issues");
});

test("reoptimize vs block distinction verified", async () => {
  // Block: Rule Check errors (structural issues)
  const blockReport = await runStageAudit("test-project", 6, {}, {
    skipAI: true,
    skipCrossStage: true,
  });
  assert(blockReport.gateDecision === "block", "Empty output should be block");

  // Reoptimize: passes Rule Check but has ref errors
  const validWithRefError = {
    positioning: "Valid positioning text here for test purposes with enough chars",
    valuePropositions: [
      { proposition: "Func", level: "functional", soWhatDerivation: "x" },
      { proposition: "Emo", level: "emotional", soWhatDerivation: "y" },
      { proposition: "Soc", level: "social", soWhatDerivation: "z" },
    ],
    brandStory: { struggleMoment: "A", brandAction: "B", brandRelationship: "C" },
    brandPersonality: [
      { trait: "A", dos: "a", donts: "not a" },
      { trait: "B", dos: "b", donts: "not b" },
      { trait: "C", dos: "c", donts: "not c" },
      { trait: "D", dos: "d", donts: "not d" },
      { trait: "E", dos: "e", donts: "not e" },
    ],
    reasoning: {
      marketOpportunityReference: "Valid reference to S3 market data with sufficient length",
      consumerInsightReference: "Valid reference to S4 consumer insight data with sufficient length here",
      competitiveGapReference: "未追溯",  // only 1 of 3 untraceable -> passes Rule Check, fails Layer A -> reoptimize
    },
  };

  const reoptReport = await runStageAudit("test-project", 6, validWithRefError, {
    skipAI: true,
    skipCrossStage: false,
  });

  assert(reoptReport.gateDecision === "reoptimize", `Expected reoptimize, got ${reoptReport.gateDecision}`);
  // Verify the distinction: block is structural, reoptimize is quality/cross-stage
  assert(blockReport.gateDecision !== reoptReport.gateDecision,
    "block and reoptimize must be distinct decisions");
});

// --- Three-way gate decision: advance ---
console.log("\nGate Decision: advance");

test("valid S6 output + no ref errors -> advance", async () => {
  const validOutput = {
    positioning: "For quality-conscious urbanites this brand offers daily ritual through specialty coffee",
    valuePropositions: [
      { proposition: "Functional value proposition text", level: "functional", soWhatDerivation: "because x" },
      { proposition: "Emotional value proposition text", level: "emotional", soWhatDerivation: "because y" },
      { proposition: "Social value proposition text", level: "social", soWhatDerivation: "because z" },
    ],
    brandStory: { struggleMoment: "Busy city life description", brandAction: "Create slow moments daily", brandRelationship: "Daily ritual and belonging" },
    brandPersonality: [
      { trait: "Refined", dos: "Attention to detail", donts: "Not rough" },
      { trait: "Understated", dos: "Quiet confidence", donts: "Not loud" },
      { trait: "Professional", dos: "Quality first", donts: "No shortcuts" },
      { trait: "Warm", dos: "Welcoming presence", donts: "Not cold" },
      { trait: "Modern", dos: "Contemporary aesthetic", donts: "Not dated" },
    ],
    reasoning: {
      marketOpportunityReference: "Ref S3: market growing 15% with online channel expansion trends visible",
      consumerInsightReference: "Ref S4: identity expression through daily coffee ritual consumption",
      competitiveGapReference: "Ref S5: experience gap in sense of belonging and community",
    },
  };

  const report = await runStageAudit("test-project", 6, validOutput, {
    skipAI: true,
    skipCrossStage: true,
  });

  assert(report.gateDecision === "advance", `Expected advance, got ${report.gateDecision}`);
  assert(canAdvance(report), "canAdvance should be true");
  assert(!needsReoptimize(report), "needsReoptimize should be false");
  assert(!isBlocked(report), "isBlocked should be false");
});

// --- AuditReport completeness ---
console.log("\nAuditReport Completeness");

test("AuditReport contains all gate-relevant fields", async () => {
  const output = { positioning: "Test positioning with minimum length here" };
  const report = await runStageAudit("test-project", 1, output, {
    skipAI: true,
    skipCrossStage: true,
  });

  // Required fields for gate integration
  assert(typeof report.projectId === "string", "projectId required");
  assert(typeof report.stageNumber === "number", "stageNumber required");
  assert(typeof report.gateDecision === "string", "gateDecision required");
  assert(report.ruleCheck !== undefined, "ruleCheck required");
  assert(Array.isArray(report.referenceIssues), "referenceIssues required");
  assert(typeof report.needsHumanReview === "boolean", "needsHumanReview required");
  assert(report.executedAt instanceof Date, "executedAt required");
  assert(report.allIssues !== undefined, "allIssues required");

  // Gate decision must be one of the three valid values
  assert(
    ["advance", "reoptimize", "block"].includes(report.gateDecision),
    `Invalid gateDecision: ${report.gateDecision}`
  );
});

test("AuditReport allIssues merges correctly", async () => {
  const conflictingOutput = {
    positioning: "高端定位在这里",
    valuePropositions: [
      { proposition: "极致性价比便宜好用实惠划算省钱", level: "functional", soWhatDerivation: "因为x" },
      { proposition: "情感", level: "emotional", soWhatDerivation: "y" },
      { proposition: "社会", level: "social", soWhatDerivation: "z" },
    ],
    brandStory: { struggleMoment: "a", brandAction: "b", brandRelationship: "c" },
    brandPersonality: [
      { trait: "大胆前卫", dos: "打破常规", donts: "不守旧" },
      { trait: "沉稳内敛", dos: "深思熟虑", donts: "不张扬" },
    ],
    reasoning: {
      marketOpportunityReference: "未追溯",
      consumerInsightReference: "未追溯",
      competitiveGapReference: "未追溯",
    },
  };

  const report = await runStageAudit("test-project", 6, conflictingOutput, {
    skipAI: true,
    skipCrossStage: true,
  });

  // allIssues from AI audit is empty (skipAI), but referenceIssues from Rule Check exist
  assert(Array.isArray(report.allIssues), "allIssues should be array");
  assert(report.ruleCheck.issues.length > 0, "Rule Check should have issues");
  assert(report.needsHumanReview === true, "Conflicts should flag needsHumanReview");
});

// --- Run all ---
async function main() {
  await Promise.all(queue);
  console.log(`\n${"-".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"-".repeat(40)}\n`);
}

main().then(() => process.exit(failed > 0 ? 1 : 0));
