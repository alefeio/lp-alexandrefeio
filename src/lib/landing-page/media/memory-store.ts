import type { LandingPageMediaRecord, LandingPageMediaStore } from "@/lib/landing-page/media/record";

function clone(record: LandingPageMediaRecord): LandingPageMediaRecord {
  return { ...record, createdAt: new Date(record.createdAt), updatedAt: new Date(record.updatedAt) };
}

export function createMemoryLandingPageMediaStore(): LandingPageMediaStore {
  const rows = new Map<string, LandingPageMediaRecord>();
  return {
    async insert(record) {
      rows.set(record.id, clone(record));
    },
    async save(record) {
      rows.set(record.id, clone(record));
    },
    async findById(id) {
      const row = rows.get(id);
      return row ? clone(row) : null;
    },
    async listForProjectOwner(landingPageProjectId, userId) {
      return [...rows.values()]
        .filter((row) => row.landingPageProjectId === landingPageProjectId && row.userId === userId && row.status !== "DELETED")
        .map(clone);
    },
    async countActive(landingPageProjectId) {
      return [...rows.values()].filter(
        (row) => row.landingPageProjectId === landingPageProjectId && (row.status === "UPLOADING" || row.status === "READY"),
      ).length;
    },
    async listUploadingBefore(cutoff) {
      return [...rows.values()].filter((row) => row.status === "UPLOADING" && row.createdAt.getTime() <= cutoff.getTime()).map(clone);
    },
  };
}
