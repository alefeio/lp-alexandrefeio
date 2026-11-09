import { z } from "zod";
import { conversionBriefResponseSchema } from "@/lib/landing-page/brief";
import { visitorDecisionResponseSchema } from "@/lib/landing-page/decision-journey";
import { copyLessonResponseSchema } from "@/lib/landing-page/copy/lesson-flow";
import { experienceLessonResponseSchema } from "@/lib/landing-page/experience/lesson-flow";
import { measurementLessonResponseSchema } from "@/lib/landing-page/measurement/lesson-flow";
import { publicationLessonResponseSchema } from "@/lib/landing-page/publication/lesson-flow";
import { visualLessonResponseSchema } from "@/lib/landing-page/theme/visual-direction";
import { trustLessonResponseSchema } from "@/lib/landing-page/trust/plan";
import { wireframeStructureResponseSchema } from "@/lib/landing-page/wireframe/summary";
import { campaignBriefSchema } from "@/lib/learning/campaign-brief";
import { campaignDiagnosisSchema } from "@/lib/learning/campaign-diagnosis";
import { campaignNextActionSchema } from "@/lib/learning/campaign-next-action";
import { conversionJourneyMapSchema, journeyMapResponseSchema } from "@/lib/learning/conversion-journey-map";
import { conversionPageReadinessSchema, pageReadinessResponseSchema } from "@/lib/learning/conversion-page-readiness";
import { destinationPlanSchema } from "@/lib/learning/destination-plan";
import { digitalPresenceDecisionSchema, digitalPresenceResponseSchema } from "@/lib/learning/digital-presence-decision";
import { keywordPlanSchema } from "@/lib/learning/keyword-intent";
import { leadConversionPlanSchema } from "@/lib/learning/lead-conversion";
import { metaCampaignPlanSchema } from "@/lib/learning/meta-campaign";
import { DIAGNOSTIC_VERSION } from "@/lib/diagnostic/definition";
import { toolResponseSchema, resultResponseSchema, RESULT_FIELD_MAX } from "@/lib/learning/blocks";
import { responsiveAdPlanSchema } from "@/lib/learning/responsive-search-ad";
import { searchBlueprintSchema } from "@/lib/learning/search-blueprint";
import type { FirstValueEvidenceKind } from "@/lib/learning/first-value/types";

/**
 * Campos RESULT das aulas FREE sem tool (espelho dos seeds lesson-01/02).
 * O loader prefere o bloco RESULT publicado no banco; este mapa é fallback de fixture/seeds.
 */
export const FIRST_VALUE_RESULT_FIELD_KEYS: Readonly<Record<string, readonly string[]>> = {
  "como-funciona-o-trafego-pago": [
    "oferta-inicial",
    "objetivo-inicial",
    "destino-inicial",
    "conversao-inicial",
    "bloqueio-inicial",
  ],
  "google-ads-ou-meta-ads": [
    "cenario-demanda",
    "indicacao-inicial",
    "motivo-escolha",
    "validacao-antes",
    "segundo-canal",
  ],
};

/**
 * Personal upsert do brief Sites (campos achatados).
 * Exige oferta/público/ação — kind + landingPageProjectId sozinhos NÃO bastam.
 * `completedAt` é mutável e ignorado na atribuição temporal.
 */
const conversionBriefPersonalStrictSchema = z
  .object({
    kind: z.literal("conversion-brief-summary"),
    landingPageProjectId: z.string().trim().min(1),
    oferta: z.string().trim().min(1),
    publico: z.string().trim().min(1),
    acao: z.string().trim().min(1),
    pageGoal: z.string().trim().min(1),
    businessOutcome: z.string().trim().min(1),
  })
  .passthrough();

const TOOL_VALIDATORS: Record<string, (payload: unknown) => boolean> = {
  CAMPAIGN_BRIEF_V1: (payload) => campaignBriefSchema.safeParse(payload).success,
  DESTINATION_MEASUREMENT_PLAN_V1: (payload) => destinationPlanSchema.safeParse(payload).success,
  SEARCH_CAMPAIGN_BLUEPRINT_V1: (payload) => searchBlueprintSchema.safeParse(payload).success,
  KEYWORD_INTENT_PLAN_V1: (payload) => keywordPlanSchema.safeParse(payload).success,
  RESPONSIVE_SEARCH_AD_PLAN_V1: (payload) => responsiveAdPlanSchema.safeParse(payload).success,
  META_CAMPAIGN_BLUEPRINT_V1: (payload) => metaCampaignPlanSchema.safeParse(payload).success,
  META_LEAD_CONVERSION_PLAN_V1: (payload) => leadConversionPlanSchema.safeParse(payload).success,
  CAMPAIGN_PERFORMANCE_DIAGNOSIS_V1: (payload) => campaignDiagnosisSchema.safeParse(payload).success,
  CAMPAIGN_NEXT_ACTION_PLAN_V1: (payload) => campaignNextActionSchema.safeParse(payload).success,
  CONVERSION_JOURNEY_MAP_V1: (payload) =>
    conversionJourneyMapSchema.safeParse(payload).success || journeyMapResponseSchema.safeParse(payload).success,
  DIGITAL_PRESENCE_DECISION_V1: (payload) =>
    digitalPresenceDecisionSchema.safeParse(payload).success || digitalPresenceResponseSchema.safeParse(payload).success,
  CONVERSION_PAGE_READINESS_V1: (payload) =>
    conversionPageReadinessSchema.safeParse(payload).success || pageReadinessResponseSchema.safeParse(payload).success,
  CONVERSION_PAGE_BRIEF_V1: (payload) =>
    conversionBriefResponseSchema.safeParse(payload).success || conversionBriefPersonalStrictSchema.safeParse(payload).success,
  VISITOR_DECISION_JOURNEY_V1: (payload) => visitorDecisionResponseSchema.safeParse(payload).success,
  LANDING_PAGE_WIREFRAME_V1: (payload) => wireframeStructureResponseSchema.safeParse(payload).success,
  LANDING_PAGE_COPY_ASSIST_V1: (payload) => copyLessonResponseSchema.safeParse(payload).success,
  LANDING_PAGE_VISUAL_DIRECTION_V1: (payload) => visualLessonResponseSchema.safeParse(payload).success,
  LANDING_PAGE_TRUST_V1: (payload) => trustLessonResponseSchema.safeParse(payload).success,
  LANDING_PAGE_EXPERIENCE_REVIEW_V1: (payload) => experienceLessonResponseSchema.safeParse(payload).success,
  LANDING_PAGE_MEASUREMENT_PLAN_V1: (payload) => measurementLessonResponseSchema.safeParse(payload).success,
  LANDING_PAGE_PUBLICATION_V1: (payload) => publicationLessonResponseSchema.safeParse(payload).success,
  /** Vínculo aula↔diagnóstico (LessonResponse de linkTrafficReadiness). */
  TRAFFIC_READINESS_V1: (payload) => toolResponseSchema.safeParse(payload).success,
};

