import { z } from "zod";
import { landingPageSectionSchema } from "@/lib/landing-page/components";
import {
  GUIDED_WIREFRAME_ENGINE_V1,
  LANDING_COMPONENT_REGISTRY_V1,
  LANDING_COMPONENT_TYPES,
  LANDING_PAGE_DOCUMENT_SCHEMA_VERSION,
  LANDING_PAGE_LIMITS,
} from "@/lib/landing-page/constants";
import { landingPageActionSchema } from "@/lib/landing-page/actions";
import { conversionPageBriefSchema } from "@/lib/landing-page/brief";
import { visitorDecisionJourneySchema } from "@/lib/landing-page/decision-journey";
import { copyFactsSchema } from "@/lib/landing-page/copy/facts-schema";
import { defaultLandingPageTheme, landingPageThemeSchema } from "@/lib/landing-page/theme/schema";
import { landingPageVisualDirectionSchema } from "@/lib/landing-page/theme/visual-direction";

export { landingPageThemeSchema };

export const landingPageConversionSchema = z
  .object({
    primaryAction: landingPageActionSchema.nullable(),
    secondaryAction: landingPageActionSchema.nullable(),
    businessOutcome: z.string().trim().max(LANDING_PAGE_LIMITS.maxShortText).nullable(),
  })
  .strict();

const measurementEventSchema = z.enum([
  "page_view",
  "cta_click",
  "whatsapp_click",
  "form_start",
  "form_submit",
  "booking_click",
  "purchase_click",
  "custom_conversion",
]);

export const landingPageMeasurementSchema = z
  .object({
    enabled: z.boolean(),
    events: z.array(measurementEventSchema).max(20),
  })
  .strict();

export const guidedWireframeOriginSchema = z
  .object({
    engineVersion: z.literal(GUIDED_WIREFRAME_ENGINE_V1),
    planFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    strategy: z.enum(["FOCUSED", "EXPLANATORY", "TRUST_HEAVY", "CONVERSATIONAL", "BALANCED"]),
    confidence: z.enum(["STRONG", "MODERATE", "LIMITED"]),
  })
  .strict();

export const landingPageWireframeStateSchema = z
  .object({
    version: z.literal(1),
    engineVersion: z.literal(GUIDED_WIREFRAME_ENGINE_V1),
    planFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    strategy: z.enum(["FOCUSED", "EXPLANATORY", "TRUST_HEAVY", "CONVERSATIONAL", "BALANCED"]),
    confidence: z.enum(["STRONG", "MODERATE", "LIMITED"]),
    finalSections: z
      .array(
        z
          .object({
            key: z.string().trim().min(1).max(40),
            type: z.enum(LANDING_COMPONENT_TYPES),
            origin: z.enum(["ENGINE", "USER_ADDED"]),
          })
          .strict(),
      )
      .max(LANDING_PAGE_LIMITS.maxSections),
    userModified: z.boolean(),
  })
  .strict();

export const landingPageStrategySchema = z
  .object({
    brief: conversionPageBriefSchema.optional(),
    decisionJourney: visitorDecisionJourneySchema.optional(),
    wireframe: landingPageWireframeStateSchema.optional(),
    copyFacts: copyFactsSchema.optional(),
    visualDirection: landingPageVisualDirectionSchema.optional(),
  })
  .strict();

export const landingPageMediaRefSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    kind: z.enum(["image"]),
    // Placeholder tipado — upload público ainda não existe.
    publicPath: z.string().trim().max(300).optional(),
  })
  .strict();

export const landingPageDocumentSchema = z
  .object({
    schemaVersion: z.literal(LANDING_PAGE_DOCUMENT_SCHEMA_VERSION),
    registryVersion: z.literal(LANDING_COMPONENT_REGISTRY_V1),
    sections: z.array(landingPageSectionSchema).max(LANDING_PAGE_LIMITS.maxSections),
    theme: landingPageThemeSchema,
    conversion: landingPageConversionSchema,
    measurement: landingPageMeasurementSchema,
    mediaRefs: z.array(landingPageMediaRefSchema).max(40),
    guidedWireframe: guidedWireframeOriginSchema.optional(),
    strategy: landingPageStrategySchema.optional(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    for (const section of doc.sections) {
      if (ids.has(section.id)) {
        ctx.addIssue({ code: "custom", message: `Section id duplicado: ${section.id}`, path: ["sections"] });
      }
      ids.add(section.id);
    }
  });

export type LandingPageDocumentV1 = z.infer<typeof landingPageDocumentSchema>;

export function createEmptyLandingPageDocument(): LandingPageDocumentV1 {
  return {
    schemaVersion: LANDING_PAGE_DOCUMENT_SCHEMA_VERSION,
    registryVersion: LANDING_COMPONENT_REGISTRY_V1,
    sections: [],
    theme: defaultLandingPageTheme(),
    conversion: {
      primaryAction: null,
      secondaryAction: null,
      businessOutcome: null,
    },
    measurement: {
      enabled: false,
      events: [],
    },
    mediaRefs: [],
  };
}

export function parseLandingPageDocument(input: unknown):
  | { ok: true; document: LandingPageDocumentV1 }
  | { ok: false; reason: "UNSUPPORTED_SCHEMA_VERSION" | "UNSUPPORTED_REGISTRY_VERSION" | "INVALID_DOCUMENT"; issues?: string[] } {
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "INVALID_DOCUMENT" };
  }
  const raw = input as Record<string, unknown>;
  if (raw.schemaVersion !== LANDING_PAGE_DOCUMENT_SCHEMA_VERSION) {
    return { ok: false, reason: "UNSUPPORTED_SCHEMA_VERSION" };
  }
  if (raw.registryVersion !== LANDING_COMPONENT_REGISTRY_V1) {
    return { ok: false, reason: "UNSUPPORTED_REGISTRY_VERSION" };
  }
  const parsed = landingPageDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "INVALID_DOCUMENT",
      issues: parsed.error.issues.slice(0, 8).map((issue) => issue.message),
    };
  }
  return { ok: true, document: parsed.data };
}
