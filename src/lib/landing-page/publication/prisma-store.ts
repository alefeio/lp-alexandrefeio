import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { validatePublicationSnapshot } from "@/lib/landing-page/publication/snapshot";
import { snapshotReferencesMedia } from "@/lib/landing-page/publication/snapshot";
import type {
  LandingPagePublicationRecord,
  LandingPagePublicationStore,
  PublicationCommitResult,
  PublicationListItem,
  PublicLandingPage,
} from "@/lib/landing-page/publication/store";

function toRecord(row: {
  id: string;
  landingPageProjectId: string;
  version: number;
  snapshot: Prisma.JsonValue;
  snapshotHash: string;
  snapshotSchemaVersion: number;
  sourceDraftRevision: number | null;
  rollbackSourcePublicationId: string | null;
  publishedSlug: string;
  publishedAt: Date;
  createdAt: Date;
}): LandingPagePublicationRecord | null {
  const snapshot = validatePublicationSnapshot(row.snapshot);
  if (!snapshot.ok || row.snapshotSchemaVersion !== 1) return null;
  return {
    id: row.id,
    landingPageProjectId: row.landingPageProjectId,
    version: row.version,
    snapshot: snapshot.snapshot,
    snapshotHash: row.snapshotHash,
    snapshotSchemaVersion: 1,
    sourceDraftRevision: row.sourceDraftRevision,
    rollbackSourcePublicationId: row.rollbackSourcePublicationId,
    publishedSlug: row.publishedSlug,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
  };
}

function toListItem(record: LandingPagePublicationRecord, activeId: string | null): PublicationListItem {
  return {
    id: record.id,
    version: record.version,
    createdAt: record.createdAt,
    sourceDraftRevision: record.sourceDraftRevision,
    isActive: record.id === activeId,
    rollbackSourcePublicationId: record.rollbackSourcePublicationId,
    snapshotSchemaVersion: record.snapshotSchemaVersion,
    snapshotHash: record.snapshotHash,
  };
}

export function createPrismaLandingPagePublicationStore(): LandingPagePublicationStore {
  const prisma = getPrisma();

  return {
    async commit(input): Promise<PublicationCommitResult> {
      try {
        return await prisma.$transaction(async (tx) => {
          const project = await tx.landingPageProject.findFirst({
            where: { id: input.projectId, userId: input.userId },
            select: { id: true, draftRevision: true, publishedPublicationId: true, slug: true },
          });
          if (!project) return { ok: false, code: "NOT_FOUND" };
          if (input.expectedDraftRevision !== null && project.draftRevision !== input.expectedDraftRevision) {
            return { ok: false, code: "LANDING_PAGE_DRAFT_CONFLICT" };
          }
          const active = project.publishedPublicationId
            ? await tx.landingPagePublication.findFirst({
                where: { id: project.publishedPublicationId, landingPageProjectId: project.id },
                select: { snapshotHash: true },
              })
            : null;
          if (active && active.snapshotHash === input.snapshotHash) return { ok: false, code: "LANDING_PAGE_NO_PUBLIC_CHANGES" };
          const latest = await tx.landingPagePublication.aggregate({
            where: { landingPageProjectId: project.id },
            _max: { version: true },
          });
          const created = await tx.landingPagePublication.create({
            data: {
              landingPageProjectId: project.id,
              version: (latest._max.version ?? 0) + 1,
              snapshot: input.snapshot as Prisma.InputJsonValue,
              snapshotHash: input.snapshotHash,
              snapshotSchemaVersion: 1,
              sourceDraftRevision: input.sourceDraftRevision,
              rollbackSourcePublicationId: input.rollbackSourcePublicationId,
              publishedSlug: input.publishedSlug,
            },
          });
          await tx.landingPageProject.update({
            where: { id: project.id },
            data: { publishedPublicationId: created.id, status: "PUBLISHED" },
          });
          const record = toRecord(created);
          if (!record) return { ok: false, code: "LANDING_PAGE_PUBLICATION_INVALID" };
          return { ok: true, publication: toListItem(record, created.id) };
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          return { ok: false, code: "LANDING_PAGE_DRAFT_CONFLICT" };
        }
        throw error;
      }
    },
    async clearActive(input) {
      const project = await prisma.landingPageProject.findFirst({
        where: { id: input.projectId, userId: input.userId },
        select: { id: true, publishedPublicationId: true },
      });
      if (!project) return { ok: false, code: "NOT_FOUND" };
      await prisma.landingPageProject.update({
        where: { id: project.id },
        data: { publishedPublicationId: null, status: "UNPUBLISHED" },
      });
      return { ok: true, alreadyInactive: project.publishedPublicationId === null };
    },
    async list(input) {
      const project = await prisma.landingPageProject.findFirst({
        where: { id: input.projectId, userId: input.userId },
        select: { id: true, publishedPublicationId: true },
      });
      if (!project) return null;
      const rows = await prisma.landingPagePublication.findMany({
        where: { landingPageProjectId: project.id },
        orderBy: { version: "asc" },
        select: {
          id: true,
          version: true,
          createdAt: true,
          sourceDraftRevision: true,
          rollbackSourcePublicationId: true,
          snapshotSchemaVersion: true,
          snapshotHash: true,
        },
      });
      return rows.map((row) => ({
        id: row.id,
        version: row.version,
        createdAt: row.createdAt,
        sourceDraftRevision: row.sourceDraftRevision,
        isActive: row.id === project.publishedPublicationId,
        rollbackSourcePublicationId: row.rollbackSourcePublicationId,
        snapshotSchemaVersion: row.snapshotSchemaVersion,
        snapshotHash: row.snapshotHash,
      }));
    },
    async get(input) {
      const project = await prisma.landingPageProject.findFirst({
        where: { id: input.projectId, userId: input.userId },
        select: { id: true },
      });
      if (!project) return null;
      const row = await prisma.landingPagePublication.findFirst({
        where: { id: input.publicationId, landingPageProjectId: project.id },
      });
      return row ? toRecord(row) : null;
    },
    async findActiveBySlug(slug): Promise<PublicLandingPage | null> {
      const project = await prisma.landingPageProject.findUnique({
        where: { slug },
        select: { id: true, slug: true, publishedPublicationId: true },
      });
      if (!project?.publishedPublicationId) return null;
      const row = await prisma.landingPagePublication.findFirst({
        where: { id: project.publishedPublicationId, landingPageProjectId: project.id },
      });
      if (!row) return null;
      const publication = toRecord(row);
      if (!publication) return null;
      return { projectId: project.id, slug: project.slug, publication };
    },
    async referencesMedia(projectId, mediaId) {
      const rows = await prisma.landingPagePublication.findMany({
        where: { landingPageProjectId: projectId },
        select: { snapshot: true },
      });
      return rows.some((row) => snapshotReferencesMedia(row.snapshot, mediaId));
    },
  };
}
