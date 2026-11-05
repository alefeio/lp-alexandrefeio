import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  assembleBlogMetrics,
  blogMetricRange,
  blogSlugFromPath,
  normalizeBlogPath,
  parseBlogMetricPeriod,
  type BlogGa4Snapshot,
} from "../src/lib/admin/blog-metrics";
import { clearBlogGa4Cache, fetchBlogGa4Snapshot, readGa4Config } from "../src/lib/admin/blog-ga4";
import { loadBlogMetrics } from "../src/lib/admin/blog-metrics-load";
import { blogArticleClickParams, blogIndexClickParams } from "../src/lib/blog/clicks";
import { isStrategicJourneyEvent } from "../src/lib/product-journey/events";

const NOW = new Date("2026-11-04T15:00:00.000Z");

function snapshot(patch: Partial<BlogGa4Snapshot> = {}): BlogGa4Snapshot {
  return {
    pages: [],
    totals: { views: 0, activeUsers: 0 },
    series: [],
    sources: [],
    truncated: false,
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

test("filtros de período usam dias de Belém e o histórico pedido", () => {
  assert.equal(parseBlogMetricPeriod(undefined), "30");
  assert.equal(parseBlogMetricPeriod("ano"), "30");
  assert.deepEqual(blogMetricRange("7", NOW), { startDate: "2026-10-29", endDate: "2026-11-04" });
  assert.deepEqual(blogMetricRange("30", NOW), { startDate: "2026-10-06", endDate: "2026-11-04" });
  assert.deepEqual(blogMetricRange("90", NOW), { startDate: "2026-08-07", endDate: "2026-11-04" });
  assert.equal(blogMetricRange("all", NOW).startDate, "2020-01-01");
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
      totals: { views: 15, activeUsers: 6 },
    }),
  });
  const article = view.articles.find((item) => item.url === "/blog/artigo-novo");
  assert.equal(article?.views, 0);
  assert.equal(article?.title, "Artigo novo");
  assert.deepEqual(view.unmatched, [{ path: "/blog/artigo-antigo", views: 8 }]);
  assert.equal(JSON.stringify(view).includes("Rascunho secreto"), false);
  assert.equal(JSON.stringify(view).includes("rascunho-secreto"), false);
  assert.equal(view.listing?.views, 2);
  assert.equal(view.totals?.activeUsers, 6);
  assert.match(view.activeUserNote, /não representam pessoas únicas/i);
  assert.equal(view.clickNote.includes("%"), false);
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
      totals: { views: 11, activeUsers: 5 },
      series: [{ date: "20261101", views: 11 }],
      sources: [{ source: "google", medium: "organic", views: 11 }],
    }),
  });
  assert.equal(view.insight, "A categoria com mais visualizações neste recorte é Tráfego pago para pequenos negócios, com 9.");
  assert.equal(view.insight.toLowerCase().includes("recom"), false);
  assert.equal(view.series[0]?.label, "01/11/2026");
  assert.equal(view.sources[0]?.label, "google / organic");
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
      const body = String(init?.body ?? "");
      bodies.push(body);
      assert.equal(body.includes("pageLocation"), false);
      assert.match(body, /pagePath/);
      return Response.json({ error: "secret-token-in-body" }, { status: 403 });
    },
  });
  assert.equal(view.status, "unavailable");
  assert.equal(view.totals, null);
  assert.equal(view.message.includes("secret-token-in-body"), false);
  assert.equal(view.message.includes("token-de-teste"), false);
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
  assert.equal(calls, 4);
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

test("painel de métricas é administrativo e não tem API pública", () => {
  const page = readFileSync("src/app/(admin)/admin/blog/metricas/page.tsx", "utf8");
  const blog = readFileSync("src/app/(admin)/admin/blog/page.tsx", "utf8");
  assert.match(page, /requireAdmin\(\)[\s\S]{0,400}if \(!session\) return null/);
  assert.match(page, /force-dynamic/);
  assert.match(page, /index: false/);
  assert.match(blog, /href="\/admin\/blog\/metricas"/);
  assert.equal(existsSync("src/app/api/admin/blog/metricas/route.ts"), false);
});