/**
 * Alinhado a `saveLessonResult`: todos os campos do bloco RESULT preenchidos com texto não vazio.
 * `resultResponseSchema` isolado NÃO basta (`{}` / `{abc:""}` passam no zod record).
 */
export function isValidResultLessonPayload(
  payload: unknown,
  requiredFieldKeys: readonly string[] | null | undefined,
): boolean {
  if (!requiredFieldKeys || requiredFieldKeys.length === 0) return false;
  const parsed = resultResponseSchema.safeParse(payload);
  if (!parsed.success) return false;
  for (const key of requiredFieldKeys) {
    const value = parsed.data[key];
    if (typeof value !== "string" || !value.trim() || value.trim().length > RESULT_FIELD_MAX) return false;
  }
  return true;
}

/**
 * Valida payload pela ferramenta. Sem schema adequado → false (nunca JSON genérico).
 * Aulas RESULT sem toolKey: exige chaves do bloco RESULT (lookup ou fallback de seed).
 */
export function isValidPedagogicalPayload(input: {
  toolKey: string | null;
  evidenceKind: FirstValueEvidenceKind;
  payload: unknown;
  lessonSlug?: string;
  requiredResultFieldKeys?: readonly string[] | null;
}): boolean {
  const { toolKey, evidenceKind, payload } = input;

  if (
    evidenceKind === "landing_page_project_shell" ||
    evidenceKind === "landing_page_draft" ||
    evidenceKind === "none" ||
    evidenceKind === "lesson_progress_complete"
  ) {
    return false;
  }

  if (evidenceKind === "diagnostic_completed" || evidenceKind === "landing_page_published") {
    return false;
  }

  if (toolKey && TOOL_VALIDATORS[toolKey]) {
    return TOOL_VALIDATORS[toolKey]!(payload);
  }

  if (!toolKey && (evidenceKind === "lesson_result_personal" || evidenceKind === "lesson_result_project")) {
    const keys =
      input.requiredResultFieldKeys ??
      (input.lessonSlug ? FIRST_VALUE_RESULT_FIELD_KEYS[input.lessonSlug] : null) ??
      null;
    return isValidResultLessonPayload(payload, keys);
  }

  return false;
}

/**
 * Espelha `ownedCompletedDiagnostic` em `tool.ts`:
 * userId + id + projectId do vínculo + COMPLETED + DIAGNOSTIC_VERSION + projeto ACTIVE.
 */
export function matchesOwnedCompletedDiagnostic(input: {
  subjectUserId: string;
  link: { projectId: string; diagnosticId: string };
  diagnostic: {
    id: string;
    userId: string;
    projectId?: string | null;
    status: string;
    version?: string | null;
    completedAt: Date | null;
  };
  projects: Array<{ id: string; userId: string; status: string }>;
}): boolean {
  const { diagnostic, link, subjectUserId, projects } = input;
  if (diagnostic.userId !== subjectUserId) return false;
  if (diagnostic.id !== link.diagnosticId) return false;
  if (!diagnostic.projectId || diagnostic.projectId !== link.projectId) return false;
  if (diagnostic.status !== "COMPLETED" || !diagnostic.completedAt) return false;
  if (diagnostic.version !== DIAGNOSTIC_VERSION) return false;
  return projects.some(
    (project) => project.id === link.projectId && project.userId === subjectUserId && project.status === "ACTIVE",
  );
}

/** Extrai completedAt mutável — apenas diagnóstico documental, nunca atribuição. */
export function readMutablePayloadCompletedAt(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { completedAt?: unknown }).completedAt;
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * `LessonResult.createdAt` só prova a primeira conquista se o registro não foi
 * subsequentemente atualizado (payload pode ter nascido incompleto).
 * updatedAt / payload.completedAt mutáveis NÃO substituem essa prova.
 */
export function resolveTrustedResultAchievedAt(row: { createdAt: Date; updatedAt: Date }): Date | null {
  if (row.updatedAt.getTime() === row.createdAt.getTime()) return row.createdAt;
  return null;
}

export function parseTrafficReadinessLink(
  payload: unknown,
): { projectId: string; diagnosticId: string } | null {
  const parsed = toolResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export function parsePublicationLessonPayload(
  payload: unknown,
): z.infer<typeof publicationLessonResponseSchema> | null {
  const parsed = publicationLessonResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** Ferramentas com schema verificável no loader. */
export function verifiedToolKeys(): string[] {
  return Object.keys(TOOL_VALIDATORS).sort((a, b) => a.localeCompare(b));
}
