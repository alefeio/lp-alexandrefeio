import { randomUUID } from "node:crypto";
import { z } from "zod";
import { parseLandingPageDocument, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageMediaStore } from "@/lib/landing-page/media/record";
import { landingPageReferencesMedia, landingPageReferencesProof } from "@/lib/landing-page/media/refs";
import { availableSectionTypes, cardinalityAllows } from "@/lib/landing-page/wireframe/policy";
import { evaluateLandingPageTrust } from "@/lib/landing-page/trust/evaluate";
import {
  TRUST_PROOF_TYPES,
  type LandingPageTrustPlanV1,
  type TrustProofType,
  type TrustProofV1,
} from "@/lib/landing-page/trust/schema";
import type { LandingPageProjectRecord, LandingPageStore } from "@/lib/landing-page/types";

export const LANDING_PAGE_TRUST_TOOL = "LANDING_PAGE_TRUST_V1";
export const SITE_TRUST_SLUG = "construa-confianca";
export const TRUST_STRUCTURE_HREF = "/aulas/organize-as-secoes-da-pagina";
export const TRUST_STRUCTURE_CTA = "Monte a estrutura da sua landing page";
export const TRUST_MEDIA_UNAVAILABLE =
  "O envio de imagens está temporariamente indisponível. Você pode continuar cadastrando as informações e adicionar as imagens depois.";
export const TRUST_CONSENT_MESSAGE = "Confirme que você possui autorização para usar este depoimento.";

export const TRUST_PROOF_LABELS: Record<TrustProofType, string> = {
  TESTIMONIAL: "Depoimento",
  PORTFOLIO: "Portfólio",
  CASE: "Case",
  CREDENTIAL: "Credencial",
  EXPERIENCE: "Experiência",
  PROCESS_EVIDENCE: "Processo",
  BUSINESS_INFORMATION: "Informação do negócio",
  OTHER: "Outro",
};

const NEXT_ACTION_BY_TYPE: Record<TrustProofType, string> = {
  TESTIMONIAL: "Pedir autorização para usar um depoimento real, quando ele existir.",
  PORTFOLIO: "Organizar fotos de trabalhos reais, se você já tiver portfólio.",
  CASE: "Registrar um case somente com o contexto e o resultado que você realmente conhece.",
  CREDENTIAL: "Cadastrar sua credencial, se ela for sua.",
  EXPERIENCE: "Informar experiência factual, somente o que você confirmar.",
  PROCESS_EVIDENCE: "Documentar o processo real, se ele já existir.",
  BUSINESS_INFORMATION: "Incluir uma informação institucional verdadeira, se fizer sentido.",
  OTHER: "Anotar outro fato real que ajude o visitante a entender o trabalho.",
};

const planInputSchema = z
  .object({
    decision: z.enum(["NO_PROOF_YET", "SHOW_SELECTED"]),
    selectedProofIds: z.array(z.string().trim().min(1).max(64)).max(8),
    reviewedProofTypes: z.array(z.enum(TRUST_PROOF_TYPES)).max(8),
    linkTrust: z.boolean(),
    addPortfolio: z.boolean(),
    addTestimonials: z.boolean(),
    mediaAlt: z.record(z.string().trim().min(1).max(64), z.string().trim().min(1).max(180)).optional(),
  })
  .strict();

export type TrustPlanInput = z.infer<typeof planInputSchema>;

export const trustLessonResponseSchema = z
  .object({
    kind: z.literal("landing-trust-summary"),
    landingPageProjectId: z.string().trim().min(1).max(64),
    trustPlanVersion: z.literal(1),
    availableProofCount: z.number().int().nonnegative(),
    readyProofCount: z.number().int().nonnegative(),
    selectedProofCount: z.number().int().nonnegative(),
    testimonialCount: z.number().int().nonnegative(),
    portfolioCount: z.number().int().nonnegative(),
    credentialCount: z.number().int().nonnegative(),
    pendingConsentCount: z.number().int().nonnegative(),
    nextActionCount: z.number().int().nonnegative(),
    mediaCount: z.number().int().nonnegative(),
    draftRevision: z.number().int().nonnegative(),
  })
  .strict();

