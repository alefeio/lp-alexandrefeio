import { z } from "zod";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { experienceReviewEffectiveStatus } from "@/lib/landing-page/experience/review";
import {
  EXPERIENCE_FINDING_CATEGORIES,
  type ExperienceActionCode,
  type ExperienceFindingV1,
  type LandingPageExperienceReviewV1,
} from "@/lib/landing-page/experience/schema";
import { EXPERIENCE_VIEWPORT_CONTROL, EXPERIENCE_VIEWPORT_IDS, type ExperienceViewportId } from "@/lib/landing-page/experience/viewports";
import type { LandingPageMediaRecord } from "@/lib/landing-page/media/record";
import type { LandingPageProjectRecord } from "@/lib/landing-page/types";

export const LANDING_PAGE_EXPERIENCE_TOOL = "LANDING_PAGE_EXPERIENCE_REVIEW_V1" as const;
export const SITE_EXPERIENCE_SLUG = "pagina-mobile-e-experiencia";
export const EXPERIENCE_RESULT_TITLE = "Revisão de experiência da minha landing page";
export const EXPERIENCE_STALE_COPY = "Esta revisão está desatualizada porque sua página mudou.";
export const EXPERIENCE_DEFER_COPY = "Você poderá voltar a este ponto antes de publicar.";
export const EXPERIENCE_PREVIEW_LIMIT = "Os botões e o formulário desta prévia não enviam nada. A ação não abre outra página.";
export const EXPERIENCE_NO_SECTIONS_HREF = "/aulas/organize-as-secoes-da-pagina";
export const EXPERIENCE_NO_PROJECT_HREF = "/aulas/oferta-publico-acao-principal";

export const SECTION_TYPE_LABEL: Record<string, string> = {
  HERO: "Abertura",
  PROBLEM: "Problema",
  SOLUTION: "Solução",
  BENEFITS: "Benefícios",
  PROCESS: "Processo",
  TRUST: "Confiança",
  PORTFOLIO: "Portfólio",
  TESTIMONIALS: "Depoimentos",
  FAQ: "Perguntas",
  CTA: "Ação",
  FORM: "Formulário",
  CONTACT: "Contato",
  FOOTER: "Rodapé",
};

export const EXPERIENCE_CATEGORY_LABEL: Record<(typeof EXPERIENCE_FINDING_CATEGORIES)[number], string> = {
  RESPONSIVE: "Responsivo",
  READABILITY: "Leitura",
  HIERARCHY: "Hierarquia",
  ACTION: "Ação",
  FORM: "Formulário",
  MEDIA: "Mídia",
  CONTENT: "Conteúdo",
  NAVIGATION: "Navegação",
  ACCESSIBILITY: "Acessibilidade",
  PERFORMANCE_PERCEIVED: "Velocidade percebida",
};

export const EXPERIENCE_SEVERITY_LABEL = {
  INFO: "Observação",
  ATTENTION: "Precisa de atenção",
  BLOCKER: "Precisa ser resolvido",
} as const;

export const EXPERIENCE_STATUS_LABEL = {
  OPEN: "Aberto",
  RESOLVED: "Resolvido",
  DEFERRED: "Adiado",
  NOT_APPLICABLE: "Não se aplica",
} as const;

const ACTION_LINKS: Record<ExperienceActionCode, { href: string | null; label: string }> = {
  REVIEW_COPY: { href: "/aulas/mensagem-que-deixa-a-oferta-clara", label: "Revisar na aula da mensagem" },
  REVIEW_THEME: { href: "/aulas/hierarquia-visual-e-atencao", label: "Revisar na aula de hierarquia" },
  REVIEW_TRUST: { href: "/aulas/construa-confianca", label: "Revisar na aula de confiança" },
  REVIEW_MEDIA: { href: "/aulas/construa-confianca", label: "Revisar a mídia" },
  CONFIGURE_ACTION: { href: "/aulas/oferta-publico-acao-principal", label: "Configurar a ação" },
  REVIEW_FORM: { href: null, label: "O funcionamento do formulário vem em uma etapa posterior." },
};

export function sectionTypeLabel(type: string) {
  return SECTION_TYPE_LABEL[type] ?? type;
}

export function experienceActionLink(code: ExperienceActionCode | undefined) {
  if (!code) return null;
  return ACTION_LINKS[code];
}

export function experienceViewportLabel(viewport: ExperienceViewportId | undefined) {
  if (!viewport) return "A página";
  return EXPERIENCE_VIEWPORT_CONTROL[viewport];
}

