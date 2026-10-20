import { z } from "zod";
import { landingPageActionSchema, type LandingPageAction } from "@/lib/landing-page/actions";
import { LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";
import { WIREFRAME_GOALS, wireframeActionIntentSchema, type WireframeActionIntent } from "@/lib/landing-page/wireframe/context";

export const CONVERSION_PAGE_BRIEF_VERSION = 1 as const;

export const BRIEF_TRAFFIC_SOURCES = [
  "GOOGLE_ORGANIC",
  "GOOGLE_ADS",
  "META_ADS",
  "INSTAGRAM",
  "FACEBOOK",
  "WHATSAPP",
  "REFERRAL",
  "DIRECT",
  "EMAIL",
  "OTHER",
  "UNKNOWN",
] as const;

export const BRIEF_BUSINESS_OUTCOMES = ["LEAD", "QUOTE", "APPOINTMENT", "SALE", "REGISTRATION", "CONVERSATION", "OTHER"] as const;

const plainText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[<>]/.test(value) && !/javascript:/i.test(value), { message: "Texto inseguro" });

const optionalPlain = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !value || (!/[<>]/.test(value) && !/javascript:/i.test(value)), { message: "Texto inseguro" })
    .optional();

export const conversionPageBriefSchema = z
  .object({
    version: z.literal(CONVERSION_PAGE_BRIEF_VERSION),
    offer: z
      .object({
        name: plainText(LANDING_PAGE_LIMITS.maxTitle),
        summary: optionalPlain(LANDING_PAGE_LIMITS.maxMediumText),
      })
      .strict(),
    audience: z
      .object({
        description: plainText(LANDING_PAGE_LIMITS.maxMediumText),
        situation: optionalPlain(LANDING_PAGE_LIMITS.maxMediumText),
        awareness: optionalPlain(LANDING_PAGE_LIMITS.maxMediumText),
      })
      .strict(),
    problemOrContext: plainText(LANDING_PAGE_LIMITS.maxMediumText),
    primaryBenefit: plainText(LANDING_PAGE_LIMITS.maxMediumText),
    pageGoal: z.enum(WIREFRAME_GOALS),
    pageGoalDetail: optionalPlain(LANDING_PAGE_LIMITS.maxShortText),
    primaryAction: wireframeActionIntentSchema,
    secondaryAction: wireframeActionIntentSchema.optional(),
    businessOutcome: z.enum(BRIEF_BUSINESS_OUTCOMES),
    businessOutcomeDetail: optionalPlain(LANDING_PAGE_LIMITS.maxShortText),
    objections: z.array(plainText(LANDING_PAGE_LIMITS.maxShortText)).max(8),
    arrivalContext: z
      .object({
        trafficSources: z.array(z.enum(BRIEF_TRAFFIC_SOURCES)).min(1).max(BRIEF_TRAFFIC_SOURCES.length),
        whatVisitorMayAlreadyKnow: optionalPlain(LANDING_PAGE_LIMITS.maxMediumText),
      })
      .strict(),
    notes: optionalPlain(LANDING_PAGE_LIMITS.maxMediumText),
  })
  .strict()
  .superRefine((brief, ctx) => {
    if (brief.pageGoal === "OTHER" && !brief.pageGoalDetail?.trim()) {
      ctx.addIssue({ code: "custom", path: ["pageGoalDetail"], message: "Descreva o objetivo." });
    }
    if (brief.businessOutcome === "OTHER" && !brief.businessOutcomeDetail?.trim()) {
      ctx.addIssue({ code: "custom", path: ["businessOutcomeDetail"], message: "Descreva o resultado esperado." });
    }
    const sources = new Set(brief.arrivalContext.trafficSources);
    if (sources.size !== brief.arrivalContext.trafficSources.length) {
      ctx.addIssue({ code: "custom", path: ["arrivalContext", "trafficSources"], message: "Origem repetida." });
    }
  });

export type ConversionPageBriefV1 = z.infer<typeof conversionPageBriefSchema>;

export function parseConversionPageBrief(input: unknown): { ok: true; brief: ConversionPageBriefV1 } | { ok: false } {
  const parsed = conversionPageBriefSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  return { ok: true, brief: parsed.data };
}

/** Configuração operacional. Intenção sem dados suficientes permanece só no brief. */
export function operationalActionFromIntent(intent: WireframeActionIntent | undefined): LandingPageAction | null {
  if (!intent) return null;
  const parsed = landingPageActionSchema.safeParse(intent);
  return parsed.success ? parsed.data : null;
}

export function conversionOutcomeLabel(brief: ConversionPageBriefV1): string {
  if (brief.businessOutcome === "OTHER") return brief.businessOutcomeDetail?.trim() || "OTHER";
  return brief.businessOutcome;
}

export type ConversionBriefLessonSummary = {
  kind: "conversion-brief-summary";
  landingPageProjectId: string;
  briefVersion: 1;
  offerName: string;
  audienceSummary: string;
  pageGoal: ConversionPageBriefV1["pageGoal"];
  primaryActionType: ConversionPageBriefV1["primaryAction"]["type"];
  businessOutcome: ConversionPageBriefV1["businessOutcome"];
  objectionCount: number;
  completedAt: string;
};

export function conversionBriefLessonSummary(
  landingPageProjectId: string,
  brief: ConversionPageBriefV1,
  completedAt: string,
): ConversionBriefLessonSummary {
  return {
    kind: "conversion-brief-summary",
    landingPageProjectId,
    briefVersion: 1,
    offerName: brief.offer.name,
    audienceSummary: brief.audience.description,
    pageGoal: brief.pageGoal,
    primaryActionType: brief.primaryAction.type,
    businessOutcome: brief.businessOutcome,
    objectionCount: brief.objections.length,
    completedAt,
  };
}

export const conversionBriefResponseSchema = z
  .object({
    kind: z.literal("conversion-brief-summary"),
    landingPageProjectId: z.string().trim().min(1).max(80),
    briefVersion: z.literal(1),
    offerName: z.string().trim().min(1).max(LANDING_PAGE_LIMITS.maxTitle),
    audienceSummary: z.string().trim().min(1).max(LANDING_PAGE_LIMITS.maxMediumText),
    pageGoal: z.enum(WIREFRAME_GOALS),
    primaryActionType: z.enum(["WHATSAPP", "FORM", "EXTERNAL_URL", "INTERNAL_ROUTE", "FORM_ANCHOR"]),
    businessOutcome: z.enum(BRIEF_BUSINESS_OUTCOMES),
    objectionCount: z.number().int().min(0).max(8),
    completedAt: z.string().trim().min(1).max(40),
  })
  .strict();