export type TrustLessonResponse = z.infer<typeof trustLessonResponseSchema>;

export type TrustProofView = {
  id: string;
  type: TrustProofType;
  title: string;
  status: "DRAFT" | "READY_FOR_DISPLAY";
  consentConfirmed: boolean;
  referenced: boolean;
};

export type TrustMediaView = {
  id: string;
  status: "UPLOADING" | "READY" | "FAILED" | "DELETED";
  altText: string | null;
  referenced: boolean;
};

export type TrustPageView = {
  id: string;
  title: string;
  draftRevision: number;
  status: string;
  setup: "READY" | "NEED_SECTIONS";
  copyHint: boolean;
  previewHref: string;
  proofs: TrustProofView[];
  media: TrustMediaView[];
  hasTrust: boolean;
  hasPortfolio: boolean;
  hasTestimonials: boolean;
  canAddPortfolio: boolean;
  canAddTestimonials: boolean;
  readyTestimonials: boolean;
  processStepCount: number;
  trustIntroNeedsWriting: boolean;
  owned: string[];
  canPrepare: string[];
};

export function toTrustPageView(
  page: { id: string; title: string; draftRevision: number; status: string; draftDocument: LandingPageDocumentV1 },
  media: Array<Pick<TrustMediaView, "id" | "status" | "altText">>,
): TrustPageView {
  const document = page.draftDocument;
  const proofs = document.strategy?.copyFacts?.trustProofs ?? [];
  const summary = trustInventorySummary(proofs);
  const types = document.sections.map((section) => section.type);
  const available = new Set(availableSectionTypes(types));
  const trust = document.sections.find((section) => section.type === "TRUST");
  const readyTestimonials = proofs.some(
    (proof) => proof.type === "TESTIMONIAL" && proof.status === "READY_FOR_DISPLAY" && proof.consentConfirmed === true,
  );
  return {
    id: page.id,
    title: page.title,
    draftRevision: page.draftRevision,
    status: page.status,
    setup: document.sections.length > 0 ? "READY" : "NEED_SECTIONS",
    copyHint: document.sections.some((section) => section.type === "HERO" && section.contentStatus !== "APPROVED"),
    previewHref: `/app/landing-pages/${page.id}/preview`,
    proofs: proofs.flatMap((proof) => {
      if (!proof.id) return [];
      return [{
        id: proof.id,
        type: proof.type,
        title: proof.title,
        status: proof.status === "READY_FOR_DISPLAY" ? "READY_FOR_DISPLAY" as const : "DRAFT" as const,
        consentConfirmed: proof.consentConfirmed === true,
        referenced: landingPageReferencesProof(document, proof.id),
      }];
    }),
    media: media.map((item) => ({
      id: item.id,
      status: item.status,
      altText: item.altText,
      referenced: landingPageReferencesMedia(document, item.id),
    })),
    hasTrust: Boolean(trust),
    hasPortfolio: types.includes("PORTFOLIO"),
    hasTestimonials: types.includes("TESTIMONIALS"),
    canAddPortfolio: available.has("PORTFOLIO"),
    canAddTestimonials: available.has("TESTIMONIALS"),
    readyTestimonials,
    processStepCount: document.strategy?.copyFacts?.processSteps?.length ?? 0,
    trustIntroNeedsWriting: Boolean(trust && (trust.contentStatus === "PLACEHOLDER" || trust.contentStatus === "DRAFT")),
    owned: summary.owned,
    canPrepare: summary.canPrepare,
  };
}

export function landingPageMediaUploadsAvailable(env: Record<string, string | undefined> = process.env): boolean {
  if (env.LANDING_PAGE_MEDIA_UPLOADS === "off") return false;
  return Boolean(env.BLOB_READ_WRITE_TOKEN || env.VERCEL_OIDC_TOKEN);
}

