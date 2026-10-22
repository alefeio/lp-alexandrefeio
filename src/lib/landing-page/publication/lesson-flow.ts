import { z } from "zod";
import { siteConfig } from "@/data/site-config";
import type { LandingPageAction } from "@/lib/landing-page/actions";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { experienceReviewEffectiveStatus } from "@/lib/landing-page/experience/review";
import { LANDING_PAGE_MEASUREMENT_EVENTS, LANDING_PAGE_MEASUREMENT_LABELS } from "@/lib/landing-page/measurement/schema";
import { landingPagePublicRuntimeEnabled } from "@/lib/landing-page/publication/gate";
import { evaluateLandingPagePublicationReadiness, type PublicationReadiness } from "@/lib/landing-page/publication/readiness";
import { validatePublicationSnapshot, type PublicationMediaInput } from "@/lib/landing-page/publication/snapshot";
import type { LandingPageProjectRecord } from "@/lib/landing-page/types";

export const LANDING_PAGE_PUBLICATION_TOOL = "LANDING_PAGE_PUBLICATION_V1";
export const SITE_PUBLICATION_SLUG = "revisao-antes-do-trafego";
export const PUBLICATION_RESULT_TITLE = "Publicação da minha landing page";

export const PUBLICATION_LIVE_COPY = "Sua landing page está no ar.";
export const PUBLICATION_RUNTIME_OFF_COPY = "A publicação pública ainda não está disponível neste ambiente.";
export const PUBLICATION_COURSE_COMPLETE_COPY = "Você concluiu o curso com uma landing page construída e publicada por você.";
export const PUBLICATION_CONFIRM_COPY = "Será criada uma versão pública desta página. Você poderá continuar editando seu rascunho depois.";
export const PUBLICATION_UNPUBLISHED_COPY = "Você possui alterações que ainda não foram publicadas.";
export const PUBLICATION_NO_CHANGES_COPY = "Não há alterações novas para publicar.";
export const PUBLICATION_STALE_COPY = "Você alterou algo que afeta a experiência depois da última revisão.";
export const PUBLICATION_READY_COPY = "Pronta para publicação";
export const PUBLICATION_METRICS_COPY = "Os dados aparecerão conforme a página começar a receber visitas e ações.";
export const PUBLICATION_NO_PROOF_COPY = "Se você ainda não possui provas reais, é melhor publicar sem inventá-las.";
export const PUBLICATION_NEXT_COURSE_COPY =
  "Agora que sua página está no ar, o próximo passo pode ser aprender a levar pessoas até ela e acompanhar os resultados.";
export const PUBLICATION_SLUG_LOCK_COPY = "Depois da primeira publicação, este endereço fica reservado para esta página.";
export const PUBLICATION_CONFLICT_COPY = "Sua página mudou enquanto a publicação estava sendo preparada. Atualize a revisão e tente novamente.";
export const PUBLICATION_UNKNOWN_COPY = "Não foi possível publicar agora. Tente novamente.";
export const PUBLICATION_ACK_COPY = "Revisei este ponto e quero continuar.";
export const PUBLICATION_RESTORE_COPY = "Será criada uma nova versão baseada nesta.";
export const PUBLICATION_FORM_LIVE_COPY = "Seu formulário está ativo na página publicada.";
export const PUBLICATION_WHATSAPP_CHECK_COPY = "Confirme se o botão abre o destino esperado.";

export const PUBLICATION_NO_PROJECT_HREF = "/aulas/oferta-publico-acao-principal";
export const PUBLICATION_NO_SECTIONS_HREF = "/aulas/organize-as-secoes-da-pagina";
export const PUBLICATION_COPY_HREF = "/aulas/mensagem-que-deixa-a-oferta-clara";
export const PUBLICATION_VISUAL_HREF = "/aulas/hierarquia-visual-e-atencao";
export const PUBLICATION_TRUST_HREF = "/aulas/construa-confianca";
export const PUBLICATION_EXPERIENCE_HREF = "/aulas/pagina-mobile-e-experiencia";
export const PUBLICATION_MEASUREMENT_HREF = "/aulas/configure-o-que-precisa-ser-medido";
export const PUBLICATION_NEXT_COURSE_HREF = "/cursos/trafego-pago-na-pratica";
export const PUBLICATION_SERVICE_HREF = "/trafego-pago";

