import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { receivedRevenueCents } from "../src/lib/admin/operations";
import {
  PRODUCT_JOURNEY_REPORTING_START_AT,
  buildJourneyDashboard,
  formatJourneyDateTime,
  journeyDashboardHref,
  parseJourneyCourse,
  parseJourneyPeriod,
  type JourneyObservedEvent,
  type JourneyOrderFact,
  type JourneyPaymentFact,
  type JourneyQuery,
} from "../src/lib/admin/journey-report";
import { TRAFFIC_COURSE_SLUG } from "../src/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "../src/lib/learning/sites-course";

const NOW = new Date("2026-12-15T12:00:00.000Z");
const INSIDE = new Date("2026-12-10T12:00:00.000Z");
const BEFORE = new Date(PRODUCT_JOURNEY_REPORTING_START_AT.getTime() - 1);
const TRAFFIC = TRAFFIC_COURSE_SLUG;
const SITES = SITES_COURSE_SLUG;

function event(patch: Partial<JourneyObservedEvent> & Pick<JourneyObservedEvent, "anonymousId" | "eventName">): JourneyObservedEvent {
  return { occurredAt: INSIDE, sessionId: "session-secret", userId: null, ...patch };
}

function view(input: {
  events?: JourneyObservedEvent[];
  orders?: JourneyOrderFact[];
  payments?: JourneyPaymentFact[];
  progress?: Array<{ userId: string; courseSlug: string; startedAt: Date; completedAt: Date | null }>;
  diagnostics?: Array<{ userId: string; completedAt: Date }>;
  lessonTitles?: Record<string, string>;
  courseTitles?: Record<string, string>;
  query?: JourneyQuery;
  now?: Date;
}) {
  return buildJourneyDashboard({
    events: input.events ?? [],
    orders: input.orders ?? [],
    payments: input.payments ?? [],
    progress: input.progress ?? [],
    diagnostics: input.diagnostics ?? [],
    lessonTitles: input.lessonTitles,
    courseTitles: input.courseTitles,
    query: input.query ?? {},
    now: input.now ?? NOW,
  });
}

function forbiddenLeaves(value: unknown, hits: string[] = []): string[] {
  if (typeof value === "string") {
    if (/secret|anonymousId|sessionId|userId|eventId/.test(value)) hits.push(value);
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => forbiddenLeaves(item, hits));
    return hits;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "anonymousId" || key === "sessionId" || key === "userId" || key === "eventId") hits.push(key);
      forbiddenLeaves(child, hits);
    }
  }
  return hits;
}

test("filtro de período e curso cai no padrão quando o valor é inválido", () => {
  assert.equal(parseJourneyPeriod(undefined), "30");
  assert.equal(parseJourneyPeriod("7"), "7");
  assert.equal(parseJourneyPeriod("30"), "30");
  assert.equal(parseJourneyPeriod("90"), "90");
  assert.equal(parseJourneyPeriod("all"), "all");
  assert.equal(parseJourneyPeriod("15"), "30");
  assert.equal(parseJourneyCourse(undefined), "all");
  assert.equal(parseJourneyCourse("inexistente"), "all");
  assert.equal(parseJourneyCourse(TRAFFIC), TRAFFIC);
  assert.equal(parseJourneyCourse(SITES), SITES);
  assert.equal(view({ query: {} }).period, "30");
  assert.equal(view({ query: { periodo: "ano" } }).period, "30");
  assert.equal(view({ query: { curso: "outro" } }).course, "all");
  assert.equal(journeyDashboardHref("7", TRAFFIC), `/admin/jornada?periodo=7&curso=${TRAFFIC}`);
  assert.equal(journeyDashboardHref("30", "all"), "/admin/jornada");
  const recent = event({ anonymousId: "anon-secret-recent", eventName: "course_view", occurredAt: new Date("2026-12-10T12:00:00.000Z") });
  const month = event({ anonymousId: "anon-secret-month", eventName: "course_view", occurredAt: new Date("2026-12-01T12:00:00.000Z") });
  const quarter = event({ anonymousId: "anon-secret-quarter", eventName: "course_view", occurredAt: new Date("2026-11-01T12:00:00.000Z") });
  assert.equal(view({ events: [recent, month, quarter], query: { periodo: "7" } }).summary.journeys, 1);
  assert.equal(view({ events: [recent, month, quarter], query: { periodo: "30" } }).summary.journeys, 2);
  assert.equal(view({ events: [recent, month, quarter], query: { periodo: "90" } }).summary.journeys, 3);
  assert.equal(view({ events: [recent, month, quarter], query: { periodo: "all" } }).summary.journeys, 3);
});

