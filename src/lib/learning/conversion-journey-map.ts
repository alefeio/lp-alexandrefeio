import { z } from "zod";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

export const CONVERSION_JOURNEY_MAP_TOOL = "CONVERSION_JOURNEY_MAP_V1" as const;
export const SITE_AJUDA_A_VENDER_SLUG = "site-ajuda-a-vender";

export const TRAFFIC_SOURCES = [
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

export const DESTINATION_TYPES = [
  "HOME",
  "LANDING_PAGE",
  "SERVICE_PAGE",
  "PRODUCT_PAGE",
  "WHATSAPP",
  "SOCIAL_PROFILE",
  "OTHER",
  "UNKNOWN",
] as const;

export const PRIMARY_ACTIONS = [
  "CONTACT",
  "WHATSAPP",
  "FORM_SUBMIT",
  "QUOTE_REQUEST",
  "BOOKING",
  "CALL",
  "PURCHASE",
  "SIGN_UP",
  "VISIT_PAGE",
  "OTHER",
] as const;

export const BUSINESS_OUTCOMES = [
  "LEAD",
  "QUALIFIED_LEAD",
  "QUOTE",
  "APPOINTMENT",
  "SALE",
  "CUSTOMER",
  "REGISTRATION",
  "AWARENESS",
  "OTHER",
] as const;

export const FRICTION_OPTIONS = [
  "OFFER_UNCLEAR",
  "CTA_UNCLEAR",
  "TOO_MANY_ACTIONS",
  "PAGE_CONFUSING",
  "MOBILE_PROBLEM",
  "SLOW_PAGE",
  "NO_MEASUREMENT",
  "NO_PAGE",
  "UNKNOWN",
  "OTHER",
] as const;

export const TRAFFIC_SOURCE_LABELS: Record<(typeof TRAFFIC_SOURCES)[number], string> = {
  GOOGLE_ORGANIC: "Google (orgânico)",
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta Ads",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Indicação / outro site",
  DIRECT: "Acesso direto",
  EMAIL: "E-mail",
  OTHER: "Outro",
  UNKNOWN: "Não sei",
};

export const DESTINATION_TYPE_LABELS: Record<(typeof DESTINATION_TYPES)[number], string> = {
  HOME: "Home",
  LANDING_PAGE: "Landing page",
  SERVICE_PAGE: "Página de serviço",
  PRODUCT_PAGE: "Página de produto",
  WHATSAPP: "WhatsApp",
  SOCIAL_PROFILE: "Perfil em rede social",
  OTHER: "Outro",
  UNKNOWN: "Não sei",
};

export const PRIMARY_ACTION_LABELS: Record<(typeof PRIMARY_ACTIONS)[number], string> = {
  CONTACT: "Entrar em contato",
  WHATSAPP: "Clicar no WhatsApp",
  FORM_SUBMIT: "Enviar formulário",
  QUOTE_REQUEST: "Solicitar orçamento",
  BOOKING: "Agendar",
  CALL: "Ligar",
  PURCHASE: "Comprar",
  SIGN_UP: "Criar conta / cadastrar",
  VISIT_PAGE: "Ir para outra página",
  OTHER: "Outra ação",
};

export const BUSINESS_OUTCOME_LABELS: Record<(typeof BUSINESS_OUTCOMES)[number], string> = {
  LEAD: "Lead / contato",
  QUALIFIED_LEAD: "Lead qualificado",
  QUOTE: "Orçamento",
  APPOINTMENT: "Agendamento",
  SALE: "Venda",
  CUSTOMER: "Cliente",
  REGISTRATION: "Cadastro",
  AWARENESS: "Conhecimento / reconhecimento",
  OTHER: "Outro resultado",
};

export const FRICTION_LABELS: Record<(typeof FRICTION_OPTIONS)[number], string> = {
  OFFER_UNCLEAR: "A oferta ainda não está clara",
  CTA_UNCLEAR: "A ação principal ainda não está clara",
  TOO_MANY_ACTIONS: "Há muitas ações competindo",
  PAGE_CONFUSING: "A página confunde",
  MOBILE_PROBLEM: "Problema no celular",
  SLOW_PAGE: "Página lenta",
  NO_MEASUREMENT: "Não sei medir o caminho",
  NO_PAGE: "Ainda não há uma página definida",
  UNKNOWN: "Ainda não sei apontar",
  OTHER: "Outro ponto de atenção",
};

export const conversionJourneyMapSchema = z
  .object({
    offer: z.string().trim().min(1).max(160),
    trafficSource: z.enum(TRAFFIC_SOURCES),
    trafficSourceOther: z.string().trim().max(120).optional().nullable(),
    destinationType: z.enum(DESTINATION_TYPES),
    destinationDescription: z.string().trim().min(1).max(200),
    destinationUrl: z.string().trim().max(500).optional().nullable(),
    primaryAction: z.enum(PRIMARY_ACTIONS),
    businessOutcome: z.enum(BUSINESS_OUTCOMES),
    currentFriction: z.enum(FRICTION_OPTIONS).optional().nullable(),
    reflection: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.trafficSource === "OTHER" && !value.trafficSourceOther?.trim()) {
      ctx.addIssue({ code: "custom", path: ["trafficSourceOther"], message: "Descreva a origem." });
    }
    if (value.destinationUrl) {
      try {
        const url = new URL(value.destinationUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          ctx.addIssue({ code: "custom", path: ["destinationUrl"], message: "Informe uma URL http(s) ou deixe em branco." });
        }
      } catch {
        ctx.addIssue({ code: "custom", path: ["destinationUrl"], message: "Informe uma URL válida ou deixe em branco." });
      }
    }
  });