const ACTION_LABEL = {
  WHATSAPP: "WhatsApp",
  EXTERNAL_URL: "Link externo",
  INTERNAL_ROUTE: "Página interna",
  FORM_ANCHOR: "Formulário",
} as const;

const REVIEW_LABEL = {
  NOT_REVIEWED: "ainda não revisada",
  NEEDS_ADJUSTMENTS: "precisa de ajustes",
  READY_FOR_NEXT_STEP: "revisão atual",
  STALE: "desatualizada",
} as const;

const BLOCKER_COPY: Record<string, string> = {
  CORE_PLACEHOLDER: "Uma das partes principais da página ainda possui conteúdo provisório.",
  CORE_COPY_NOT_APPROVED: "Um texto principal ainda não foi aprovado.",
  CONTRAST_CRITICAL: "Há uma combinação de cores que pode dificultar a leitura.",
  INVALID_ACTION: "A ação principal precisa ser configurada.",
  INVALID_FORM: "O formulário ainda não está pronto para receber contatos.",
  INVALID_MEASUREMENT: "O plano de mensuração ainda precisa ser ajustado.",
  INVALID_PRIMARY_CONVERSION: "A conversão principal precisa ser definida.",
  INVALID_MEDIA: "Uma imagem usada na página ainda não está pronta.",
  MEDIA_NOT_READY: "Uma imagem usada na página ainda não está pronta.",
  INVALID_TRUST: "Uma prova selecionada ainda não está pronta para aparecer.",
  TESTIMONIAL_CONSENT: "Um depoimento ainda não tem autorização para ser publicado.",
  EXPERIENCE_REVIEW_MISSING: "A revisão de experiência ainda não foi feita.",
  EXPERIENCE_REVIEW_NOT_READY: "A revisão de experiência ainda não está pronta para publicar.",
  EXPERIENCE_REVIEW_STALE: PUBLICATION_STALE_COPY,
  EXPERIENCE_REVIEW_REVISION: PUBLICATION_STALE_COPY,
  EXPERIENCE_BLOCKER_OPEN: "Ainda há um ponto da experiência que precisa ser resolvido.",
  INVALID_SCHEMA: "A página ainda não pode ser preparada para publicação.",
  UNSUPPORTED_REGISTRY: "A página ainda não pode ser preparada para publicação.",
  INVALID_SNAPSHOT: "A página ainda não pode ser preparada para publicação.",
  INVALID_SLUG: "O endereço da página ainda não é válido.",
};

const WARNING_COPY: Record<string, string> = {
  NO_TRUST_PROOF: "Nenhuma prova foi adicionada. Se você ainda não possui provas reais, é melhor publicar sem inventá-las.",
  NON_CORE_DRAFT: "Um texto secundário ainda está em revisão.",
  LARGE_IMAGE: "Uma imagem está grande e pode demorar para carregar.",
  DEFERRED_ATTENTION: "Um ponto da revisão de experiência foi deixado para depois.",
};

export const publicationLessonResponseSchema = z
  .object({
    landingPageProjectId: z.string().min(1),
    publicationId: z.string().min(1),
    publicationVersion: z.number().int().positive(),
    snapshotSchemaVersion: z.literal(1),
    publicSlug: z.string().min(1),
    publicPath: z.string().regex(/^\/p\/[a-z0-9]+(?:-[a-z0-9]+)*$/),
    primaryActionType: z.enum(["WHATSAPP", "EXTERNAL_URL", "INTERNAL_ROUTE", "FORM_ANCHOR"]),
    primaryConversionEvent: z.enum(LANDING_PAGE_MEASUREMENT_EVENTS),
    warningCount: z.number().int().nonnegative(),
    acknowledgedWarningCount: z.number().int().nonnegative(),
    publishedAt: z.string().datetime(),
    sourceDraftRevision: z.number().int().positive(),
  })
  .strict();

