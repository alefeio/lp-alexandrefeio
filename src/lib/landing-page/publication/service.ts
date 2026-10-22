import type { LandingPageCode } from "@/lib/landing-page/errors";
import type { LandingPageStore } from "@/lib/landing-page/types";
import { evaluateLandingPagePublicationReadiness, type PublicationReadiness } from "@/lib/landing-page/publication/readiness";
import {
  buildLandingPagePublicationSnapshot,
  hashLandingPagePublicationSnapshot,
  validatePublicationSnapshot,
  type LandingPagePublicationSnapshotV1,
  type PublicationMediaInput,
} from "@/lib/landing-page/publication/snapshot";
import type { LandingPagePublicationRecord, LandingPagePublicationStore, PublicationListItem } from "@/lib/landing-page/publication/store";

export type PublicationLogEvent = {
  projectId?: string;
  publicationId?: string;
  version?: number;
  code?: string;
  operation?: string;
  status?: number;
  durationMs?: number;
  errorClass?: string;
};

const LOG_KEYS = ["projectId", "publicationId", "version", "code", "operation", "status", "durationMs", "errorClass"] as const;

/** Mantém no log só identificadores, código e classe do erro. Texto, telefone, URL e payload ficam de fora. */
export function publicationLogEvent(input: Record<string, unknown>): PublicationLogEvent {
  const event: PublicationLogEvent = {};
  for (const key of LOG_KEYS) {
    const value = input[key];
    if ((key === "version" || key === "status" || key === "durationMs") && typeof value === "number") event[key] = value;
    else if (key !== "version" && key !== "status" && key !== "durationMs" && typeof value === "string") event[key] = value;
  }
  return event;
}

export type PublishLandingPageResult =
  | { ok: true; publication: PublicationListItem; warnings: string[] }
  | { ok: false; code: LandingPageCode; blockers: string[]; warnings: string[] };

type PublishDeps = {
  projects: LandingPageStore;
  publications: LandingPagePublicationStore;
  media?: PublicationMediaInput[];
  log?: (event: PublicationLogEvent) => void;
};

export async function publishLandingPage(
  deps: PublishDeps,
  input: { userId: string; landingPageProjectId: string; expectedDraftRevision: number; acknowledgedWarningCodes?: string[] },
): Promise<PublishLandingPageResult> {
  const project = await deps.projects.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project) return { ok: false, code: "NOT_FOUND", blockers: [], warnings: [] };
  if (project.draftRevision !== input.expectedDraftRevision) {
    return { ok: false, code: "LANDING_PAGE_DRAFT_CONFLICT", blockers: [], warnings: [] };
  }
  const readiness = evaluateLandingPagePublicationReadiness({
    document: project.draftDocument,
    draftRevision: project.draftRevision,
    slug: project.slug,
    projectId: project.id,
    media: deps.media,
  });
  if (!readiness.ready || readiness.blockers.some((code) => input.acknowledgedWarningCodes?.includes(code))) {
    return { ok: false, code: "LANDING_PAGE_NOT_READY", blockers: readiness.blockers, warnings: readiness.warnings };
  }
  const snapshot = buildLandingPagePublicationSnapshot(project.draftDocument, deps.media ?? []);
  const validated = snapshot ? validatePublicationSnapshot(snapshot) : { ok: false as const };
  if (!validated.ok) return { ok: false, code: "LANDING_PAGE_PUBLICATION_INVALID", blockers: ["INVALID_SNAPSHOT"], warnings: readiness.warnings };
  const committed = await deps.publications.commit({
    userId: input.userId,
    projectId: project.id,
    expectedDraftRevision: input.expectedDraftRevision,
    snapshot: validated.snapshot,
    snapshotHash: hashLandingPagePublicationSnapshot(validated.snapshot),
    sourceDraftRevision: project.draftRevision,
    rollbackSourcePublicationId: null,
    publishedSlug: project.slug,
  });
  if (!committed.ok) return { ok: false, code: committed.code, blockers: [], warnings: readiness.warnings };
  deps.log?.(publicationLogEvent({ projectId: project.id, publicationId: committed.publication.id, version: committed.publication.version, code: "PUBLISHED" }));
  return { ok: true, publication: committed.publication, warnings: readiness.warnings };
}

