import { z } from "zod";
import { EXPERIENCE_VIEWPORT_IDS } from "@/lib/landing-page/experience/viewports";

export const EXPERIENCE_FINDING_CATEGORIES = [
  "RESPONSIVE",
  "READABILITY",
  "HIERARCHY",
  "ACTION",
  "FORM",
  "MEDIA",
  "CONTENT",
  "NAVIGATION",
  "ACCESSIBILITY",
  "PERFORMANCE_PERCEIVED",
] as const;

export const EXPERIENCE_SEVERITIES = ["INFO", "ATTENTION", "BLOCKER"] as const;

export const EXPERIENCE_FINDING_STATUSES = ["OPEN", "RESOLVED", "DEFERRED", "NOT_APPLICABLE"] as const;

export const EXPERIENCE_SOURCES = ["SYSTEM", "USER"] as const;

export const EXPERIENCE_ACTION_CODES = [
  "REVIEW_COPY",
  "REVIEW_THEME",
  "REVIEW_TRUST",
  "CONFIGURE_ACTION",
  "REVIEW_FORM",
  "REVIEW_MEDIA",
] as const;

export const EXPERIENCE_REVIEW_STATUSES = ["NOT_REVIEWED", "NEEDS_ADJUSTMENTS", "READY_FOR_NEXT_STEP", "STALE"] as const;

export const EXPERIENCE_SCOPES = ["PAGE", "SECTION"] as const;

export type ExperienceFindingCategory = (typeof EXPERIENCE_FINDING_CATEGORIES)[number];
export type ExperienceSeverity = (typeof EXPERIENCE_SEVERITIES)[number];
export type ExperienceFindingStatus = (typeof EXPERIENCE_FINDING_STATUSES)[number];
export type ExperienceSource = (typeof EXPERIENCE_SOURCES)[number];
export type ExperienceActionCode = (typeof EXPERIENCE_ACTION_CODES)[number];
export type ExperienceReviewStatus = (typeof EXPERIENCE_REVIEW_STATUSES)[number];

const line = (max: number) => z.string().trim().min(1).max(max);

export const experienceFindingSchema = z
  .object({
    id: line(120),
    code: line(80),
    category: z.enum(EXPERIENCE_FINDING_CATEGORIES),
    severity: z.enum(EXPERIENCE_SEVERITIES),
    scope: z.enum(EXPERIENCE_SCOPES),
    sectionId: line(64).optional(),
    viewport: z.enum(EXPERIENCE_VIEWPORT_IDS).optional(),
    message: line(400),
    recommendation: line(400),
    source: z.enum(EXPERIENCE_SOURCES),
    status: z.enum(EXPERIENCE_FINDING_STATUSES),
    actionCode: z.enum(EXPERIENCE_ACTION_CODES).optional(),
    deferReason: line(240).optional(),
    platformLimitation: z.boolean().optional(),
  })
  .strict()
  .superRefine((finding, ctx) => {
    if (/[<>]/.test(`${finding.message} ${finding.recommendation} ${finding.deferReason ?? ""}`)) {
      ctx.addIssue({ code: "custom", message: "Use texto simples.", path: ["message"] });
    }
  });

export type ExperienceFindingV1 = z.infer<typeof experienceFindingSchema>;

export const experienceChecklistItemSchema = z
  .object({
    id: line(40),
    label: line(180),
    viewport: z.enum(EXPERIENCE_VIEWPORT_IDS),
    applicable: z.boolean(),
    confirmed: z.boolean(),
  })
  .strict();

export const experienceReviewSummarySchema = z
  .object({
    status: z.enum(["NOT_REVIEWED", "NEEDS_ADJUSTMENTS", "READY_FOR_NEXT_STEP"]),
    headline: z.enum(["Ainda não revisado", "Bloqueios encontrados", "Precisa de ajustes", "Revisado"]),
    openBlockerCount: z.number().int().nonnegative(),
    openAttentionCount: z.number().int().nonnegative(),
    deferredCount: z.number().int().nonnegative(),
  })
  .strict();

export const landingPageExperienceReviewSchema = z
  .object({
    version: z.literal(1),
    reviewedDraftRevision: z.number().int().positive(),
    reviewedViewports: z.array(z.enum(EXPERIENCE_VIEWPORT_IDS)).max(4),
    checklist: z.array(experienceChecklistItemSchema).max(24),
    findings: z.array(experienceFindingSchema).max(80),
    summary: experienceReviewSummarySchema,
  })
  .strict();

export type LandingPageExperienceReviewV1 = z.infer<typeof landingPageExperienceReviewSchema>;

export const landingPageExperienceSummarySchema = z
  .object({
    version: z.literal(1),
    status: z.enum(["NOT_REVIEWED", "NEEDS_ADJUSTMENTS", "READY_FOR_NEXT_STEP"]),
    reviewedDraftRevision: z.number().int().positive(),
    reviewedViewports: z.array(z.enum(EXPERIENCE_VIEWPORT_IDS)).max(4),
    openBlockerCount: z.number().int().nonnegative(),
    openAttentionCount: z.number().int().nonnegative(),
    deferredCount: z.number().int().nonnegative().optional(),
    userFindingCount: z.number().int().nonnegative().optional(),
  })
  .strict();

export type LandingPageExperienceSummaryV1 = z.infer<typeof landingPageExperienceSummarySchema>;

export const EXPERIENCE_CAPABILITIES_V1 = {
  formsFunctional: true,
  publicationAvailable: true,
  measurementAvailable: true,
} as const;

export type ExperienceCapabilities = {
  formsFunctional: boolean;
  publicationAvailable: boolean;
  measurementAvailable: boolean;
};
