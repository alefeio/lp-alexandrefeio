import { z } from "zod";
import { LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";
import {
  COPY_INTENTS,
  COPY_MISSING_FACTS,
  COPY_SUGGESTION_SECTION_TYPES,
  COPY_VARIANT_MAX,
  LANDING_PAGE_COPY_PROMPT_V1,
} from "@/lib/landing-page/copy/constants";

const plain = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[<>]|```|javascript:/i.test(value), { message: "Texto com marcação não é aceito." });

export const copySuggestionRequestSchema = z
  .object({
    version: z.literal(1),
    landingPageProjectId: z.string().trim().min(1).max(80),
    sectionId: z.string().trim().min(1).max(64),
    sectionType: z.enum(COPY_SUGGESTION_SECTION_TYPES),
    intent: z.enum(COPY_INTENTS).default("CLEAR"),
    variantCount: z.number().int().min(1).max(COPY_VARIANT_MAX).default(COPY_VARIANT_MAX),
  })
  .strict();

export type CopySuggestionRequestV1 = z.infer<typeof copySuggestionRequestSchema>;

const heroSuggestionSchema = z
  .object({
    eyebrow: plain(LANDING_PAGE_LIMITS.maxEyebrow).optional(),
    headline: plain(LANDING_PAGE_LIMITS.maxHeadline),
    subheadline: plain(LANDING_PAGE_LIMITS.maxSubheadline).optional(),
    primaryCtaLabel: plain(LANDING_PAGE_LIMITS.maxShortText).optional(),
  })
  .strict();

const problemSuggestionSchema = z
  .object({
    heading: plain(LANDING_PAGE_LIMITS.maxHeadline),
    description: plain(LANDING_PAGE_LIMITS.maxMediumText).optional(),
  })
  .strict();

const solutionSuggestionSchema = z
  .object({
    heading: plain(LANDING_PAGE_LIMITS.maxHeadline),
    description: plain(LANDING_PAGE_LIMITS.maxMediumText),
  })
  .strict();

const benefitsSuggestionSchema = z
  .object({
    heading: plain(LANDING_PAGE_LIMITS.maxHeadline).optional(),
    items: z
      .array(
        z
          .object({
            title: plain(LANDING_PAGE_LIMITS.maxShortText),
            description: plain(LANDING_PAGE_LIMITS.maxMediumText),
          })
          .strict(),
      )
      .min(1)
      .max(LANDING_PAGE_LIMITS.maxBenefits),
  })
  .strict();

const ctaSuggestionSchema = z
  .object({
    heading: plain(LANDING_PAGE_LIMITS.maxHeadline),
    description: plain(LANDING_PAGE_LIMITS.maxMediumText).optional(),
    buttonLabel: plain(LANDING_PAGE_LIMITS.maxShortText).optional(),
  })
  .strict();

const formSuggestionSchema = z
  .object({
    heading: plain(LANDING_PAGE_LIMITS.maxHeadline).optional(),
    intro: plain(LANDING_PAGE_LIMITS.maxMediumText).optional(),
    submitLabel: plain(LANDING_PAGE_LIMITS.maxShortText).optional(),
  })
  .strict();

export const copySuggestionContentSchemas = {
  HERO: heroSuggestionSchema,
  PROBLEM: problemSuggestionSchema,
  SOLUTION: solutionSuggestionSchema,
  BENEFITS: benefitsSuggestionSchema,
  CTA: ctaSuggestionSchema,
  FORM: formSuggestionSchema,
} as const;

export const copySuggestionSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    content: z.record(z.string(), z.unknown()),
    rationale: plain(240).optional(),
  })
  .strict();

export const copySuggestionResponseSchema = z
  .object({
    version: z.literal(1),
    promptVersion: z.literal(LANDING_PAGE_COPY_PROMPT_V1),
    sectionId: z.string().trim().min(1).max(64),
    sectionType: z.enum(COPY_SUGGESTION_SECTION_TYPES),
    suggestions: z.array(copySuggestionSchema).max(COPY_VARIANT_MAX),
    warnings: z.array(z.object({ code: z.string().trim().min(1).max(40), text: plain(240) }).strict()).max(8),
    missingFacts: z.array(z.enum(COPY_MISSING_FACTS)).max(8),
  })
  .strict();

export type CopySuggestionResponseV1 = z.infer<typeof copySuggestionResponseSchema>;
