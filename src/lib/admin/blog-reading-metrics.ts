import {
  BLOG_METRIC_PERIOD_LABEL,
  BLOG_METRIC_PERIODS,
  blogMetricRange,
  parseBlogMetricPeriod,
  type BlogMetricPeriod,
} from "@/lib/admin/blog-metrics";
import { blogCategoryLabel } from "@/lib/blog/catalog";
import { BLOG_READING_MIN_SAMPLE, blogReadingIngestEnabled } from "@/lib/blog/reading/constants";
import { isDeepBlogReading, isEngagedBlogReading } from "@/lib/blog/reading/metrics";

export { BLOG_METRIC_PERIODS, BLOG_METRIC_PERIOD_LABEL, parseBlogMetricPeriod };

export const BLOG_READING_SAMPLE_NOTE = `Amostra abaixo de ${BLOG_READING_MIN_SAMPLE} sessões. Os números existem, mas ainda não sustentam interpretações consistentes.`;
export const BLOG_READING_TZ = "America/Belem";

export type BlogReadingMetricCatalogItem = {
  id: string;
  slug: string;
  title: string;
  categorySlug: string;
  published: boolean;
};

export type BlogReadingSessionFact = {
  id: string;
  blogPostId: string | null;
  slugObserved: string;
  anonymousId: string;
  activeTimeMs: number;
  maxScrollPercent: number;
  reachedEnd: boolean;
  startedAt: Date;
};

export type BlogReadingClickFact = {
  readingSessionId: string;
  destinationType: "course" | "service";
};

export type BlogReadingMetricsStatus =
  | "ready"
  | "empty"
  | "ingest_disabled"
  | "migration_missing"
  | "unavailable";

export type BlogReadingMetricsView = {
  period: BlogMetricPeriod;
  queryLabel: string;
  status: BlogReadingMetricsStatus;
  message: string;
  sampleWarning: string;
  ingestEnabled: boolean;
  totals: {
    sessions: number;
    browsers: number;
    meanActiveMs: number | null;
    medianActiveMs: number | null;
    engaged: number;
    deep: number;
    depth25: number;
    depth50: number;
    depth75: number;
    reachedEnd: number;
    courseClicks: number;
    serviceClicks: number;
    /** Total de eventos comerciais registrados. */
    commercialClicks: number;
    /** Sessões distintas com pelo menos um clique. */
    sessionsWithClick: number;
    /** sessões com clique / sessões observadas (0–1). */
    clickRate: number | null;
  } | null;
  articles: Array<{
    key: string;
    title: string;
    category: string;
    url: string | null;
    removed: boolean;
    sessions: number;
    meanActiveMs: number | null;
    engaged: number;
    deep: number;
    depth25: number;
    depth50: number;
    depth75: number;
    reachedEnd: number;
    courseClicks: number;
    serviceClicks: number;
    commercialClicks: number;
    sessionsWithClick: number;
    clickRate: number | null;
  }>;
  categories: Array<{
    label: string;
    sessions: number;
    engaged: number;
    deep: number;
    courseClicks: number;
    serviceClicks: number;
  }>;
};

export function blogReadingPeriodBounds(period: BlogMetricPeriod, now: Date): { start: Date; endExclusive: Date } {
  const civil = blogMetricRange(period, now, BLOG_READING_TZ);
  return {
    start: startOfCivilDay(civil.startDate, BLOG_READING_TZ),
    endExclusive: addCivilDays(civil.endDate, 1, BLOG_READING_TZ),
  };
}

