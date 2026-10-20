import { z } from "zod";
import { safeExternalUrlSchema, safeInternalRouteSchema } from "@/lib/landing-page/actions";
import { LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";

export const WIREFRAME_LEVELS = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"] as const;
export const WIREFRAME_PROCESS_NEEDS = ["YES", "NO", "UNKNOWN"] as const;
export const WIREFRAME_PROOF_SITUATIONS = ["HAS_PROOF", "NEEDS_PROOF", "NOT_RELEVANT", "UNKNOWN"] as const;
export const WIREFRAME_COMPLETENESS = ["SUFFICIENT", "PARTIAL", "INSUFFICIENT"] as const;
export const WIREFRAME_GOALS = [
  "GENERATE_LEAD",
  "START_CONVERSATION",
  "REQUEST_QUOTE",
  "BOOK_APPOINTMENT",
  "SELL",
  "SIGN_UP",
  "INFORM_AND_ADVANCE",
  "OTHER",
] as const;
export const WIREFRAME_ACTION_TYPES = ["WHATSAPP", "FORM", "EXTERNAL_URL", "INTERNAL_ROUTE", "FORM_ANCHOR"] as const;

const optionalLabel = z.string().trim().min(1).max(LANDING_PAGE_LIMITS.maxShortText).optional();

export const wireframeActionIntentSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("WHATSAPP"),
      phone: z.string().trim().max(32).optional(),
      message: z.string().trim().max(LANDING_PAGE_LIMITS.maxWhatsappMessage).optional(),
      label: optionalLabel,
    })
    .strict(),
  z
    .object({
      type: z.literal("FORM"),
      label: optionalLabel,
    })
    .strict(),
  z
    .object({
      type: z.literal("EXTERNAL_URL"),
      url: safeExternalUrlSchema.optional(),
      label: optionalLabel,
    })
    .strict(),
  z
    .object({
      type: z.literal("INTERNAL_ROUTE"),
      path: safeInternalRouteSchema.optional(),
      label: optionalLabel,
    })
    .strict(),
  z
    .object({
      type: z.literal("FORM_ANCHOR"),
      sectionId: z.string().trim().min(1).max(64).optional(),
      label: optionalLabel,
    })
    .strict(),
]);

export const wireframeContextSchema = z
  .object({
    version: z.literal(1),
    offer: z
      .object({
        name: z.string().trim().min(1).max(LANDING_PAGE_LIMITS.maxTitle),
        summary: z.string().trim().max(LANDING_PAGE_LIMITS.maxMediumText).optional(),
        type: z.string().trim().max(80).optional(),
      })
      .strict(),
    audience: z
      .object({
        description: z.string().trim().max(LANDING_PAGE_LIMITS.maxMediumText).optional(),
      })
      .strict(),
    primaryGoal: z.enum(WIREFRAME_GOALS),
    primaryAction: wireframeActionIntentSchema,
    secondaryAction: wireframeActionIntentSchema.optional(),
    explanationNeed: z.enum(WIREFRAME_LEVELS),
    trustNeed: z.enum(WIREFRAME_LEVELS),
    decisionComplexity: z.enum(WIREFRAME_LEVELS),
    objections: z.array(z.string().trim().min(1).max(LANDING_PAGE_LIMITS.maxMediumText)).max(12),
    processNeedsExplanation: z.enum(WIREFRAME_PROCESS_NEEDS),
    proofSituation: z.enum(WIREFRAME_PROOF_SITUATIONS),
    contactImportance: z.enum(WIREFRAME_LEVELS),
    preferredConversionMethod: z.enum(WIREFRAME_ACTION_TYPES).optional(),
    contextCompleteness: z.enum(WIREFRAME_COMPLETENESS),
  })
  .strict();

export type WireframeContextV1 = z.infer<typeof wireframeContextSchema>;
export type WireframeActionIntent = z.infer<typeof wireframeActionIntentSchema>;

export function parseWireframeContext(input: unknown):
  | { ok: true; context: WireframeContextV1 }
  | { ok: false } {
  const parsed = wireframeContextSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  return { ok: true, context: parsed.data };
}