export type PublicationLessonResult = z.infer<typeof publicationLessonResponseSchema>;

export type PublicationHistoryItem = {
  id: string;
  version: number;
  publishedAt: string;
  active: boolean;
};

export type PublicationPageView = {
  id: string;
  title: string;
  slug: string;
  draftRevision: number;
  setup: "READY" | "NO_SECTIONS";
  document: LandingPageDocumentV1;
  media: PublicationMediaInput[];
  history: PublicationHistoryItem[];
  activeVersion: number | null;
  unpublishedChanges: boolean;
  runtimeEnabled: boolean;
  publicPath: string;
  publicUrl: string | null;
};

export type PublicationPanel = {
  kind: "landing-publication";
  mode: "preview" | "live";
  preview: boolean;
  authenticated: boolean;
  blockKey: string;
  pages: PublicationPageView[];
  suggestedPageId: string | null;
};

export function publicationSetup(input: { pageCount: number; sectionCount: number }): "NO_PROJECT" | "NO_SECTIONS" | "READY" {
  if (input.pageCount < 1) return "NO_PROJECT";
  if (input.sectionCount < 1) return "NO_SECTIONS";
  return "READY";
}

export function publicationPublicPath(slug: string): string {
  return `/p/${slug}`;
}

/** URL absoluta só quando o runtime deste ambiente pode servir a rota. O resultado da aula guarda o caminho, não o host. */
export function publicationPublicUrl(slug: string, runtimeEnabled: boolean): string | null {
  if (!runtimeEnabled) return null;
  return `${siteConfig.url}${publicationPublicPath(slug)}`;
}

export function publicationAcknowledgedBlocker(codes: readonly string[]): boolean {
  return codes.some((code) => code in BLOCKER_COPY);
}

export function publicationIssueCopy(code: string, kind: "blocker" | "warning"): string {
  const table = kind === "blocker" ? BLOCKER_COPY : WARNING_COPY;
  return table[code] ?? (kind === "blocker" ? "Há um ponto que precisa ser corrigido antes da publicação." : "Há um ponto que vale revisar.");
}

export function publicationIssueHref(code: string): string {
  if (code === "CONTRAST_CRITICAL" || code === "LARGE_IMAGE" || code === "INVALID_MEDIA" || code === "MEDIA_NOT_READY") return PUBLICATION_VISUAL_HREF;
  if (code === "INVALID_TRUST" || code === "TESTIMONIAL_CONSENT" || code === "NO_TRUST_PROOF") return PUBLICATION_TRUST_HREF;
  if (code.startsWith("EXPERIENCE_") || code === "DEFERRED_ATTENTION") return PUBLICATION_EXPERIENCE_HREF;
  if (
    code === "INVALID_ACTION" ||
    code === "INVALID_FORM" ||
    code === "INVALID_MEASUREMENT" ||
    code === "INVALID_PRIMARY_CONVERSION"
  ) {
    return PUBLICATION_MEASUREMENT_HREF;
  }
  return PUBLICATION_COPY_HREF;
}

export function publicationBlockedMessage(count: number): string {
  if (count === 1) return "Existe 1 ponto que precisa ser corrigido antes da publicação.";
  return `Existem ${count} pontos que precisam ser corrigidos antes da publicação.`;
}

export function publicationLessonMessage(code: string): string {
  if (code === "LANDING_PAGE_DRAFT_CONFLICT") return PUBLICATION_CONFLICT_COPY;
  if (code === "RUNTIME_DISABLED") return PUBLICATION_RUNTIME_OFF_COPY;
  if (code === "LANDING_PAGE_NO_PUBLIC_CHANGES") return PUBLICATION_NO_CHANGES_COPY;
  if (code === "LANDING_PAGE_NOT_READY") return "A página ainda tem pendências para corrigir.";
  return PUBLICATION_UNKNOWN_COPY;
}

