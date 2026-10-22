import { z } from "zod";
import { landingPageActionSchema, type LandingPageAction } from "@/lib/landing-page/actions";
import { conversionOutcomeLabel } from "@/lib/landing-page/brief";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { experienceReviewEffectiveStatus } from "@/lib/landing-page/experience/review";
import type { ExperienceReviewStatus } from "@/lib/landing-page/experience/schema";
import {
  landingPageFormContentSchema,
  normalizeLandingPageFormField,
  type LandingPageFormContentV1,
} from "@/lib/landing-page/forms/schema";
import { recommendLandingPageMeasurement } from "@/lib/landing-page/measurement/availability";
import {
  LANDING_PAGE_MEASUREMENT_EVENTS,
  LANDING_PAGE_MEASUREMENT_LABELS,
  type LandingPageMeasurementEvent,
} from "@/lib/landing-page/measurement/schema";
import { validateLandingPageMeasurement } from "@/lib/landing-page/measurement/validate";
import type { LandingPageProjectRecord } from "@/lib/landing-page/types";

export const LANDING_PAGE_MEASUREMENT_TOOL = "LANDING_PAGE_MEASUREMENT_PLAN_V1";
export const SITE_MEASUREMENT_SLUG = "configure-o-que-precisa-ser-medido";
export const MEASUREMENT_RESULT_TITLE = "Plano de mensuração da minha landing page";
export const MEASUREMENT_NO_SECTIONS_HREF = "/aulas/organize-as-secoes-da-pagina";
export const MEASUREMENT_NO_PROJECT_HREF = "/aulas/oferta-publico-acao-principal";
export const MEASUREMENT_DATA_LATER_COPY = "Os dados começarão a aparecer depois que a página for publicada e utilizada.";
export const MEASUREMENT_PRIVACY_COPY =
  "A plataforma registra contagens dos eventos configurados. Informações enviadas pelo formulário ficam separadas como leads privados.";
export const MEASUREMENT_PREVIEW_SUBMIT_COPY = "Envio será ativado na página publicada.";
export const MEASUREMENT_STALE_NOTICE =
  "Você alterou sua página depois da última revisão de experiência. Como esta alteração afeta a experiência da página, revise novamente antes de publicar.";

const JOURNEY_ORDER: LandingPageMeasurementEvent[] = ["PAGE_VIEW", "CTA_CLICK", "WHATSAPP_CLICK", "FORM_START", "FORM_SUBMIT"];

export const MEASUREMENT_EVENT_GUIDE: Record<
  LandingPageMeasurementEvent,
  { label: string; explanation: string; when: string }
> = {
  PAGE_VIEW: {
    label: LANDING_PAGE_MEASUREMENT_LABELS.PAGE_VIEW,
    explanation: "A landing foi carregada publicamente. Isso não significa interesse, lead nem venda.",
    when: "Quando a página publicada abre.",
  },
  CTA_CLICK: {
    label: LANDING_PAGE_MEASUREMENT_LABELS.CTA_CLICK,
    explanation: "Alguém clicou em uma ação da landing. Pode acontecer antes de sabermos qual canal específico foi usado.",
    when: "No clique de um botão ou link de ação.",
  },
  WHATSAPP_CLICK: {
    label: LANDING_PAGE_MEASUREMENT_LABELS.WHATSAPP_CLICK,
    explanation: "A pessoa clicou para abrir o WhatsApp. Isso ainda não significa conversa iniciada, venda nem cliente adquirido.",
    when: "Somente quando a página tem uma ação de WhatsApp.",
  },
  FORM_START: {
    label: LANDING_PAGE_MEASUREMENT_LABELS.FORM_START,
    explanation: "A pessoa começou a interagir com o formulário. Isso não é um envio.",
    when: "Quando existe um formulário válido e a pessoa começa a preenchê-lo.",
  },
  FORM_SUBMIT: {
    label: LANDING_PAGE_MEASUREMENT_LABELS.FORM_SUBMIT,
    explanation: "O formulário era válido e o lead foi gravado. O clique no botão de enviar, sozinho, não conta.",
    when: "Somente depois que o envio é aceito com sucesso.",
  },
};

const ACTION_LABEL = {
  WHATSAPP: "WhatsApp",
  EXTERNAL_URL: "Link externo",
  INTERNAL_ROUTE: "Página interna",
  FORM_ANCHOR: "Formulário",
} as const;

const REVIEW_LABEL: Record<ExperienceReviewStatus, string> = {
  NOT_REVIEWED: "ainda não revisada",
  NEEDS_ADJUSTMENTS: "precisa de ajustes",
  READY_FOR_NEXT_STEP: "revisão atual",
  STALE: "desatualizada",
};

