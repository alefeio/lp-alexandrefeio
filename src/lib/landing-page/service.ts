import { conversionOutcomeLabel, operationalActionFromIntent, parseConversionPageBrief } from "@/lib/landing-page/brief";
import { parseVisitorDecisionJourney, syncBriefWithDecisionJourney } from "@/lib/landing-page/decision-journey";
import { createEmptyLandingPageDocument, parseLandingPageDocument } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageResult } from "@/lib/landing-page/errors";
import { LANDING_PAGE_COURSE_SLUG, LANDING_PAGE_LIMITS } from "@/lib/landing-page/constants";
import { isValidLandingPageSlug, normalizeLandingPageSlug } from "@/lib/landing-page/slug";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import type { LandingPageProjectRecord, LandingPageStore } from "@/lib/landing-page/types";

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function mapRecord(record: LandingPageProjectRecord) {
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

export type LandingPageProjectView = ReturnType<typeof mapRecord>;

export async function createLandingPageProject(
  store: LandingPageStore,
  input: {
    userId: string;
    title: string;
    slug: string;
    projectId?: string | null;
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  const title = input.title.trim();
  if (!title || title.length > LANDING_PAGE_LIMITS.maxTitle) {
    return fail("INVALID_TITLE");
  }

  const slug = normalizeLandingPageSlug(input.slug);
  if (!isValidLandingPageSlug(slug)) return fail("INVALID_SLUG");

  const taken = await store.findSlugOwner(slug);
  if (taken) return fail("SLUG_TAKEN");

  const courseId = await store.findCourseIdBySlug(LANDING_PAGE_COURSE_SLUG);
  if (!courseId) return fail("COURSE_NOT_FOUND");

  let projectId: string | null = null;
  if (input.projectId) {
    const project = await store.findOwnedProject(input.projectId, input.userId);
    if (!project) return fail("NOT_FOUND");
    projectId = project.id;
  }

  const document = createEmptyLandingPageDocument();
  const record = await store.create({
    id: newId(),
    userId: input.userId,
    projectId,
    courseId,
    slug,
    title,
    draftDocument: document,
  });

  return ok(mapRecord(record));
}

export async function getLandingPageProject(
  store: LandingPageStore,
  input: { userId: string; landingPageProjectId: string },
): Promise<LandingPageResult<LandingPageProjectView>> {
  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");

  const parsed = parseLandingPageDocument(record.draftDocument);
  if (!parsed.ok) {
    if (parsed.reason === "UNSUPPORTED_SCHEMA_VERSION") return fail("UNSUPPORTED_SCHEMA_VERSION");
    if (parsed.reason === "UNSUPPORTED_REGISTRY_VERSION") return fail("UNSUPPORTED_REGISTRY_VERSION");
    return fail("INVALID_DOCUMENT");
  }

  return ok(
    mapRecord({
      ...record,
      draftDocument: parsed.document,
    }),
  );
}

export async function updateLandingPageDraft(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    document: unknown;
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    return fail("INVALID_INPUT");
  }

  const parsed = parseLandingPageDocument(input.document);
  if (!parsed.ok) {
    if (parsed.reason === "UNSUPPORTED_SCHEMA_VERSION") return fail("UNSUPPORTED_SCHEMA_VERSION");
    if (parsed.reason === "UNSUPPORTED_REGISTRY_VERSION") return fail("UNSUPPORTED_REGISTRY_VERSION");
    return fail("INVALID_DOCUMENT");
  }

  const updated = await store.updateDraftAtomic({
    id: input.landingPageProjectId,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
  });

  if (!updated.ok) {
    if (updated.reason === "CONFLICT") return fail("LANDING_PAGE_DRAFT_CONFLICT");
    return fail("NOT_FOUND");
  }

  return ok(mapRecord(updated.record));
}

export async function updateLandingPageTitle(
  store: LandingPageStore,
  input: { userId: string; landingPageProjectId: string; title: string },
): Promise<LandingPageResult<LandingPageProjectView>> {
  const title = input.title.trim();
  if (!title || title.length > LANDING_PAGE_LIMITS.maxTitle) return fail("INVALID_TITLE");

  const updated = await store.updateTitleAtomic({
    id: input.landingPageProjectId,
    userId: input.userId,
    title,
  });
  if (!updated.ok) return fail("NOT_FOUND");
  return ok(mapRecord(updated.record));
}

export async function updateLandingPageSlug(
  store: LandingPageStore,
  input: { userId: string; landingPageProjectId: string; slug: string },
): Promise<LandingPageResult<LandingPageProjectView>> {
  const slug = normalizeLandingPageSlug(input.slug);
  if (!isValidLandingPageSlug(slug)) return fail("INVALID_SLUG");

  const current = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!current) return fail("NOT_FOUND");
  if (current.publicationCount > 0) return fail("LANDING_PAGE_SLUG_LOCKED_AFTER_PUBLICATION");
  if (current.slug === slug) return ok(mapRecord(current));

  const updated = await store.updateSlugAtomic({
    id: input.landingPageProjectId,
    userId: input.userId,
    slug,
  });
  if (!updated.ok) {
    if (updated.reason === "LOCKED") return fail("LANDING_PAGE_SLUG_LOCKED_AFTER_PUBLICATION");
    if (updated.reason === "TAKEN") return fail("SLUG_TAKEN");
    return fail("NOT_FOUND");
  }
  return ok(mapRecord(updated.record));
}