test("baseline fixo exclui o que veio antes e inclui o instante oficial", () => {
  assert.equal(PRODUCT_JOURNEY_REPORTING_START_AT.toISOString(), "2026-10-26T17:42:00.000Z");
  assert.equal(formatJourneyDateTime(PRODUCT_JOURNEY_REPORTING_START_AT), "26/10/2026 14:42");
  const source = readFileSync(new URL("../src/lib/admin/journey-report.ts", import.meta.url), "utf8");
  assert.match(source, /new Date\("2026-10-26T17:42:00.000Z"\)/);
  assert.equal(source.includes("Date.now()"), false);
  const events = [
    event({ anonymousId: "anon-secret-before", eventName: "course_view", occurredAt: BEFORE }),
    event({ anonymousId: "anon-secret-at", eventName: "course_view", occurredAt: PRODUCT_JOURNEY_REPORTING_START_AT }),
    event({ anonymousId: "anon-secret-after", eventName: "course_view", occurredAt: new Date("2026-10-26T17:42:00.001Z") }),
  ];
  const all = view({ events, query: { periodo: "all" }, now: new Date("2026-10-27T00:00:00.000Z") });
  assert.equal(all.summary.journeys, 2);
  assert.equal(all.baselineLabel, "26/10/2026 14:42");
  const ninety = view({ events, query: { periodo: "90" }, now: new Date("2026-10-27T00:00:00.000Z") });
  assert.equal(ninety.summary.journeys, 2);
  const atEnd = view({
    events: [event({ anonymousId: "anon-secret-end", eventName: "course_view", occurredAt: NOW })],
    now: NOW,
  });
  assert.equal(atEnd.summary.journeys, 0);
});

test("identidade da jornada é o navegador e o usuário autenticado é outro recorte", () => {
  const dashboard = view({
    events: [
      event({ anonymousId: "anon-secret-a", sessionId: "session-secret-a", userId: "user-secret", eventName: "course_view" }),
      event({ anonymousId: "anon-secret-a", sessionId: "session-secret-a", userId: "user-secret", eventName: "lesson_started" }),
      event({ anonymousId: "anon-secret-b", sessionId: "session-secret-b", userId: "user-secret", eventName: "course_view" }),
    ],
  });
  assert.equal(dashboard.summary.journeys, 2);
  assert.equal(dashboard.summary.sessions, 2);
  assert.equal(dashboard.summary.authenticated, 1);
  assert.deepEqual(forbiddenLeaves(dashboard), []);
});

test("cada marco do funil deduplica a jornada e não vira taxa entre etapas", () => {
  const dashboard = view({
    events: [
      event({ anonymousId: "anon-secret-a", eventName: "course_view" }),
      event({ anonymousId: "anon-secret-a", eventName: "course_view" }),
      event({ anonymousId: "anon-secret-b", eventName: "checkout_started" }),
    ],
  });
  const viewed = dashboard.funnel.find((step) => step.key === "course_view");
  const checkout = dashboard.funnel.find((step) => step.key === "checkout_started");
  assert.equal(viewed?.count, 1);
  assert.equal(checkout?.count, 1);
  assert.deepEqual(Object.keys(viewed ?? {}).sort(), ["count", "key", "label"]);
  const funnelFile = readFileSync(new URL("../src/components/admin/journey/JourneySections.tsx", import.meta.url), "utf8");
  const funnel = funnelFile.slice(funnelFile.indexOf("export function JourneyFunnel"), funnelFile.indexOf("export function JourneyCommercial"));
  assert.match(funnel, /não é um funil fechado de cohort/);
  assert.equal(funnel.includes("%"), false);
});

