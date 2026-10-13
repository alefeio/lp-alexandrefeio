import { z } from "zod";
import { DESTINATION_TYPES } from "@/lib/project/schema";

export const TRAFFIC_SOURCE_METHODS = ["PLATFORM", "UTM", "AUTO_TAGGING", "ASK_AT_SERVICE", "OTHER"] as const;
export const TRACKING_STATUSES = ["CONFIGURED", "NOT_CONFIGURED", "NOT_SURE", "NOT_APPLICABLE"] as const;
export const BUSINESS_OUTCOME_METHODS = ["CRM", "SPREADSHEET", "SYSTEM", "CALENDAR", "MANUAL", "OTHER", "NONE"] as const;
export const DESTINATION_READINESS = ["READY_TO_CONFIGURE", "NEEDS_PREPARATION"] as const;

export const GOOGLE_LESSON_SLUG = "campanha-de-pesquisa";
export const META_LESSON_SLUG = "objetivo-publico-estrutura";

export type ChannelHint = "google" | "meta" | "both" | "none";

export function nextLessonSlugs(hint: ChannelHint | null): string[] {
  if (hint === "google") return [GOOGLE_LESSON_SLUG];
  if (hint === "meta") return [META_LESSON_SLUG];
  if (hint === "both") return [GOOGLE_LESSON_SLUG, META_LESSON_SLUG];
  return [];
}

export const TRAFFIC_SOURCE_LABEL: Record<(typeof TRAFFIC_SOURCE_METHODS)[number], string> = {
  PLATFORM: "Identificação da própria plataforma",
  UTM: "Parâmetros UTM",
  AUTO_TAGGING: "Identificação automática",
  ASK_AT_SERVICE: "Pergunta no atendimento",
  OTHER: "Outro método",
};

export const TRACKING_STATUS_LABEL: Record<(typeof TRACKING_STATUSES)[number], string> = {
  CONFIGURED: "Configurado",
  NOT_CONFIGURED: "Ainda não configurado",
  NOT_SURE: "Não tenho certeza",
  NOT_APPLICABLE: "Não se aplica a esta campanha",
};

export const BUSINESS_OUTCOME_LABEL: Record<(typeof BUSINESS_OUTCOME_METHODS)[number], string> = {
  CRM: "CRM",
  SPREADSHEET: "Planilha",
  SYSTEM: "Sistema interno",
  CALENDAR: "Agenda",
  MANUAL: "Registro manual",
  OTHER: "Outro registro",
  NONE: "Ainda não registro",
};

const httpsUrl = z.string().trim().max(300);

export const destinationPlanSchema = z
  .object({
    destinationType: z.enum(DESTINATION_TYPES),
    destinationUrl: httpsUrl.optional(),
    primaryCta: z.string().trim().min(1).max(120),
    primaryConversion: z.string().trim().min(1).max(200),
    destinationChecks: z
      .object({
        offerIsClear: z.boolean(),
        ctaIsVisible: z.boolean(),
        mobileChecked: z.boolean(),
        conversionPathTested: z.boolean(),
      })
      .strict(),
    trafficSourceMethod: z.enum(TRAFFIC_SOURCE_METHODS),
    platformConversionStatus: z.enum(TRACKING_STATUSES),
    analyticsStatus: z.enum(TRACKING_STATUSES),
    businessOutcomeMethod: z.enum(BUSINESS_OUTCOME_METHODS),
    preLaunchIssue: z.string().trim().min(1).max(500).optional(),
    readinessStatus: z.enum(DESTINATION_READINESS),
  })
  .strict();

export type DestinationPlan = z.infer<typeof destinationPlanSchema>;

export function destinationUrlError(destinationType: string, raw: string): string | null {
  const value = raw.trim();
  const needsUrl = destinationType === "LANDING_PAGE" || destinationType === "WEBSITE";
  if (!value) return needsUrl ? "Informe o endereço HTTPS do destino." : null;
  if (/^(javascript|data|vbscript):/i.test(value)) return "Esse endereço não pode ser usado.";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Use um endereço HTTPS válido.";
  }
  if (url.protocol !== "https:") return "Use um endereço que comece com https://.";
  if (url.username || url.password) return "O endereço não pode trazer usuário ou senha.";
  if (url.search.includes("@")) return "Não coloque e-mail ou dados pessoais no endereço.";
  return null;
}

export function normalizeDestinationUrl(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  return new URL(value).toString();
}

