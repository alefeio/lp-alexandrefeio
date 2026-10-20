import type { LandingPageAction } from "@/lib/landing-page/actions";
import type { LandingPageSection } from "@/lib/landing-page/components";
import { parseLandingPageDocument, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageProjectView } from "@/lib/landing-page/service";
import type { LandingPageStore } from "@/lib/landing-page/types";
import { buildWireframeContextFromLandingPageProject, wireframeContextCompleteness } from "@/lib/landing-page/wireframe/from-brief";
import { generateWireframePlan } from "@/lib/landing-page/wireframe/engine";
import { materializeReviewedSections } from "@/lib/landing-page/wireframe/materialize";
import { confidenceLabel, DEFAULT_SECTION_VARIANT, PARTIAL_STRUCTURE_WARNING, strategyLabel, variantAllowed, cardinalityAllows, hasActionPath, WIREFRAME_REQUIRED_TYPES } from "@/lib/landing-page/wireframe/policy";
import { validateReviewedWireframePlan, reviewedPlanFromEngine, type ReviewedWireframePlanV1 } from "@/lib/landing-page/wireframe/review";
import type { WireframeContextV1 } from "@/lib/landing-page/wireframe/context";
import type { LandingComponentType } from "@/lib/landing-page/constants";

export type WireframeProposal = {
  completeness: "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT";
  canApply: boolean;
  missingBrief: boolean;
  missingJourney: boolean;
  partialWarning: string | null;
  strategyLabel: string | null;
  confidenceLabel: string | null;
  reviewed: ReviewedWireframePlanV1 | null;
};

function viewFromRecord(record: {
  id: string;
  userId: string;
  projectId: string | null;
  courseId: string;
  slug: string;
  title: string;
  status: LandingPageProjectView["status"];
  draftDocument: LandingPageProjectView["draftDocument"];
  draftRevision: number;
  publishedPublicationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  publicationCount: number;
}): LandingPageProjectView {
  return {
    id: record.id,
    userId: record.userId,
    projectId: record.projectId,
    courseId: record.courseId,
    slug: record.slug,
    title: record.title,
    status: record.status,
    draftDocument: record.draftDocument,
    draftRevision: record.draftRevision,
    publishedPublicationId: record.publishedPublicationId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hasPublicationHistory: record.publicationCount > 0,
  };
}

export function proposeWireframeFromDocument(document: LandingPageDocumentV1): LandingPageResult<WireframeProposal> {
  const completeness = wireframeContextCompleteness(document);
  const missingBrief = completeness === "INSUFFICIENT";
  const missingJourney = completeness !== "INSUFFICIENT" && !document.strategy?.decisionJourney;
  if (completeness === "INSUFFICIENT") {
    return ok({
      completeness,
      canApply: false,
      missingBrief,
      missingJourney: false,
      partialWarning: null,
      strategyLabel: null,
      confidenceLabel: null,
      reviewed: null,
    });
  }
  const context = buildWireframeContextFromLandingPageProject(document);
  if (!context) {
    return ok({
      completeness: "INSUFFICIENT",
      canApply: false,
      missingBrief: true,
      missingJourney: false,
      partialWarning: null,
      strategyLabel: null,
      confidenceLabel: null,
      reviewed: null,
    });
  }
  const plan = generateWireframePlan(context);
  if (!plan.ok) return plan;
  return ok({
    completeness,
    canApply: true,
    missingBrief: false,
    missingJourney,
    partialWarning: completeness === "PARTIAL" ? PARTIAL_STRUCTURE_WARNING : null,
    strategyLabel: strategyLabel(plan.value.strategy),
    confidenceLabel: confidenceLabel(plan.value.confidence),
    reviewed: reviewedPlanFromEngine(plan.value),
  });
}

function wireframeState(plan: ReviewedWireframePlanV1) {
  return {
    version: 1 as const,
    engineVersion: plan.engineVersion,
    planFingerprint: plan.planFingerprint,
    strategy: plan.strategy,
    confidence: plan.confidence,
    finalSections: plan.sections.map((section) => ({
      key: section.key,
      type: section.type,
      origin: section.origin,
    })),
    userModified: plan.modifications.added.length > 0 || plan.modifications.removed.length > 0 || plan.modifications.reordered,
  };
}

