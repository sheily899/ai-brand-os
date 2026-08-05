/**
 * Redundancy Detector — 纯函数，识别 Token 消耗中的冗余模式
 *
 * 职责：
 * - 分析 Prompt 结构开销（systemRatio, conversationRatio）
 * - 识别成本优化机会（System Prompt 过大、历史对话冗余、重复注入）
 * - 纯计算逻辑，无 I/O 依赖，可直接单元测试
 */

import type { StageCost, PromptOverhead, RedundancyFlag } from "@/lib/ai/cost-analysis";

// Re-export types for convenience
export type { StageCost, PromptOverhead, RedundancyFlag } from "@/lib/ai/cost-analysis";

/**
 * 自动识别成本优化机会。
 *
 * 规则：
 * 1. systemRatio > 60% → system prompt 占比过大，可能包含冗余固定内容
 * 2. conversationRatio > 70% → 对话历史过长，可能需要截断
 * 3. systemRatio > 50% AND 同 stage 的 consultation calls > 10 → 重复注入
 */
export function identifyRedundancy(
  overheads: PromptOverhead[],
  stageCosts: StageCost[],
): RedundancyFlag[] {
  const flags: RedundancyFlag[] = [];

  for (const oh of overheads) {
    // 规则 1：系统 Prompt 占比过高
    if (oh.systemRatio > 60 && oh.sampleCount >= 2) {
      flags.push({
        type: "large_system_prompt",
        severity: oh.systemRatio > 80 ? "high" : "medium",
        stageNumber: oh.stageNumber,
        callType: oh.callType,
        detail: `Stage ${oh.stageNumber} ${oh.callType} 的 system prompt 占 input 的 ${oh.systemRatio}%（平均 ${oh.avgSystemPromptTokens} tokens）。系统指令/搜索协议/方法论等固定内容占比偏高。`,
        estimatedSavingPct: Math.round((oh.systemRatio - 40) * 0.5),
        recommendation: `考虑将固定方法论内容拆分到可缓存前缀，或精简 Stage ${oh.stageNumber} ${oh.callType} 的 prompt 模板。`,
      });
    }

    // 规则 2：对话历史过长
    if (oh.conversationRatio > 70 && oh.sampleCount >= 3) {
      flags.push({
        type: "high_conversation_ratio",
        severity: oh.conversationRatio > 85 ? "high" : "medium",
        stageNumber: oh.stageNumber,
        callType: oh.callType,
        detail: `Stage ${oh.stageNumber} ${oh.callType} 的对话历史占 input 的 ${oh.conversationRatio}%（平均 ${oh.avgConversationTokens} tokens）。多轮对话累积导致上下文膨胀。`,
        estimatedSavingPct: Math.round((oh.conversationRatio - 60) * 0.3),
        recommendation: `建议对 Stage ${oh.stageNumber} 对话历史做滑动窗口截断（保留最近 N 轮），或使用摘要压缩早期对话。`,
      });
    }
  }

  // 规则 3：同 stage consultation 重复注入
  for (const sc of stageCosts) {
    const consultationBreakdown = sc.breakdown.find((b) => b.callType === "consultation");
    if (consultationBreakdown && consultationBreakdown.calls > 10) {
      const stageOverhead = overheads.find(
        (oh) => oh.stageNumber === sc.stageNumber && oh.callType === "consultation",
      );
      if (stageOverhead && stageOverhead.systemRatio > 50) {
        flags.push({
          type: "duplicate_injection",
          severity: "medium",
          stageNumber: sc.stageNumber,
          callType: "consultation",
          detail: `Stage ${sc.stageNumber} 的 consultation 共 ${consultationBreakdown.calls} 次调用，system prompt 平均占 ${stageOverhead.systemRatio}%。每轮都重复注入搜索协议和 Decision Memory，累积浪费显著。`,
          estimatedSavingPct: Math.round(stageOverhead.systemRatio * 0.3),
          recommendation: `将搜索协议和 Decision Memory 移动到可缓存前缀，避免每轮都完整发送。${consultationBreakdown.calls} 轮 × ${stageOverhead.avgSystemPromptTokens} tokens = ${(consultationBreakdown.calls * stageOverhead.avgSystemPromptTokens).toLocaleString()} tokens 潜在节省。`,
        });
      }
    }
  }

  return flags;
}
