import { validateLandingPageAction } from "@/lib/landing-page/action-validation";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { parseLandingPageDocument } from "@/lib/landing-page/document";
import { experienceReviewEffectiveStatus } from "@/lib/landing-page/experience/review";
import { landingPageFormContentSchema } from "@/lib/landing-page/forms/schema";
import { validateLandingPageMeasurement } from "@/lib/landing-page/measurement/validate";
import { isPublicInternalRouteAllowed } from "@/lib/landing-page/publication/internal-route";
import {
  buildLandingPagePublicationSnapshot,
  referencedMediaIds,
  selectedTrustProofs,
  type PublicationMediaInput,
} from "@/lib/landing-page/publication/snapshot";
import { isValidLandingPageSlug } from "@/lib/landing-page/slug";
import { assessThemeContrast } from "@/lib/landing-page/theme/schema";

const CORE_SECTION_TYPES = new Set(["HERO", "CTA", "FORM"]);
const LARGE_IMAGE_BYTES = 1_500_000;

export type PublicationReadiness = {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  draftRevision: number;
};

function push(list: string[], code: string) {
  if (!list.includes(code)) list.push(code);
}

/**
 * Avalia se o rascunho pode virar uma versão pública. Não grava e não produz nota.
 */
export function evaluateLandingPagePublicationReadiness(input: {
  document: unknown;
  draftRevision: number;
  slug: string;
  projectId: string;
  media?: PublicationMediaInput[];
}): PublicationReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const parsed = parseLandingPageDocument(input.document);
  if (!parsed.ok) {
    push(blockers, parsed.reason === "UNSUPPORTED_REGISTRY_VERSION" ? "UNSUPPORTED_REGISTRY" : "INVALID_SCHEMA");
    return { ready: false, blockers, warnings, draftRevision: input.draftRevision };
  }
  const document = parsed.document;
  if (!isValidLandingPageSlug(input.slug)) push(blockers, "INVALID_SLUG");

  const enabled = document.sections.filter((section) => section.enabled);
  if (!enabled.some((section) => section.type === "HERO")) push(blockers, "CORE_COPY_NOT_APPROVED");
  for (const section of enabled) {
    if (section.contentStatus === "PLACEHOLDER") push(blockers, "CORE_PLACEHOLDER");
    if (CORE_SECTION_TYPES.has(section.type) && section.contentStatus !== "APPROVED") push(blockers, "CORE_COPY_NOT_APPROVED");
    if (!CORE_SECTION_TYPES.has(section.type) && section.contentStatus === "DRAFT") push(warnings, "NON_CORE_DRAFT");
    if (section.type === "FORM") {
      const form = landingPageFormContentSchema.safeParse(section.content);
      if (!form.success || !form.data.successMessage) push(blockers, "INVALID_FORM");
    }
  }

  if (assessThemeContrast(document.theme).blocked.length > 0) push(blockers, "CONTRAST_CRITICAL");

  const primary = validateLandingPageAction(document.conversion.primaryAction, document);
  if (!primary.ok || !actionRouteAllowed(primary.ok ? primary.action : null)) push(blockers, "INVALID_ACTION");
  if (document.conversion.secondaryAction) {
    const secondary = validateLandingPageAction(document.conversion.secondaryAction, document);
    if (!secondary.ok || !actionRouteAllowed(secondary.ok ? secondary.action : null)) push(blockers, "INVALID_ACTION");
  }

  const measurement = validateLandingPageMeasurement(document, document.measurement);
  if (!measurement.valid) {
    const primaryInvalid = measurement.invalidSelections.includes("primaryConversionEvent") || measurement.invalidSelections.includes(document.measurement.primaryConversionEvent ?? "");
    push(blockers, primaryInvalid ? "INVALID_PRIMARY_CONVERSION" : "INVALID_MEASUREMENT");
  }

  reviewBlockers(document, input.draftRevision, blockers, warnings);
  trustBlockers(document, blockers, warnings);
  mediaBlockers(document, input.projectId, input.media ?? [], blockers, warnings);

  if (blockers.length === 0 && !buildLandingPagePublicationSnapshot(document, input.media ?? [])) {
    push(blockers, "INVALID_SNAPSHOT");
  }

  return { ready: blockers.length === 0, blockers, warnings, draftRevision: input.draftRevision };
}

function actionRouteAllowed(action: { type: string; path?: string } | null): boolean {
  if (!action) return false;
  if (action.type !== "INTERNAL_ROUTE") return true;
  return Boolean(action.path && isPublicInternalRouteAllowed(action.path));
}

function reviewBlockers(document: LandingPageDocumentV1, draftRevision: number, blockers: string[], warnings: string[]) {
  const review = document.experienceReview;
  if (!review) {
    push(blockers, "EXPERIENCE_REVIEW_MISSING");
    return;
  }
  const status = experienceReviewEffectiveStatus(document, draftRevision);
  if (status === "STALE") push(blockers, "EXPERIENCE_REVIEW_STALE");
  else if (status !== "READY_FOR_NEXT_STEP") push(blockers, "EXPERIENCE_REVIEW_NOT_READY");
  if (review.reviewedDraftRevision !== draftRevision) push(blockers, "EXPERIENCE_REVIEW_REVISION");
  if (review.findings.some((finding) => finding.severity === "BLOCKER" && finding.status === "OPEN") || review.summary.openBlockerCount > 0) {
    push(blockers, "EXPERIENCE_BLOCKER_OPEN");
  }
  if (review.findings.some((finding) => finding.severity === "ATTENTION" && finding.status === "DEFERRED")) {
    push(warnings, "DEFERRED_ATTENTION");
  }
}

function trustBlockers(document: LandingPageDocumentV1, blockers: string[], warnings: string[]) {
  const selected = selectedTrustProofs(document);
  const referenced = new Set<string>();
  for (const section of document.sections) {
    if (!section.enabled || (section.type !== "TRUST" && section.type !== "TESTIMONIALS")) continue;
    for (const proofId of section.content.proofRefs ?? []) referenced.add(proofId);
  }
  if (referenced.size === 0) push(warnings, "NO_TRUST_PROOF");
  const known = new Map((document.strategy?.copyFacts?.trustProofs ?? []).filter((proof) => proof.id).map((proof) => [proof.id as string, proof]));
  for (const proofId of referenced) {
    const proof = known.get(proofId);
    if (!proof || proof.status !== "READY_FOR_DISPLAY") {
      push(blockers, "INVALID_TRUST");
      continue;
    }
    if (proof.type === "TESTIMONIAL" && proof.consentConfirmed !== true) push(blockers, "TESTIMONIAL_CONSENT");
  }
  if (selected.length !== referenced.size && !blockers.includes("INVALID_TRUST")) push(blockers, "INVALID_TRUST");
}

function mediaBlockers(
  document: LandingPageDocumentV1,
  projectId: string,
  media: PublicationMediaInput[],
  blockers: string[],
  warnings: string[],
) {
  const proofs = selectedTrustProofs(document);
  const ids = referencedMediaIds(document, proofs);
  for (const mediaId of ids) {
    const record = media.find((item) => item.id === mediaId);
    if (!record || record.landingPageProjectId !== projectId) {
      push(blockers, "INVALID_MEDIA");
      continue;
    }
    if (record.status !== "READY" || !record.publicUrl?.startsWith("https://")) push(blockers, "MEDIA_NOT_READY");
    if (record.fileSize > LARGE_IMAGE_BYTES) push(warnings, "LARGE_IMAGE");
  }
}
