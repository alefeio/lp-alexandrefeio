import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import type {
  CreateLandingPageRecordInput,
  LandingPageProjectRecord,
  LandingPageStore,
} from "@/lib/landing-page/types";

type MemoryRow = LandingPageProjectRecord;

export function createMemoryLandingPageStore(seed?: {
  courseIdBySlug?: Record<string, string>;
  projects?: Array<{ id: string; userId: string }>;
}): LandingPageStore & {
  rows: Map<string, MemoryRow>;
  seedPublication(landingPageProjectId: string): void;
} {
  const rows = new Map<string, MemoryRow>();
  const courseIdBySlug = new Map(Object.entries(seed?.courseIdBySlug ?? {}));
  const projects = new Map((seed?.projects ?? []).map((project) => [project.id, project]));
  const publicationCounts = new Map<string, number>();

  function clone(row: MemoryRow): MemoryPage {
    return {
      ...row,
      draftDocument: structuredClone(row.draftDocument),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      publicationCount: publicationCounts.get(row.id) ?? 0,
    };
  }

  type MemoryPage = LandingPageProjectRecord;

  return {
    rows,
    seedPublication(landingPageProjectId: string) {
      publicationCounts.set(landingPageProjectId, (publicationCounts.get(landingPageProjectId) ?? 0) + 1);
      const row = rows.get(landingPageProjectId);
      if (row) row.publicationCount = publicationCounts.get(landingPageProjectId) ?? 0;
    },
    async findCourseIdBySlug(slug) {
      return courseIdBySlug.get(slug) ?? null;
    },
    async findOwnedProject(projectId, userId) {
      const project = projects.get(projectId);
      if (!project || project.userId !== userId) return null;
      return { id: project.id };
    },
    async findByIdForUser(id, userId) {
      const row = rows.get(id);
      if (!row || row.userId !== userId) return null;
      return clone(row);
    },
    async findSlugOwner(slug) {
      for (const row of rows.values()) {
        if (row.slug === slug) return { id: row.id, userId: row.userId };
      }
      return null;
    },
    async create(input: CreateLandingPageRecordInput) {
      const now = new Date();
      const row: MemoryRow = {
        id: input.id,
        userId: input.userId,
        projectId: input.projectId,
        courseId: input.courseId,
        slug: input.slug,
        title: input.title,
        status: "DRAFT",
        draftDocument: structuredClone(input.draftDocument),
        draftRevision: 1,
        publishedPublicationId: null,
        createdAt: now,
        updatedAt: now,
        publicationCount: 0,
      };
      rows.set(row.id, row);
      return clone(row);
    },
    async updateDraftAtomic(input) {
      const row = rows.get(input.id);
      if (!row || row.userId !== input.userId) return { ok: false, reason: "NOT_FOUND" };
      if (row.draftRevision !== input.expectedRevision) return { ok: false, reason: "CONFLICT" };
      row.draftDocument = structuredClone(input.document) as LandingPageDocumentV1;
      row.draftRevision += 1;
      row.updatedAt = new Date();
      return { ok: true, record: clone(row) };
    },
    async updateTitleAtomic(input) {
      const row = rows.get(input.id);
      if (!row || row.userId !== input.userId) return { ok: false, reason: "NOT_FOUND" };
      row.title = input.title;
      row.updatedAt = new Date();
      return { ok: true, record: clone(row) };
    },
    async updateSlugAtomic(input) {
      const row = rows.get(input.id);
      if (!row || row.userId !== input.userId) return { ok: false, reason: "NOT_FOUND" };
      if ((publicationCounts.get(row.id) ?? 0) > 0) return { ok: false, reason: "LOCKED" };
      for (const other of rows.values()) {
        if (other.id !== row.id && other.slug === input.slug) return { ok: false, reason: "TAKEN" };
      }
      row.slug = input.slug;
      row.updatedAt = new Date();
      return { ok: true, record: clone(row) };
    },
  };
}
