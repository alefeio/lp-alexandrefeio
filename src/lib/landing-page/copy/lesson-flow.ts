import { z } from "zod";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import type { LandingPageSection } from "@/lib/landing-page/components";
import { COPY_SUGGESTION_SECTION_TYPES } from "@/lib/landing-page/copy/constants";
import { WIREFRAME_PLACEHOLDERS, WIREFRAME_PURPOSE } from "@/lib/landing-page/wireframe/copy";

export const COPY_SECTION_LABEL: Record<string, string> = {
  HERO: "Abertura",
  PROBLEM: "Contexto",
  SOLUTION: "Solução",
  BENEFITS: "Benefícios",
  PROCESS: "Processo",
  TRUST: "Confiança",
  FAQ: "Dúvidas",
  CTA: "Convite",
  FORM: "Formulário",
  CONTACT: "Contato",
  FOOTER: "Rodapé",
};

const CORE_TYPES = ["HERO", "PROBLEM", "SOLUTION", "BENEFITS", "CTA"] as const;
const OPTIONAL_TYPES = ["PROCESS", "FAQ", "TRUST", "FORM"] as const;

export const COPY_AI_SECTION_TYPES = COPY_SUGGESTION_SECTION_TYPES;

export function copyStatusLabel(status: string | null | undefined): string {
  if (status === "APPROVED") return "Aprovado";
  if (status === "DRAFT") return "Em revisão";
  return "Ainda não escrito";
}

export function supportsCopyAssist(type: string): boolean {
  return (COPY_AI_SECTION_TYPES as readonly string[]).includes(type);
}

export type CopySetup = "NEED_PROJECT" | "NEED_BRIEF" | "NEED_JOURNEY" | "NEED_SECTIONS" | "READY";

export function copySetup(document: LandingPageDocumentV1 | null): CopySetup {
  if (!document) return "NEED_PROJECT";
  if (!document.strategy?.brief) return "NEED_BRIEF";
  if (!document.strategy.decisionJourney) return "NEED_JOURNEY";
  if (document.sections.length === 0) return "NEED_SECTIONS";
  return "READY";
}

export type CopyCoverageV1 = {
  version: 1;
  requiredCore: number;
  approvedCore: number;
  optionalPresent: number;
  optionalReviewed: number;
  draftOptional: number;
  approvedOptional: number;
  coreComplete: boolean;
  pendingOptional: boolean;
};

const INSTRUCTIONAL_COPY = new Set<string>(Object.values(WIREFRAME_PLACEHOLDERS));