test("compra paga vem do pedido e o evento de jornada não vira venda", () => {
  const orders = [order("user-secret-1"), order("user-secret-2")];
  const events = [1, 2, 3, 4, 5].map((index) => event({
    anonymousId: `anon-secret-${index}`,
    userId: index <= 2 ? `user-secret-${index}` : null,
    eventName: "purchase_completed",
  }));
  const dashboard = view({ events, orders });
  assert.equal(dashboard.commercial.paidOrders, 2);
  assert.equal(dashboard.summary.journeys, 5);
  const withoutEvent = view({ orders: [order("user-secret-1")] });
  assert.equal(withoutEvent.commercial.paidOrders, 1);
  assert.equal(withoutEvent.coverage.withJourney, 0);
  assert.equal(withoutEvent.coverage.buyers, 1);
  assert.equal(withoutEvent.coverage.percent, 0);
  const coverage = readFileSync(new URL("../src/components/admin/journey/JourneySections.tsx", import.meta.url), "utf8");
  assert.match(coverage, /cobertura de analytics consentido/);
  assert.match(coverage, /Não é taxa de conversão/);
});

test("receita reutiliza a regra operacional e não rateia pagamento por curso", () => {
  const payments: JourneyPaymentFact[] = [
    { status: "APPROVED", amountCents: 24990, refundedAmountCents: 0, approvedAt: INSIDE, createdAt: INSIDE },
    { status: "PARTIALLY_REFUNDED", amountCents: 10000, refundedAmountCents: 2500, approvedAt: INSIDE, createdAt: INSIDE },
    { status: "REFUNDED", amountCents: 5000, refundedAmountCents: 5000, approvedAt: INSIDE, createdAt: INSIDE },
    { status: "APPROVED", amountCents: 999, refundedAmountCents: 0, approvedAt: BEFORE, createdAt: BEFORE },
  ];
  const dashboard = view({ payments });
  assert.equal(dashboard.commercial.revenueCents, receivedRevenueCents(payments.slice(0, 3)));
  assert.equal(dashboard.commercial.revenueCents, 32490);
  const filtered = view({
    query: { curso: TRAFFIC },
    orders: [{
      userId: "user-secret",
      createdAt: INSIDE,
      items: [
        { courseSlugs: [TRAFFIC], finalPriceCents: 10000 },
        { courseSlugs: [SITES], finalPriceCents: 20000 },
      ],
    }],
    payments,
  });
  assert.equal(filtered.commercial.revenueCents, null);
  assert.equal(filtered.commercial.itemValueCents, 10000);
  assert.equal(filtered.commercial.paidOrders, 1);
});

test("filtro de curso não puxa o outro curso nem evento sem formação", () => {
  const events = [
    event({ anonymousId: "anon-secret-t", eventName: "course_view", courseSlug: TRAFFIC }),
    event({ anonymousId: "anon-secret-s", eventName: "course_view", courseSlug: SITES }),
    event({ anonymousId: "anon-secret-g", eventName: "course_view" }),
    event({ anonymousId: "anon-secret-link", eventName: "course_complementary_click", sourceCourseSlug: SITES, targetCourseSlug: TRAFFIC }),
  ];
  const traffic = view({ events, query: { curso: TRAFFIC } });
  assert.equal(traffic.summary.journeys, 2);
  assert.equal(traffic.funnel.find((step) => step.key === "course_view")?.count, 1);
  const sites = view({ events, query: { curso: SITES } });
  assert.equal(sites.funnel.find((step) => step.key === "course_view")?.count, 1);
  assert.equal(sites.summary.journeys, 2);
});

test("movimento entre cursos usa só o clique complementar", () => {
  const dashboard = view({
    events: [
      event({ anonymousId: "anon-secret-a", eventName: "course_view", courseSlug: TRAFFIC, occurredAt: new Date("2026-12-10T10:00:00.000Z") }),
      event({ anonymousId: "anon-secret-a", eventName: "course_view", courseSlug: SITES, occurredAt: new Date("2026-12-10T11:00:00.000Z") }),
      event({ anonymousId: "anon-secret-a", eventName: "course_complementary_click", sourceCourseSlug: TRAFFIC, targetCourseSlug: SITES }),
      event({ anonymousId: "anon-secret-a", eventName: "course_complementary_click", sourceCourseSlug: TRAFFIC, targetCourseSlug: SITES, occurredAt: new Date("2026-12-10T13:00:00.000Z") }),
      event({ anonymousId: "anon-secret-b", eventName: "course_complementary_click", sourceCourseSlug: SITES, targetCourseSlug: TRAFFIC }),
    ],
  });
  assert.equal(dashboard.transitions.length, 2);
  const forward = dashboard.transitions.find((row) => row.from === "Tráfego Pago" && row.to === "Sites que Convertem");
  const back = dashboard.transitions.find((row) => row.from === "Sites que Convertem" && row.to === "Tráfego Pago");
  assert.equal(forward?.journeys, 1);
  assert.equal(forward?.clicks, 2);
  assert.equal(back?.journeys, 1);
});

