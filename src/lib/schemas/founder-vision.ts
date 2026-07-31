import { z } from "zod";

// ── Stage 1: FounderVision ────────────────────────────

export const founderTypeEnum = z.enum(["problem_driven", "creation_driven"]);

export const founderMotivationSchema = z.object({
  content: z.string().min(10, "founderMotivation.content 必须至少 10 个字"),
  source: z.literal("founder_statement"),
});

export const observationSchema = z.object({
  subject: z.string().min(1, "subject 不能为空"),
  context: z.string().min(1, "context 不能为空"),
  behavior: z.string().min(1, "behavior 不能为空"),
  result: z.string().min(1, "result 不能为空"),
  source: z.literal("founder_observation"),
});

export const constraintsSchema = z.object({
  budget: z.string().default(""),
  team: z.string().default(""),
  timeline: z.string().default(""),
});

export const founderVisionSchema = z.object({
  founderType: founderTypeEnum,
  founderMotivation: founderMotivationSchema,
  observations: z
    .array(observationSchema)
    .min(1, "observations 至少 1 条"),
  confirmedProblems: z.array(z.string()),
  constraints: constraintsSchema,
});

export type FounderVision = z.infer<typeof founderVisionSchema>;
export type FounderType = z.infer<typeof founderTypeEnum>;
export type Observation = z.infer<typeof observationSchema>;
