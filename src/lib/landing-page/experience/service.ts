import { parseLandingPageDocument, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import { composeLandingPageExperienceReview, type ExperienceReviewInput } from "@/lib/landing-page/experience/review";
import type { LandingPageMediaStore } from "@/lib/landing-page/media/record";
import type { LandingPageProjectRecord, LandingPageStore } from "@/lib/landing-page/types";

export async function saveLandingPageExperienceReview(
  store: LandingPageStore,
  mediaStore: LandingPageMediaStore | null,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    review: ExperienceReviewInput;
  },
): Promise<LandingPageResult<LandingPageProjectRecord>> {
  const project = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project || project.draftRevision !== input.expectedRevision) {
    return fail(project ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  }
  const rows = mediaStore ? await mediaStore.listForProjectOwner(project.id, input.userId) : [];
  const composed = composeLandingPageExperienceReview(
    project.draftDocument,
    input.expectedRevision + 1,
    input.review,
    rows.map((row) => ({ id: row.id, status: row.status, fileSize: row.fileSize, altText: row.altText })),
  );
  if (!composed.ok) return fail("INVALID_INPUT");
  const document: LandingPageDocumentV1 = structuredClone(project.draftDocument);
  document.experienceReview = composed.review;
  document.strategy = { ...document.strategy, experienceReview: composed.summary };
  const parsed = parseLandingPageDocument(document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: project.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  return ok(updated.record);
}
