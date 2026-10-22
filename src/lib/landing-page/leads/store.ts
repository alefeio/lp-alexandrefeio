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
  archivedAt: Date | null;
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
  const tails = new Map<string, Promise<unknown>>();

  function exclusive<T>(key: string, task: () => T | Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const run = previous.then(task, task);
    tails.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  return {
    insert(input) {
      return exclusive(`${input.landingPageProjectId}:${input.idempotencyKey}`, () => {
        const existing = [...rows.values()].find(
          (row) => row.landingPageProjectId === input.landingPageProjectId && row.idempotencyKey === input.idempotencyKey,
        );
        if (existing) return { record: existing, created: false };
        const now = new Date();
        const record: LandingPageLeadRecord = { ...input, status: "NEW", createdAt: now, archivedAt: null, updatedAt: now };
        rows.set(record.id, record);
        return { record, created: true };
      });
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
      const now = new Date();
      row.status = "ARCHIVED";
      row.archivedAt = now;
      row.updatedAt = now;
      return row;
    },
  };
}
