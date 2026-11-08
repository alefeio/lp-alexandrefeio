import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BlogMetricsPanel } from "../src/components/admin/blog/BlogMetricsPanel";
import { assembleBlogMetrics, type BlogGa4Snapshot } from "../src/lib/admin/blog-metrics";
import {
  assembleBlogReadingMetrics,
  blogReadingMetricsPending,
  blogReadingPeriodBounds,
  BLOG_READING_SAMPLE_NOTE,
  type BlogReadingSessionFact,
} from "../src/lib/admin/blog-reading-metrics";
import { loadBlogReadingMetrics } from "../src/lib/admin/blog-reading-metrics-load";
import { BLOG_READING_MIN_SAMPLE } from "../src/lib/blog/reading/constants";

const NOW = new Date("2026-11-05T15:00:00.000Z");
const POST_A = "c123456789012345678901234";
const POST_B = "c123456789012345678901235";

const catalog = [
  { id: POST_A, slug: "artigo-a", title: "Artigo A", categorySlug: "trafego-pago", published: true },
  { id: POST_B, slug: "artigo-b", title: "Artigo B", categorySlug: "funil", published: true },
];

test("recorte first-party usa America/Belem e histórico disponível", () => {
  const week = blogReadingPeriodBounds("7", NOW);
  assert.ok(week.start < week.endExclusive);
  const all = blogReadingPeriodBounds("all", NOW);
  assert.ok(all.start < all.endExclusive);
});

test("monta rankings, profundidade, cliques e aviso de amostra", () => {
  const sessions: BlogReadingSessionFact[] = Array.from({ length: BLOG_READING_MIN_SAMPLE - 2 }, (_, index) => ({
    id: `s${index}`,
    blogPostId: index % 2 === 0 ? POST_A : POST_B,
    slugObserved: index % 2 === 0 ? "artigo-a" : "artigo-b",
    anonymousId: `a${index % 5}`,
    activeTimeMs: index % 2 === 0 ? 45_000 : 70_000,
    maxScrollPercent: index % 2 === 0 ? 50 : 80,
    reachedEnd: index % 3 === 0,
    startedAt: NOW,
  }));
  sessions.push({
    id: "removed",
    blogPostId: null,
    slugObserved: "antigo",
    anonymousId: "gone",
    activeTimeMs: 10_000,
    maxScrollPercent: 10,
    reachedEnd: false,
    startedAt: NOW,
  });
  const view = assembleBlogReadingMetrics({
    period: "30",
    now: NOW,
    catalog,
    ingestEnabled: false,
    sessions,
    clicks: [
      { readingSessionId: "s0", destinationType: "course" },
      { readingSessionId: "s1", destinationType: "service" },
      { readingSessionId: "s1", destinationType: "service" },
    ],
  });
  assert.equal(view.status, "ready");
  assert.equal(view.totals?.sessions, BLOG_READING_MIN_SAMPLE - 1);
  assert.equal(view.totals?.browsers, 6);
  assert.equal(view.sampleWarning, BLOG_READING_SAMPLE_NOTE);
  assert.ok((view.totals?.courseClicks ?? 0) >= 1);
  assert.ok((view.totals?.serviceClicks ?? 0) >= 1);
  assert.ok((view.totals?.commercialClicks ?? 0) >= (view.totals?.courseClicks ?? 0));
  assert.ok((view.totals?.sessionsWithClick ?? 0) <= (view.totals?.sessions ?? 0));
  assert.ok((view.totals?.clickRate ?? 0) <= 1);
  assert.ok((view.totals?.clickRate ?? 0) >= 0);
  // Dois eventos na mesma sessão não elevam a taxa acima de sessões com clique / sessões.
  assert.equal(view.totals?.clickRate, (view.totals?.sessionsWithClick ?? 0) / (view.totals?.sessions ?? 1));
  assert.ok(view.articles.some((row) => row.removed && row.title.includes("antigo")));
  assert.ok(view.articles.some((row) => row.title === "Artigo A" && row.sessions > 0));
  assert.ok(view.categories.length >= 1);
  assert.match(view.queryLabel, /America\/Belem/);
  assert.equal(view.queryLabel.includes("GA4"), true);
});

