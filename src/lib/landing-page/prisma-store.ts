import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { parseLandingPageDocument } from "@/lib/landing-page/document";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import type { LandingPageProjectRecord, LandingPageStore } from "@/lib/landing-page/types";

function toRecord(
  row: {
    id: string;
    userId: string;
    projectId: string | null;
    courseId: string;
    slug: string;
    title: string;
    status: LandingPageProjectRecord["status"];
    draftDocument: Prisma.JsonValue;
    draftRevision: number;
    publishedPublicationId: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { publications: number };
  },
): LandingPageProjectRecord {
  const parsed = parseLandingPageDocument(row.draftDocument);
  if (!parsed.ok) {
    throw new Error(`LandingPageProject ${row.id} has invalid draftDocument: ${parsed.reason}`);
  }
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    courseId: row.courseId,
    slug: row.slug,
    title: row.title,
    status: row.status,
    draftDocument: parsed.document,
    draftRevision: row.draftRevision,
    publishedPublicationId: row.publishedPublicationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publicationCount: row._count.publications,
  };
}

const selectWithCount = {
  id: true,
  userId: true,
  projectId: true,
  courseId: true,
  slug: true,
  title: true,
  status: true,
  draftDocument: true,
  draftRevision: true,
  publishedPublicationId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { publications: true } },
} as const;

export function createPrismaLandingPageStore(): LandingPageStore {
  const prisma = getPrisma();

  return {
    async findCourseIdBySlug(slug) {
      const course = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
      return course?.id ?? null;
    },
    async findOwnedProject(projectId, userId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
        select: { id: true },
      });
      return project;
    },
    async findByIdForUser(id, userId) {
      const row = await prisma.landingPageProject.findFirst({
        where: { id, userId },
        select: selectWithCount,
      });
      return row ? toRecord(row) : null;
    },
    async findSlugOwner(slug) {
      const row = await prisma.landingPageProject.findUnique({
        where: { slug },
        select: { id: true, userId: true },
      });
      return row;
    },
    async create(input) {
      const row = await prisma.landingPageProject.create({
        data: {
          id: input.id,
          userId: input.userId,
          projectId: input.projectId,
          courseId: input.courseId,
          slug: input.slug,
          title: input.title,
          status: "DRAFT",
          draftDocument: input.draftDocument as Prisma.InputJsonValue,
          draftRevision: 1,
        },
        select: selectWithCount,
      });
      return toRecord(row);
    },
    async updateDraftAtomic(input) {
      const result = await prisma.landingPageProject.updateMany({
        where: {
          id: input.id,
          userId: input.userId,
          draftRevision: input.expectedRevision,
        },
        data: {
          draftDocument: input.document as Prisma.InputJsonValue,
          draftRevision: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const exists = await prisma.landingPageProject.findFirst({
          where: { id: input.id, userId: input.userId },
          select: { id: true },
        });
        return { ok: false, reason: exists ? "CONFLICT" : "NOT_FOUND" };
      }
      const row = await prisma.landingPageProject.findFirst({
        where: { id: input.id, userId: input.userId },
        select: selectWithCount,
      });
      if (!row) return { ok: false, reason: "NOT_FOUND" };
      return { ok: true, record: toRecord(row) };
    },
    async updateTitleAtomic(input) {
      const result = await prisma.landingPageProject.updateMany({
        where: { id: input.id, userId: input.userId },
        data: { title: input.title },
      });
      if (result.count === 0) return { ok: false, reason: "NOT_FOUND" };
      const row = await prisma.landingPageProject.findFirst({
        where: { id: input.id, userId: input.userId },
        select: selectWithCount,
      });
      if (!row) return { ok: false, reason: "NOT_FOUND" };
      return { ok: true, record: toRecord(row) };
    },
    async updateSlugAtomic(input) {
      const current = await prisma.landingPageProject.findFirst({
        where: { id: input.id, userId: input.userId },
        select: {
          id: true,
          _count: { select: { publications: true } },
        },
      });
      if (!current) return { ok: false, reason: "NOT_FOUND" };
      if (current._count.publications > 0) return { ok: false, reason: "LOCKED" };

      try {
        const result = await prisma.landingPageProject.updateMany({
          where: { id: input.id, userId: input.userId },
          data: { slug: input.slug },
        });
        if (result.count === 0) return { ok: false, reason: "NOT_FOUND" };
      } catch (error) {
        if (isUniqueViolation(error)) return { ok: false, reason: "TAKEN" };
        throw error;
      }

      const row = await prisma.landingPageProject.findFirst({
        where: { id: input.id, userId: input.userId },
        select: selectWithCount,
      });
      if (!row) return { ok: false, reason: "NOT_FOUND" };
      return { ok: true, record: toRecord(row) };
    },
    async listForUser(userId) {
      const rows = await prisma.landingPageProject.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: selectWithCount,
      });
      return rows.map((row) => toRecord(row));
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Helper tipado para futura publicação — não expõe endpoint. */
export type { LandingPageDocumentV1 };
