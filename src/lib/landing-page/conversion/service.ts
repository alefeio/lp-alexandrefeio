import { validateLandingPageAction } from "@/lib/landing-page/action-validation";
import { parseLandingPageDocument, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import { keepExperienceReviewCurrent } from "@/lib/landing-page/experience/invalidation";
import { landingPageFormContentSchema, type LandingPageFormContentV1 } from "@/lib/landing-page/forms/schema";
import { landingPageHasEnabledForm } from "@/lib/landing-page/measurement/availability";
import type { LandingPageMeasurementV1 } from "@/lib/landing-page/measurement/schema";
import { validateLandingPageMeasurement } from "@/lib/landing-page/measurement/validate";
import type { LandingPageProjectRecord, LandingPageStore } from "@/lib/landing-page/types";

type SaveTarget = {
  userId: string;
  landingPageProjectId: string;
  expectedRevision: number;
};

async function commitDraft(
  store: LandingPageStore,
  project: LandingPageProjectRecord,
  document: LandingPageDocumentV1,
  expectedRevision: number,
  measurementOnly: boolean,
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const next = structuredClone(document);
  if (measurementOnly) keepExperienceReviewCurrent(next, expectedRevision, expectedRevision + 1);
  const parsed = parseLandingPageDocument(next);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: project.id,
    userId: project.userId,
    expectedRevision,
    document: parsed.document,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  return ok(updated.record);
}

function applyMeasurement(document: LandingPageDocumentV1, measurement: LandingPageMeasurementV1, confirmed = false): void {
  document.measurement = measurement;
  const plan = {
    version: 1 as const,
    primaryActionType: document.conversion.primaryAction?.type ?? null,
    primaryConversionEvent: measurement.primaryConversionEvent,
    enabledEvents: measurement.enabledEvents,
    formPresent: landingPageHasEnabledForm(document),
  };
  document.strategy = {
    ...document.strategy,
    measurementPlan: confirmed ? { ...plan, confirmed: true as const } : plan,
  };
}

function applyAction(document: LandingPageDocumentV1, action: LandingPageDocumentV1["conversion"]["primaryAction"], target: { kind: "PRIMARY" } | { kind: "SECTION"; sectionId: string }): boolean {
  if (!action) return false;
  if (target.kind === "PRIMARY") {
    document.conversion = { ...document.conversion, primaryAction: action };
    return true;
  }
  const section = document.sections.find((item) => item.id === target.sectionId && item.enabled);
  if (!section) return false;
  if (section.type === "HERO") {
    section.content = { ...section.content, primaryCta: action };
    return true;
  }
  if (section.type === "CTA") {
    section.content = { ...section.content, action };
    return true;
  }
  return false;
}

function applyForm(document: LandingPageDocumentV1, sectionId: string, content: LandingPageFormContentV1): boolean {
  const section = document.sections.find((item) => item.id === sectionId && item.type === "FORM");
  if (!section || section.type !== "FORM") return false;
  section.content = content;
  return true;
}

export async function updateLandingPageActionConfiguration(
  store: LandingPageStore,
  input: SaveTarget & {
    action: unknown;
    target: { kind: "PRIMARY" } | { kind: "SECTION"; sectionId: string };
  },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  const document = structuredClone(project.draftDocument);
  const validated = validateLandingPageAction(input.action, document);
  if (!validated.ok) return fail("LANDING_PAGE_ACTION_INVALID");
  if (!applyAction(document, validated.action, input.target)) return fail("LANDING_PAGE_ACTION_INVALID");
  return commitDraft(store, project, document, input.expectedRevision, false);
}

export async function updateLandingPageFormConfiguration(
  store: LandingPageStore,
  input: SaveTarget & { sectionId: string; content: unknown },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  const content = landingPageFormContentSchema.safeParse(input.content);
  if (!content.success) return fail("LANDING_PAGE_FORM_INVALID");
  const document = structuredClone(project.draftDocument);
  if (!applyForm(document, input.sectionId, content.data)) return fail("LANDING_PAGE_FORM_INVALID");
  return commitDraft(store, project, document, input.expectedRevision, false);
}

export async function updateLandingPageMeasurement(
  store: LandingPageStore,
  input: SaveTarget & { measurement: unknown; confirmed?: boolean },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  const document = structuredClone(project.draftDocument);
  const validated = validateLandingPageMeasurement(document, input.measurement);
  if (!validated.valid || !validated.measurement) return fail("LANDING_PAGE_MEASUREMENT_INVALID");
  applyMeasurement(document, validated.measurement, input.confirmed === true);
  return commitDraft(store, project, document, input.expectedRevision, true);
}

/** Uma revisão quando ação, formulário e plano fazem parte da mesma decisão. */
export async function saveLandingPageConversionMeasurementPlan(
  store: LandingPageStore,
  input: SaveTarget & {
    action?: { action: unknown; target: { kind: "PRIMARY" } | { kind: "SECTION"; sectionId: string } };
    form?: { sectionId: string; content: unknown };
    measurement?: unknown;
    confirmed?: boolean;
  },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  if (!input.action && !input.form && !input.measurement) return fail("INVALID_INPUT");
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  const document = structuredClone(project.draftDocument);
  if (input.form) {
    const content = landingPageFormContentSchema.safeParse(input.form.content);
    if (!content.success || !applyForm(document, input.form.sectionId, content.data)) return fail("LANDING_PAGE_FORM_INVALID");
  }
  if (input.action) {
    const validated = validateLandingPageAction(input.action.action, document);
    if (!validated.ok || !applyAction(document, validated.action, input.action.target)) return fail("LANDING_PAGE_ACTION_INVALID");
  }
  if (input.measurement) {
    const validated = validateLandingPageMeasurement(document, input.measurement);
    if (!validated.valid || !validated.measurement) return fail("LANDING_PAGE_MEASUREMENT_INVALID");
    applyMeasurement(document, validated.measurement, input.confirmed === true);
  }
  return commitDraft(store, project, document, input.expectedRevision, !input.action && !input.form);
}
