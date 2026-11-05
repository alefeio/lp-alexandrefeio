import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BlogMetricsPanel } from "../src/components/admin/blog/BlogMetricsPanel";
import {
  assembleBlogMetrics,
  blogMetricRange,
  blogSlugFromPath,
  normalizeBlogPath,
  parseBlogMetricPeriod,
  type BlogGa4Snapshot,
} from "../src/lib/admin/blog-metrics";
import { BLOG_GA4_REPORTS, clearBlogGa4Cache, fetchBlogGa4Snapshot, readGa4Config } from "../src/lib/admin/blog-ga4";
import {
  GA4_PAGES_REPORT,
  GA4_PAGES_WITH_DRAFT_REPORT,
  GA4_PROPERTY_TIME_ZONE,
  GA4_SERIES_REPORT,
  GA4_SERIES_TRUNCATED_REPORT,
  GA4_SOURCES_REPORT,
} from "./fixtures/blog-ga4-reports";
import { loadBlogMetrics } from "../src/lib/admin/blog-metrics-load";
import { blogArticleClickParams, blogIndexClickParams } from "../src/lib/blog/clicks";
import { isStrategicJourneyEvent } from "../src/lib/product-journey/events";

const NOW = new Date("2026-11-04T15:00:00.000Z");

function snapshot(patch: Partial<BlogGa4Snapshot> = {}): BlogGa4Snapshot {
  return {
    timeZone: "America/Sao_Paulo",
    rangeAligned: true,
    pages: [],
    filteredActiveUsers: 0,
    pagesTruncated: false,
    series: [],
    seriesTruncated: false,
    sources: [],
    sourcesTruncated: false,
    ...patch,
  };
}

test("normaliza URL do blog e separa listagem de slug", () => {
  assert.equal(normalizeBlogPath("https://alexandrefeio.com.br/blog/Meu-Post?utm_source=ads&utm_medium=cpc#topo"), "/blog/meu-post");
  assert.equal(normalizeBlogPath("/blog/meu-post/"), "/blog/meu-post");
  assert.equal(normalizeBlogPath("/cursos?utm_source=ads"), null);
  assert.equal(blogSlugFromPath("/blog"), null);
  assert.equal(blogSlugFromPath("/blog/meu-post?utm_campaign=novembro"), "meu-post");
  assert.equal(blogSlugFromPath("/blog/meu-post/extra"), null);
});

test("filtros de período seguem o fuso informado e o histórico pedido", () => {
  assert.equal(parseBlogMetricPeriod(undefined), "30");
  assert.equal(parseBlogMetricPeriod("ano"), "30");
  assert.deepEqual(blogMetricRange("7", NOW, "America/Sao_Paulo"), { startDate: "2026-10-29", endDate: "2026-11-04" });
  assert.deepEqual(blogMetricRange("30", NOW, "America/Sao_Paulo"), { startDate: "2026-10-06", endDate: "2026-11-04" });
  assert.deepEqual(blogMetricRange("90", NOW, "America/Sao_Paulo"), { startDate: "2026-08-07", endDate: "2026-11-04" });
  assert.equal(blogMetricRange("all", NOW, "America/Sao_Paulo").startDate, "2020-01-01");
  const stillPreviousDay = new Date("2026-11-04T07:30:00.000Z");
  assert.deepEqual(blogMetricRange("7", stillPreviousDay, "America/Los_Angeles"), { startDate: "2026-10-28", endDate: "2026-11-03" });
});