export type ConversionJourneyMap = z.infer<typeof conversionJourneyMapSchema>;

/** Resposta do bloco TOOL: mapa completo (anônimo e autenticado). */
export const journeyMapResponseSchema = z
  .object({
    kind: z.enum(["personal", "project"]),
    projectId: z.string().trim().min(1).max(80).optional().nullable(),
    map: conversionJourneyMapSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "project" && !value.projectId) {
      ctx.addIssue({ code: "custom", path: ["projectId"], message: "Escolha um projeto." });
    }
  });

export type JourneyMapResponse = z.infer<typeof journeyMapResponseSchema>;

/** Persistência anônima: course + lesson + tool version. */
export function conversionJourneyLocalKey(courseSlug = SITES_COURSE_SLUG, lessonSlug = SITE_AJUDA_A_VENDER_SLUG): string {
  return `af_${courseSlug}_${lessonSlug}_conversion_journey_map_v1`;
}

export function parseConversionJourneyMapForm(input: {
  offer: string;
  trafficSource: string;
  trafficSourceOther?: string;
  destinationType: string;
  destinationDescription: string;
  destinationUrl?: string;
  primaryAction: string;
  businessOutcome: string;
  currentFriction?: string;
  reflection?: string;
  projectId?: string;
}):
  | { ok: true; map: ConversionJourneyMap; projectId: string | null }
  | { ok: false; message: string } {
  const mapInput = {
    offer: input.offer,
    trafficSource: input.trafficSource,
    trafficSourceOther: input.trafficSourceOther?.trim() || null,
    destinationType: input.destinationType,
    destinationDescription: input.destinationDescription,
    destinationUrl: input.destinationUrl?.trim() || null,
    primaryAction: input.primaryAction,
    businessOutcome: input.businessOutcome,
    currentFriction: input.currentFriction?.trim() || null,
    reflection: input.reflection?.trim() || null,
  };
  const parsed = conversionJourneyMapSchema.safeParse(mapInput);
  if (!parsed.success) return { ok: false, message: "Revise os campos do mapa de conversão." };
  const projectId = input.projectId?.trim() || null;
  return { ok: true, map: parsed.data, projectId };
}

export function journeyMapProjectIdsFrom(rows: { projectId: string | null; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.projectId && conversionJourneyMapSchema.safeParse(row.payload).success) ids.add(row.projectId);
  }
  return ids;
}

export function isPersonalJourneyMap(payload: unknown): boolean {
  return conversionJourneyMapSchema.safeParse(payload).success;
}

export type JourneyValidationNotice = { code: string; message: string };

/** Alertas objetivos — sem julgar qualidade da página. */
export function journeyMapNotices(map: ConversionJourneyMap): JourneyValidationNotice[] {
  const notices: JourneyValidationNotice[] = [];
  if (map.trafficSource === "UNKNOWN") {
    notices.push({
      code: "unknown_source",
      message: "Tudo bem ainda não saber de onde as pessoas chegam.",
    });
  }
  if (map.destinationType === "UNKNOWN") {
    notices.push({
      code: "unknown_destination",
      message: "Antes de otimizar a página, precisamos identificar onde o visitante chega.",
    });
  }
  return notices;
}

export function sourceLabel(map: ConversionJourneyMap): string {
  if (map.trafficSource === "OTHER" && map.trafficSourceOther?.trim()) return map.trafficSourceOther.trim();
  return TRAFFIC_SOURCE_LABELS[map.trafficSource];
}

export function actionLabel(map: ConversionJourneyMap): string {
  return PRIMARY_ACTION_LABELS[map.primaryAction];
}

export function outcomeLabel(map: ConversionJourneyMap): string {
  return BUSINESS_OUTCOME_LABELS[map.businessOutcome];
}

export function frictionLabel(map: ConversionJourneyMap): string | null {
  if (!map.currentFriction) return null;
  return FRICTION_LABELS[map.currentFriction];
}

export function readLocalJourneyMap(storageKey = conversionJourneyLocalKey()): ConversionJourneyMap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = conversionJourneyMapSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeLocalJourneyMap(map: ConversionJourneyMap, storageKey = conversionJourneyLocalKey()): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(map));
}