export function assembleBlogReadingMetrics(input: {
  period: BlogMetricPeriod;
  now: Date;
  sessions: BlogReadingSessionFact[];
  clicks: BlogReadingClickFact[];
  catalog: BlogReadingMetricCatalogItem[];
  ingestEnabled: boolean;
}): BlogReadingMetricsView {
  const bounds = blogReadingPeriodBounds(input.period, input.now);
  const queryLabel = readingQueryLabel(input.period, bounds);
  const published = new Map(input.catalog.filter((item) => item.published).map((item) => [item.id, item]));
  const clicksBySession = new Map<string, BlogReadingClickFact[]>();
  for (const click of input.clicks) {
    const list = clicksBySession.get(click.readingSessionId) ?? [];
    list.push(click);
    clicksBySession.set(click.readingSessionId, list);
  }

  if (input.sessions.length === 0) {
    return {
      period: input.period,
      queryLabel,
      status: "empty",
      message: input.ingestEnabled
        ? "Nenhuma sessão first-party neste recorte."
        : "Nenhuma sessão first-party neste recorte. A coleta pública permanece desligada.",
      sampleWarning: "",
      ingestEnabled: input.ingestEnabled,
      totals: emptyTotals(),
      articles: publishedArticlesWithoutSessions(published),
      categories: [],
    };
  }

  const times = input.sessions.map((session) => session.activeTimeMs).sort((a, b) => a - b);
  let courseClicks = 0;
  let serviceClicks = 0;
  let sessionsWithClick = 0;
  let engaged = 0;
  let deep = 0;
  let depth25 = 0;
  let depth50 = 0;
  let depth75 = 0;
  let reachedEnd = 0;
  const browsers = new Set<string>();
  const byArticle = new Map<string, ArticleBucket>();

  for (const session of input.sessions) {
    browsers.add(session.anonymousId);
    const facts = {
      activeTimeMs: session.activeTimeMs,
      maxScrollPercent: session.maxScrollPercent,
      reachedEnd: session.reachedEnd,
    };
    if (isEngagedBlogReading(facts)) engaged += 1;
    if (isDeepBlogReading(facts)) deep += 1;
    if (session.maxScrollPercent >= 25 || session.reachedEnd) depth25 += 1;
    if (session.maxScrollPercent >= 50 || session.reachedEnd) depth50 += 1;
    if (session.maxScrollPercent >= 75 || session.reachedEnd) depth75 += 1;
    if (session.reachedEnd) reachedEnd += 1;
    const sessionClicks = clicksBySession.get(session.id) ?? [];
    let sessionCourse = 0;
    let sessionService = 0;
    for (const click of sessionClicks) {
      if (click.destinationType === "course") {
        courseClicks += 1;
        sessionCourse += 1;
      } else {
        serviceClicks += 1;
        sessionService += 1;
      }
    }
    if (sessionClicks.length > 0) sessionsWithClick += 1;
    const catalog = session.blogPostId ? published.get(session.blogPostId) : undefined;
    const key = catalog?.id ?? `removed:${session.slugObserved}`;
    const bucket = byArticle.get(key) ?? {
      key,
      title: catalog?.title ?? `Artigo removido (${session.slugObserved})`,
      category: catalog ? blogCategoryLabel(catalog.categorySlug) : "Removido",
      url: catalog ? `/blog/${catalog.slug}` : null,
      removed: !catalog,
      categorySlug: catalog?.categorySlug ?? "",
      sessions: 0,
      activeSum: 0,
      engaged: 0,
      deep: 0,
      depth25: 0,
      depth50: 0,
      depth75: 0,
      reachedEnd: 0,
      courseClicks: 0,
      serviceClicks: 0,
      sessionsWithClick: 0,
    };
    bucket.sessions += 1;
    bucket.activeSum += session.activeTimeMs;
    if (isEngagedBlogReading(facts)) bucket.engaged += 1;
    if (isDeepBlogReading(facts)) bucket.deep += 1;
    if (session.maxScrollPercent >= 25 || session.reachedEnd) bucket.depth25 += 1;
    if (session.maxScrollPercent >= 50 || session.reachedEnd) bucket.depth50 += 1;
    if (session.maxScrollPercent >= 75 || session.reachedEnd) bucket.depth75 += 1;
    if (session.reachedEnd) bucket.reachedEnd += 1;
    bucket.courseClicks += sessionCourse;
    bucket.serviceClicks += sessionService;
    if (sessionClicks.length > 0) bucket.sessionsWithClick += 1;
    byArticle.set(key, bucket);
  }

  for (const item of published.values()) {
    if (!byArticle.has(item.id)) {
      byArticle.set(item.id, {
        key: item.id,
        title: item.title,
        category: blogCategoryLabel(item.categorySlug),
        url: `/blog/${item.slug}`,
        removed: false,
        categorySlug: item.categorySlug,
        sessions: 0,
        activeSum: 0,
        engaged: 0,
        deep: 0,
        depth25: 0,
        depth50: 0,
        depth75: 0,
        reachedEnd: 0,
        courseClicks: 0,
        serviceClicks: 0,
        sessionsWithClick: 0,
      });
    }
  }

  const articles = [...byArticle.values()]
    .map((bucket) => {
      const commercialClicks = bucket.courseClicks + bucket.serviceClicks;
      return {
        key: bucket.key,
        title: bucket.title,
        category: bucket.category,
        url: bucket.url,
        removed: bucket.removed,
        sessions: bucket.sessions,
        meanActiveMs: bucket.sessions > 0 ? Math.round(bucket.activeSum / bucket.sessions) : null,
        engaged: bucket.engaged,
        deep: bucket.deep,
        depth25: bucket.depth25,
        depth50: bucket.depth50,
        depth75: bucket.depth75,
        reachedEnd: bucket.reachedEnd,
        courseClicks: bucket.courseClicks,
        serviceClicks: bucket.serviceClicks,
        commercialClicks,
        sessionsWithClick: bucket.sessionsWithClick,
        clickRate: sessionClickRate(bucket.sessionsWithClick, bucket.sessions),
      };
    })
    .sort((a, b) => b.sessions - a.sessions || a.title.localeCompare(b.title, "pt"));

  const categoriesMap = new Map<string, BlogReadingMetricsView["categories"][number]>();
  for (const article of articles) {
    if (article.removed || article.sessions === 0) continue;
    const label = article.category;
    const current = categoriesMap.get(label) ?? {
      label,
      sessions: 0,
      engaged: 0,
      deep: 0,
      courseClicks: 0,
      serviceClicks: 0,
    };
    current.sessions += article.sessions;
    current.engaged += article.engaged;
    current.deep += article.deep;
    current.courseClicks += article.courseClicks;
    current.serviceClicks += article.serviceClicks;
    categoriesMap.set(label, current);
  }

  const sessionCount = input.sessions.length;
  const commercialClicks = courseClicks + serviceClicks;
  return {
    period: input.period,
    queryLabel,
    status: "ready",
    message: "",
    sampleWarning: sessionCount < BLOG_READING_MIN_SAMPLE ? BLOG_READING_SAMPLE_NOTE : "",
    ingestEnabled: input.ingestEnabled,
    totals: {
      sessions: sessionCount,
      browsers: browsers.size,
      meanActiveMs: Math.round(times.reduce((sum, value) => sum + value, 0) / sessionCount),
      medianActiveMs: median(times),
      engaged,
      deep,
      depth25,
      depth50,
      depth75,
      reachedEnd,
      courseClicks,
      serviceClicks,
      commercialClicks,
      sessionsWithClick,
      clickRate: sessionClickRate(sessionsWithClick, sessionCount),
    },
    articles,
    categories: [...categoriesMap.values()].sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label, "pt")),
  };
}