test("artigo sem visualização continua na lista e URL antiga não herda o título", () => {
  const view = assembleBlogMetrics({
    period: "30",
    now: NOW,
    catalog: [
      { slug: "artigo-novo", title: "Artigo novo", categorySlug: "trafego-pago", published: true },
      { slug: "rascunho-secreto", title: "Rascunho secreto", categorySlug: "trafego-pago", published: false },
    ],
    snapshot: snapshot({
      pages: [
        { pagePath: "https://exemplo.test/blog/artigo-antigo?utm_source=ads", views: 8, activeUsers: 3 },
        { pagePath: "/blog/rascunho-secreto", views: 5, activeUsers: 1 },
        { pagePath: "/BLOG", views: 2, activeUsers: 2 },
      ],
      filteredActiveUsers: 6,
      series: [
        { pagePath: "/blog/rascunho-secreto", date: "20261104", views: 5 },
        { pagePath: "/blog/artigo-antigo?utm_source=ads", date: "20261104", views: 8 },
      ],
      sources: [
        { pagePath: "/blog/rascunho-secreto", source: "draft", medium: "hidden", views: 5 },
        { pagePath: "/blog", source: "google", medium: "organic", views: 2 },
      ],
    }),
  });
  const article = view.articles.find((item) => item.url === "/blog/artigo-novo");
  assert.equal(article?.views, 0);
  assert.equal(article?.title, "Artigo novo");
  assert.deepEqual(view.unmatched, [{ path: "/blog/artigo-antigo", views: 8 }]);
  assert.equal(JSON.stringify(view).includes("Rascunho secreto"), false);
  assert.equal(JSON.stringify(view).includes("rascunho-secreto"), false);
  assert.equal(JSON.stringify(view).includes("draft / hidden"), false);
  assert.equal(view.listing?.views, 2);
  assert.equal(view.totals?.views, 10);
  assert.equal(view.totals?.activeUsers, null);
  assert.match(view.activeUserNote, /somar as páginas/i);
  assert.match(view.scopeNote, /mesmo conjunto/i);
  assert.equal(view.series[0]?.views, 8);
  assert.equal(view.sources[0]?.label, "google / organic");
  assert.equal(view.clickNote.includes("%"), false);
});

test("usuários ativos do cartão usam o total deduplicado e não a soma das páginas", () => {
  const view = assembleBlogMetrics({
    period: "30",
    now: NOW,
    catalog: [
      { slug: "um", title: "Um", categorySlug: "trafego-pago", published: true },
      { slug: "dois", title: "Dois", categorySlug: "trafego-pago", published: true },
    ],
    snapshot: snapshot({
      pages: [
        { pagePath: "/blog/um", views: 7, activeUsers: 7 },
        { pagePath: "/blog/dois", views: 7, activeUsers: 7 },
      ],
      filteredActiveUsers: 10,
    }),
  });
  assert.equal(view.totals?.views, 14);
  assert.equal(view.totals?.activeUsers, 10);
  assert.equal(view.articles.reduce((sum, article) => sum + (article.activeUsers ?? 0), 0), 14);
});

test("categoria descreve a audiência sem recomendar pauta", () => {
  const view = assembleBlogMetrics({
    period: "7",
    now: NOW,
    catalog: [
      { slug: "um", title: "Um", categorySlug: "trafego-pago", published: true },
      { slug: "dois", title: "Dois", categorySlug: "sites-landing-pages", published: true },
    ],
    snapshot: snapshot({
      pages: [
        { pagePath: "/blog/um", views: 9, activeUsers: 4 },
        { pagePath: "/blog/dois", views: 2, activeUsers: 1 },
      ],
      filteredActiveUsers: 5,
      series: [{ pagePath: "/blog/um", date: "20261101", views: 11 }],
      sources: [{ pagePath: "/blog/um", source: "google", medium: "organic", views: 11 }],
    }),
  });
  assert.equal(view.insight, "A categoria com mais visualizações neste recorte é Tráfego pago para pequenos negócios, com 9.");
  assert.equal(view.insight.toLowerCase().includes("recom"), false);
  assert.equal(view.series[0]?.label, "01/11/2026");
  assert.equal(view.sources[0]?.label, "google / organic");
  assert.match(view.queryLabel, /America\/Sao_Paulo/);
  assert.equal(view.queryLabel.includes("Belém"), false);
});