export async function listLandingPageProjects(
  store: LandingPageStore,
  input: { userId: string },
): Promise<LandingPageProjectView[]> {
  const records = await store.listForUser(input.userId);
  return records.map((record) => mapRecord(record));
}

export async function saveConversionPageBrief(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    brief: unknown;
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");
  const brief = parseConversionPageBrief(input.brief);
  if (!brief.ok) return fail("INVALID_INPUT");

  const current = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!current) return fail("NOT_FOUND");

  const document = {
    ...current.draftDocument,
    strategy: { ...current.draftDocument.strategy, brief: brief.brief },
    conversion: {
      ...current.draftDocument.conversion,
      primaryAction: operationalActionFromIntent(brief.brief.primaryAction),
      secondaryAction: operationalActionFromIntent(brief.brief.secondaryAction),
      businessOutcome: conversionOutcomeLabel(brief.brief),
    },
  };
  const parsed = parseLandingPageDocument(document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");

  const updated = await store.updateDraftAtomic({
    id: input.landingPageProjectId,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
  });
  if (!updated.ok) {
    if (updated.reason === "CONFLICT") return fail("LANDING_PAGE_DRAFT_CONFLICT");
    return fail("NOT_FOUND");
  }
  if (updated.record.status !== current.status) return fail("INVALID_DOCUMENT");
  return ok(mapRecord(updated.record));
}

export async function saveVisitorDecisionJourney(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    expectedRevision: number;
    decisionJourney: unknown;
    confirmActionChange?: boolean;
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");
  const journey = parseVisitorDecisionJourney(input.decisionJourney);
  if (!journey.ok) return fail("INVALID_INPUT");

  const current = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!current) return fail("NOT_FOUND");
  const brief = current.draftDocument.strategy?.brief;
  if (!brief) return fail("LANDING_PAGE_BRIEF_REQUIRED");

  const synced = syncBriefWithDecisionJourney(brief, journey.journey, input.confirmActionChange === true);
  if (!synced.ok) {
    if (synced.reason === "confirm") return fail("ACTION_CHANGE_REQUIRES_CONFIRMATION");
    return fail("INVALID_INPUT");
  }
  const parsedBrief = parseConversionPageBrief(synced.brief);
  if (!parsedBrief.ok) return fail("INVALID_INPUT");

  const document = {
    ...current.draftDocument,
    strategy: {
      ...current.draftDocument.strategy,
      brief: parsedBrief.brief,
      decisionJourney: journey.journey,
    },
    conversion: {
      ...current.draftDocument.conversion,
      ...(synced.conversionAction === "keep" ? {} : { primaryAction: synced.conversionAction }),
    },
  };
  const parsed = parseLandingPageDocument(document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");

  const updated = await store.updateDraftAtomic({
    id: input.landingPageProjectId,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
  });
  if (!updated.ok) {
    if (updated.reason === "CONFLICT") return fail("LANDING_PAGE_DRAFT_CONFLICT");
    return fail("NOT_FOUND");
  }
  if (updated.record.status !== current.status) return fail("INVALID_DOCUMENT");
  return ok(mapRecord(updated.record));
}

/** Reexport tipado para testes/schema. */
export type { LandingPageDocumentV1 };
