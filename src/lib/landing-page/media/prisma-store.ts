import type { LandingPageMediaStatus, LandingPageMediaType } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { LandingPageMediaRecord, LandingPageMediaStore } from "@/lib/landing-page/media/record";

function toRecord(row: {
  id: string;
  landingPageProjectId: string;
  userId: string;
  type: LandingPageMediaType;
  status: LandingPageMediaStatus;
  storageKey: string;
  publicUrl: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  createdAt: Date;
  updatedAt: Date;
}): LandingPageMediaRecord {
  return { ...row };
}

export function createPrismaLandingPageMediaStore(): LandingPageMediaStore {
  const prisma = getPrisma();
  return {
    async insert(record) {
      await prisma.landingPageMedia.create({ data: record });
    },
    async save(record) {
      await prisma.landingPageMedia.update({ where: { id: record.id }, data: record });
    },
    async findById(id) {
      const row = await prisma.landingPageMedia.findUnique({ where: { id } });
      return row ? toRecord(row) : null;
    },
    async listForProjectOwner(landingPageProjectId, userId) {
      const rows = await prisma.landingPageMedia.findMany({
        where: { landingPageProjectId, userId, status: { not: "DELETED" } },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(toRecord);
    },
    async countActive(landingPageProjectId) {
      return prisma.landingPageMedia.count({
        where: { landingPageProjectId, status: { in: ["UPLOADING", "READY"] } },
      });
    },
    async listUploadingBefore(cutoff) {
      const rows = await prisma.landingPageMedia.findMany({
        where: { status: "UPLOADING", createdAt: { lte: cutoff } },
      });
      return rows.map(toRecord);
    },
  };
}