test("histórico separa coleta, Data API, retenção e relatórios agregados", () => {
  const view = assembleBlogMetrics({
    period: "all",
    now: NOW,
    catalog: [{ slug: "um", title: "Um", categorySlug: "trafego-pago", published: true }],
    snapshot: snapshot({
      pages: [{ pagePath: "/blog/um", views: 1, activeUsers: 1 }],
      filteredActiveUsers: 1,
    }),
  });
  assert.match(view.queryLabel, /coleta que não ocorreu/);
  assert.match(view.queryLabel, /relatório agregado/);
  assert.match(view.queryLabel, /Explorações/);
  assert.match(view.queryLabel, /não usa esse prazo como limite dos relatórios agregados/);
  const unknown = assembleBlogMetrics({
    period: "30",
    now: NOW,
    catalog: [{ slug: "um", title: "Um", categorySlug: "trafego-pago", published: true }],
    snapshot: snapshot({ timeZone: null, rangeAligned: false, pages: [{ pagePath: "/blog/um", views: 1, activeUsers: 1 }] }),
  });
  assert.match(unknown.queryLabel, /não confirmou/);
  assert.match(unknown.queryLabel, /não altera essa configuração/);
});

test("GA4 ausente não consulta a rede e não finge métrica", async () => {
  clearBlogGa4Cache();
  let called = false;
  const view = await loadBlogMetrics({}, {
    now: NOW,
    env: {},
    catalog: [],
    fetchImpl: async () => {
      called = true;
      return new Response("não deveria", { status: 500 });
    },
  });
  assert.equal(called, false);
  assert.equal(view.status, "unconfigured");
  assert.equal(view.totals, null);
  assert.equal(view.articles.length, 0);
  assert.match(view.message, /GA4_PROPERTY_ID/);
  assert.equal(readGa4Config({ GA4_PROPERTY_ID: "G-ABC", GA4_CLIENT_EMAIL: "a@b.iam.gserviceaccount.com", GA4_PRIVATE_KEY: "x" }).ok, false);
});

test("consulta do GA4 usa pagePath, respeita cota e não ecoa segredo", async () => {
  clearBlogGa4Cache();
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const env = {
    GA4_PROPERTY_ID: "123456789",
    GA4_CLIENT_EMAIL: "blog@teste.iam.gserviceaccount.com",
    GA4_PRIVATE_KEY: privateKey,
  };
  const bodies: string[] = [];
  const view = await loadBlogMetrics({ periodo: "7" }, {
    now: NOW,
    env,
    catalog: [{ slug: "artigo", title: "Artigo", categorySlug: "aquisicao-conversao", published: true }],
    fetchImpl: async (input, init) => {
      const url = String(input);
      assert.equal(url.includes(privateKey.slice(0, 24)), false);
      if (url.includes("oauth2")) return Response.json({ access_token: "token-de-teste", expires_in: 3600 });
      if (url.includes("analyticsadmin")) return new Response("sem fuso", { status: 403 });
      const body = String(init?.body ?? "");
      bodies.push(body);
      assert.equal(body.includes("pageLocation"), false);
      assert.match(body, /"name":"pagePath"/);
      assert.match(body, /"fieldName":"pagePath"/);
      return Response.json({ error: "secret-token-in-body" }, { status: 403 });
    },
  });
  assert.equal(view.status, "unavailable");
  assert.equal(view.totals, null);
  assert.equal(view.message.includes("secret-token-in-body"), false);
  assert.equal(view.message.includes("token-de-teste"), false);
  assert.match(view.message, /permissão de leitura/);
  assert.equal(bodies.length, 3);
  clearBlogGa4Cache();
  let calls = 0;
  const ok = await fetchBlogGa4Snapshot({
    period: "7",
    now: NOW,
    env,
    fetchImpl: async (input) => {
      calls += 1;
      const url = String(input);
      if (url.includes("oauth2")) return Response.json({ access_token: "token-de-teste", expires_in: 3600 });
      return Response.json({ rows: [], totals: [{ metricValues: [{ value: "0" }, { value: "0" }] }], rowCount: 0 });
    },
  });
  assert.equal(ok.ok, true);
  const again = await fetchBlogGa4Snapshot({ period: "7", now: NOW, env, fetchImpl: async () => {
    calls += 1;
    return new Response("não", { status: 500 });
  } });
  assert.equal(again.ok, true);
  assert.equal(calls, 5);
  clearBlogGa4Cache();
  const quota = await fetchBlogGa4Snapshot({
    period: "30",
    now: NOW,
    env,
    fetchImpl: async (input) => {
      if (String(input).includes("oauth2")) return Response.json({ access_token: "token-de-teste", expires_in: 3600 });
      return new Response("limite", { status: 429 });
    },
  });
  assert.equal(quota.ok, false);
  if (!quota.ok) assert.match(quota.message, /cota/i);
});

