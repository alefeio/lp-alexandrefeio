import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { experienceChecklistFor, requiredViewportsReviewed } from "@/lib/landing-page/experience/checklist";
import { evaluateLandingPageExperience, type ExperienceMediaInput } from "@/lib/landing-page/experience/evaluate";
import {
  experienceFindingSchema,
  landingPageExperienceReviewSchema,
  landingPageExperienceSummarySchema,
  type ExperienceFindingStatus,
  type ExperienceFindingV1,
  type ExperienceReviewStatus,
  type ExperienceSeverity,
  type LandingPageExperienceReviewV1,
  type LandingPageExperienceSummaryV1,
} from "@/lib/landing-page/experience/schema";
import { EXPERIENCE_VIEWPORT_IDS, type ExperienceViewportId } from "@/lib/landing-page/experience/viewports";

export type ExperienceReviewInput = {
  reviewedViewports: ExperienceViewportId[];
  checklist: Array<{ id: string; confirmed: boolean }>;
  userFindings: Array<{
    id?: string;
    category: ExperienceFindingV1["category"];
    severity: ExperienceSeverity;
    message: string;
    recommendation?: string;
    viewport?: ExperienceViewportId;
    sectionId?: string;
    status?: ExperienceFindingStatus;
    deferReason?: string;
  }>;
  decisions: Array<{
    findingId: string;
    status: ExperienceFindingStatus;
    deferReason?: string;
  }>;
};

function applyDecision(finding: ExperienceFindingV1, status: ExperienceFindingStatus, deferReason?: string): "ok" | "invalid" {
  if (status === "OPEN") return "ok";
  if (status === "RESOLVED" && finding.source === "SYSTEM") return "ok";
  if (status === "DEFERRED" && finding.severity === "BLOCKER") return "invalid";
  if (status === "NOT_APPLICABLE" && finding.source === "SYSTEM" && finding.platformLimitation !== true) return "invalid";
  finding.status = status;
  if (status === "DEFERRED" && deferReason) finding.deferReason = deferReason;
  return "ok";
}

export function composeLandingPageExperienceReview(
  document: LandingPageDocumentV1,
  reviewedDraftRevision: number,
  input: ExperienceReviewInput,
  media: ExperienceMediaInput[] = [],
): { ok: true; review: LandingPageExperienceReviewV1; summary: LandingPageExperienceSummaryV1 } | { ok: false } {
  const system = evaluateLandingPageExperience(document, { media });
  const findings: ExperienceFindingV1[] = system.map((finding) => ({ ...finding }));
  const userFindings: ExperienceFindingV1[] = [];
  for (const raw of input.userFindings) {
    const parsed = experienceFindingSchema.safeParse({
      id: raw.id ?? `user:${crypto.randomUUID()}`,
      code: "USER_NOTE",
      category: raw.category,
      severity: raw.severity,
      scope: raw.sectionId ? "SECTION" : "PAGE",
      ...(raw.sectionId ? { sectionId: raw.sectionId } : {}),
      ...(raw.viewport ? { viewport: raw.viewport } : {}),
      message: raw.message,
      recommendation: raw.recommendation?.trim() || "Anote o que ajustar nesta página.",
      source: "USER",
      status: raw.status ?? "OPEN",
      ...(raw.deferReason ? { deferReason: raw.deferReason } : {}),
    });
    if (!parsed.success) return { ok: false };
    if (parsed.data.severity === "BLOCKER") return { ok: false };
    userFindings.push(parsed.data);
  }
  const known = new Set([...findings, ...userFindings].map((finding) => finding.id));
  for (const decision of input.decisions) {
    if (!known.has(decision.findingId)) return { ok: false };
    const finding = [...findings, ...userFindings].find((item) => item.id === decision.findingId);
    if (!finding) return { ok: false };
    if (applyDecision(finding, decision.status, decision.deferReason) === "invalid") return { ok: false };
  }
  const checklist = experienceChecklistFor(document).map((item) => {
    const answer = input.checklist.find((entry) => entry.id === item.id);
    return { ...item, confirmed: item.applicable && answer?.confirmed === true };
  });
  if (input.checklist.some((entry) => !checklist.some((item) => item.id === entry.id))) return { ok: false };
  const viewports = EXPERIENCE_VIEWPORT_IDS.filter((id) => input.reviewedViewports.includes(id));
  const openBlockerCount = [...findings, ...userFindings].filter((finding) => finding.severity === "BLOCKER" && finding.status === "OPEN").length;
  const openAttentionCount = [...findings, ...userFindings].filter((finding) => finding.severity === "ATTENTION" && finding.status === "OPEN").length;
  const deferredCount = [...findings, ...userFindings].filter((finding) => finding.status === "DEFERRED").length;
  const checklistReady = checklist.every((item) => !item.applicable || item.confirmed);
  const ready = openBlockerCount === 0 && openAttentionCount === 0 && checklistReady && requiredViewportsReviewed(viewports);
  const summary = {
    status: ready ? "READY_FOR_NEXT_STEP" as const : "NEEDS_ADJUSTMENTS" as const,
    headline: openBlockerCount > 0 ? "Bloqueios encontrados" as const : ready ? "Revisado" as const : "Precisa de ajustes" as const,
    openBlockerCount,
    openAttentionCount,
    deferredCount,
  };
  const review = landingPageExperienceReviewSchema.safeParse({
    version: 1,
    reviewedDraftRevision,
    reviewedViewports: viewports,
    checklist,
    findings: [...findings, ...userFindings],
    summary,
  });
  const strategySummary = landingPageExperienceSummarySchema.safeParse({
    version: 1,
    status: summary.status,
    reviewedDraftRevision,
    reviewedViewports: viewports,
    openBlockerCount,
    openAttentionCount,
    deferredCount,
    userFindingCount: userFindings.length,
  });
  if (!review.success || !strategySummary.success) return { ok: false };
  return { ok: true, review: review.data, summary: strategySummary.data };
}

export function experienceReviewEffectiveStatus(
  document: LandingPageDocumentV1,
  draftRevision: number,
): ExperienceReviewStatus {
  const review = document.experienceReview;
  if (!review) return "NOT_REVIEWED";
  if (review.reviewedDraftRevision !== draftRevision) return "STALE";
  return review.summary.status;
}
