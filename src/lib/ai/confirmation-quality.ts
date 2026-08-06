/**
 * Confirmation Quality Classifier
 *
 * 在用户回复确认总结（intent = "confirm"）之后，进一步分类确认的质量。
 * 纯确定性规则，不调用 LLM。
 *
 * 四类确认质量：
 * - explicit_yes: 明确确认 → 直接推进
 * - weak_yes:     模糊确认 → 追问一次
 * - delegation:   推给 AI 决定 → 把决策权推回给创始人
 * - exhaustion:   想尽快结束 → 追问一次，再次确认后通过但标记低质量
 */

export type ConfirmationQuality =
  | "explicit_yes"
  | "weak_yes"
  | "delegation"
  | "exhaustion";

export interface QualityResult {
  quality: ConfirmationQuality;
  /** 是否为二次确认（上一次 AI 刚发过质量追问） */
  isRetry: boolean;
}

/** AI 发出的质量追问消息的特征文本（用于判断是否为重试） */
const QUALITY_FOLLOWUP_SIGNATURES = [
  "有没有哪个部分你觉得需要调整的",
  "有没有哪个判断你觉得需要调整的",
  "我需要你来确认——因为这是你的品牌",
];

/**
 * 分类用户确认消息的质量。
 *
 * @param userMessage 用户的最新消息
 * @param lastAssistantMessage 上一条 AI 消息（用于判断是否在重试质量追问后回复）
 */
export function classifyConfirmationQuality(
  userMessage: string,
  lastAssistantMessage?: string
): QualityResult {
  const normalized = userMessage.trim();

  // ── 判断是否为重试 ──────────────────────────────
  const isRetry = lastAssistantMessage
    ? QUALITY_FOLLOWUP_SIGNATURES.some((sig) =>
        lastAssistantMessage.includes(sig)
      )
    : false;

  // ── delegation: 把决策推给 AI ─────────────────────
  // 必须先于其他判断，因为可能同时包含短确认词
  if (
    /你觉得呢|你决定|你来定|你说了算|你觉得行|按你说的|都可以|都行|随便|你看着办|听你的/.test(
      normalized
    )
  ) {
    return { quality: "delegation", isRetry };
  }

  // ── explicit_yes: 明确确认 ────────────────────────
  // 必须在 exhaustion 之前，避免 "好的""行的" 等被误判为想尽快结束

  // 短确认词精确匹配
  if (
    /^(确认|没问题|好的|嗯嗯|OK|ok|yes|对|好|行|可以|没错|准确|正确|是的|就是这样|很准确|非常准确|行的|可以的|没问题)[。！!]?\s*$/i.test(
      normalized
    ) ||
    /^(没问题|完全正确|非常对)/.test(normalized)
  ) {
    return { quality: "explicit_yes", isRetry };
  }

  // ── exhaustion: 想尽快结束 ───────────────────────
  if (
    /^[可好行嗯对](了|的)?[。！!]?\s*$/i.test(normalized) ||
    /^(没问题继续|继续吧|过了|下一个|下一阶段|下一步|可以了|先这样|就这样吧|聊得差不多了)/i.test(
      normalized
    ) ||
    (/^[可好行]/.test(normalized) && normalized.length <= 5)
  ) {
    return { quality: "exhaustion", isRetry };
  }

  // ── weak_yes: 模糊确认 ───────────────────────────
  if (
    /差不多|还行|基本上|大概.*对|应该.*对|可能.*对|大体|大致|整体.*对|大部分.*对/.test(
      normalized
    ) ||
    /^(差不多|还行|基本上|大概|应该|可能)/.test(normalized)
  ) {
    return { quality: "weak_yes", isRetry };
  }

  // "就这样" 独立判断：短消息 = exhaustion，带后续内容 = weak_yes
  if (/^就这样/.test(normalized)) {
    return normalized.length < 10
      ? { quality: "exhaustion", isRetry }
      : { quality: "weak_yes", isRetry };
  }

  // 更长的确认表达（如"理解准确，可以继续"）
  if (
    /确认|没问题|可以继续|没问题.*继续|理解.*准确|描述.*准确|总结.*准确/.test(normalized) &&
    normalized.length < 30
  ) {
    return { quality: "explicit_yes", isRetry };
  }

  // ── 默认 ────────────────────────────────────────
  // 无法匹配任何模式的消息（可能是用户在确认后顺便补充了信息）
  // 保守处理：如果消息很短（< 10 字），视为 explicit_yes
  // 否则视为 weak_yes（可能需要处理用户补充的信息）
  if (normalized.length < 10) {
    return { quality: "explicit_yes", isRetry };
  }
  return { quality: "weak_yes", isRetry };
}

/**
 * 根据确认质量返回处理动作和追问消息。
 */
export function getQualityAction(
  quality: ConfirmationQuality,
  isRetry: boolean
): {
  action: "advance" | "follow_up" | "advance_with_flag";
  message?: string;
  flag?: string;
} {
  switch (quality) {
    case "explicit_yes":
      return { action: "advance" };

    case "weak_yes":
      return {
        action: "follow_up",
        message: "有没有哪个部分你觉得需要调整的？",
      };

    case "delegation":
      return {
        action: "follow_up",
        message:
          "我需要你来确认——因为这是你的品牌。如果暂时不确定，我们可以先标注为待定，在后续阶段回头再确认。",
      };

    case "exhaustion":
      if (isRetry) {
        // 第二次仍然想快速结束 → 通过但标记低质量
        return {
          action: "advance_with_flag",
          flag: "low_quality_confirmation",
        };
      }
      return {
        action: "follow_up",
        message: "有没有哪个判断你觉得需要调整的？如果都 OK，回复确认我们就进入下一步。",
      };
  }
}
