/**
 * Source Credibility — 分阶段来源信任权重配置
 *
 * 职责：
 * - 定义四个搜索阶段的来源可信度策略
 * - 作为 Search Service 配置层（不写死在 Prompt 中）
 * - 供 URL Ranking 和 Search Context 调用
 *
 * 注意：此处定义的是来源筛选策略。具体的搜索优先级和覆盖矩阵
 * 定义在 reference/shared-search-protocol.md 中，不在代码中重复。
 */

import type { StageCredibilityConfig, SourceConfig } from "./types";

// ── 通用来源类别 ──────────────────────────────────────

const INDUSTRY_REPORTS: SourceConfig = {
  domainPatterns: [
    "iresearch", "iresearch.cn",     // 艾瑞咨询
    "cbndata",                        // CBNData
    "askci", "askci.com",            // 中商产业研究院
    "qianzhan",                       // 前瞻产业研究院
    "stats.gov.cn",                   // 国家统计局
    "questmobile",
  ],
  trustLevel: "high",
  category: "行业报告/统计数据",
};

const MEDIA_ANALYSIS: SourceConfig = {
  domainPatterns: [
    "36kr.com",
    "iyiou.com",                      // 亿欧网
    "socialbeta.com",
    "digitaling.com",                 // 数英
  ],
  trustLevel: "medium",
  category: "媒体报道/行业分析",
};

const PLATFORM_OFFICIAL: SourceConfig = {
  domainPatterns: [
    "xiaohongshu",                    // 小红书
    "oceanengine.com",                // 巨量引擎
    "weixin.qq.com",                  // 微信公众平台
    "bilibili",                       // B站
    "zhihu.com",
    "tmall.com",
    "jd.com",
  ],
  trustLevel: "medium",
  category: "平台官方/电商",
};

const SOCIAL_CONTENT: SourceConfig = {
  domainPatterns: [
    "weibo.com",
    "douyin.com",
    "kuaishou.com",
  ],
  trustLevel: "low",
  category: "社媒内容",
};

const BRAND_OFFICIAL: SourceConfig = {
  domainPatterns: [
    // 品牌官网匹配由域名推断（不含知名平台域名的即为品牌官网）
  ],
  trustLevel: "medium",
  category: "品牌官网",
};

// ── 分阶段配置 ────────────────────────────────────────

export const STAGE_CREDIBILITY: Record<number, StageCredibilityConfig> = {
  /** S2 商业背景：行业报告 > 媒体分析 > 社媒（不使用） */
  2: {
    stage: 2,
    sources: [INDUSTRY_REPORTS, MEDIA_ANALYSIS],
  },

  /** S3 市场机会：行业报告 > 平台官方 > 媒体 > 社媒（不使用） */
  3: {
    stage: 3,
    sources: [INDUSTRY_REPORTS, PLATFORM_OFFICIAL, MEDIA_ANALYSIS],
  },

  /** S5 竞争判断：品牌官网 > 电商 > 社媒 > 行业报告 > 媒体 */
  5: {
    stage: 5,
    sources: [BRAND_OFFICIAL, PLATFORM_OFFICIAL, SOCIAL_CONTENT, INDUSTRY_REPORTS, MEDIA_ANALYSIS],
  },

  /** S8 内容规划：平台官方 > 媒体 > 社媒 */
  8: {
    stage: 8,
    sources: [PLATFORM_OFFICIAL, MEDIA_ANALYSIS, SOCIAL_CONTENT],
  },
};

/**
 * 根据 URL 域名匹配来源可信度
 * @returns trustLevel + category，无匹配时返回 medium + "未分类来源"
 */
export function classifySource(
  url: string,
  stage: number
): { trustLevel: "high" | "medium" | "low"; category: string } {
  const config = STAGE_CREDIBILITY[stage];
  if (!config) return { trustLevel: "medium", category: "未分类来源" };

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    for (const sourceConfig of config.sources) {
      // 跳过空模式（如 BRAND_OFFICIAL 无预定义域名）
      if (sourceConfig.domainPatterns.length === 0) continue;

      for (const pattern of sourceConfig.domainPatterns) {
        if (hostname.includes(pattern)) {
          return { trustLevel: sourceConfig.trustLevel, category: sourceConfig.category };
        }
      }
    }

    // 无匹配 → 默认 medium（可能是品牌官网等未列举来源）
    return { trustLevel: "medium", category: "未分类来源" };
  } catch {
    return { trustLevel: "medium", category: "无法解析的 URL" };
  }
}

/**
 * 获取某阶段排序后的来源配置（高信任在前）
 */
export function getCredibilityConfig(stage: number): StageCredibilityConfig | undefined {
  return STAGE_CREDIBILITY[stage];
}
