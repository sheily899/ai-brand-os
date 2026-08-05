/**
 * Confirmation Intent Classifier
 *
 * 当阶段处于 waiting_confirm 状态时，分类用户对确认总结的回复意图。
 *
 * 三类意图：
 * - confirm: 用户接受当前阶段结果，触发结构化收敛
 * - modify:  用户接受大方向但需要局部修改，带着修改意见回到咨询
 * - reject:  用户不认可当前总结，需要重新咨询
 */

import { getLLMProvider } from "./provider";

// ── 类型定义 ──────────────────────────────────────────

export type ConfirmationIntent = "confirm" | "modify" | "reject";

export interface IntentClassification {
  intent: ConfirmationIntent;
  /** 分类理由（用于日志） */
  reason: string;
  /** 修改意见（仅 modify 时填充） */
  modificationNotes?: string;
  /** 拒绝的具体原因（仅 reject 时填充） */
  rejectionReason?: string;
}

// ── 评估 System Prompt ───────────────────────────────

const CLASSIFIER_SYSTEM_PROMPT = `你是一个意图分类器。你的唯一职责是判断用户对品牌咨询顾问的确认总结的回复意图。

## 三种意图

### confirm（确认）
用户接受当前阶段的总结内容，可以进入下一阶段。
关键词示例：可以、确认、没问题、就这样、继续、好的、嗯嗯、OK、yes、对、差不多

### modify（修改）
用户基本接受大方向，但需要对部分内容进行调整。
关键词示例：第三点不太对、用户画像应该调整一下、这个定位修改一下、价格策略重新考虑、XX部分改成YY

### reject（拒绝）
用户不认可整体总结，认为方向错误，需要重新分析。
关键词示例：不认可、不是这样的、重新分析、这个方向错了、完全不对、推倒重来、不对

## 分类规则

1. 默认倾向 confirm：除非用户明确指出要修改或拒绝，否则视为 confirm
2. 关键词匹配只是参考，需要理解上下文语义
3. 如果用户同时表达了确认和小的修改意见（如"可以，但第三点改一下"），分类为 modify
4. 如果用户表达了根本性的不同意（如"这个定位完全不是我想的"），分类为 reject
5. 如果用户的修改意见涉及超过 2 个部分的变更，倾向于分类为 reject（而不是逐条修改）

## 输出格式

严格输出 JSON（不含 markdown 代码块）：

{
  "intent": "confirm" | "modify" | "reject",
  "reason": "一句话说明分类理由",
  "modificationNotes": "如果是 modify，提取用户要修改的具体内容；否则为空字符串",
  "rejectionReason": "如果是 reject，说明拒绝的具体原因；否则为空字符串"
}`;

// ── 公开 API ──────────────────────────────────────────

/**
 * 分类用户对确认总结的回复意图。
 *
 * @param userMessage - 用户的最新消息
 * @param confirmationSummary - AI 输出的确认总结（最后一条 assistant 消息）
 * @returns 意图分类结果
 */
export async function classifyConfirmationIntent(
  userMessage: string,
  confirmationSummary: string
): Promise<IntentClassification> {
  // ── 快速路径：强信号关键词直接判定 ──────────────
  const normalized = userMessage.trim();

  // 明确的拒绝关键词
  const strongReject =
    /^(不认可|不是这样|重新(分析|做|来)|完全不对|推倒重来|方向(错|不对)|全盘否定)/i.test(normalized) ||
    /^(不对|错了|不行|no)$/i.test(normalized);

  if (strongReject) {
    return {
      intent: "reject",
      reason: "用户明确表达了否定/拒绝意图",
      rejectionReason: normalized,
    };
  }

  // 明确的确认关键词（短消息）
  const strongConfirm =
    /^(可以|确认|没问题|就这样|继续|好的|嗯嗯|OK|ok|yes|对|差不多|好|行|可以的|没问题|OK的)$/i.test(
      normalized
    );

  if (strongConfirm) {
    return {
      intent: "confirm",
      reason: "用户明确表达了确认意图",
    };
  }

  // 明确包含修改诉求
  const hasModification =
    /改一下|调整一下|修改|换成|应该是|重新考虑|补充.*内容|加上/i.test(normalized);

  if (hasModification && normalized.length < 100) {
    return {
      intent: "modify",
      reason: "用户表达了局部修改意图",
      modificationNotes: normalized,
    };
  }

  // ── LLM 路径：模糊消息需要语义理解 ──────────────
  const userPrompt = `## 确认总结（AI 顾问的输出）

${confirmationSummary.slice(0, 1500)}

## 用户回复

${userMessage}

请分类用户的意图。`;

  const provider = getLLMProvider();
  try {
    const rawOutput = await provider.chat(
      [
        { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.1, maxTokens: 512 }
    );

    // 解析 JSON
    const cleaned = rawOutput
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      intent: (parsed.intent as ConfirmationIntent) ?? "confirm",
      reason: parsed.reason ?? "",
      modificationNotes: parsed.modificationNotes || undefined,
      rejectionReason: parsed.rejectionReason || undefined,
    };
  } catch (e: any) {
    console.error(`[intent-classifier] LLM 调用失败: ${e.message}`);

    // 降级：检查模糊确认信号
    const looksLikeConfirm =
      normalized.length < 20 &&
      !/不|错|改|换|重|reject/i.test(normalized) &&
      /^[一-鿿\w\s，。！？,.!?]+$/.test(normalized);

    return {
      intent: looksLikeConfirm ? "confirm" : "modify",
      reason: `降级判定（LLM 不可用）：${looksLikeConfirm ? "短消息视为确认" : "无法确定，保守视为修改"}`,
    };
  }
}

/**
 * 快速路径检测：判断用户消息是否可能是对确认总结的回复。
 * 用于在 waiting_confirm 状态下决定是否启用意图分类。
 */
export function looksLikeConfirmationResponse(
  userMessage: string,
  status: string
): boolean {
  if (status !== "waiting_confirm") return false;

  // 如果消息中包含总结/收束意愿，应该走 converge 而非意图分类
  const wantsConverge = /总结一下|收束|确认一下|先总结/.test(userMessage);
  if (wantsConverge) return false;

  return true;
}