export function republishLandingPage(
  deps: PublishDeps,
  input: { userId: string; landingPageProjectId: string; expectedDraftRevision: number; acknowledgedWarningCodes?: string[] },
): Promise<PublishLandingPageResult> {
  return publishLandingPage(deps, input);
}

export async function rollbackLandingPage(
  deps: PublishDeps,
  input: { userId: string; landingPageProjectId: string; publicationId: string },
): Promise<PublishLandingPageResult> {
  const project = await deps.projects.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project) return { ok: false, code: "NOT_FOUND", blockers: [], warnings: [] };
  const target = await deps.publications.get({ userId: input.userId, projectId: project.id, publicationId: input.publicationId });
  if (!target || target.landingPageProjectId !== project.id) return { ok: false, code: "NOT_FOUND", blockers: [], warnings: [] };
  const validated = validatePublicationSnapshot(structuredClone(target.snapshot));
  if (!validated.ok) return { ok: false, code: "LANDING_PAGE_PUBLICATION_INVALID", blockers: ["INVALID_SNAPSHOT"], warnings: [] };
  if (!rollbackMediaReady(validated.snapshot, project.id, deps.media ?? [])) {
    return { ok: false, code: "LANDING_PAGE_ROLLBACK_UNAVAILABLE", blockers: ["MEDIA_NOT_READY"], warnings: [] };
  }
  const committed = await deps.publications.commit({
    userId: input.userId,
    projectId: project.id,
    expectedDraftRevision: null,
    snapshot: validated.snapshot,
    snapshotHash: hashLandingPagePublicationSnapshot(validated.snapshot),
    sourceDraftRevision: null,
    rollbackSourcePublicationId: target.id,
    publishedSlug: project.slug,
  });
  if (!committed.ok) return { ok: false, code: committed.code, blockers: [], warnings: [] };
  deps.log?.(publicationLogEvent({ projectId: project.id, publicationId: committed.publication.id, version: committed.publication.version, code: "ROLLED_BACK" }));
  return { ok: true, publication: committed.publication, warnings: [] };
}

function rollbackMediaReady(snapshot: LandingPagePublicationSnapshotV1, projectId: string, media: PublicationMediaInput[]): boolean {
  return snapshot.media.every((item) => {
    const record = media.find((entry) => entry.id === item.mediaId);
    return Boolean(record && record.landingPageProjectId === projectId && record.status === "READY" && record.publicUrl);
  });
}

export async function unpublishLandingPage(
  deps: Pick<PublishDeps, "projects" | "publications" | "log">,
  input: { userId: string; landingPageProjectId: string },
): Promise<{ ok: true; activePublicationId: null } | { ok: false; code: "NOT_FOUND" }> {
  const project = await deps.projects.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!project) return { ok: false, code: "NOT_FOUND" };
  const cleared = await deps.publications.clearActive({ userId: input.userId, projectId: project.id });
  if (!cleared.ok) return cleared;
  deps.log?.(publicationLogEvent({ projectId: project.id, code: "UNPUBLISHED" }));
  return { ok: true, activePublicationId: null };
}

export async function listLandingPagePublications(
  deps: Pick<PublishDeps, "publications">,
  input: { userId: string; landingPageProjectId: string },
): Promise<PublicationListItem[] | null> {
  return deps.publications.list({ userId: input.userId, projectId: input.landingPageProjectId });
}

export async function getLandingPagePublication(
  deps: Pick<PublishDeps, "publications">,
  input: { userId: string; landingPageProjectId: string; publicationId: string },
): Promise<LandingPagePublicationRecord | null> {
  return deps.publications.get({ userId: input.userId, projectId: input.landingPageProjectId, publicationId: input.publicationId });
}

export function landingPageHasUnpublishedChanges(draftRevision: number, sourceDraftRevision: number | null | undefined): boolean {
  return typeof sourceDraftRevision === "number" && draftRevision > sourceDraftRevision;
}

export type { PublicationReadiness };
