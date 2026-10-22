import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { LandingPageLeadInsert, LandingPageLeadRecord, LandingPageLeadStatus, LandingPageLeadStore } from "@/lib/landing-page/leads/store";

function toRecord(row: {
  id: string;
  landingPageProjectId: string;
  publicationId: string | null;
  formSectionId: string;
  submittedData: Prisma.JsonValue;
  status: LandingPageLeadStatus;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}): LandingPageLeadRecord {
  const data = row.submittedData && typeof row.submittedData === "object" && !Array.isArray(row.submittedData) ? row.submittedData : {};
  const submittedData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") submittedData[key] = value;
  }
  return { ...row, submittedData };
}

export function createPrismaLandingPageLeadStore(): LandingPageLeadStore {
  return {
    async insert(input: LandingPageLeadInsert) {
      const prisma = getPrisma();
      try {
        const row = await prisma.landingPageLead.create({
          data: {
            id: input.id,
            landingPageProjectId: input.landingPageProjectId,
            publicationId: input.publicationId,
            formSectionId: input.formSectionId,
            submittedData: input.submittedData as Prisma.InputJsonValue,
            idempotencyKey: input.idempotencyKey,
          },
        });
        return { record: toRecord(row), created: true };
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code !== "P2002") throw error;
        const existing = await prisma.landingPageLead.findUnique({
          where: { landingPageProjectId_idempotencyKey: { landingPageProjectId: input.landingPageProjectId, idempotencyKey: input.idempotencyKey } },
        });
        if (!existing) throw error;
        return { record: toRecord(existing), created: false };
      }
    },
    async listForProject(landingPageProjectId) {
      const rows = await getPrisma().landingPageLead.findMany({ where: { landingPageProjectId }, orderBy: { createdAt: "desc" } });
      return rows.map(toRecord);
    },
    async findById(id) {
      const row = await getPrisma().landingPageLead.findUnique({ where: { id } });
      return row ? toRecord(row) : null;
    },
    async archive(id) {
      const row = await getPrisma().landingPageLead.update({ where: { id }, data: { status: "ARCHIVED" } }).catch(() => null);
      return row ? toRecord(row) : null;
    },
  };
}