export function confirmedProcessProof(stepCount: number): Pick<TrustProofV1, "type" | "title" | "description"> | null {
  if (stepCount < 1) return null;
  return {
    type: "PROCESS_EVIDENCE",
    title: "Processo informado",
    description: "As etapas já cadastradas nesta página foram confirmadas como o processo real.",
  };
}

export function nextTrustActions(input: {
  readyTypes: readonly TrustProofType[];
  pendingConsent: boolean;
  decision: "NO_PROOF_YET" | "SHOW_SELECTED";
}): string[] {
  const ready = new Set(input.readyTypes);
  const actions = TRUST_PROOF_TYPES.filter((type) => !ready.has(type)).map((type) => NEXT_ACTION_BY_TYPE[type]);
  if (input.pendingConsent) {
    return [TRUST_CONSENT_MESSAGE, ...actions.filter((action) => action !== NEXT_ACTION_BY_TYPE.TESTIMONIAL)].slice(0, 4);
  }
  if (input.decision === "SHOW_SELECTED" && actions.length === 0) return [];
  return actions.slice(0, 4);
}

export function trustInventorySummary(proofs: readonly Pick<TrustProofV1, "type" | "status">[]): {
  owned: string[];
  canPrepare: string[];
} {
  const ready = proofs.filter((proof) => proof.status === "READY_FOR_DISPLAY");
  const owned = TRUST_PROOF_TYPES.flatMap((type) => {
    const count = ready.filter((proof) => proof.type === type).length;
    if (count === 0) return [];
    return [proofCountLabel(type, count)];
  });
  const present = new Set(ready.map((proof) => proof.type));
  const canPrepare = TRUST_PROOF_TYPES.filter((type) => !present.has(type)).map((type) => TRUST_PROOF_LABELS[type].toLowerCase());
  return { owned, canPrepare };
}

function proofCountLabel(type: TrustProofType, count: number): string {
  if (type === "PORTFOLIO") return count === 1 ? "1 item de portfólio" : `${count} itens de portfólio`;
  if (type === "TESTIMONIAL") return count === 1 ? "1 depoimento" : `${count} depoimentos`;
  if (type === "CREDENTIAL") return count === 1 ? "1 credencial" : `${count} credenciais`;
  if (type === "CASE") return count === 1 ? "1 case" : `${count} cases`;
  if (type === "PROCESS_EVIDENCE") return "processo estruturado";
  const label = TRUST_PROOF_LABELS[type].toLowerCase();
  return count === 1 ? `1 ${label}` : `${count} ${label}`;
}

