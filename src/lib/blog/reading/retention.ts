import { subtractCalendarMonths } from "@/lib/landing-page/retention/policy";
import { BLOG_READING_RETENTION_MONTHS } from "@/lib/blog/reading/constants";

export type BlogReadingRetentionReport = {
  mode: "DRY_RUN" | "EXECUTE";
  cutoff: string;
  expiredCount: number;
  deletedSessions: number;
  deletedClicks: number;
};

export type BlogReadingRetentionRepository = {
  countExpired(cutoff: Date): Promise<number>;
  deleteExpired(cutoff: Date): Promise<{ sessions: number; clicks: number }>;
};

/** Exclui sessões com startedAt anterior ao corte. O instante exato permanece. Cliques da sessão saem junto. */
export function blogReadingRetentionCutoff(now: Date): Date {
  return subtractCalendarMonths(now, BLOG_READING_RETENTION_MONTHS);
}

export async function runBlogReadingRetention(input: {
  now?: Date;
  execute?: boolean;
  repository: BlogReadingRetentionRepository;
}): Promise<BlogReadingRetentionReport> {
  const now = input.now ?? new Date();
  const cutoff = blogReadingRetentionCutoff(now);
  const expiredCount = await input.repository.countExpired(cutoff);
  if (input.execute !== true) {
    return { mode: "DRY_RUN", cutoff: cutoff.toISOString(), expiredCount, deletedSessions: 0, deletedClicks: 0 };
  }
  const deleted = await input.repository.deleteExpired(cutoff);
  return {
    mode: "EXECUTE",
    cutoff: cutoff.toISOString(),
    expiredCount,
    deletedSessions: deleted.sessions,
    deletedClicks: deleted.clicks,
  };
}