export function publicationReadinessGroups(readiness: PublicationReadiness) {
  return {
    ready: readiness.ready,
    blockers: readiness.blockers.map((code) => ({
      code,
      label: publicationIssueCopy(code, "blocker"),
      href: publicationIssueHref(code),
    })),
    warnings: readiness.warnings.map((code) => ({
      code,
      label: publicationIssueCopy(code, "warning"),
      href: publicationIssueHref(code),
    })),
  };
}

export function publicationActionLabel(action: LandingPageAction | null): string {
  if (!action) return "Ação ainda não configurada";
  return ACTION_LABEL[action.type];
}

export function publicationReviewLabel(document: LandingPageDocumentV1, draftRevision: number): string {
  return REVIEW_LABEL[experienceReviewEffectiveStatus(document, draftRevision)];
}

export function publicationLessonCanComplete(input: { runtimeEnabled: boolean; activeSnapshot: unknown | null }): boolean {
  if (!input.runtimeEnabled || !input.activeSnapshot) return false;
  return validatePublicationSnapshot(input.activeSnapshot).ok;
}

/** O gate é lido no servidor. O cliente só recebe o boolean já resolvido. */
export function publicationRuntimeForLesson(env?: { LANDING_PAGE_PUBLIC_RUNTIME_ENABLED?: string }): boolean {
  return landingPagePublicRuntimeEnabled(env);
}

export function publicationLessonResult(input: {
  landingPageProjectId: string;
  publicationId: string;
  publicationVersion: number;
  publicSlug: string;
  primaryActionType: PublicationLessonResult["primaryActionType"];
  primaryConversionEvent: PublicationLessonResult["primaryConversionEvent"];
  warningCount: number;
  acknowledgedWarningCount: number;
  publishedAt: string;
  sourceDraftRevision: number;
}): PublicationLessonResult | null {
  const parsed = publicationLessonResponseSchema.safeParse({
    ...input,
    snapshotSchemaVersion: 1,
    publicPath: publicationPublicPath(input.publicSlug),
  });
  return parsed.success ? parsed.data : null;
}

export function publicationResultDisplay(result: PublicationLessonResult) {
  return {
    versao: String(result.publicationVersion),
    endereco: result.publicPath,
    acao: ACTION_LABEL[result.primaryActionType],
    conversao: LANDING_PAGE_MEASUREMENT_LABELS[result.primaryConversionEvent],
    avisos: `${result.acknowledgedWarningCount} de ${result.warningCount}`,
  };
}

export function toPublicationPageView(
  record: Pick<LandingPageProjectRecord, "id" | "title" | "slug" | "draftRevision" | "draftDocument">,
  input: {
    media: PublicationMediaInput[];
    history: PublicationHistoryItem[];
    activeVersion: number | null;
    activeSourceRevision: number | null;
    runtimeEnabled: boolean;
  },
): PublicationPageView {
  const sections = record.draftDocument.sections.filter((section) => section.enabled);
  const unpublishedChanges =
    input.activeSourceRevision != null && record.draftRevision > input.activeSourceRevision;
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    draftRevision: record.draftRevision,
    setup: sections.length === 0 ? "NO_SECTIONS" : "READY",
    document: record.draftDocument,
    media: input.media,
    history: input.history,
    activeVersion: input.activeVersion,
    unpublishedChanges,
    runtimeEnabled: input.runtimeEnabled,
    publicPath: publicationPublicPath(record.slug),
    publicUrl: publicationPublicUrl(record.slug, input.runtimeEnabled),
  };
}

export function publicationPreviewState(): PublicationPanel {
  return {
    kind: "landing-publication",
    mode: "preview",
    preview: true,
    authenticated: false,
    blockKey: "ferramenta-publicacao",
    pages: [],
    suggestedPageId: null,
  };
}

export function publicationPageReadiness(page: Pick<PublicationPageView, "document" | "draftRevision" | "slug" | "id" | "media">) {
  return evaluateLandingPagePublicationReadiness({
    document: page.document,
    draftRevision: page.draftRevision,
    slug: page.slug,
    projectId: page.id,
    media: page.media,
  });
}