test("respostas sintéticas do GA4 cobrem páginas, usuários, origem, evolução e erros", async () => {
  for (const report of Object.values(BLOG_GA4_REPORTS)) {
    assert.equal(report.dimensions.includes("pagePath"), true);
  }
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const env = {
    GA4_PROPERTY_ID: "123456789",
    GA4_CLIENT_EMAIL: "blog@teste.iam.gserviceaccount.com",
    GA4_PRIVATE_KEY: privateKey,
  };
  const catalog = [
    { slug: "artigo", title: "Artigo", categorySlug: "aquisicao-conversao", published: true },
    { slug: "rascunho-secreto", title: "Rascunho secreto", categorySlug: "trafego-pago", published: false },
  ];
  const seen = new Set<string>();
  const ga4Fetch = (reports: { pages: unknown; series: unknown; sources: unknown }, adminStatus: number) =>
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      assert.equal(
        url.startsWith("https://oauth2.googleapis.com/") || url.startsWith("https://analyticsadmin.googleapis.com/") || url.startsWith("https://analyticsdata.googleapis.com/"),
        true,
      );
      if (url.includes("oauth2")) return Response.json({ access_token: "token-de-teste", expires_in: 3600 });
      if (url.includes("analyticsadmin")) return new Response(JSON.stringify(GA4_PROPERTY_TIME_ZONE), { status: adminStatus, headers: { "content-type": "application/json" } });
      const body = String(init?.body ?? "");
      const parsed = JSON.parse(body) as { dimensions: Array<{ name: string }>; dimensionFilter: { filter: { fieldName: string } }; dateRanges: Array<{ endDate: string }> };
      const names = parsed.dimensions.map((item) => item.name).join(",");
      seen.add(names);
      assert.equal(parsed.dimensions.some((item) => item.name === "pagePath"), true);
      assert.equal(parsed.dimensionFilter.filter.fieldName, "pagePath");
      assert.equal(body.includes("pageLocation"), false);
      if (names.includes("date")) return Response.json(reports.series);
      if (names.includes("sessionSource")) return Response.json(reports.sources);
      return Response.json(reports.pages);
    };

  clearBlogGa4Cache();
  const ready = await loadBlogMetrics({ periodo: "7" }, {
    now: NOW,
    env,
    catalog,
    fetchImpl: ga4Fetch({ pages: GA4_PAGES_REPORT, series: GA4_SERIES_REPORT, sources: GA4_SOURCES_REPORT }, 200),
  });
  assert.equal(seen.has("pagePath"), true);
  assert.equal(seen.has("pagePath,date"), true);
  assert.equal(seen.has("pagePath,sessionSource,sessionMedium"), true);
  assert.equal(ready.totals?.views, 14);
  assert.equal(ready.totals?.activeUsers, 10);
  assert.equal(ready.articles[0]?.views, 10);
  assert.equal(ready.articles[0]?.activeUsers, null);
  assert.equal(ready.listing?.views, 4);
  assert.equal(ready.sources[0]?.label, "google / organic");
  assert.equal(ready.sources[1]?.label, "newsletter / email");
  assert.equal(ready.series[0]?.label, "03/11/2026");
  assert.equal(ready.series[1]?.views, 8);
  assert.match(ready.queryLabel, /Datas no fuso da propriedade \(America\/Sao_Paulo\)/);
  assert.equal(ready.queryLabel.includes("Belém"), false);

  clearBlogGa4Cache();
  seen.clear();
  const partial = await loadBlogMetrics({ periodo: "7" }, {
    now: NOW,
    env,
    catalog,
    fetchImpl: ga4Fetch({
      pages: GA4_PAGES_WITH_DRAFT_REPORT,
      series: GA4_SERIES_TRUNCATED_REPORT,
      sources: {
        ...GA4_SOURCES_REPORT,
        rows: [
          ...GA4_SOURCES_REPORT.rows,
          { dimensionValues: [{ value: "/blog/rascunho-secreto" }, { value: "draft" }, { value: "hidden" }], metricValues: [{ value: "9" }] },
        ],
      },
    }, 200),
  });
  assert.equal(partial.totals?.views, 14);
  assert.equal(partial.totals?.activeUsers, null);
  assert.match(partial.activeUserNote, /somar as páginas/i);
  assert.match(partial.seriesNote, /incompleta/);
  assert.equal(partial.series[0]?.views, 6);
  assert.equal(JSON.stringify(partial).includes("rascunho-secreto"), false);
  assert.equal(JSON.stringify(partial).includes("draft / hidden"), false);
  assert.equal(partial.sourceNote, "");

  clearBlogGa4Cache();
  const truncatedPages = await loadBlogMetrics({ periodo: "7" }, {
    now: NOW,
    env,
    catalog,
    fetchImpl: ga4Fetch({ pages: { ...GA4_PAGES_REPORT, rows: GA4_PAGES_REPORT.rows.slice(0, 1), rowCount: 10001 }, series: GA4_SERIES_REPORT, sources: GA4_SOURCES_REPORT }, 200),
  });
  assert.equal(truncatedPages.totals?.views, null);
  assert.equal(truncatedPages.totals?.activeUsers, null);
  assert.match(truncatedPages.message, /limite de linhas/);

  clearBlogGa4Cache();
  const metadataZone = await loadBlogMetrics({ periodo: "30" }, {
    now: NOW,
    env,
    catalog,
    fetchImpl: ga4Fetch({ pages: GA4_PAGES_REPORT, series: GA4_SERIES_REPORT, sources: GA4_SOURCES_REPORT }, 403),
  });
  assert.match(metadataZone.queryLabel, /intervalo foi pedido em datas civis/);
  assert.match(metadataZone.queryLabel, /America\/Sao_Paulo/);
  assert.equal(metadataZone.queryLabel.includes("Datas no fuso da propriedade"), false);

  clearBlogGa4Cache();
  let requestedEnd = "";
  await fetchBlogGa4Snapshot({
    period: "7",
    now: new Date("2026-11-04T07:30:00.000Z"),
    env,
    fetchImpl: async (input, init) => {
      const url = String(input);
      if (url.includes("oauth2")) return Response.json({ access_token: "token-de-teste", expires_in: 3600 });
      if (url.includes("analyticsadmin")) return Response.json({ timeZone: "America/Los_Angeles" });
      requestedEnd = JSON.parse(String(init?.body ?? "{}")).dateRanges?.[0]?.endDate ?? "";
      return Response.json(GA4_PAGES_REPORT);
    },
  });
  assert.equal(requestedEnd, "2026-11-03");

  clearBlogGa4Cache();
  const unauthorized = await fetchBlogGa4Snapshot({
    period: "7",
    now: NOW,
    env,
    fetchImpl: async (input) => {
      if (String(input).includes("oauth2")) return new Response("negado", { status: 401 });
      throw new Error("relatório não deveria ser chamado");
    },
  });
  assert.equal(unauthorized.ok, false);
  if (!unauthorized.ok) {
    assert.match(unauthorized.message, /não autorizou/);
    assert.equal(unauthorized.message.includes("permissão de leitura"), false);
  }

  const docs = readFileSync("docs/analytics-setup.md", "utf8");
  assert.match(docs, /não trata esse prazo como limite dos relatórios agregados/);
  assert.match(docs, /não altera a configuração/);
  assert.equal(docs.includes("O histórico depende da retenção da propriedade"), false);
});