test("dados insuficientes e migration ausente não inventam números", async () => {
  const empty = assembleBlogReadingMetrics({
    period: "7",
    now: NOW,
    catalog,
    ingestEnabled: false,
    sessions: [],
    clicks: [],
  });
  assert.equal(empty.status, "empty");
  assert.equal(empty.totals?.sessions, 0);
  assert.equal(empty.sampleWarning, "");
  assert.ok(empty.articles.every((row) => row.sessions === 0));

  const missing = blogReadingMetricsPending({
    period: "30",
    now: NOW,
    status: "migration_missing",
    message: "As tabelas first-party ainda não existem neste ambiente.",
    ingestEnabled: false,
  });
  assert.equal(missing.totals, null);
  assert.equal(missing.articles.length, 0);

  const loaded = await loadBlogReadingMetrics(
    { periodo: "30" },
    {
      now: NOW,
      ingestEnabled: false,
      catalog,
      repository: {
        async listCatalog() {
          return catalog;
        },
        async listSessions() {
          const error = Object.assign(new Error("table blog_reading_session does not exist"), { code: "P2021" });
          throw error;
        },
        async listClicks() {
          return [];
        },
      },
    },
  );
  assert.equal(loaded.status, "migration_missing");
  assert.equal(loaded.totals, null);
});

test("painel separa first-party do GA4 e exige admin", () => {
  const reading = assembleBlogReadingMetrics({
    period: "30",
    now: NOW,
    catalog,
    ingestEnabled: false,
    sessions: [
      {
        id: "s1",
        blogPostId: POST_A,
        slugObserved: "artigo-a",
        anonymousId: "anon",
        activeTimeMs: 40_000,
        maxScrollPercent: 60,
        reachedEnd: true,
        startedAt: NOW,
      },
    ],
    clicks: [
      { readingSessionId: "s1", destinationType: "course" },
      { readingSessionId: "s1", destinationType: "service" },
    ],
  });
  assert.equal(reading.totals?.commercialClicks, 2);
  assert.equal(reading.totals?.sessionsWithClick, 1);
  assert.equal(reading.totals?.clickRate, 1);
  const ga4 = assembleBlogMetrics({
    period: "30",
    now: NOW,
    catalog: catalog.map(({ slug, title, categorySlug, published }) => ({ slug, title, categorySlug, published })),
    snapshot: {
      timeZone: "America/Sao_Paulo",
      rangeAligned: true,
      pages: [{ pagePath: "/blog/artigo-a", views: 9, activeUsers: 4 }],
      filteredActiveUsers: 4,
      pagesTruncated: false,
      series: [],
      seriesTruncated: false,
      sources: [],
      sourcesTruncated: false,
    } satisfies BlogGa4Snapshot,
  });
  const html = renderToStaticMarkup(createElement(BlogMetricsPanel, { reading, ga4 }));
  assert.match(html, /Leitura first-party/);
  assert.match(html, /GA4 complementar/);
  assert.match(html, /Sessões observadas/);
  assert.match(html, /Coleta pública desligada/);
  assert.match(html, /Amostra abaixo de 20 sessões/);
  assert.match(html, /Visualizações/);
  assert.match(html, />9</);

  const page = readFileSync("src/app/(admin)/admin/blog/metricas/page.tsx", "utf8");
  assert.match(page, /requireAdmin/);
  assert.match(page, /loadBlogReadingMetrics/);
  assert.match(page, /loadBlogMetrics/);

  const article = readFileSync("src/components/blog/BlogArticle.tsx", "utf8");
  assert.match(article, /BlogReadingObserver/);
  assert.match(article, /blogPostId=\{post\.id\}/);
  const link = readFileSync("src/components/blog/BlogCtaLink.tsx", "utf8");
  assert.match(link, /reportCommercialClick/);
  assert.match(link, /trackEvent\(event, params, \{ targetPath: journeyPath\(href\) \}\)/);
  assert.match(link, /cta_location === "blog_post"/);
});
