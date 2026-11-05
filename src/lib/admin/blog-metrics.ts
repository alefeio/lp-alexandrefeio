import { blogCategoryLabel } from "@/lib/blog/catalog";

export const BLOG_METRIC_PERIODS = ["7", "30", "90", "all"] as const;
export type BlogMetricPeriod = (typeof BLOG_METRIC_PERIODS)[number];

export const BLOG_METRIC_PERIOD_LABEL: Record<BlogMetricPeriod, string> = {
  "7": "Últimos 7 dias",
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  all: "Histórico disponível",
};

export const BLOG_METRICS_HISTORY_START = "2020-01-01";
export const BLOG_CLICK_NOTE = "Cliques de curso e serviço por artigo ainda não entram neste painel. O GA4 não tem essa coleta confirmada.";
export const BLOG_ACTIVE_USER_NOTE = "Usuários ativos são a métrica do GA4 neste recorte. Não representam pessoas únicas em sentido absoluto.";
export const BLOG_PAGE_VIEW_OWNER = "ga4-via-gtm";

export type BlogMetricCatalogItem = {
  slug: string;
  title: string;
  categorySlug: string;
  published: boolean;
};

export type BlogGa4Snapshot = {
  pages: Array<{ pagePath: string; views: number; activeUsers: number }>;
  totals: { views: number; activeUsers: number };
  series: Array<{ date: string; views: number }>;
  sources: Array<{ source: string; medium: string; views: number }>;
  truncated: boolean;
};

export type BlogMetricsView = {
  period: BlogMetricPeriod;
  queryLabel: string;
  status: "unconfigured" | "unavailable" | "empty" | "ready";
  message: string;
  clickNote: string;
  activeUserNote: string;
  totals: { views: number; activeUsers: number } | null;
  listing: { views: number; activeUsers: number | null } | null;
  articles: Array<{ title: string; category: string; url: string; views: number; activeUsers: number | null }>;
  categories: Array<{ label: string; views: number }>;
  sources: Array<{ label: string; views: number }>;
  series: Array<{ label: string; views: number }>;
  seriesTruncated: boolean;
  unmatched: Array<{ path: string; views: number }>;
  insight: string;
};

export function parseBlogMetricPeriod(raw: string | undefined): BlogMetricPeriod {
  return raw === "7" || raw === "30" || raw === "90" || raw === "all" ? raw : "30";
}

export function blogMetricsHref(period: BlogMetricPeriod): string {
  return period === "30" ? "/admin/blog/metricas" : `/admin/blog/metricas?periodo=${period}`;
}

export function normalizeBlogPath(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  try {
    if (value.includes("://")) value = new URL(value).pathname;
  } catch {
    return null;
  }
  value = value.split("#")[0]?.split("?")[0] ?? "";
  if (!value.startsWith("/")) value = `/${value}`;
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  value = value.replace(/\/+$/, "").toLowerCase() || "/";
  if (value !== "/blog" && !value.startsWith("/blog/")) return null;
  return value;
}

export function blogSlugFromPath(raw: string): string | null {
  const path = normalizeBlogPath(raw);
  if (!path || path === "/blog") return null;
  const slug = path.slice("/blog/".length);
  if (!slug || slug.includes("/")) return null;
  return slug;
}

export function blogMetricRange(period: BlogMetricPeriod, now: Date): { startDate: string; endDate: string } {
  const endDate = belemDate(now);
  if (period === "all") return { startDate: BLOG_METRICS_HISTORY_START, endDate };
  const days = period === "7" ? 6 : period === "30" ? 29 : 89;
  return { startDate: addIsoDays(endDate, -days), endDate };
}