export function destinationReadiness(input: {
  destinationType: string;
  destinationChecks: DestinationPlan["destinationChecks"];
  businessOutcomeMethod: string;
  preLaunchIssue?: string;
}): { status: "READY_TO_CONFIGURE" | "NEEDS_PREPARATION"; issues: string[] } {
  const issues: string[] = [];
  if (input.destinationType === "UNDEFINED") issues.push("O destino ainda não foi definido.");
  if (!input.destinationChecks.offerIsClear) issues.push("A oferta ainda não está clara no destino.");
  if (!input.destinationChecks.ctaIsVisible) issues.push("A ação principal ainda não está fácil de encontrar.");
  if (!input.destinationChecks.mobileChecked) issues.push("O destino ainda não foi conferido no celular.");
  if (!input.destinationChecks.conversionPathTested) issues.push("O caminho completo até a conversão ainda não foi testado.");
  if (input.businessOutcomeMethod === "NONE") issues.push("O resultado comercial ainda não é registrado.");
  const note = input.preLaunchIssue?.trim();
  if (note) issues.push(note);
  return { status: issues.length > 0 ? "NEEDS_PREPARATION" : "READY_TO_CONFIGURE", issues };
}

const formSchema = z.object({
  projectId: z.string().trim().min(1).max(80),
  destinationType: z.enum(DESTINATION_TYPES),
  destinationUrl: z.string().trim().max(300),
  primaryCta: z.string().trim().min(1).max(120),
  primaryConversion: z.string().trim().min(1).max(200),
  offerIsClear: z.boolean(),
  ctaIsVisible: z.boolean(),
  mobileChecked: z.boolean(),
  conversionPathTested: z.boolean(),
  trafficSourceMethod: z.enum(TRAFFIC_SOURCE_METHODS),
  platformConversionStatus: z.enum(TRACKING_STATUSES),
  analyticsStatus: z.enum(TRACKING_STATUSES),
  businessOutcomeMethod: z.enum(BUSINESS_OUTCOME_METHODS),
  preLaunchIssue: z.string().trim().max(500),
});

export function parseDestinationPlanForm(input: {
  projectId: string;
  destinationType: string;
  destinationUrl: string;
  primaryCta: string;
  primaryConversion: string;
  offerIsClear: boolean;
  ctaIsVisible: boolean;
  mobileChecked: boolean;
  conversionPathTested: boolean;
  trafficSourceMethod: string;
  platformConversionStatus: string;
  analyticsStatus: string;
  businessOutcomeMethod: string;
  preLaunchIssue: string;
}): { ok: true; projectId: string; plan: DestinationPlan } | { ok: false; message: string } {
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revise os campos do plano." };
  const urlError = destinationUrlError(parsed.data.destinationType, parsed.data.destinationUrl);
  if (urlError) return { ok: false, message: urlError };
  const checks = {
    offerIsClear: parsed.data.offerIsClear,
    ctaIsVisible: parsed.data.ctaIsVisible,
    mobileChecked: parsed.data.mobileChecked,
    conversionPathTested: parsed.data.conversionPathTested,
  };
  const note = parsed.data.preLaunchIssue.trim();
  const readiness = destinationReadiness({
    destinationType: parsed.data.destinationType,
    destinationChecks: checks,
    businessOutcomeMethod: parsed.data.businessOutcomeMethod,
    preLaunchIssue: note || undefined,
  });
  const plan: DestinationPlan = {
    destinationType: parsed.data.destinationType,
    destinationUrl: parsed.data.destinationUrl.trim() ? normalizeDestinationUrl(parsed.data.destinationUrl) : undefined,
    primaryCta: parsed.data.primaryCta,
    primaryConversion: parsed.data.primaryConversion,
    destinationChecks: checks,
    trafficSourceMethod: parsed.data.trafficSourceMethod,
    platformConversionStatus: parsed.data.platformConversionStatus,
    analyticsStatus: parsed.data.analyticsStatus,
    businessOutcomeMethod: parsed.data.businessOutcomeMethod,
    preLaunchIssue: note || undefined,
    readinessStatus: readiness.status,
  };
  const checked = destinationPlanSchema.safeParse(plan);
  if (!checked.success) return { ok: false, message: "Revise os campos do plano." };
  return { ok: true, projectId: parsed.data.projectId, plan: checked.data };
}

export function planProjectIdsFrom(rows: { projectId: string | null; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.projectId && destinationPlanSchema.safeParse(row.payload).success) ids.add(row.projectId);
  }
  return ids;
}