test("home e catálogo continuam distinguíveis no mesmo cenário", () => {
  const dashboard = view({
    events: [
      event({ anonymousId: "anon-secret-h", eventName: "home_course_path_click", scenario: "atrair", courseSlug: TRAFFIC }),
      event({ anonymousId: "anon-secret-c", eventName: "course_catalog_path_click", scenario: "atrair", courseSlug: SITES }),
    ],
  });
  const row = dashboard.scenarios.find((item) => item.id === "atrair");
  assert.equal(row?.label, "Preciso atrair mais pessoas.");
  assert.equal(row?.home, 1);
  assert.equal(row?.catalog, 1);
  assert.equal(row?.traffic, 1);
  assert.equal(row?.sites, 1);
  assert.deepEqual(dashboard.courseChoices.map((item) => [item.slug, item.count]), [[TRAFFIC, 1], [SITES, 1]]);
});

test("origem observada usa o primeiro evento da jornada no período", () => {
  const dashboard = view({
    events: [
      event({
        anonymousId: "anon-secret-a",
        eventName: "course_view",
        occurredAt: new Date("2026-12-10T10:00:00.000Z"),
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "primeira",
      }),
      event({
        anonymousId: "anon-secret-a",
        eventName: "lesson_started",
        occurredAt: new Date("2026-12-10T11:00:00.000Z"),
        utmSource: "facebook",
        utmMedium: "paid",
        utmCampaign: "segunda",
      }),
      event({ anonymousId: "anon-secret-b", eventName: "course_view", utmSource: "direct", utmMedium: "none" }),
      event({ anonymousId: "anon-secret-c", eventName: "course_view", leadSource: "organic", leadMedium: "search" }),
      event({ anonymousId: "anon-secret-d", eventName: "course_view", utmSource: "referral", utmMedium: "referral" }),
      event({ anonymousId: "anon-secret-e", eventName: "course_view" }),
    ],
  });
  assert.deepEqual(dashboard.sources.map((row) => row.label).sort(), ["Não informado", "direct / none", "google / cpc", "organic / search", "referral / referral"]);
  assert.deepEqual(dashboard.campaigns, [{ label: "primeira", count: 1 }]);
  const many = view({
    events: Array.from({ length: 12 }, (_, index) => event({
      anonymousId: `anon-secret-${index}`,
      eventName: "course_view",
      utmSource: `fonte-${String(index).padStart(2, "0")}`,
      utmMedium: "cpc",
    })),
  });
  assert.equal(many.sources.length, 10);
});

test("aula gratuita mostra título ou slug e não calcula percentual", () => {
  const dashboard = view({
    lessonTitles: { "aula-conhecida": "Aula conhecida" },
    events: [
      event({ anonymousId: "anon-secret-a", eventName: "course_free_start", courseSlug: TRAFFIC, lessonSlug: "aula-conhecida" }),
      event({ anonymousId: "anon-secret-a", eventName: "course_free_start", courseSlug: TRAFFIC, lessonSlug: "aula-conhecida", occurredAt: new Date("2026-12-10T13:00:00.000Z") }),
      event({ anonymousId: "anon-secret-a", eventName: "lesson_completed", courseSlug: TRAFFIC, lessonSlug: "aula-conhecida" }),
      event({ anonymousId: "anon-secret-b", eventName: "course_free_start", courseSlug: SITES, lessonSlug: "slug-antigo" }),
    ],
  });
  const known = dashboard.freeLessons.find((row) => row.lessonTitle === "Aula conhecida");
  const unknown = dashboard.freeLessons.find((row) => row.lessonTitle === "slug-antigo");
  assert.equal(known?.journeys, 1);
  assert.equal(known?.starts, 2);
  assert.equal(known?.completions, 1);
  assert.equal(unknown?.journeys, 1);
  assert.equal(JSON.stringify(dashboard.freeLessons).includes("%"), false);
});

