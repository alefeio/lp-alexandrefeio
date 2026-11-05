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
export const BLOG_ACTIVE_USER_NOTE = "Usuários ativos são o total deduplicado do GA4 neste conjunto. Não representam pessoas únicas em sentido absoluto.";
export const BLOG_ACTIVE_USER_ABSENT = "Usuários ativos deste conjunto não aparecem. O total do GA4 inclui caminhos de fora da lista, e somar as páginas contaria a mesma pessoa mais de uma vez.";
export const BLOG_SCOPE_NOTE = "Visualizações, origem e evolução usam o mesmo conjunto: artigos publicados, a listagem /blog e URLs sem artigo publicado. Caminhos de rascunho ficam de fora.";
export const BLOG_PAGE_VIEW_OWNER = "ga4-via-gtm";

export type BlogMetricCatalogItem = {
  slug: string;
  title: string;
  categorySlug: string;
  published: boolean;
};

export type BlogGa4Snapshot = {
  timeZone: string | null;
  rangeAligned: boolean;
  range?: { startDate: string; endDate: string };
  pages: Array<{ pagePath: string; views: number; activeUsers: number }>;
  filteredActiveUsers: number | null;
  pagesTruncated: boolean;
  series: Array<{ pagePath: string; date: string; views: number }>;
  seriesTruncated: boolean;
  sources: Array<{ pagePath: string; source: string; medium: string; views: number }>;
  sourcesTruncated: boolean;
};

export type BlogMetricsView = {
  period: BlogMetricPeriod;
  queryLabel: string;
  status: "unconfigured" | "unavailable" | "empty" | "ready";
  message: string;
  clickNote: string;
  activeUserNote: string;
  scopeNote: string;
  sourceNote: string;
  seriesNote: string;
  totals: { views: number | null; activeUsers: number | null } | null;
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

export function blogMetricRange(period: BlogMetricPeriod, now: Date, timeZone?: string | null): { startDate: string; endDate: string } {
  const endDate = civilDate(now, timeZone);
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
  const range = input.snapshot.range ?? blogMetricRange(input.period, input.now, input.snapshot.rangeAligned ? input.snapshot.timeZone : null);
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
  const sources = sourceRows(input.snapshot.sources, hidden);
  const seriesAll = seriesRows(input.snapshot.series, hidden);
  const seriesCapped = seriesAll.length > 90;
  const series = seriesCapped ? seriesAll.slice(-90) : seriesAll;
  const visibleViews = articles.reduce((sum, article) => sum + article.views, 0) + (pages.listing?.views ?? 0) + pages.unmatched.reduce((sum, row) => sum + row.views, 0);
  const views = input.snapshot.pagesTruncated ? null : visibleViews;
  const activeUsers = !input.snapshot.pagesTruncated && !pages.excluded && input.snapshot.filteredActiveUsers != null
    ? input.snapshot.filteredActiveUsers
    : null;
  const ready = articles.length > 0 || pages.listing || pages.unmatched.length > 0 || (views ?? 0) > 0;
  const top = categories[0];
  return {
    period: input.period,
    queryLabel: queryLabel(input.period, range, input.snapshot.timeZone, input.snapshot.rangeAligned),
    status: ready ? "ready" : "empty",
    message: input.snapshot.pagesTruncated
      ? "O relatório de páginas passou do limite de linhas do GA4. Ranking e totais ficam incompletos."
      : ready && (views ?? 0) === 0
        ? "O GA4 não registrou visualização de blog neste recorte."
        : "",
    clickNote: BLOG_CLICK_NOTE,
    activeUserNote: activeUsers == null && ready ? BLOG_ACTIVE_USER_ABSENT : BLOG_ACTIVE_USER_NOTE,
    scopeNote: ready ? BLOG_SCOPE_NOTE : "",
    sourceNote: input.snapshot.sourcesTruncated ? "A origem está incompleta: o GA4 cortou linhas desse relatório." : "",
    seriesNote: [input.snapshot.seriesTruncated ? "A evolução está incompleta: o GA4 cortou linhas desse relatório." : "", seriesCapped ? "A tabela mostra os 90 dias mais recentes com visualização. Os totais usam o período inteiro recebido." : ""].filter(Boolean).join(" "),
    totals: ready ? { views, activeUsers } : null,
    listing: pages.listing,
    articles,
    categories,
    sources,
    series,
    seriesTruncated: seriesCapped || input.snapshot.seriesTruncated,
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
    queryLabel: queryLabel(input.period, range, null, false),
    status: input.status,
    message: input.message,
    clickNote: BLOG_CLICK_NOTE,
    activeUserNote: BLOG_ACTIVE_USER_NOTE,
    scopeNote: "",
    sourceNote: "",
    seriesNote: "",
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
  let excluded = false;
  for (const row of rows) {
    const path = normalizeBlogPath(row.pagePath);
    if (!path) {
      excluded = true;
      continue;
    }
    const slug = blogSlugFromPath(path);
    if (slug && hidden.has(slug)) {
      excluded = true;
      continue;
    }
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
    excluded,
    listing: listing ? { views: listing.views, activeUsers: listing.paths > 1 ? null : listing.activeUsers } : null,
    unmatched: [...unmatched.entries()].map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views),
  };
}

function sourceRows(rows: BlogGa4Snapshot["sources"], hidden: Set<string>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!visibleBlogPath(row.pagePath, hidden)) continue;
    const label = `${row.source || "Não informado"} / ${row.medium || "Não informado"}`;
    counts.set(label, (counts.get(label) ?? 0) + row.views);
  }
  return [...counts.entries()]
    .map(([label, views]) => ({ label, views }))
    .filter((row) => row.views > 0)
    .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label, "pt"))
    .slice(0, 10);
}

function seriesRows(rows: BlogGa4Snapshot["series"], hidden: Set<string>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!visibleBlogPath(row.pagePath, hidden)) continue;
    counts.set(row.date, (counts.get(row.date) ?? 0) + row.views);
  }
  return [...counts.entries()]
    .filter(([, views]) => views > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ label: formatGa4Date(date), views }));
}

function visibleBlogPath(raw: string, hidden: Set<string>): boolean {
  const path = normalizeBlogPath(raw);
  if (!path) return false;
  const slug = blogSlugFromPath(path);
  return !(slug && hidden.has(slug));
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

function queryLabel(period: BlogMetricPeriod, range: { startDate: string; endDate: string }, timeZone: string | null, aligned: boolean): string {
  const dates = `${formatIsoDate(range.startDate)} a ${formatIsoDate(range.endDate)}`;
  const history = period === "all"
    ? `Histórico pedido de ${dates}. A Data API devolve o relatório agregado ainda disponível. Isso não reconstitui coleta que não ocorreu. A retenção de eventos e usuários nas Explorações pode ser outra; este painel não usa esse prazo como limite dos relatórios agregados.`
    : `Consulta de ${dates}. Os números são o que a Data API devolve nesse intervalo, dentro do que foi efetivamente coletado.`;
  const zone = aligned && timeZone
    ? ` Datas no fuso da propriedade (${timeZone}).`
    : timeZone
      ? ` O GA4 interpreta as datas no fuso da propriedade (${timeZone}). O intervalo foi pedido em datas civis. Este painel não altera essa configuração.`
      : " O GA4 interpreta as datas no fuso da propriedade. Este painel não confirmou qual é e não altera essa configuração.";
  return history + zone;
}

function civilDate(now: Date, timeZone?: string | null): string {
  const zone = timeZone && isTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
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
