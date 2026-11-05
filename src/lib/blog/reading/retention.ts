import { subtractCalendarMonths } from "@/lib/landing-page/retention/policy";
import {
  BLOG_READING_RETENTION_BATCH,
  BLOG_READING_RETENTION_MAX_BATCHES,
  BLOG_READING_RETENTION_MONTHS,
} from "@/lib/blog/reading/constants";

export type BlogReadingRetentionReport = {
  mode: "DRY_RUN" | "EXECUTE";
  cutoff: string;
  expiredCount: number;
  deletedSessions: number;
  deletedClicks: number;
  batchesRun: number;
  truncated: boolean;
};

export type BlogReadingRetentionRepository = {
  countExpired(cutoff: Date): Promise<number>;
  deleteBatch(cutoff: Date, limit: number): Promise<{ sessions: number; clicks: number; fetched: number }>;
};

/** Exclui sessões com startedAt anterior ao corte. O instante exato permanece. Cliques da sessão saem junto. */
export function blogReadingRetentionCutoff(now: Date): Date {
  return subtractCalendarMonths(now, BLOG_READING_RETENTION_MONTHS);
}

export async function runBlogReadingRetention(input: {
  now?: Date;
  execute?: boolean;
  batchSize?: number;
  maxBatches?: number;
  repository: BlogReadingRetentionRepository;
}): Promise<BlogReadingRetentionReport> {
  const now = input.now ?? new Date();
  const cutoff = blogReadingRetentionCutoff(now);
  const expiredCount = await input.repository.countExpired(cutoff);
  if (input.execute !== true) {
    return {
      mode: "DRY_RUN",
      cutoff: cutoff.toISOString(),
      expiredCount,
      deletedSessions: 0,
      deletedClicks: 0,
      batchesRun: 0,
      truncated: false,
    };
  }
  const batchSize = input.batchSize ?? BLOG_READING_RETENTION_BATCH;
  const maxBatches = input.maxBatches ?? BLOG_READING_RETENTION_MAX_BATCHES;
  let deletedSessions = 0;
  let deletedClicks = 0;
  let batchesRun = 0;
  let truncated = false;
  for (;;) {
    if (batchesRun >= maxBatches) {
      truncated = true;
      break;
    }
    const batch = await input.repository.deleteBatch(cutoff, batchSize);
    batchesRun += 1;
    deletedSessions += batch.sessions;
    deletedClicks += batch.clicks;
    if (batch.fetched === 0 || batch.sessions === 0 || batch.fetched < batchSize) break;
  }
  return {
    mode: "EXECUTE",
    cutoff: cutoff.toISOString(),
    expiredCount,
    deletedSessions,
    deletedClicks,
    batchesRun,
    truncated,
  };
}
