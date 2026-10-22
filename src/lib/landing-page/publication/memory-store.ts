import type { LandingPageProjectRecord } from "@/lib/landing-page/types";
import { snapshotReferencesMedia } from "@/lib/landing-page/publication/snapshot";
import type {
  LandingPagePublicationRecord,
  LandingPagePublicationStore,
  PublicationCommitInput,
  PublicationListItem,
} from "@/lib/landing-page/publication/store";

type MemoryPages = {
  rows: Map<string, LandingPageProjectRecord>;
  seedPublication(landingPageProjectId: string): void;
};

function listItem(record: LandingPagePublicationRecord, activeId: string | null): PublicationListItem {
  return {
    id: record.id,
    version: record.version,
    createdAt: new Date(record.createdAt),
    sourceDraftRevision: record.sourceDraftRevision,
    isActive: record.id === activeId,
    rollbackSourcePublicationId: record.rollbackSourcePublicationId,
    snapshotSchemaVersion: record.snapshotSchemaVersion,
    snapshotHash: record.snapshotHash,
  };
}

function cloneRecord(record: LandingPagePublicationRecord): LandingPagePublicationRecord {
  return {
    ...record,
    snapshot: structuredClone(record.snapshot),
    publishedAt: new Date(record.publishedAt),
    createdAt: new Date(record.createdAt),
  };
}

export function createMemoryLandingPagePublicationStore(pages: MemoryPages): LandingPagePublicationStore {
  const publications: LandingPagePublicationRecord[] = [];
  let chain = Promise.resolve();

  function exclusive<T>(run: () => Promise<T>): Promise<T> {
    const next = chain.then(run, run);
    chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  return {
    commit(input: PublicationCommitInput) {
      return exclusive(async () => {
        const row = pages.rows.get(input.projectId);
        if (!row || row.userId !== input.userId) return { ok: false as const, code: "NOT_FOUND" as const };
        if (input.expectedDraftRevision !== null && row.draftRevision !== input.expectedDraftRevision) {
          return { ok: false as const, code: "LANDING_PAGE_DRAFT_CONFLICT" as const };
        }
        const active = publications.find((item) => item.id === row.publishedPublicationId);
        if (active && active.snapshotHash === input.snapshotHash) {
          return { ok: false as const, code: "LANDING_PAGE_NO_PUBLIC_CHANGES" as const };
        }
        const version = publications.filter((item) => item.landingPageProjectId === row.id).reduce((max, item) => Math.max(max, item.version), 0) + 1;
        if (publications.some((item) => item.landingPageProjectId === row.id && item.version === version)) {
          return { ok: false as const, code: "LANDING_PAGE_DRAFT_CONFLICT" as const };
        }
        const now = new Date();
        const record: LandingPagePublicationRecord = {
          id: crypto.randomUUID(),
          landingPageProjectId: row.id,
          version,
          snapshot: structuredClone(input.snapshot),
          snapshotHash: input.snapshotHash,
          snapshotSchemaVersion: 1,
          sourceDraftRevision: input.sourceDraftRevision,
          rollbackSourcePublicationId: input.rollbackSourcePublicationId,
          publishedSlug: input.publishedSlug,
          publishedAt: now,
          createdAt: now,
        };
        publications.push(record);
        row.publishedPublicationId = record.id;
        row.status = "PUBLISHED";
        row.updatedAt = now;
        pages.seedPublication(row.id);
        return { ok: true as const, publication: listItem(record, record.id) };
      });
    },
    async clearActive(input) {
      const row = pages.rows.get(input.projectId);
      if (!row || row.userId !== input.userId) return { ok: false, code: "NOT_FOUND" };
      const alreadyInactive = row.publishedPublicationId === null;
      row.publishedPublicationId = null;
      row.status = "UNPUBLISHED";
      row.updatedAt = new Date();
      return { ok: true, alreadyInactive };
    },
    async list(input) {
      const row = pages.rows.get(input.projectId);
      if (!row || row.userId !== input.userId) return null;
      return publications
        .filter((item) => item.landingPageProjectId === row.id)
        .map((item) => listItem(item, row.publishedPublicationId))
        .sort((a, b) => a.version - b.version);
    },
    async get(input) {
      const row = pages.rows.get(input.projectId);
      if (!row || row.userId !== input.userId) return null;
      const record = publications.find((item) => item.id === input.publicationId && item.landingPageProjectId === row.id);
      return record ? cloneRecord(record) : null;
    },
    async findActiveBySlug(slug) {
      const row = [...pages.rows.values()].find((item) => item.slug === slug);
      if (!row?.publishedPublicationId) return null;
      const record = publications.find((item) => item.id === row.publishedPublicationId && item.landingPageProjectId === row.id);
      if (!record) return null;
      return { projectId: row.id, slug: row.slug, publication: cloneRecord(record) };
    },
    async referencesMedia(projectId, mediaId) {
      return publications.some((item) => item.landingPageProjectId === projectId && snapshotReferencesMedia(item.snapshot, mediaId));
    },
  };
}
