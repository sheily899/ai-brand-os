import { z } from "zod";

// ── Stage 7: VisualStrategy ────────────────────────────

/**
 * S7 视觉策略输出 Schema
 *
 * 对应 Stage 7 Convergence Prompt 的 JSON Schema。
 * S7 不依赖搜索，依赖 S6 品牌核心战略。
 * visualDirection 可追溯到 S6 brandPositioning。
 */

// ── 视觉关键词 ─────────────────────────────────────────

export const visualKeywordSchema = z.object({
  /** 感知关键词 */
  keyword: z.string().min(1, "keyword 不能为空"),
  /** 与品牌人格对应的逻辑说明 */
  rationale: z.string().min(4, "rationale 至少 4 个字"),
});

// ── 视觉维度 ───────────────────────────────────────────

export const visualDimensionSchema = z.object({
  /** 方向选择 — 须包含具体视觉方向描述（非纯形容词堆砌） */
  choice: z.string().min(6, "choice 至少 6 个字"),
  /** 应避免的方向 */
  exclusions: z.string().min(2, "exclusions 至少 2 个字"),
  /** 感知基调 — 须体现品牌感知关联 */
  perceptualTone: z.string().min(6, "perceptualTone 至少 6 个字"),
});

export const visualSystemSchema = z.object({
  /** 形态语言 */
  form: visualDimensionSchema,
  /** 色彩语言 */
  color: visualDimensionSchema,
  /** 字体语言 */
  typography: visualDimensionSchema,
  /** 图像语言 */
  imagery: visualDimensionSchema,
  /** 材质语言 */
  material: visualDimensionSchema,
});

// ── 视觉禁区 ───────────────────────────────────────────

export const visualRestrictionSchema = z.object({
  /** 视觉禁区方向 */
  exclusion: z.string().min(4, "exclusion 至少 4 个字"),
  /** 排除的战略理由 */
  strategicRationale: z.string().min(4, "strategicRationale 至少 4 个字"),
});

// ── 组合 Schema ────────────────────────────────────────

export const visualStrategySchema = z.object({
  /** 统领性的一句话视觉核心概念 */
  coreConcept: z.string().min(10, "coreConcept 至少 10 个字"),
  /** 视觉关键词，3-5 个，每个含 rationale */
  keywords: z
    .array(visualKeywordSchema)
    .min(3, "keywords 至少 3 个")
    .max(5, "keywords 最多 5 个"),
  /** 五维度视觉语言系统 */
  visualSystem: visualSystemSchema,
  /** 视觉禁区，至少 3 条 */
  restrictions: z
    .array(visualRestrictionSchema)
    .min(3, "restrictions 至少 3 条"),
});

export type VisualStrategy = z.infer<typeof visualStrategySchema>;
export type VisualKeyword = z.infer<typeof visualKeywordSchema>;
export type VisualDimension = z.infer<typeof visualDimensionSchema>;
export type VisualSystem7 = z.infer<typeof visualSystemSchema>;
export type VisualRestriction = z.infer<typeof visualRestrictionSchema>;
