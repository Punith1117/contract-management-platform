import { z } from "zod";

export const LLMAnalysisSchema = z.object({
  recommendationConfidence: z.number().min(0.0).max(1.0),
  recommendationReason: z.string().min(5),
});

export type LLMAnalysisOutput = z.infer<typeof LLMAnalysisSchema>;

export const AIRecommendationSchema = z.object({
  recommended: z.boolean(),
  recommendationScore: z.number().min(0.0).max(1.0),
  recommendationConfidence: z.number().min(0.0).max(1.0),
  recommendationReason: z.string().min(5),
  recommendationVersion: z.string().default("v1.0"),
});

export type AIRecommendationOutput = z.infer<typeof AIRecommendationSchema>;

