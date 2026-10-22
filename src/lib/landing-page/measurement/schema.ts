import { z } from "zod";

/** Taxonomia fechada da V1. Não há evento custom. */
export const LANDING_PAGE_MEASUREMENT_EVENTS = [
  "PAGE_VIEW",
  "CTA_CLICK",
  "WHATSAPP_CLICK",
  "FORM_START",
  "FORM_SUBMIT",
] as const;

export type LandingPageMeasurementEvent = (typeof LANDING_PAGE_MEASUREMENT_EVENTS)[number];

export const LANDING_PAGE_MEASUREMENT_LABELS: Record<LandingPageMeasurementEvent, string> = {
  PAGE_VIEW: "Visualização da página",
  CTA_CLICK: "Clique na ação",
  WHATSAPP_CLICK: "Clique no WhatsApp",
  FORM_START: "Início do formulário",
  FORM_SUBMIT: "Formulário enviado",
};

const LEGACY_MEASUREMENT_EVENTS: Record<string, LandingPageMeasurementEvent> = {
  page_view: "PAGE_VIEW",
  cta_click: "CTA_CLICK",
  whatsapp_click: "WHATSAPP_CLICK",
  form_start: "FORM_START",
  form_submit: "FORM_SUBMIT",
};

const eventSchema = z.enum(LANDING_PAGE_MEASUREMENT_EVENTS);

const canonicalMeasurementSchema = z
  .object({
    version: z.literal(1),
    primaryConversionEvent: eventSchema.nullable(),
    enabledEvents: z.array(eventSchema).max(LANDING_PAGE_MEASUREMENT_EVENTS.length),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.enabledEvents).size !== value.enabledEvents.length) {
      ctx.addIssue({ code: "custom", message: "Evento repetido.", path: ["enabledEvents"] });
    }
  });

/**
 * Lê o formato antigo `{ enabled, events }` sem falhar o documento.
 * `enabled: false` não liga eventos. Eventos fora da V1 são descartados.
 * A fonte canônica passa a ser `enabledEvents`.
 */
export const landingPageMeasurementSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (record.version === 1 && Array.isArray(record.enabledEvents)) return value;
  if (!("events" in record) && !("enabled" in record)) return value;
  if (record.enabled === false) {
    return { version: 1, primaryConversionEvent: null, enabledEvents: [] };
  }
  const source = Array.isArray(record.events) ? record.events : [];
  const enabledEvents: LandingPageMeasurementEvent[] = [];
  for (const event of source) {
    const mapped = typeof event === "string" ? LEGACY_MEASUREMENT_EVENTS[event] : undefined;
    if (mapped && !enabledEvents.includes(mapped)) enabledEvents.push(mapped);
  }
  return { version: 1, primaryConversionEvent: null, enabledEvents };
}, canonicalMeasurementSchema);

export type LandingPageMeasurementV1 = z.infer<typeof canonicalMeasurementSchema>;

/** Resumo pedagógico. Não substitui `draftDocument.measurement`. */
export const landingPageMeasurementPlanSummarySchema = z
  .object({
    version: z.literal(1),
    primaryActionType: z.enum(["WHATSAPP", "EXTERNAL_URL", "INTERNAL_ROUTE", "FORM_ANCHOR"]).nullable(),
    primaryConversionEvent: eventSchema.nullable(),
    enabledEvents: z.array(eventSchema).max(LANDING_PAGE_MEASUREMENT_EVENTS.length),
    formPresent: z.boolean(),
  })
  .strict();

export type LandingPageMeasurementPlanSummaryV1 = z.infer<typeof landingPageMeasurementPlanSummarySchema>;