test("aprendizado e diagnóstico operacionais não nascem do JourneyEvent", () => {
  const dashboard = view({
    events: [
      event({ anonymousId: "anon-secret-a", eventName: "lesson_started" }),
      event({ anonymousId: "anon-secret-a", eventName: "diagnostic_completed" }),
      event({ anonymousId: "anon-secret-b", eventName: "diagnostic_started" }),
    ],
    progress: [
      { userId: "user-secret-1", courseSlug: TRAFFIC, startedAt: INSIDE, completedAt: INSIDE },
      { userId: "user-secret-1", courseSlug: TRAFFIC, startedAt: INSIDE, completedAt: null },
      { userId: "user-secret-2", courseSlug: SITES, startedAt: INSIDE, completedAt: null },
    ],
    diagnostics: [
      { userId: "user-secret-9", completedAt: INSIDE },
      { userId: "user-secret-9", completedAt: INSIDE },
    ],
  });
  assert.equal(dashboard.operational.lessonsStarted, 2);
  assert.equal(dashboard.operational.lessonsCompleted, 1);
  assert.equal(dashboard.operational.diagnosticsCompleted, 1);
  assert.equal(dashboard.observedDiagnostics.started, 1);
  assert.equal(dashboard.observedDiagnostics.completed, 1);
  const filtered = view({
    query: { curso: TRAFFIC },
    progress: [
      { userId: "user-secret-1", courseSlug: TRAFFIC, startedAt: INSIDE, completedAt: INSIDE },
      { userId: "user-secret-2", courseSlug: SITES, startedAt: INSIDE, completedAt: INSIDE },
    ],
    diagnostics: [{ userId: "user-secret-9", completedAt: INSIDE }],
  });
  assert.equal(filtered.operational.lessonsStarted, 1);
  assert.equal(filtered.operational.lessonsCompleted, 1);
  assert.equal(filtered.operational.diagnosticsCompleted, null);
});

test("amostra pequena avisa e amostra vazia não finge gráfico", () => {
  assert.equal(view({ events: [] }).smallSample, false);
  assert.equal(view({ events: [event({ anonymousId: "anon-secret-a", eventName: "course_view" })] }).smallSample, true);
  const twenty = view({
    events: Array.from({ length: 20 }, (_, index) => event({ anonymousId: `anon-secret-${index}`, eventName: "course_view" })),
  });
  assert.equal(twenty.smallSample, false);
  const ui = readFileSync(new URL("../src/components/admin/journey/JourneyBreakdowns.tsx", import.meta.url), "utf8");
  assert.match(ui, /JOURNEY_EMPTY/);
  assert.match(ui, /JOURNEY_SAMPLE_NOTE/);
});

test("painel é admin, sem API pública e sem identificador na consulta exposta", () => {
  const page = readFileSync(new URL("../src/app/(admin)/admin/jornada/page.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../src/app/(admin)/admin/layout.tsx", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../src/lib/admin/journey-dashboard.ts", import.meta.url), "utf8");
  const overview = readFileSync(new URL("../src/app/(admin)/admin/page.tsx", import.meta.url), "utf8");
  assert.match(page, /requireAdmin/);
  assert.match(page, /if \(!session\) return null/);
  assert.match(page, /loadJourneyDashboard/);
  assert.match(page, /force-dynamic/);
  assert.match(page, /index: false/);
  assert.match(page, /follow: false/);
  assert.match(layout, /href="\/admin\/jornada"/);
  assert.match(layout, /Visão geral[\s\S]*Jornada[\s\S]*Usuários[\s\S]*Compras[\s\S]*Cursos/);
  assert.match(overview, /FunnelCounts/);
  assert.match(loader, /Prisma\.sql/);
  assert.match(loader, /DISTINCT ON \("anonymousId"\)/);
  assert.match(loader, /receivedRevenueCents/);
  assert.match(loader, /status = 'PAID'/);
  assert.match(loader, /lesson_progress/);
  assert.match(loader, /FROM diagnostic/);
  assert.match(loader, /LIMIT 10/);
  assert.equal(loader.includes("$queryRawUnsafe"), false);
  assert.equal(loader.includes("console."), false);
  assert.equal(existsSync(new URL("../src/app/api/admin/jornada/route.ts", import.meta.url)), false);
  assert.equal(walk("src/app/api").some((file) => file.includes("jornada")), false);
});

function order(userId: string): JourneyOrderFact {
  return { userId, createdAt: INSIDE, items: [{ courseSlugs: [TRAFFIC], finalPriceCents: 24990 }] };
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}