export function trustLessonResult(input: {
  landingPageProjectId: string;
  document: LandingPageDocumentV1;
  mediaCount: number;
  draftRevision: number;
}): TrustLessonResponse {
  const proofs = input.document.strategy?.copyFacts?.trustProofs ?? [];
  const ready = proofs.filter((proof) => proof.status === "READY_FOR_DISPLAY");
  const plan = input.document.strategy?.trustPlan;
  const evaluation = evaluateLandingPageTrust(input.document);
  return {
    kind: "landing-trust-summary",
    landingPageProjectId: input.landingPageProjectId,
    trustPlanVersion: 1,
    availableProofCount: proofs.length,
    readyProofCount: ready.length,
    selectedProofCount: plan?.selectedProofIds.length ?? 0,
    testimonialCount: ready.filter((proof) => proof.type === "TESTIMONIAL").length,
    portfolioCount: ready.filter((proof) => proof.type === "PORTFOLIO").length,
    credentialCount: ready.filter((proof) => proof.type === "CREDENTIAL").length,
    pendingConsentCount: evaluation.pendingConsent.length,
    nextActionCount: plan?.nextActions.length ?? 0,
    mediaCount: input.mediaCount,
    draftRevision: input.draftRevision,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export async function saveLandingPageTrustPlan(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    plan: unknown;
  },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const parsed = planInputSchema.safeParse(input.plan);
  if (!parsed.success) return fail("INVALID_INPUT");
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) {
    return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  }
  if (project.draftDocument.sections.length === 0) return fail("INVALID_INPUT");
  const choice = parsed.data;
  const selectedIds = unique(choice.selectedProofIds);
  if (choice.decision === "NO_PROOF_YET" && (selectedIds.length > 0 || choice.addPortfolio || choice.addTestimonials || choice.linkTrust)) {
    return fail("INVALID_INPUT");
  }
  if (choice.decision === "SHOW_SELECTED" && selectedIds.length === 0) return fail("INVALID_INPUT");

  const proofs = project.draftDocument.strategy?.copyFacts?.trustProofs ?? [];
  const selected: TrustProofV1[] = [];
  for (const id of selectedIds) {
    const proof = proofs.find((item) => item.id === id);
    if (!proof?.id || proof.status !== "READY_FOR_DISPLAY") return fail("INVALID_INPUT");
    if (proof.type === "TESTIMONIAL" && proof.consentConfirmed !== true) return fail("INVALID_INPUT");
    selected.push(proof);
  }
  const testimonialIds = selected.filter((proof) => proof.type === "TESTIMONIAL").map((proof) => proof.id as string);
  const portfolioProofs = selected.filter((proof) => proof.type === "PORTFOLIO");
  if (choice.addTestimonials && testimonialIds.length === 0) return fail("INVALID_INPUT");
  if (choice.addPortfolio && portfolioProofs.length === 0) return fail("INVALID_INPUT");

  const document = structuredClone(project.draftDocument);
  const themeBefore = JSON.stringify(document.theme);
  const directionBefore = JSON.stringify(document.strategy?.visualDirection ?? null);
  const copyBefore = document.sections.map((section) => ({
    id: section.id,
    contentStatus: section.contentStatus,
    heading: "heading" in section.content ? section.content.heading : undefined,
  }));

  let portfolioSectionId = document.sections.find((section) => section.type === "PORTFOLIO")?.id;
  let testimonialsSectionId = document.sections.find((section) => section.type === "TESTIMONIALS")?.id;
  if (choice.addPortfolio && !portfolioSectionId) {
    const added = appendSection(document, "PORTFOLIO");
    if (!added) return fail("INVALID_INPUT");
    portfolioSectionId = added;
  }
  if (choice.addTestimonials && !testimonialsSectionId) {
    const added = appendSection(document, "TESTIMONIALS");
    if (!added) return fail("INVALID_INPUT");
    testimonialsSectionId = added;
  }

  if (choice.addPortfolio && portfolioSectionId) {
    const items = await portfolioItems(mediaStore, input.userId, project.id, portfolioProofs, choice.mediaAlt ?? {});
    if (items === "rejected") return fail("LANDING_PAGE_MEDIA_REJECTED");
    const section = document.sections.find((item) => item.id === portfolioSectionId);
    if (!section || section.type !== "PORTFOLIO") return fail("INVALID_INPUT");
    if (items.length > 0) section.content = { ...section.content, items };
  }
  if (choice.addTestimonials && testimonialsSectionId) {
    const section = document.sections.find((item) => item.id === testimonialsSectionId);
    if (!section || section.type !== "TESTIMONIALS") return fail("INVALID_INPUT");
    section.content = { ...section.content, proofRefs: testimonialIds };
  }
  const trustSection = document.sections.find((section) => section.type === "TRUST");
  if (choice.linkTrust && trustSection?.type === "TRUST") {
    const trustIds = choice.addTestimonials ? selectedIds.filter((id) => !testimonialIds.includes(id)) : selectedIds;
    trustSection.content = { ...trustSection.content, proofRefs: trustIds };
  }

  const readyTypes = proofs
    .filter((proof) => proof.status === "READY_FOR_DISPLAY")
    .map((proof) => proof.type);
  const pendingConsent = proofs.some((proof) => proof.type === "TESTIMONIAL" && proof.consentConfirmed !== true);
  const missingProofTypes = TRUST_PROOF_TYPES.filter((type) => !readyTypes.includes(type));
  const plan: LandingPageTrustPlanV1 = {
    version: 1,
    decision: choice.decision,
    reviewedProofTypes: unique(choice.reviewedProofTypes) as TrustProofType[],
    selectedProofIds: selectedIds,
    sectionUsage: {
      ...(choice.linkTrust && trustSection ? { trustSectionId: trustSection.id } : {}),
      ...(choice.addPortfolio && portfolioSectionId ? { portfolioSectionId } : {}),
      ...(choice.addTestimonials && testimonialsSectionId ? { testimonialsSectionId } : {}),
    },
    missingProofTypes,
    nextActions: nextTrustActions({ readyTypes, pendingConsent, decision: choice.decision }),
    reviewedAt: new Date().toISOString(),
  };
  document.strategy = { ...document.strategy, trustPlan: plan };

  if (JSON.stringify(document.theme) !== themeBefore) return fail("INVALID_DOCUMENT");
  if (JSON.stringify(document.strategy.visualDirection ?? null) !== directionBefore) return fail("INVALID_DOCUMENT");
  for (const previous of copyBefore) {
    const section = document.sections.find((item) => item.id === previous.id);
    if (!section || section.contentStatus !== previous.contentStatus) return fail("INVALID_DOCUMENT");
    if ("heading" in section.content && section.content.heading !== previous.heading) return fail("INVALID_DOCUMENT");
  }

  const checked = parseLandingPageDocument(document);
  if (!checked.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: project.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: checked.document,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  return ok(updated.record);
}

function appendSection(document: LandingPageDocumentV1, type: "PORTFOLIO" | "TESTIMONIALS"): string | null {
  const types = [...document.sections.map((section) => section.type), type];
  if (!cardinalityAllows(types)) return null;
  const wireframe = document.strategy?.wireframe;
  if (wireframe && wireframe.finalSections.length >= types.length) return null;
  const id = randomUUID();
  const order = document.sections.length;
  const base = {
    id,
    type,
    variant: "default" as const,
    order,
    enabled: true,
    settings: { backgroundRole: "DEFAULT" as const, alignment: "LEFT" as const, emphasis: "NORMAL" as const },
    contentStatus: "PLACEHOLDER" as const,
  };
  if (type === "PORTFOLIO") {
    document.sections.push({ ...base, type: "PORTFOLIO", content: { heading: "Trabalhos", items: [] } });
  } else {
    document.sections.push({ ...base, type: "TESTIMONIALS", content: { heading: "Depoimentos", proofRefs: [] } });
  }
  if (wireframe) {
    const used = new Set(wireframe.finalSections.map((item) => item.key));
    let key = `extra-${type.toLowerCase()}`;
    let suffix = 2;
    while (used.has(key)) {
      key = `extra-${type.toLowerCase()}-${suffix}`;
      suffix += 1;
    }
    wireframe.finalSections.push({ key, type, origin: "USER_ADDED" });
    wireframe.userModified = true;
  }
  return id;
}

async function portfolioItems(
  mediaStore: LandingPageMediaStore,
  userId: string,
  landingPageProjectId: string,
  proofs: TrustProofV1[],
  mediaAlt: Record<string, string>,
) {
  const items: Array<{
    mediaRef: { mediaId: string; usage: "PORTFOLIO"; altText?: string; decorative?: boolean };
    title?: string;
    description?: string;
  }> = [];
  for (const proof of proofs) {
    for (const mediaId of proof.mediaIds ?? []) {
      const media = await mediaStore.findById(mediaId);
      if (!media || media.userId !== userId || media.landingPageProjectId !== landingPageProjectId || media.status !== "READY") {
        return "rejected" as const;
      }
      const altText = mediaAlt[mediaId] ?? media.altText ?? proof.title;
      if (!altText || /[<>]/.test(altText)) return "rejected" as const;
      items.push({
        mediaRef: { mediaId, usage: "PORTFOLIO", altText },
        ...(proof.title ? { title: proof.title } : {}),
        ...(proof.description ? { description: proof.description } : {}),
      });
    }
  }
  return items.slice(0, 12);
}