export const measurementLessonResponseSchema = z
  .object({
    landingPageProjectId: z.string().min(1),
    measurementVersion: z.literal(1),
    primaryActionType: z.enum(["WHATSAPP", "EXTERNAL_URL", "INTERNAL_ROUTE", "FORM_ANCHOR"]),
    enabledEvents: z.array(z.enum(LANDING_PAGE_MEASUREMENT_EVENTS)).min(1),
    primaryConversionEvent: z.enum(LANDING_PAGE_MEASUREMENT_EVENTS),
    formPresent: z.boolean(),
    formFieldCount: z.number().int().nonnegative(),
    experienceReviewStatus: z.enum(["NOT_REVIEWED", "NEEDS_ADJUSTMENTS", "READY_FOR_NEXT_STEP", "STALE"]),
    measurementConfirmed: z.literal(true),
    draftRevision: z.number().int().positive(),
    completedAt: z.string().datetime(),
  })
  .strict();

export type MeasurementLessonResult = z.infer<typeof measurementLessonResponseSchema>;

export type MeasurementPageView = {
  id: string;
  title: string;
  status: string;
  draftRevision: number;
  setup: "READY" | "NO_SECTIONS";
  effectiveStatus: ExperienceReviewStatus;
  document: LandingPageDocumentV1;
};

export type MeasurementPanel = {
  kind: "landing-measurement";
  mode: "preview" | "live";
  preview: boolean;
  authenticated: boolean;
  blockKey: string;
  pages: MeasurementPageView[];
  suggestedPageId: string | null;
};

export function measurementSetup(input: { pageCount: number; sectionCount: number }): "NO_PROJECT" | "NO_SECTIONS" | "READY" {
  if (input.pageCount < 1) return "NO_PROJECT";
  if (input.sectionCount < 1) return "NO_SECTIONS";
  return "READY";
}

export function measurementGoalText(document: LandingPageDocumentV1): string {
  if (document.strategy?.brief) return conversionOutcomeLabel(document.strategy.brief);
  return document.conversion.businessOutcome?.trim() || "O objetivo continua o que você definiu na oferta e na ação principal.";
}

export function maskWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "número incompleto";
  return `número terminado em ${digits.slice(-4)}`;
}

export function measurementActionSummary(action: LandingPageAction | null): { title: string; detail: string } {
  if (!action) return { title: "Ação ainda não configurada", detail: "Defina o que o visitante deve fazer." };
  if (action.type === "WHATSAPP") return { title: "WhatsApp", detail: maskWhatsAppPhone(action.phone) };
  if (action.type === "EXTERNAL_URL") {
    try {
      return { title: "Destino externo", detail: new URL(action.url).host };
    } catch {
      return { title: "Destino externo", detail: "endereço ainda inválido" };
    }
  }
  if (action.type === "INTERNAL_ROUTE") return { title: "Página interna", detail: action.path };
  return { title: "Formulário desta página", detail: action.sectionId ? "Formulário ligado" : "Falta apontar o formulário" };
}

export function measurementRecommendationCopy(document: LandingPageDocumentV1): string | null {
  const action = document.conversion.primaryAction;
  const recommended = recommendLandingPageMeasurement(document).primaryConversionEvent;
  if (action?.type === "WHATSAPP" && recommended === "WHATSAPP_CLICK") {
    return "Como sua ação principal é WhatsApp, o clique no WhatsApp parece ser o sinal mais próximo do objetivo que a plataforma consegue medir.";
  }
  if (action?.type === "FORM_ANCHOR" && recommended === "FORM_SUBMIT") {
    return "Como sua ação principal leva ao formulário, o envio aceito parece ser o sinal mais próximo do objetivo que a plataforma consegue medir.";
  }
  if ((action?.type === "EXTERNAL_URL" || action?.type === "INTERNAL_ROUTE") && recommended === "CTA_CLICK") {
    return "O clique na ação é o sinal que esta plataforma consegue medir. Depois do clique, a landing não controla o que acontece no destino.";
  }
  return null;
}

export function measurementJourneySteps(
  enabledEvents: readonly LandingPageMeasurementEvent[],
  primary: LandingPageMeasurementEvent | null,
): Array<{ event: LandingPageMeasurementEvent; label: string; primary: boolean }> {
  return JOURNEY_ORDER.filter((event) => enabledEvents.includes(event)).map((event) => ({
    event,
    label: LANDING_PAGE_MEASUREMENT_LABELS[event],
    primary: event === primary,
  }));
}

export function measurementExperienceNotice(status: ExperienceReviewStatus): string | null {
  return status === "STALE" ? MEASUREMENT_STALE_NOTICE : null;
}

/** A publicação exige revisão atual. A rota pública continua noindex e desligada em produção. */
export function futurePublicationBlockedByStaleExperienceReview(document: LandingPageDocumentV1, draftRevision: number): boolean {
  return experienceReviewEffectiveStatus(document, draftRevision) === "STALE";
}

export function enabledFormSection(document: LandingPageDocumentV1) {
  return document.sections.find((section) => section.type === "FORM" && section.enabled) ?? null;
}