export function assembleBlogMetrics(input: {
  period: BlogMetricPeriod;
  now: Date;
  snapshot: BlogGa4Snapshot;
  catalog: BlogMetricCatalogItem[];
}): BlogMetricsView {
  const range = blogMetricRange(input.period, input.now);
  const hidden = new Set(input.catalog.filter((item) => !item.published).map((item) => item.slug));
  const published = new Map(input.catalog.filter((item) => item.published).map((item) => [item.slug, item]));
  const pages = collapsePages(input.snapshot.pages, hidden, new Set(published.keys()));
  const articles = [...published.values()]
    .map((item) => {
      const hit = pages.articles.get(item.slug);
      return {
        title: item.title,
        category: blogCategoryLabel(item.categorySlug),
        url: `/blog/${item.slug}`,
        views: hit?.views ?? 0,
        activeUsers: hit ? hit.activeUsers : 0,
      };
    })
    .sort((a, b) => b.views - a.views || a.title.localeCompare(b.title, "pt"));
  const categories = categoryRows(articles, input.catalog);
  const sources = input.snapshot.sources
    .map((row) => ({ label: `${row.source || "Não informado"} / ${row.medium || "Não informado"}`, views: row.views }))
    .filter((row) => row.views > 0)
    .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label, "pt"))
    .slice(0, 10);
  const seriesAll = [...input.snapshot.series]
    .filter((row) => row.views > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({ label: formatGa4Date(row.date), views: row.views }));
  const seriesTruncated = seriesAll.length > 90;
  const series = seriesTruncated ? seriesAll.slice(-90) : seriesAll;
  const visibleViews = articles.reduce((sum, article) => sum + article.views, 0) + (pages.listing?.views ?? 0) + pages.unmatched.reduce((sum, row) => sum + row.views, 0);
  const views = input.snapshot.truncated ? null : visibleViews;
  const ready = articles.length > 0 || pages.listing || pages.unmatched.length > 0 || (views ?? 0) > 0;
  const top = categories[0];
  return {
    period: input.period,
    queryLabel: queryLabel(input.period, range),
    status: ready ? "ready" : "empty",
    message: input.snapshot.truncated
      ? "A consulta passou do limite de linhas do GA4. Os números abaixo ficam incompletos."
      : ready && (views ?? 0) === 0
        ? "O GA4 não registrou visualização de blog neste recorte."
        : "",
    clickNote: BLOG_CLICK_NOTE,
    activeUserNote: BLOG_ACTIVE_USER_NOTE,
    totals: views == null ? null : { views, activeUsers: input.snapshot.totals.activeUsers },
    listing: pages.listing,
    articles,
    categories,
    sources,
    series,
    seriesTruncated,
    unmatched: pages.unmatched,
    insight: top && top.views > 0 ? `A categoria com mais visualizações neste recorte é ${top.label}, com ${top.views}.` : "",
  };
}

export function blogMetricsPending(input: {
  period: BlogMetricPeriod;
  now: Date;
  status: "unconfigured" | "unavailable";
  message: string;
}): BlogMetricsView {
  const range = blogMetricRange(input.period, input.now);
  return {
    period: input.period,
    queryLabel: queryLabel(input.period, range),
    status: input.status,
    message: input.message,
    clickNote: BLOG_CLICK_NOTE,
    activeUserNote: BLOG_ACTIVE_USER_NOTE,
    totals: null,
    listing: null,
    articles: [],
    categories: [],
    sources: [],
    series: [],
    seriesTruncated: false,
    unmatched: [],
    insight: "",
  };
}

function collapsePages(rows: BlogGa4Snapshot["pages"], hidden: Set<string>, published: Set<string>) {
  const articles = new Map<string, { views: number; activeUsers: number | null; paths: number }>();
  const unmatched = new Map<string, number>();
  let listing: { views: number; activeUsers: number | null; paths: number } | null = null;
  for (const row of rows) {
    const path = normalizeBlogPath(row.pagePath);
    if (!path) continue;
    const slug = blogSlugFromPath(path);
    if (slug && hidden.has(slug)) continue;
    if (path === "/blog") {
      listing = addCount(listing, row.views, row.activeUsers);
      continue;
    }
    if (slug && published.has(slug)) {
      const current = articles.get(slug) ?? { views: 0, activeUsers: 0, paths: 0 };
      current.views += row.views;
      current.paths += 1;
      current.activeUsers = current.paths > 1 ? null : row.activeUsers;
      articles.set(slug, current);
      continue;
    }
    unmatched.set(path, (unmatched.get(path) ?? 0) + row.views);
  }
  return {
    articles,
    listing: listing ? { views: listing.views, activeUsers: listing.paths > 1 ? null : listing.activeUsers } : null,
    unmatched: [...unmatched.entries()].map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views),
  };
}

function addCount(current: { views: number; activeUsers: number | null; paths: number } | null, views: number, activeUsers: number) {
  if (!current) return { views, activeUsers, paths: 1 };
  return { views: current.views + views, activeUsers: null, paths: current.paths + 1 };
}

function categoryRows(articles: BlogMetricsView["articles"], catalog: BlogMetricCatalogItem[]) {
  const categories = new Map<string, number>();
  for (const article of articles) {
    const source = catalog.find((item) => item.published && `/blog/${item.slug}` === article.url);
    const label = source ? blogCategoryLabel(source.categorySlug) : article.category;
    categories.set(label, (categories.get(label) ?? 0) + article.views);
  }
  return [...categories.entries()]
    .map(([label, views]) => ({ label, views }))
    .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label, "pt"));
}

function queryLabel(period: BlogMetricPeriod, range: { startDate: string; endDate: string }): string {
  const start = formatIsoDate(range.startDate);
  const end = formatIsoDate(range.endDate);
  if (period === "all") {
    return `Consulta pedida de ${start} a ${end}, no fuso de Belém. O GA4 devolve só o que a retenção da propriedade ainda guarda.`;
  }
  return `Consulta de ${start} a ${end}, no fuso de Belém.`;
}

function belemDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Belem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatGa4Date(value: string): string {
  if (!/^\d{8}$/.test(value)) return value;
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
}
