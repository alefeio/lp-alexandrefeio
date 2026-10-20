import { z } from "zod";
import { operationalActionFromIntent, type ConversionPageBriefV1 } from "@/lib/landing-page/brief";
import { LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";
import {
  WIREFRAME_ACTION_TYPES,
  WIREFRAME_LEVELS,
  WIREFRAME_PROCESS_NEEDS,
  WIREFRAME_PROOF_SITUATIONS,
  type WireframeActionIntent,
} from "@/lib/landing-page/wireframe/context";

export const VISITOR_DECISION_JOURNEY_VERSION = 1 as const;

export const AWARENESS_LEVELS = [
  "LITTLE_OR_NOTHING",
  "KNOWS_THE_PROBLEM",
  "KNOWS_THE_SOLUTION",
  "KNOWS_THE_OFFER",
  "READY_TO_ACT",
  "UNKNOWN",
] as const;

export const OBJECTION_CATEGORIES = ["PRICE", "TRUST", "TIMING", "FIT", "PROCESS", "RISK", "LOCATION", "COMPARISON", "OTHER"] as const;
export const OBJECTION_IMPORTANCE = ["LOW", "MEDIUM", "HIGH"] as const;
export const DECISION_STAGE_TYPES = ["ARRIVAL", "UNDERSTAND", "RECOGNIZE_VALUE", "BUILD_TRUST", "RESOLVE_OBJECTION", "ACT"] as const;
export const PREFERRED_CONVERSION_METHODS = ["WHATSAPP", "FORM", "BOOKING", "PURCHASE", "SIGN_UP", "LINK", "OTHER"] as const;

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

export const decisionStageSchema = z
  .object({
    type: z.enum(DECISION_STAGE_TYPES),
    goal: plainText(LANDING_PAGE_LIMITS.maxShortText),
    notes: optionalPlain(LANDING_PAGE_LIMITS.maxMediumText),
  })
  .strict();

export const objectionAnalysisSchema = z
  .object({
    objection: plainText(LANDING_PAGE_LIMITS.maxShortText),
    category: z.enum(OBJECTION_CATEGORIES).optional(),
    importance: z.enum(OBJECTION_IMPORTANCE),
  })
  .strict();

export const visitorDecisionJourneySchema = z
  .object({
    version: z.literal(VISITOR_DECISION_JOURNEY_VERSION),
    awarenessLevel: z.enum(AWARENESS_LEVELS),
    explanationNeed: z.enum(WIREFRAME_LEVELS),
    decisionComplexity: z.enum(WIREFRAME_LEVELS),
    trustNeed: z.enum(WIREFRAME_LEVELS),
    objectionAnalysis: z.array(objectionAnalysisSchema).max(8),
    processNeedsExplanation: z.enum(WIREFRAME_PROCESS_NEEDS),
    proofSituation: z.enum(WIREFRAME_PROOF_SITUATIONS),
    contactImportance: z.enum(WIREFRAME_LEVELS),
    preferredConversionMethod: z.enum(PREFERRED_CONVERSION_METHODS),
    decisionStages: z.array(decisionStageSchema).min(1).max(8),
    notes: optionalPlain(LANDING_PAGE_LIMITS.maxMediumText),
  })
  .strict()
  .superRefine((journey, ctx) => {
    const seen = new Set<string>();
    journey.objectionAnalysis.forEach((item, index) => {
      const key = item.objection.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["objectionAnalysis", index, "objection"], message: "Objeção repetida." });
      }
      seen.add(key);
    });
  });

export type VisitorDecisionJourneyV1 = z.infer<typeof visitorDecisionJourneySchema>;
export type PreferredConversionMethod = (typeof PREFERRED_CONVERSION_METHODS)[number];

export function parseVisitorDecisionJourney(input: unknown): { ok: true; journey: VisitorDecisionJourneyV1 } | { ok: false } {
  const parsed = visitorDecisionJourneySchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  return { ok: true, journey: parsed.data };
}

/** Método pedagógico → tipo operacional do builder. OTHER não troca a ação. */
export function wireframeActionTypeForMethod(
  method: PreferredConversionMethod,
): (typeof WIREFRAME_ACTION_TYPES)[number] | null {
  switch (method) {
    case "WHATSAPP":
      return "WHATSAPP";
    case "FORM":
    case "BOOKING":
    case "SIGN_UP":
      return "FORM";
    case "PURCHASE":
    case "LINK":
      return "EXTERNAL_URL";
    default:
      return null;
  }
}

