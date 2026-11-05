import {
  assembleBlogReadingMetrics,
  blogReadingMetricsPending,
  blogReadingPeriodBounds,
  parseBlogMetricPeriod,
  type BlogReadingClickFact,
  type BlogReadingMetricCatalogItem,
  type BlogReadingMetricsView,
  type BlogReadingSessionFact,
} from "@/lib/admin/blog-reading-metrics";
import { blogReadingIngestEnabled } from "@/lib/blog/reading/constants";
import { getPrisma } from "@/lib/db/prisma";

function isMissingTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "P2021" || code === "P2010") return true;
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return /blog_reading_session|blog_commercial_click|does not exist|não existe/i.test(message);
}

export async function loadBlogReadingMetrics(
  query: { periodo?: string },
  options?: {
    now?: Date;
    catalog?: BlogReadingMetricCatalogItem[];
    ingestEnabled?: boolean;
    repository?: {
      listSessions(start: Date, endExclusive: Date): Promise<BlogReadingSessionFact[]>;
      listClicks(sessionIds: string[]): Promise<BlogReadingClickFact[]>;
      listCatalog(): Promise<BlogReadingMetricCatalogItem[]>;
    };
  },
): Promise<BlogReadingMetricsView> {
  const now = options?.now ?? new Date();
  const period = parseBlogMetricPeriod(query.periodo);
  const ingestEnabled = options?.ingestEnabled ?? blogReadingIngestEnabled();
  const bounds = blogReadingPeriodBounds(period, now);
  try {
    const repository = options?.repository ?? createPrismaBlogReadingMetricsRepository();
    const catalog = options?.catalog ?? (await repository.listCatalog());
    const sessions = await repository.listSessions(bounds.start, bounds.endExclusive);
    const clicks = await repository.listClicks(sessions.map((session) => session.id));
    return assembleBlogReadingMetrics({ period, now, sessions, clicks, catalog, ingestEnabled });
  } catch (error) {
    if (isMissingTable(error)) {
      return blogReadingMetricsPending({
        period,
        now,
        status: "migration_missing",
        message: "As tabelas first-party ainda não existem neste ambiente. Aplique a migration da BLOG-M1A antes de consultar sessões.",
        ingestEnabled,
      });
    }
    return blogReadingMetricsPending({
      period,
      now,
      status: "unavailable",
      message: "Não foi possível consultar as sessões first-party agora.",
      ingestEnabled,
    });
  }
}

function createPrismaBlogReadingMetricsRepository() {
  const prisma = () => getPrisma();
  return {
    async listCatalog(): Promise<BlogReadingMetricCatalogItem[]> {
      const rows = await prisma().blogPost.findMany({
        select: { id: true, slug: true, title: true, categorySlug: true, status: true },
      });
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        categorySlug: row.categorySlug,
        published: row.status === "PUBLISHED",
      }));
    },
    async listSessions(start: Date, endExclusive: Date): Promise<BlogReadingSessionFact[]> {
      const rows = await prisma().blogReadingSession.findMany({
        where: { startedAt: { gte: start, lt: endExclusive } },
        select: {
          id: true,
          blogPostId: true,
          slugObserved: true,
          anonymousId: true,
          activeTimeMs: true,
          maxScrollPercent: true,
          reachedEndAt: true,
          startedAt: true,
        },
      });
      return rows.map((row) => ({
        id: row.id,
        blogPostId: row.blogPostId,
        slugObserved: row.slugObserved,
        anonymousId: row.anonymousId,
        activeTimeMs: row.activeTimeMs,
        maxScrollPercent: row.maxScrollPercent,
        reachedEnd: row.reachedEndAt != null,
        startedAt: row.startedAt,
      }));
    },
    async listClicks(sessionIds: string[]): Promise<BlogReadingClickFact[]> {
      if (sessionIds.length === 0) return [];
      const rows = await prisma().blogCommercialClick.findMany({
        where: { readingSessionId: { in: sessionIds } },
        select: { readingSessionId: true, destinationType: true },
      });
      return rows.flatMap((row) => {
        if (row.destinationType !== "course" && row.destinationType !== "service") return [];
        return [{ readingSessionId: row.readingSessionId, destinationType: row.destinationType }];
      });
    },
  };
}