/** Taxa de cliques por sessão = sessões com ≥1 clique / sessões observadas. */
export function sessionClickRate(sessionsWithClickCount: number, sessions: number): number | null {
  if (sessions <= 0) return null;
  return Math.max(0, Math.min(1, sessionsWithClickCount / sessions));
}

export function blogReadingMetricsPending(input: {
  period: BlogMetricPeriod;
  now: Date;
  status: Exclude<BlogReadingMetricsStatus, "ready" | "empty">;
  message: string;
  ingestEnabled?: boolean;
}): BlogReadingMetricsView {
  const bounds = blogReadingPeriodBounds(input.period, input.now);
  return {
    period: input.period,
    queryLabel: readingQueryLabel(input.period, bounds),
    status: input.status,
    message: input.message,
    sampleWarning: "",
    ingestEnabled: input.ingestEnabled ?? blogReadingIngestEnabled(),
    totals: null,
    articles: [],
    categories: [],
  };
}

type ArticleBucket = {
  key: string;
  title: string;
  category: string;
  url: string | null;
  removed: boolean;
  categorySlug: string;
  sessions: number;
  activeSum: number;
  engaged: number;
  deep: number;
  depth25: number;
  depth50: number;
  depth75: number;
  reachedEnd: number;
  courseClicks: number;
  serviceClicks: number;
  sessionsWithClick: number;
};

function emptyTotals(): BlogReadingMetricsView["totals"] {
  return {
    sessions: 0,
    browsers: 0,
    meanActiveMs: null,
    medianActiveMs: null,
    engaged: 0,
    deep: 0,
    depth25: 0,
    depth50: 0,
    depth75: 0,
    reachedEnd: 0,
    courseClicks: 0,
    serviceClicks: 0,
    commercialClicks: 0,
    sessionsWithClick: 0,
    clickRate: null,
  };
}

function publishedArticlesWithoutSessions(published: Map<string, BlogReadingMetricCatalogItem>): BlogReadingMetricsView["articles"] {
  return [...published.values()]
    .map((item) => ({
      key: item.id,
      title: item.title,
      category: blogCategoryLabel(item.categorySlug),
      url: `/blog/${item.slug}`,
      removed: false,
      sessions: 0,
      meanActiveMs: null,
      engaged: 0,
      deep: 0,
      depth25: 0,
      depth50: 0,
      depth75: 0,
      reachedEnd: 0,
      courseClicks: 0,
      serviceClicks: 0,
      commercialClicks: 0,
      sessionsWithClick: 0,
      clickRate: null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "pt"));
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const a = sorted[mid - 1];
  const b = sorted[mid];
  if (a == null || b == null) return null;
  return Math.round((a + b) / 2);
}

function readingQueryLabel(period: BlogMetricPeriod, bounds: { start: Date; endExclusive: Date }): string {
  const start = formatBelem(bounds.start);
  const end = formatBelem(new Date(bounds.endExclusive.getTime() - 1));
  const history = period === "all"
    ? `Histórico first-party de ${start} a ${end}, limitado ao que existe no banco (retenção de 12 meses).`
    : `Consulta first-party de ${start} a ${end}.`;
  return `${history} Datas em ${BLOG_READING_TZ}. Não mistura visualizações do GA4.`;
}

function startOfCivilDay(isoDate: string, timeZone: string): Date {
  return zonedCivilInstant(isoDate, "00:00:00.000", timeZone);
}

function addCivilDays(isoDate: string, days: number, timeZone: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
  const next = utc.toISOString().slice(0, 10);
  return startOfCivilDay(next, timeZone);
}

function zonedCivilInstant(isoDate: string, time: string, timeZone: string): Date {
  const guess = new Date(`${isoDate}T${time}Z`);
  const asText = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(asText.find((part) => part.type === type)?.value ?? "0");
  const shifted = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  const diff = shifted - guess.getTime();
  return new Date(guess.getTime() - diff);
}

function formatBelem(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: BLOG_READING_TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(value);
}