export function containsInstructionalPlaceholder(value: unknown): boolean {
  if (typeof value === "string") return INSTRUCTIONAL_COPY.has(value);
  if (Array.isArray(value)) return value.some((item) => containsInstructionalPlaceholder(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => containsInstructionalPlaceholder(item));
  return false;
}

function coreSectionReady(section: LandingPageSection): boolean {
  return section.contentStatus === "APPROVED" && !containsInstructionalPlaceholder(section.content);
}

export function copyCoverage(document: LandingPageDocumentV1): CopyCoverageV1 {
  const core = document.sections.filter((section) => (CORE_TYPES as readonly string[]).includes(section.type));
  const optional = document.sections.filter((section) => (OPTIONAL_TYPES as readonly string[]).includes(section.type));
  const hero = document.sections.find((section) => section.type === "HERO");
  const approvedCore = core.filter((section) => coreSectionReady(section)).length;
  const draftOptional = optional.filter((section) => section.contentStatus === "DRAFT").length;
  const approvedOptional = optional.filter((section) => section.contentStatus === "APPROVED" && !containsInstructionalPlaceholder(section.content)).length;
  return {
    version: 1,
    requiredCore: core.length,
    approvedCore,
    optionalPresent: optional.length,
    optionalReviewed: draftOptional + approvedOptional,
    draftOptional,
    approvedOptional,
    coreComplete: Boolean(hero && coreSectionReady(hero) && core.every((section) => coreSectionReady(section))),
    pendingOptional: optional.some((section) => section.contentStatus !== "APPROVED" || containsInstructionalPlaceholder(section.content)),
  };
}

export function copyOriginCounts(sections: LandingPageSection[]) {
  const origin = (section: LandingPageSection) => (section as { copyMeta?: { origin?: string } }).copyMeta?.origin;
  return {
    aiAssistedSectionCount: sections.filter((section) => origin(section) === "AI_ASSISTED").length,
    manualSectionCount: sections.filter((section) => origin(section) === "MANUAL").length,
  };
}

export const COPY_LESSON_SCHEMA_VERSION = 1;

export function copyLessonResult(input: {
  landingPageProjectId: string;
  document: LandingPageDocumentV1;
  draftRevision: number;
  completedAt: string;
}) {
  const coverage = copyCoverage(input.document);
  const origins = copyOriginCounts(input.document.sections);
  return {
    kind: "landing-copy-summary" as const,
    landingPageProjectId: input.landingPageProjectId,
    copySchemaVersion: COPY_LESSON_SCHEMA_VERSION,
    coreSectionCount: coverage.requiredCore,
    approvedCoreCount: coverage.approvedCore,
    draftOptionalCount: coverage.draftOptional,
    approvedOptionalCount: coverage.approvedOptional,
    aiAssistedSectionCount: origins.aiAssistedSectionCount,
    manualSectionCount: origins.manualSectionCount,
    completedAt: input.completedAt,
    draftRevision: input.draftRevision,
  };
}

export const copyLessonResponseSchema = z
  .object({
    kind: z.literal("landing-copy-summary"),
    landingPageProjectId: z.string().trim().min(1).max(80),
    copySchemaVersion: z.literal(COPY_LESSON_SCHEMA_VERSION),
    coreSectionCount: z.number().int().min(1).max(30),
    approvedCoreCount: z.number().int().min(1).max(30),
    draftOptionalCount: z.number().int().min(0).max(30),
    approvedOptionalCount: z.number().int().min(0).max(30),
    aiAssistedSectionCount: z.number().int().min(0).max(30),
    manualSectionCount: z.number().int().min(0).max(30),
    completedAt: z.string().trim().min(1).max(40),
    draftRevision: z.number().int().min(1),
  })
  .strict();

export function copyAssistUserMessage(code: string): string {
  if (code === "COPY_ASSIST_RATE_LIMITED") return "Você fez várias gerações em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (code === "COPY_ASSIST_UNAVAILABLE") return "As sugestões automáticas estão temporariamente indisponíveis. Você ainda pode escrever e editar seu texto manualmente.";
  if (code === "COPY_ASSIST_PROVIDER_ERROR" || code === "COPY_ASSIST_INVALID_RESPONSE") return "Não foi possível gerar sugestões agora. Tente novamente ou escreva manualmente.";
  if (code === "LANDING_PAGE_DRAFT_CONFLICT") return "Esta página foi alterada em outro lugar. Atualize antes de salvar novamente.";
  if (code === "LANDING_PAGE_SECTION_INCOMPLETE") return "Esta seção ainda tem informações obrigatórias em aberto.";
  return "Não foi possível salvar agora.";
}

export function missingFactPrompt(code: string): string {
  if (code === "PROCESS_STEPS") return "quais são as etapas reais do atendimento?";
  if (code === "TRUST_PROOF") return "você possui alguma prova real que deseja apresentar?";
  if (code === "FAQ_ANSWER" || code === "DELIVERY_TIME") return "qual fato responde esta objeção, sem completar o que você ainda não sabe?";
  if (code === "ADDITIONAL_BENEFITS" || code === "PRIMARY_BENEFIT") return "qual benefício real você quer mostrar?";
  if (code === "PROBLEM_CONTEXT") return "qual é o contexto real do visitante?";
  return "qual informação real ainda falta?";
}

export const COPY_APPROVAL_NOTE = "Aprovar significa que este texto está pronto para seguir para as próximas etapas. Você ainda poderá editá-lo depois.";

export function sectionPurpose(type: string): string {
  if (type === "HERO") return "Deixar clara sua oferta e o próximo passo.";
  return WIREFRAME_PURPOSE[type] ?? "Cumprir a função desta seção.";
}

export type CopySectionView = {
  id: string;
  type: string;
  label: string;
  purpose: string;
  status: "PLACEHOLDER" | "DRAFT" | "APPROVED";
  statusLabel: string;
  order: number;
  ai: boolean;
  content: unknown;
};

export type CopyWorkspace = {
  id: string;
  title: string;
  draftRevision: number;
  projectStatus: string;
  setup: CopySetup;
  coverage: CopyCoverageV1;
  sections: CopySectionView[];
  previewHref: string;
  progressLabel: string;
  coreLabel: string | null;
  pendingNote: string | null;
};

export function toCopyWorkspace(page: {
  id: string;
  title: string;
  draftRevision: number;
  status: string;
  draftDocument: LandingPageDocumentV1;
}): CopyWorkspace {
  const coverage = copyCoverage(page.draftDocument);
  const reviewed = coverage.approvedCore + coverage.optionalReviewed;
  const total = coverage.requiredCore + coverage.optionalPresent;
  return {
    id: page.id,
    title: page.title,
    draftRevision: page.draftRevision,
    projectStatus: page.status,
    setup: copySetup(page.draftDocument),
    coverage,
    sections: [...page.draftDocument.sections].sort((left, right) => left.order - right.order).map((section) => ({
      id: section.id,
      type: section.type,
      label: COPY_SECTION_LABEL[section.type] ?? section.type,
      purpose: sectionPurpose(section.type),
      status: section.contentStatus ?? "PLACEHOLDER",
      statusLabel: copyStatusLabel(section.contentStatus),
      order: section.order,
      ai: supportsCopyAssist(section.type),
      content: section.content,
    })),
    previewHref: `/app/landing-pages/${page.id}/preview`,
    progressLabel: total > 0 ? `${reviewed} de ${total} seções revisadas.` : "Nenhuma seção para revisar.",
    coreLabel: coverage.coreComplete ? "Textos principais concluídos" : null,
    pendingNote: coverage.pendingOptional ? "Você ainda tem seções para revisar." : null,
  };
}