export function groupExperienceFindings(findings: readonly ExperienceFindingV1[]) {
  return {
    blockers: findings.filter((finding) => finding.severity === "BLOCKER" && finding.status === "OPEN"),
    attention: findings.filter((finding) => finding.severity === "ATTENTION" && (finding.status === "OPEN" || finding.status === "DEFERRED")),
    info: findings.filter((finding) => finding.severity === "INFO" && finding.status === "OPEN"),
    reviewed: findings.filter((finding) => finding.status === "RESOLVED" || finding.status === "NOT_APPLICABLE"),
  };
}

export function experienceReviewProgress(review: LandingPageExperienceReviewV1 | null) {
  const attention = review?.findings.filter((finding) => finding.severity === "ATTENTION") ?? [];
  return {
    viewportsReviewed: review?.reviewedViewports.length ?? 0,
    viewportTotal: EXPERIENCE_VIEWPORT_IDS.length,
    openBlockers: review?.summary.openBlockerCount ?? 0,
    attentionReviewed: attention.filter((finding) => finding.status !== "OPEN").length,
    attentionTotal: attention.length,
  };
}

export const experienceLessonResponseSchema = z
  .object({
    landingPageProjectId: z.string().trim().min(1),
    reviewVersion: z.literal(1),
    status: z.literal("READY_FOR_NEXT_STEP"),
    viewportsReviewed: z.number().int().min(4).max(4),
    systemFindingCount: z.number().int().nonnegative(),
    userFindingCount: z.number().int().nonnegative(),
    blockerCount: z.number().int().nonnegative(),
    attentionCount: z.number().int().nonnegative(),
    resolvedCount: z.number().int().nonnegative(),
    deferredCount: z.number().int().nonnegative(),
    reviewedDraftRevision: z.number().int().positive(),
    draftRevision: z.number().int().positive(),
  })
  .strict();

export type ExperienceLessonResponse = z.infer<typeof experienceLessonResponseSchema>;

export function experienceLessonResult(input: {
  landingPageProjectId: string;
  document: LandingPageDocumentV1;
  draftRevision: number;
}): ExperienceLessonResponse | null {
  const review = input.document.experienceReview;
  if (!review || experienceReviewEffectiveStatus(input.document, input.draftRevision) !== "READY_FOR_NEXT_STEP") return null;
  const findings = review.findings;
  return experienceLessonResponseSchema.parse({
    landingPageProjectId: input.landingPageProjectId,
    reviewVersion: review.version,
    status: "READY_FOR_NEXT_STEP",
    viewportsReviewed: review.reviewedViewports.length,
    systemFindingCount: findings.filter((finding) => finding.source === "SYSTEM").length,
    userFindingCount: findings.filter((finding) => finding.source === "USER").length,
    blockerCount: findings.filter((finding) => finding.severity === "BLOCKER" && finding.status === "OPEN").length,
    attentionCount: findings.filter((finding) => finding.severity === "ATTENTION").length,
    resolvedCount: findings.filter((finding) => finding.status === "RESOLVED").length,
    deferredCount: findings.filter((finding) => finding.status === "DEFERRED").length,
    reviewedDraftRevision: review.reviewedDraftRevision,
    draftRevision: input.draftRevision,
  });
}

export type ExperiencePageMedia = {
  id: string;
  status: LandingPageMediaRecord["status"];
  publicUrl: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  fileSize: number;
};

export type ExperiencePageView = {
  id: string;
  title: string;
  status: LandingPageProjectRecord["status"];
  draftRevision: number;
  setup: "READY" | "NO_SECTIONS";
  effectiveStatus: ReturnType<typeof experienceReviewEffectiveStatus>;
  document: LandingPageDocumentV1;
  media: ExperiencePageMedia[];
};

export type ExperiencePanel = {
  kind: "landing-experience";
  mode: "preview" | "live";
  preview: boolean;
  authenticated: boolean;
  blockKey: string;
  pages: ExperiencePageView[];
  suggestedPageId: string | null;
};

export function toExperiencePageView(record: LandingPageProjectRecord, media: LandingPageMediaRecord[]): ExperiencePageView {
  const enabled = record.draftDocument.sections.filter((section) => section.enabled);
  return {
    id: record.id,
    title: record.title,
    status: record.status,
    draftRevision: record.draftRevision,
    setup: enabled.length === 0 ? "NO_SECTIONS" : "READY",
    effectiveStatus: experienceReviewEffectiveStatus(record.draftDocument, record.draftRevision),
    document: record.draftDocument,
    media: media.map((item) => ({
      id: item.id,
      status: item.status,
      publicUrl: item.publicUrl,
      width: item.width,
      height: item.height,
      altText: item.altText,
      fileSize: item.fileSize,
    })),
  };
}

export function experiencePreviewState(): ExperiencePanel {
  return {
    kind: "landing-experience",
    mode: "preview",
    preview: true,
    authenticated: false,
    blockKey: "ferramenta-experiencia",
    pages: [],
    suggestedPageId: null,
  };
}
