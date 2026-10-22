import { landingPageActionSchema } from "@/lib/landing-page/actions";
import { validateLandingPageAction } from "@/lib/landing-page/action-validation";
import { saveLandingPageConversionMeasurementPlan, updateLandingPageMeasurement } from "@/lib/landing-page/conversion/service";
import { fail, type LandingPageResult } from "@/lib/landing-page/errors";
import { landingPageFormContentSchema } from "@/lib/landing-page/forms/schema";
import { measurementPlanDiff } from "@/lib/landing-page/measurement/lesson-flow";
import type { LandingPageProjectRecord, LandingPageStore } from "@/lib/landing-page/types";

export async function saveLandingPageMeasurementLesson(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    action?: unknown;
    form?: { sectionId: string; content: unknown } | null;
    measurement: unknown;
    confirmed: boolean;
  },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  if (input.confirmed !== true) return fail("INVALID_INPUT");
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  if (!project.draftDocument.sections.some((section) => section.enabled)) return fail("INVALID_INPUT");
  if (input.action !== undefined) {
    const parsed = landingPageActionSchema.safeParse(input.action);
    if (!parsed.success || !validateLandingPageAction(parsed.data, project.draftDocument).ok) return fail("LANDING_PAGE_ACTION_INVALID");
  }
  if (input.form) {
    const parsed = landingPageFormContentSchema.safeParse(input.form.content);
    const section = project.draftDocument.sections.find((item) => item.id === input.form?.sectionId && item.type === "FORM");
    if (!parsed.success || !section) return fail("LANDING_PAGE_FORM_INVALID");
  }
  const diff = measurementPlanDiff(project.draftDocument, { action: input.action, form: input.form });
  const nextAction = diff.action?.action ?? project.draftDocument.conversion.primaryAction;
  if (!nextAction || !validateLandingPageAction(nextAction, project.draftDocument).ok) return fail("LANDING_PAGE_ACTION_INVALID");
  if (!diff.action && !diff.form) {
    return updateLandingPageMeasurement(store, {
      userId: input.userId,
      landingPageProjectId: input.landingPageProjectId,
      expectedRevision: input.expectedRevision,
      measurement: input.measurement,
      confirmed: true,
    });
  }
  return saveLandingPageConversionMeasurementPlan(store, {
    userId: input.userId,
    landingPageProjectId: input.landingPageProjectId,
    expectedRevision: input.expectedRevision,
    action: diff.action,
    form: diff.form,
    measurement: input.measurement,
    confirmed: true,
  });
}
