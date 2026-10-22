export const LANDING_PAGE_LEAD_STATUSES = ["NEW", "ARCHIVED"] as const;

export type LandingPageLeadStatus = (typeof LANDING_PAGE_LEAD_STATUSES)[number];

/** Lead privado do dono. Sem IP, user agent, cabeçalhos ou requisição bruta. */
export type LandingPageLeadRecord = {
  id: string;
  landingPageProjectId: string;
  publicationId: string | null;
  formSectionId: string;
  submittedData: Record<string, string>;
  status: LandingPageLeadStatus;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
};

export type LandingPageLeadInsert = {
  id: string;
  landingPageProjectId: string;
  publicationId: string | null;
  formSectionId: string;
  submittedData: Record<string, string>;
  idempotencyKey: string;
};

export type LandingPageLeadStore = {
  insert(input: LandingPageLeadInsert): Promise<{ record: LandingPageLeadRecord; created: boolean }>;
  listForProject(landingPageProjectId: string): Promise<LandingPageLeadRecord[]>;
  findById(id: string): Promise<LandingPageLeadRecord | null>;
  archive(id: string): Promise<LandingPageLeadRecord | null>;
};

export function createMemoryLandingPageLeadStore(): LandingPageLeadStore {
  const rows = new Map<string, LandingPageLeadRecord>();

  return {
    async insert(input) {
      const existing = [...rows.values()].find(
        (row) => row.landingPageProjectId === input.landingPageProjectId && row.idempotencyKey === input.idempotencyKey,
      );
      if (existing) return { record: existing, created: false };
      const now = new Date();
      const record: LandingPageLeadRecord = { ...input, status: "NEW", createdAt: now, updatedAt: now };
      rows.set(record.id, record);
      return { record, created: true };
    },
    async listForProject(landingPageProjectId) {
      return [...rows.values()]
        .filter((row) => row.landingPageProjectId === landingPageProjectId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findById(id) {
      return rows.get(id) ?? null;
    },
    async archive(id) {
      const row = rows.get(id);
      if (!row) return null;
      row.status = "ARCHIVED";
      row.updatedAt = new Date();
      return row;
    },
  };
}
