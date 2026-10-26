import { subtractCalendarMonths } from "@/lib/landing-page/retention/policy";

export const JOURNEY_RETENTION_MONTHS = 12;

export type JourneyRetentionReport = {
  mode: "DRY_RUN" | "EXECUTE";
  cutoff: string;
  expiredCount: number;
  deletedCount: number;
};

export type JourneyRetentionRepository = {
  countExpired(cutoff: Date): Promise<number>;
  deleteExpired(cutoff: Date): Promise<number>;
};

/** Exclui somente occurredAt anterior ao corte. O instante exato permanece. */
export function journeyRetentionCutoff(now: Date): Date {
  return subtractCalendarMonths(now, JOURNEY_RETENTION_MONTHS);
}

export function formatJourneyRetentionReport(report: JourneyRetentionReport): string {
  return [`mode ${report.mode}`, `cutoff ${report.cutoff}`, `expiredCount ${report.expiredCount}`, `deletedCount ${report.deletedCount}`].join("\n");
}

export async function runJourneyRetention(input: {
  now?: Date;
  execute?: boolean;
  repository: JourneyRetentionRepository;
}): Promise<JourneyRetentionReport> {
  const now = input.now ?? new Date();
  const cutoff = journeyRetentionCutoff(now);
  const expiredCount = await input.repository.countExpired(cutoff);
  if (input.execute !== true) {
    return { mode: "DRY_RUN", cutoff: cutoff.toISOString(), expiredCount, deletedCount: 0 };
  }
  const deletedCount = await input.repository.deleteExpired(cutoff);
  return { mode: "EXECUTE", cutoff: cutoff.toISOString(), expiredCount, deletedCount };
}