export function actionChangeNeeded(current: WireframeActionIntent, method: PreferredConversionMethod): boolean {
  const next = wireframeActionTypeForMethod(method);
  if (!next) return false;
  return next !== current.type;
}

export function actionIntentForConfirmedMethod(method: PreferredConversionMethod): WireframeActionIntent | null {
  const type = wireframeActionTypeForMethod(method);
  if (!type) return null;
  if (type === "WHATSAPP") return { type: "WHATSAPP" };
  if (type === "FORM") return { type: "FORM" };
  return { type: "EXTERNAL_URL" };
}

export function syncBriefWithDecisionJourney(
  brief: ConversionPageBriefV1,
  journey: VisitorDecisionJourneyV1,
  confirmActionChange: boolean,
): { ok: true; brief: ConversionPageBriefV1; conversionAction: ReturnType<typeof operationalActionFromIntent> | "keep" } | { ok: false; reason: "confirm" | "invalid" } {
  const change = actionChangeNeeded(brief.primaryAction, journey.preferredConversionMethod);
  if (change && !confirmActionChange) return { ok: false, reason: "confirm" };
  const nextAction = change ? actionIntentForConfirmedMethod(journey.preferredConversionMethod) : null;
  if (change && !nextAction) return { ok: false, reason: "invalid" };
  return {
    ok: true,
    brief: {
      ...brief,
      objections: journey.objectionAnalysis.map((item) => item.objection),
      ...(nextAction ? { primaryAction: nextAction } : {}),
    },
    conversionAction: nextAction ? operationalActionFromIntent(nextAction) : "keep",
  };
}

export type VisitorDecisionLessonSummary = {
  kind: "visitor-decision-summary";
  landingPageProjectId: string;
  decisionJourneyVersion: 1;
  awarenessLevel: VisitorDecisionJourneyV1["awarenessLevel"];
  explanationNeed: VisitorDecisionJourneyV1["explanationNeed"];
  decisionComplexity: VisitorDecisionJourneyV1["decisionComplexity"];
  trustNeed: VisitorDecisionJourneyV1["trustNeed"];
  processNeedsExplanation: VisitorDecisionJourneyV1["processNeedsExplanation"];
  proofSituation: VisitorDecisionJourneyV1["proofSituation"];
  contactImportance: VisitorDecisionJourneyV1["contactImportance"];
  objectionCount: number;
  decisionStageCount: number;
  contextCompleteness: "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT";
  completedAt: string;
};

export function visitorDecisionLessonSummary(
  landingPageProjectId: string,
  journey: VisitorDecisionJourneyV1,
  contextCompleteness: VisitorDecisionLessonSummary["contextCompleteness"],
  completedAt: string,
): VisitorDecisionLessonSummary {
  return {
    kind: "visitor-decision-summary",
    landingPageProjectId,
    decisionJourneyVersion: 1,
    awarenessLevel: journey.awarenessLevel,
    explanationNeed: journey.explanationNeed,
    decisionComplexity: journey.decisionComplexity,
    trustNeed: journey.trustNeed,
    processNeedsExplanation: journey.processNeedsExplanation,
    proofSituation: journey.proofSituation,
    contactImportance: journey.contactImportance,
    objectionCount: journey.objectionAnalysis.length,
    decisionStageCount: journey.decisionStages.length,
    contextCompleteness,
    completedAt,
  };
}

export const visitorDecisionResponseSchema = z
  .object({
    kind: z.literal("visitor-decision-summary"),
    landingPageProjectId: z.string().trim().min(1).max(80),
    decisionJourneyVersion: z.literal(1),
    awarenessLevel: z.enum(AWARENESS_LEVELS),
    explanationNeed: z.enum(WIREFRAME_LEVELS),
    decisionComplexity: z.enum(WIREFRAME_LEVELS),
    trustNeed: z.enum(WIREFRAME_LEVELS),
    processNeedsExplanation: z.enum(WIREFRAME_PROCESS_NEEDS),
    proofSituation: z.enum(WIREFRAME_PROOF_SITUATIONS),
    contactImportance: z.enum(WIREFRAME_LEVELS),
    objectionCount: z.number().int().min(0).max(8),
    decisionStageCount: z.number().int().min(1).max(8),
    contextCompleteness: z.enum(["SUFFICIENT", "PARTIAL", "INSUFFICIENT"]),
    completedAt: z.string().trim().min(1).max(40),
  })
  .strict();