test("cliques do blog reutilizam eventos existentes e separam artigo da listagem", () => {
  const article = blogArticleClickParams({ slug: "quando-anunciar", ctaKey: "TRAFFIC_COURSE" });
  assert.equal(article?.cta_location, "blog_post");
  assert.equal(article?.destination_type, "course");
  assert.equal(article?.blog_post_slug, "quando-anunciar");
  assert.equal(blogArticleClickParams({ slug: "pessoa@email.com", ctaKey: "TRAFFIC_COURSE" }), null);
  assert.equal(blogArticleClickParams({ slug: "artigo", ctaKey: "NONE" }), null);
  const index = blogIndexClickParams("courses");
  const service = blogIndexClickParams("service");
  assert.equal(index.cta_location, "blog_index");
  assert.equal("blog_post_slug" in index, false);
  assert.equal(service.cta_name, "blog_delegar");
  assert.equal(service.destination_type, "service");
  assert.equal(isStrategicJourneyEvent("cta_click"), false);
  assert.equal(isStrategicJourneyEvent("service_from_course_click"), false);
  const articleSource = readFileSync("src/components/blog/BlogArticle.tsx", "utf8");
  const aside = readFileSync("src/components/blog/BlogDiscoveryAside.tsx", "utf8");
  const link = readFileSync("src/components/blog/BlogCtaLink.tsx", "utf8");
  assert.match(articleSource, /event="cta_click"/);
  assert.match(articleSource, /blogArticleClickParams/);
  assert.equal(articleSource.includes("page_view"), false);
  assert.match(aside, /event="cta_click"/);
  assert.match(aside, /event="service_from_course_click"/);
  assert.match(aside, /blogIndexClickParams\("service"\)/);
  assert.match(link, /trackEvent\(event, params\)/);
  assert.equal(link.includes("consent"), false);
  const analytics = readFileSync("src/lib/analytics.ts", "utf8");
  const gtm = readFileSync("src/components/analytics/GoogleTagManager.tsx", "utf8");
  assert.match(analytics, /generate_lead/);
  assert.equal(analytics.includes('"page_view"'), false);
  assert.match(gtm, /analytics_storage':'denied'/);
  const blogPost = readFileSync("src/app/(public)/blog/[slug]/page.tsx", "utf8");
  const blogIndex = readFileSync("src/app/(public)/blog/page.tsx", "utf8");
  assert.equal(blogPost.includes("ViewEvent"), false);
  assert.equal(blogIndex.includes("page_view"), false);
});

test("painel mostra ausência de usuário e o mesmo conjunto visível", () => {
  const view = assembleBlogMetrics({
    period: "30",
    now: NOW,
    catalog: [
      { slug: "artigo-novo", title: "Artigo novo", categorySlug: "trafego-pago", published: true },
      { slug: "rascunho-secreto", title: "Rascunho secreto", categorySlug: "trafego-pago", published: false },
    ],
    snapshot: snapshot({
      pages: [
        { pagePath: "/blog/artigo-novo", views: 4, activeUsers: 2 },
        { pagePath: "/blog/rascunho-secreto", views: 9, activeUsers: 1 },
      ],
      filteredActiveUsers: 3,
      seriesTruncated: true,
      sourcesTruncated: true,
      series: [{ pagePath: "/blog/artigo-novo", date: "20261104", views: 4 }],
      sources: [{ pagePath: "/blog/artigo-novo", source: "google", medium: "organic", views: 4 }],
    }),
  });
  const html = renderToStaticMarkup(createElement(BlogMetricsPanel, { view }));
  assert.match(html, /mesmo conjunto/);
  assert.match(html, /somar as páginas/);
  assert.match(html, /Usuários ativos/);
  assert.match(html, /—/);
  assert.equal(html.includes(">3<"), false);
  assert.match(html, /A origem está incompleta/);
  assert.match(html, /A evolução está incompleta/);
  assert.equal(html.includes("Rascunho"), false);
});

test("painel de métricas é administrativo e não tem API pública", () => {
  const page = readFileSync("src/app/(admin)/admin/blog/metricas/page.tsx", "utf8");
  const blog = readFileSync("src/app/(admin)/admin/blog/page.tsx", "utf8");
  assert.match(page, /requireAdmin\(\)[\s\S]{0,400}if \(!session\) return null/);
  assert.match(page, /force-dynamic/);
  assert.match(page, /index: false/);
  assert.match(blog, /href="\/admin\/blog\/metricas"/);
  assert.equal(existsSync("src/app/api/admin/blog/metricas/route.ts"), false);
});