export async function applyReviewedWireframe(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    reviewed: unknown;
    idFactory?: () => string;
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");
  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");
  if (record.status === "PUBLISHED" || record.status === "UNPUBLISHED") return fail("INVALID_INPUT");
  if (record.draftDocument.sections.length > 0) return fail("LANDING_PAGE_WIREFRAME_NOT_EMPTY");

  const proposal = proposeWireframeFromDocument(record.draftDocument);
  if (!proposal.ok) return proposal;
  if (!proposal.value.canApply || !proposal.value.reviewed) return fail("LANDING_PAGE_CONTEXT_INSUFFICIENT");

  const context = buildWireframeContextFromLandingPageProject(record.draftDocument);
  if (!context) return fail("LANDING_PAGE_CONTEXT_INSUFFICIENT");
  const generated = generateWireframePlan(context);
  if (!generated.ok) return generated;
  const validated = validateReviewedWireframePlan(input.reviewed, generated.value);
  if (!validated.ok) return fail("INVALID_INPUT");

  const sections = materializeReviewedSections(
    validated.plan.sections.map((section) => ({ type: section.type, variant: section.variant })),
    context,
    { idFactory: input.idFactory },
  );
  if (!sections.ok) return sections;

  const document = {
    ...record.draftDocument,
    sections: sections.value,
    guidedWireframe: {
      engineVersion: validated.plan.engineVersion,
      planFingerprint: validated.plan.planFingerprint,
      strategy: validated.plan.strategy,
      confidence: validated.plan.confidence,
    },
    strategy: {
      ...record.draftDocument.strategy,
      wireframe: wireframeState(validated.plan),
    },
  };
  const parsed = parseLandingPageDocument(document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: record.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
    status: "READY_TO_PREVIEW",
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  if (updated.record.status === "PUBLISHED") return fail("INVALID_INPUT");
  return ok(viewFromRecord(updated.record));
}

function existingAction(document: LandingPageDocumentV1): LandingPageAction | undefined {
  const hero = document.sections.find((section) => section.type === "HERO");
  if (hero?.type === "HERO") return hero.content.primaryCta;
  return document.conversion.primaryAction ?? undefined;
}

export async function updateLandingPageWireframeStructure(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    orderedSectionIds: string[];
    additions?: Array<{ type: LandingComponentType; variant?: string }>;
    variantUpdates?: Array<{ sectionId: string; variant: string }>;
    enabledUpdates?: Array<{ sectionId: string; enabled: boolean }>;
    idFactory?: () => string;
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");
  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");
  if (record.status === "PUBLISHED" || record.status === "UNPUBLISHED") return fail("INVALID_INPUT");
  const wireframe = record.draftDocument.strategy?.wireframe;
  if (!wireframe || record.draftDocument.sections.length === 0) return fail("LANDING_PAGE_WIREFRAME_NOT_EMPTY");

  const byId = new Map(record.draftDocument.sections.map((section) => [section.id, section]));
  if (new Set(input.orderedSectionIds).size !== input.orderedSectionIds.length) return fail("INVALID_INPUT");
  for (const id of input.orderedSectionIds) {
    if (!byId.has(id)) return fail("INVALID_INPUT");
  }
  const kept = new Set(input.orderedSectionIds);
  for (const section of record.draftDocument.sections) {
    if (kept.has(section.id)) continue;
    if ((WIREFRAME_REQUIRED_TYPES as readonly string[]).includes(section.type)) return fail("INVALID_INPUT");
    if (section.contentStatus !== "PLACEHOLDER") return fail("LANDING_PAGE_SECTION_HAS_CONTENT");
  }

  const context = buildWireframeContextFromLandingPageProject(record.draftDocument);
  if (!context) return fail("LANDING_PAGE_CONTEXT_INSUFFICIENT");

  const ordered: LandingPageSection[] = [];
  const finalSections: Array<{ key: string; type: LandingComponentType; origin: "ENGINE" | "USER_ADDED" }> = [];
  for (const id of input.orderedSectionIds) {
    const section = byId.get(id);
    if (!section) return fail("INVALID_INPUT");
    const index = record.draftDocument.sections.findIndex((item) => item.id === id);
    const meta = wireframe.finalSections[index];
    ordered.push({ ...section, order: ordered.length });
    finalSections.push(meta ?? { key: section.id, type: section.type, origin: "ENGINE" as const });
  }

  const additions = input.additions ?? [];
  if (additions.length > 0) {
    const made = materializeReviewedSections(
      additions.map((item) => ({ type: item.type, variant: item.variant ?? DEFAULT_SECTION_VARIANT[item.type] })),
      context,
      { idFactory: input.idFactory, action: existingAction(record.draftDocument) },
    );
    if (!made.ok) return made;
    for (const [index, section] of made.value.entries()) {
      const addition = additions[index];
      if (!addition) return fail("INVALID_INPUT");
      ordered.push({ ...section, order: ordered.length });
      const used = new Set(finalSections.map((item) => item.key));
      let key = `extra-${addition.type.toLowerCase()}`;
      let suffix = 2;
      while (used.has(key)) {
        key = `extra-${addition.type.toLowerCase()}-${suffix}`;
        suffix += 1;
      }
      finalSections.push({ key, type: addition.type, origin: "USER_ADDED" });
    }
  }

  for (const update of input.variantUpdates ?? []) {
    const section = ordered.find((item) => item.id === update.sectionId);
    if (!section || !variantAllowed(section.type, update.variant)) return fail("INVALID_INPUT");
    section.variant = update.variant as LandingPageSection["variant"];
  }
  for (const update of input.enabledUpdates ?? []) {
    const section = ordered.find((item) => item.id === update.sectionId);
    if (!section) return fail("INVALID_INPUT");
    section.enabled = update.enabled;
  }

  const types = ordered.map((section) => section.type);
  if (!cardinalityAllows(types) || !hasActionPath(types)) return fail("INVALID_INPUT");
  for (const required of WIREFRAME_REQUIRED_TYPES) {
    if (!types.includes(required)) return fail("INVALID_INPUT");
  }

  const renumbered = ordered.map((section, order) => ({ ...section, order }));
  const document = {
    ...record.draftDocument,
    sections: renumbered,
    strategy: {
      ...record.draftDocument.strategy,
      wireframe: {
        ...wireframe,
        finalSections,
        userModified: true,
      },
    },
  };
  const parsed = parseLandingPageDocument(document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: record.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
    status: record.status === "DRAFT" ? "READY_TO_PREVIEW" : undefined,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  return ok(viewFromRecord(updated.record));
}

export function wireframeContextForApply(document: LandingPageDocumentV1): WireframeContextV1 | null {
  return buildWireframeContextFromLandingPageProject(document);
}
