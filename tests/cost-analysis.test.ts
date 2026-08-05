/**
 * 成本分析单元测试 — identifyRedundancy()
 *
 * 运行: npx tsx tests/cost-analysis.test.ts
 *
 * 验证冗余识别规则：
 * - systemRatio > 60% → large_system_prompt flag
 * - conversationRatio > 70% → high_conversation_ratio flag
 * - consultation calls > 10 + systemRatio > 50% → duplicate_injection flag
 */

import { identifyRedundancy } from "@/lib/ai/redundancy-detector";
import type { PromptOverhead, StageCost } from "@/lib/ai/cost-analysis";

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function makeOverhead(overrides: Partial<PromptOverhead> = {}): PromptOverhead {
  return {
    stageNumber: 3,
    callType: "consultation",
    systemRatio: 40,
    conversationRatio: 50,
    avgSystemPromptTokens: 2000,
    avgConversationTokens: 2500,
    avgInputTokens: 5000,
    sampleCount: 5,
    ...overrides,
  };
}

function makeStageCost(stageNumber: number, calls: number, callType = "consultation"): StageCost {
  return {
    stageNumber,
    totalCalls: calls,
    totalInputTokens: calls * 5000,
    totalOutputTokens: calls * 1000,
    totalTokens: calls * 6000,
    avgTokensPerCall: 6000,
    breakdown: [
      {
        callType,
        calls,
        inputTokens: calls * 5000,
        outputTokens: calls * 1000,
        totalTokens: calls * 6000,
      },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────

console.log("\n成本分析 identifyRedundancy 单元测试\n");

// Test 1: no thresholds exceeded
(() => {
  const overheads = [makeOverhead({ systemRatio: 40, conversationRatio: 50 })];
  const stages = [makeStageCost(3, 5)];
  const flags = identifyRedundancy(overheads, stages);
  assert(flags.length === 0, "无阈值超限时返回空数组");
})();

// Test 2: large_system_prompt when systemRatio > 60%
(() => {
  const overheads = [makeOverhead({ stageNumber: 4, callType: "audit", systemRatio: 75, sampleCount: 3 })];
  const flags = identifyRedundancy(overheads, []);
  const sysFlag = flags.find((f) => f.type === "large_system_prompt");
  assert(sysFlag != null, "systemRatio > 60% 时标记 large_system_prompt");
  assert(sysFlag!.stageNumber === 4, "正确记录 stageNumber");
  assert(sysFlag!.callType === "audit", "正确记录 callType");
  assert(sysFlag!.severity === "medium", "systemRatio 75% → severity = medium");
})();

// Test 3: large_system_prompt as high severity when > 80%
(() => {
  const overheads = [makeOverhead({ systemRatio: 85, sampleCount: 3 })];
  const flags = identifyRedundancy(overheads, []);
  const sysFlag = flags.find((f) => f.type === "large_system_prompt");
  assert(sysFlag!.severity === "high", "systemRatio > 80% → severity = high");
})();

// Test 4: insufficient samples → no flag
(() => {
  const overheads = [makeOverhead({ systemRatio: 75, sampleCount: 1 })];
  const flags = identifyRedundancy(overheads, []);
  assert(flags.length === 0, "样本不足时不标记 (sampleCount=1)");
})();

// Test 5: high_conversation_ratio
(() => {
  const overheads = [makeOverhead({ conversationRatio: 80, sampleCount: 5 })];
  const flags = identifyRedundancy(overheads, []);
  const convoFlag = flags.find((f) => f.type === "high_conversation_ratio");
  assert(convoFlag != null, "conversationRatio > 70% 时标记 high_conversation_ratio");
  assert(convoFlag!.severity === "medium", "conversationRatio 80% → severity = medium");
})();

// Test 6: high_conversation_ratio as high severity
(() => {
  const overheads = [makeOverhead({ conversationRatio: 90, sampleCount: 5 })];
  const flags = identifyRedundancy(overheads, []);
  const convoFlag = flags.find((f) => f.type === "high_conversation_ratio");
  assert(convoFlag!.severity === "high", "conversationRatio > 85% → severity = high");
})();

// Test 7: duplicate_injection
(() => {
  const overheads = [makeOverhead({ stageNumber: 3, callType: "consultation", systemRatio: 55, sampleCount: 15 })];
  const stages = [makeStageCost(3, 15, "consultation")];
  const flags = identifyRedundancy(overheads, stages);
  const dupFlag = flags.find((f) => f.type === "duplicate_injection");
  assert(dupFlag != null, "consultation > 10 + systemRatio > 50% → duplicate_injection");
  assert(dupFlag!.stageNumber === 3, "正确记录 stageNumber");
})();

// Test 8: no duplicate_injection when calls <= 10
(() => {
  const overheads = [makeOverhead({ systemRatio: 55 })];
  const stages = [makeStageCost(3, 10, "consultation")];
  const flags = identifyRedundancy(overheads, stages);
  const dupFlag = flags.find((f) => f.type === "duplicate_injection");
  assert(dupFlag == null, "calls <= 10 时不标记 duplicate_injection");
})();

// Test 9: no duplicate_injection when systemRatio <= 50%
(() => {
  const overheads = [makeOverhead({ systemRatio: 45 })];
  const stages = [makeStageCost(3, 15, "consultation")];
  const flags = identifyRedundancy(overheads, stages);
  const dupFlag = flags.find((f) => f.type === "duplicate_injection");
  assert(dupFlag == null, "systemRatio <= 50% 时不标记 duplicate_injection");
})();

// Test 10: multiple flags coexist
(() => {
  const overheads = [makeOverhead({ stageNumber: 3, callType: "consultation", systemRatio: 75, conversationRatio: 80, sampleCount: 15 })];
  const stages = [makeStageCost(3, 15, "consultation")];
  const flags = identifyRedundancy(overheads, stages);
  const types = new Set(flags.map((f) => f.type));
  assert(types.has("large_system_prompt"), "multiple flags: large_system_prompt");
  assert(types.has("high_conversation_ratio"), "multiple flags: high_conversation_ratio");
  assert(types.has("duplicate_injection"), "multiple flags: duplicate_injection");
})();

// ── Summary ──────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  process.exit(1);
}
