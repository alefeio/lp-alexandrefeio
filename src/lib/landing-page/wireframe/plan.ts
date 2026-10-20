import { z } from "zod";
import { GUIDED_WIREFRAME_ENGINE_V1, LANDING_COMPONENT_TYPES } from "@/lib/landing-page/constants";
import {
  WIREFRAME_RATIONALE_CODES,
  WIREFRAME_REASON_CODES,
  WIREFRAME_WARNING_CODES,
} from "@/lib/landing-page/wireframe/copy";

export const WIREFRAME_STRATEGIES = ["FOCUSED", "EXPLANATORY", "TRUST_HEAVY", "CONVERSATIONAL", "BALANCED"] as const;
export const WIREFRAME_CONFIDENCE = ["STRONG", "MODERATE", "LIMITED"] as const;

export const WIREFRAME_SECTION_KEYS = [
  "hero",
  "problem",
  "solution",
  "benefits",
  "process",
  "trust",
  "faq",
  "primary-form",
  "primary-cta",
  "contact",
  "footer",
] as const;

export const wireframePlanSectionSchema = z
  .object({
    key: z.enum(WIREFRAME_SECTION_KEYS),
    type: z.enum(LANDING_COMPONENT_TYPES),
    variant: z.string().trim().min(1).max(40),
    purpose: z.string().trim().min(1).max(240),
    reasonCode: z.enum(WIREFRAME_REASON_CODES),
    reason: z.string().trim().min(1).max(400),
    required: z.boolean(),
    priority: z.number().int().min(1).max(30),
  })
  .strict();

export const wireframePlanSchema = z
  .object({
    version: z.literal(1),
    engineVersion: z.literal(GUIDED_WIREFRAME_ENGINE_V1),
    strategy: z.enum(WIREFRAME_STRATEGIES),
    sections: z.array(wireframePlanSectionSchema).min(1).max(20),
    rationale: z
      .array(
        z
          .object({
            code: z.enum(WIREFRAME_RATIONALE_CODES),
            text: z.string().trim().min(1).max(400),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    warnings: z
      .array(
        z
          .object({
            code: z.enum(WIREFRAME_WARNING_CODES),
            text: z.string().trim().min(1).max(400),
          })
          .strict(),
      )
      .max(8),
    confidence: z.enum(WIREFRAME_CONFIDENCE),
    planFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type WireframePlanV1 = z.infer<typeof wireframePlanSchema>;
export type WireframeStrategy = (typeof WIREFRAME_STRATEGIES)[number];
export type WireframeSectionKey = (typeof WIREFRAME_SECTION_KEYS)[number];