export function formContentSignature(content: unknown): string | null {
  const parsed = landingPageFormContentSchema.safeParse(content);
  if (!parsed.success) return null;
  const fields = parsed.data.fields.map((field) => normalizeLandingPageFormField(field));
  if (fields.some((field) => !field)) return null;
  return JSON.stringify({ ...parsed.data, fields });
}

export function measurementPlanDiff(
  document: LandingPageDocumentV1,
  input: { action?: unknown; form?: { sectionId: string; content: unknown } | null },
): {
  action?: { action: LandingPageAction; target: { kind: "PRIMARY" } };
  form?: { sectionId: string; content: LandingPageFormContentV1 };
} {
  const diff: {
    action?: { action: LandingPageAction; target: { kind: "PRIMARY" } };
    form?: { sectionId: string; content: LandingPageFormContentV1 };
  } = {};
  if (input.action !== undefined) {
    const next = landingPageActionSchema.safeParse(input.action);
    if (next.success && JSON.stringify(next.data) !== JSON.stringify(document.conversion.primaryAction ?? null)) {
      diff.action = { action: next.data, target: { kind: "PRIMARY" } };
    }
  }
  if (input.form) {
    const section = document.sections.find((item) => item.id === input.form?.sectionId && item.type === "FORM");
    const nextSignature = formContentSignature(input.form.content);
    const currentSignature = section && section.type === "FORM" ? formContentSignature(section.content) : null;
    const parsed = landingPageFormContentSchema.safeParse(input.form.content);
    if (parsed.success && nextSignature && nextSignature !== currentSignature) {
      diff.form = { sectionId: input.form.sectionId, content: parsed.data };
    }
  }
  return diff;
}

export function measurementLessonResult(input: {
  landingPageProjectId: string;
  document: LandingPageDocumentV1;
  draftRevision: number;
  completedAt: string;
}): MeasurementLessonResult | null {
  const action = input.document.conversion.primaryAction;
  if (!action) return null;
  const actionCheck = landingPageActionSchema.safeParse(action);
  if (!actionCheck.success) return null;
  if (action.type === "FORM_ANCHOR") {
    const form = input.document.sections.find((section) => section.id === action.sectionId && section.type === "FORM" && section.enabled);
    if (!form) return null;
  }
  const measurement = validateLandingPageMeasurement(input.document, input.document.measurement);
  if (!measurement.valid || !measurement.measurement?.primaryConversionEvent) return null;
  const primary = measurement.measurement.primaryConversionEvent;
  if (!measurement.measurement.enabledEvents.includes(primary)) return null;
  const plan = input.document.strategy?.measurementPlan;
  if (!plan || plan.confirmed !== true || plan.primaryConversionEvent !== primary) return null;
  const forms = input.document.sections.filter((section) => section.type === "FORM" && section.enabled);
  for (const form of forms) {
    if (form.type === "FORM" && !landingPageFormContentSchema.safeParse(form.content).success) return null;
  }
  const candidate = {
    landingPageProjectId: input.landingPageProjectId,
    measurementVersion: 1 as const,
    primaryActionType: action.type,
    enabledEvents: measurement.measurement.enabledEvents,
    primaryConversionEvent: primary,
    formPresent: forms.length > 0,
    formFieldCount: forms.reduce((total, form) => (form.type === "FORM" ? total + form.content.fields.length : total), 0),
    experienceReviewStatus: experienceReviewEffectiveStatus(input.document, input.draftRevision),
    measurementConfirmed: true as const,
    draftRevision: input.draftRevision,
    completedAt: input.completedAt,
  };
  const parsed = measurementLessonResponseSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function measurementResultDisplay(result: MeasurementLessonResult) {
  return {
    acao: ACTION_LABEL[result.primaryActionType],
    conversao: LANDING_PAGE_MEASUREMENT_LABELS[result.primaryConversionEvent],
    eventos: result.enabledEvents.map((event) => LANDING_PAGE_MEASUREMENT_LABELS[event]).join(", "),
    formulario: result.formPresent ? "sim" : "não",
    campos: String(result.formFieldCount),
    revisao: REVIEW_LABEL[result.experienceReviewStatus],
  };
}

export function toMeasurementPageView(record: LandingPageProjectRecord): MeasurementPageView {
  const sections = record.draftDocument.sections.filter((section) => section.enabled);
  return {
    id: record.id,
    title: record.title,
    status: record.status,
    draftRevision: record.draftRevision,
    setup: sections.length === 0 ? "NO_SECTIONS" : "READY",
    effectiveStatus: experienceReviewEffectiveStatus(record.draftDocument, record.draftRevision),
    document: record.draftDocument,
  };
}

export function measurementPreviewState(): MeasurementPanel {
  return {
    kind: "landing-measurement",
    mode: "preview",
    preview: true,
    authenticated: false,
    blockKey: "ferramenta-mensuracao",
    pages: [],
    suggestedPageId: null,
  };
}
