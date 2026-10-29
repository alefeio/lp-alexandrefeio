import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CONSENT_STORAGE_KEY, serializeConsent } from "../src/lib/consent";
import { rejectNonEssentialConsent } from "../src/lib/consent-store";
import { ATTRIBUTION_STORAGE_KEY } from "../src/lib/attribution";
import { trackEvent } from "../src/lib/analytics";
import { createMemoryDurableRateLimiter } from "../src/lib/landing-page/rate-limit/durable";
import {
  handleProductJourneyRequest,
  JOURNEY_MAX_BODY_BYTES,
  JOURNEY_RATE_LIMIT,
  JOURNEY_RATE_NAMESPACE,
  JOURNEY_RATE_WINDOW_SECONDS,
  type JourneyInsert,
} from "../src/lib/product-journey/ingest";
import { GA_ONLY_ANALYTICS_EVENTS, isStrategicJourneyEvent, STRATEGIC_JOURNEY_EVENTS } from "../src/lib/product-journey/events";
import {
  JOURNEY_ANONYMOUS_KEY,
  JOURNEY_ANONYMOUS_TTL_MS,
  JOURNEY_SESSION_KEY,
  clearJourneyIdentity,
  isJourneyUuid,
  readOrCreateAnonymousId,
  readOrCreateSessionId,
} from "../src/lib/product-journey/identity";
import { journeyPath } from "../src/lib/product-journey/paths";
import { parseJourneyEvent } from "../src/lib/product-journey/schema";
import { formatJourneyRetentionReport, journeyRetentionCutoff, runJourneyRetention } from "../src/lib/product-journey/retention";
import { handleJourneyRetentionCron } from "../src/lib/product-journey/retention-cron";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const ANON = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";
const NOW = Date.parse("2026-10-26T15:00:00.000Z");

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

function journeyBody(overrides: Record<string, unknown> = {}) {
  return {
    eventId: EVENT_ID,
    eventName: "course_catalog_path_click",
    anonymousId: ANON,
    sessionId: SESSION,
    courseSlug: "trafego-pago-na-pratica",
    scenario: "atrair",
    sourcePath: "/cursos",
    targetPath: "/cursos/trafego-pago-na-pratica",
    analyticsConsent: true,
    consentUpdatedAt: NOW,
    ...overrides,
  };
}

function post(payload: unknown, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request("https://alexandrefeio.com.br/api/analytics/journey", {
    method: "POST",
    headers,
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

async function ingest(payload: unknown, options: { userId?: string | null; insert?: (row: JourneyInsert) => Promise<void>; consume?: (key: string, now: number) => Promise<{ allowed: boolean }> } = {}) {
  const rows: JourneyInsert[] = [];
  const response = await handleProductJourneyRequest(post(payload), {
    now: NOW,
    userId: options.userId ?? null,
    consume: options.consume ?? (async () => ({ allowed: true })),
    insert: options.insert ?? (async (row) => {
      rows.push(row);
    }),
  });
  return { response, rows };
}

test("eventos estratégicos incluem as duas escolhas de caminho e deixam a visão do catálogo no GA", () => {
  assert.equal(STRATEGIC_JOURNEY_EVENTS.includes("home_course_path_click"), true);
  assert.equal(STRATEGIC_JOURNEY_EVENTS.includes("course_catalog_path_click"), true);
  assert.equal(isStrategicJourneyEvent("course_catalog_view"), false);
  assert.equal(GA_ONLY_ANALYTICS_EVENTS.includes("course_catalog_view"), true);
  assert.equal(GA_ONLY_ANALYTICS_EVENTS.includes("course_cta_click"), true);
  const catalog = readFileSync("src/components/course/CourseCatalog.tsx", "utf8");
  assert.match(catalog, /event="course_catalog_path_click"/);
  assert.match(catalog, /course_slug: link\.slug, scenario: hint\.id/);
  assert.match(catalog, /event="course_catalog_view"/);
  const home = readFileSync("src/components/home/CourseDecisionGuide.tsx", "utf8");
  assert.match(home, /event="home_course_path_click"/);
  assert.match(home, /scenario: scenario\.id/);
  assert.equal(home.includes("course_catalog_path_click"), false);
});

test("identidade pseudônima só nasce quando a função é chamada, reutiliza, rotaciona e limpa", () => {
  const local = memoryStorage();
  const session = memoryStorage();
  const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
  let cursor = 0;
  const next = () => ids[cursor++]!;
  assert.equal(local.getItem(JOURNEY_ANONYMOUS_KEY), null);
  const first = readOrCreateAnonymousId(local, NOW, next);
  assert.equal(isJourneyUuid(first), true);
  assert.equal(readOrCreateAnonymousId(local, NOW + JOURNEY_ANONYMOUS_TTL_MS - 1, next), first);
  const rotated = readOrCreateAnonymousId(local, NOW + JOURNEY_ANONYMOUS_TTL_MS, next);
  assert.notEqual(rotated, first);
  assert.equal(isJourneyUuid(rotated), true);
  const sessionA = readOrCreateSessionId(session, () => "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  assert.equal(readOrCreateSessionId(session, () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd"), sessionA);
  const other = memoryStorage();
  const sessionB = readOrCreateSessionId(other, () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  assert.notEqual(sessionB, sessionA);
  clearJourneyIdentity(local, session);
  assert.equal(local.getItem(JOURNEY_ANONYMOUS_KEY), null);
  assert.equal(session.getItem(JOURNEY_SESSION_KEY), null);
});

test("caminho interno é pathname e rejeita URL insegura", () => {
  assert.equal(journeyPath("/cursos/trafego-pago-na-pratica?gclid=1#topo"), "/cursos/trafego-pago-na-pratica");
  assert.equal(journeyPath("javascript:alert(1)"), undefined);
  assert.equal(journeyPath("data:text/html,hi"), undefined);
  assert.equal(journeyPath("https://example.com/cursos"), undefined);
});

test("consentimento controla o dataLayer e a chamada da jornada sem criar identidade antes", () => {
  const scope = globalThis as unknown as {
    window?: unknown;
    localStorage?: unknown;
    sessionStorage?: unknown;
    fetch: typeof fetch;
  };
  const previousWindow = scope.window;
  const previousLocal = scope.localStorage;
  const previousSession = scope.sessionStorage;
  const previousFetch = globalThis.fetch;
  const calls: Array<{ url: string; keepalive?: boolean; body: Record<string, unknown> }> = [];
  try {
    const local = memoryStorage();
    const session = memoryStorage();
    const win = {
      localStorage: local,
      sessionStorage: session,
      dataLayer: [] as Array<Record<string, unknown>>,
      location: { pathname: "/cursos" },
    };
    scope.window = win;
    scope.localStorage = local;
    scope.sessionStorage = session;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), keepalive: init?.keepalive, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return new Response(null, { status: 202 });
    }) as typeof fetch;

    trackEvent("course_catalog_path_click", { course_slug: "trafego-pago-na-pratica", scenario: "atrair", email: "ana@example.com" }, { targetPath: "/cursos/trafego-pago-na-pratica" });
    assert.equal(win.dataLayer.some((entry) => entry.event === "course_catalog_path_click"), true);
    assert.equal(calls.length, 0);
    assert.equal(local.getItem(JOURNEY_ANONYMOUS_KEY), null);

    local.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ necessary: true, analytics: false, marketing: false, updatedAt: NOW }));
    trackEvent("home_course_path_click", { course_slug: "sites-que-convertem", scenario: "pagina" });
    assert.equal(win.dataLayer.some((entry) => entry.event === "home_course_path_click"), true);
    assert.equal(calls.length, 0);

    local.setItem(CONSENT_STORAGE_KEY, JSON.stringify(serializeConsent({ analytics: true, marketing: false })));
    session.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "cursos",
      utm_content: "anuncio",
      utm_term: "atrair",
      lead_source: "paid",
      lead_medium: "cpc",
      landing_page: "/?gclid=CLICK",
      referrer: "news.example",
      gclid: "CLICK-G",
      fbclid: "CLICK-F",
    }));
    trackEvent("course_catalog_view", { course_slug: "trafego-pago-na-pratica" });
    assert.equal(calls.length, 0);
    assert.equal(local.getItem(JOURNEY_ANONYMOUS_KEY), null);

    trackEvent(
      "course_catalog_path_click",
      { course_slug: "trafego-pago-na-pratica", scenario: "atrair", value: 24990, transaction_id: "order_1" },
      { targetPath: "/cursos/trafego-pago-na-pratica" },
    );
    assert.equal(calls.length, 1);
    const sent = calls[0]!;
    assert.equal(sent.url, "/api/analytics/journey");
    assert.equal(sent.keepalive, true);
    assert.equal(sent.body.eventName, "course_catalog_path_click");
    assert.equal(sent.body.courseSlug, "trafego-pago-na-pratica");
    assert.equal(sent.body.scenario, "atrair");
    assert.equal(sent.body.sourcePath, "/cursos");
    assert.equal(sent.body.targetPath, "/cursos/trafego-pago-na-pratica");
    assert.equal(sent.body.analyticsConsent, true);
    assert.equal("value" in sent.body, false);
    assert.equal("transaction_id" in sent.body, false);
    assert.equal("userId" in sent.body, false);
    assert.equal("email" in sent.body, false);
    const attribution = sent.body.attribution as Record<string, unknown>;
    assert.equal(attribution.utm_source, "google");
    assert.equal("gclid" in attribution, false);
    assert.equal("fbclid" in attribution, false);
    assert.equal(isJourneyUuid(String(sent.body.anonymousId)), true);
    assert.equal(isJourneyUuid(String(sent.body.sessionId)), true);
    const anonymousId = String(sent.body.anonymousId);
    const sessionId = String(sent.body.sessionId);

    trackEvent("course_view", { course_slug: "trafego-pago-na-pratica" });
    assert.equal(calls[1]?.body.anonymousId, anonymousId);
    assert.equal(calls[1]?.body.sessionId, sessionId);

    const freshSession = memoryStorage();
    scope.sessionStorage = freshSession;
    win.sessionStorage = freshSession;
    trackEvent("course_free_start", { course_slug: "trafego-pago-na-pratica" });
    assert.equal(calls[2]?.body.anonymousId, anonymousId);
    assert.notEqual(calls[2]?.body.sessionId, sessionId);

    local.setItem(JOURNEY_ANONYMOUS_KEY, JSON.stringify({ id: anonymousId, createdAt: Date.now() }));
    freshSession.setItem(JOURNEY_SESSION_KEY, String(calls[2]?.body.sessionId));
    rejectNonEssentialConsent();
    assert.equal(local.getItem(JOURNEY_ANONYMOUS_KEY), null);
    assert.equal(freshSession.getItem(JOURNEY_SESSION_KEY), null);
    const before = calls.length;
    trackEvent("checkout_started", { course_slug: "trafego-pago-na-pratica" });
    assert.equal(win.dataLayer.some((entry) => entry.event === "checkout_started"), true);
    assert.equal(calls.length, before);
  } finally {
    scope.window = previousWindow;
    scope.localStorage = previousLocal;
    scope.sessionStorage = previousSession;
    globalThis.fetch = previousFetch;
  }
});

test("endpoint aceita evento estratégico, ignora userId do cliente e deriva a sessão", async () => {
  const created = await ingest(journeyBody());
  assert.equal(created.response.status, 202);
  assert.equal(created.rows[0]?.userId, null);
  assert.equal(created.rows[0]?.eventName, "course_catalog_path_click");
  assert.equal(created.rows[0]?.courseSlug, "trafego-pago-na-pratica");
  assert.equal(created.rows[0]?.scenario, "atrair");
  assert.equal(created.rows[0]?.sourcePath, "/cursos");
  assert.equal(created.rows[0]?.targetPath, "/cursos/trafego-pago-na-pratica");

  const authed = await ingest(journeyBody({ eventId: "44444444-4444-4444-8444-444444444444" }), { userId: "user_session" });
  assert.equal(authed.response.status, 202);
  assert.equal(authed.rows[0]?.userId, "user_session");

  let inserted = 0;
  const forged = await ingest(journeyBody({ userId: "user_forged" }), {
    userId: "user_session",
    insert: async () => {
      inserted += 1;
    },
  });
  assert.equal(forged.response.status, 400);
  assert.equal(inserted, 0);
});

test("endpoint rejeita allowlist, corpo, tipo, campos desconhecidos e PII", async () => {
  assert.equal((await ingest(journeyBody({ eventName: "course_catalog_view" }))).response.status, 400);
  assert.equal((await ingest(journeyBody({ eventName: "curriculum_lesson_expand" }))).response.status, 400);
  assert.equal((await ingest(journeyBody({ analyticsConsent: false }))).response.status, 400);
  assert.equal((await ingest(journeyBody({ email: "ana@example.com" }))).response.status, 400);
  assert.equal((await ingest(journeyBody({ phone: "11999999999" }))).response.status, 400);
  assert.equal((await ingest(journeyBody({ name: "Ana" }))).response.status, 400);
  assert.equal((await ingest(journeyBody({ submittedData: { email: "ana@example.com" } }))).response.status, 400);
  assert.equal((await ingest(journeyBody({ userAgent: "Mozilla/5.0" }))).response.status, 400);
  assert.equal((await ingest(journeyBody({ ip: "203.0.113.9" }))).response.status, 400);
  assert.equal((await ingest(journeyBody({ metadata: { note: "x" } }))).response.status, 400);
  assert.equal((await ingest("{")).response.status, 400);
  const wrongType = await handleProductJourneyRequest(post(journeyBody(), { "content-type": "text/plain" }), {
    now: NOW,
    userId: null,
    consume: async () => ({ allowed: true }),
    insert: async () => undefined,
  });
  assert.equal(wrongType.status, 415);
  const large = await handleProductJourneyRequest(post("x".repeat(JOURNEY_MAX_BODY_BYTES + 1)), {
    now: NOW,
    userId: null,
    consume: async () => ({ allowed: true }),
    insert: async () => undefined,
  });
  assert.equal(large.status, 413);
});

test("eventId repetido é sucesso idempotente", async () => {
  let calls = 0;
  const insert = async () => {
    calls += 1;
    if (calls > 1) throw Object.assign(new Error("unique"), { code: "P2002" });
  };
  const first = await ingest(journeyBody(), { insert });
  const second = await ingest(journeyBody(), { insert });
  assert.equal(first.response.status, 202);
  assert.equal(second.response.status, 200);
  assert.deepEqual(await second.response.json(), { ok: true });
});

test("atribuição sanitizada persiste UTM e host, sem click id nem e-mail", () => {
  const parsed = parseJourneyEvent(journeyBody({
    courseSlug: "ana@example.com",
    attribution: {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "cursos",
      utm_content: "anuncio",
      utm_term: "pagina",
      lead_source: "paid",
      lead_medium: "cpc",
      landing_page: "/cursos?gclid=CLICK-G&fbclid=CLICK-F",
      referrer: "https://news.example/artigo?utm_source=secret",
      gclid: "CLICK-G",
      fbclid: "CLICK-F",
    },
  }), NOW);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.utmSource, "google");
  assert.equal(parsed.value.utmMedium, "cpc");
  assert.equal(parsed.value.utmCampaign, "cursos");
  assert.equal(parsed.value.utmContent, "anuncio");
  assert.equal(parsed.value.utmTerm, "pagina");
  assert.equal(parsed.value.leadSource, "paid");
  assert.equal(parsed.value.leadMedium, "cpc");
  assert.equal(parsed.value.landingPath, "/cursos");
  assert.equal(parsed.value.referrerHost, "news.example");
  assert.equal(parsed.value.courseSlug, null);
  const stored = JSON.stringify(parsed.value);
  assert.equal(stored.includes("CLICK-G"), false);
  assert.equal(stored.includes("CLICK-F"), false);
  assert.equal(stored.includes("ana@example.com"), false);
  assert.equal(stored.includes("gclid"), false);
  assert.equal(stored.includes("fbclid"), false);
});

test("limite de 120 eventos em 10 minutos responde 429 e não grava IP", async () => {
  const limiter = createMemoryDurableRateLimiter();
  const keys: string[] = [];
  const rows: JourneyInsert[] = [];
  const ip = "203.0.113.9";
  for (let index = 0; index < JOURNEY_RATE_LIMIT + 1; index += 1) {
    const request = post(journeyBody({ eventId: `55555555-5555-4555-8555-${String(index).padStart(12, "0")}` }));
    request.headers.set("x-forwarded-for", ip);
    const response = await handleProductJourneyRequest(request, {
      now: NOW,
      userId: null,
      consume: (key, now) => {
        keys.push(key);
        return limiter.consume({ namespace: JOURNEY_RATE_NAMESPACE, key, limit: JOURNEY_RATE_LIMIT, windowSeconds: JOURNEY_RATE_WINDOW_SECONDS, now });
      },
      insert: async (row) => {
        rows.push(row);
      },
    });
    assert.equal(response.status, index < JOURNEY_RATE_LIMIT ? 202 : 429);
  }
  assert.equal(rows.length, JOURNEY_RATE_LIMIT);
  assert.equal(keys.every((key) => key === `anon:${ANON}`), true);
  assert.equal(JSON.stringify(rows).includes(ip), false);
  assert.equal(JSON.stringify(limiter.snapshot()).includes(ip), false);
});

test("retenção de 12 meses apaga só o que é anterior ao corte e o dry-run não apaga", async () => {
  const now = new Date("2026-10-26T15:00:00.000Z");
  const cutoff = journeyRetentionCutoff(now);
  const rows = [
    { occurredAt: new Date(cutoff.getTime() - 1) },
    { occurredAt: new Date(cutoff.getTime()) },
    { occurredAt: new Date(cutoff.getTime() + 1) },
  ];
  let deletes = 0;
  const repository = {
    async countExpired(limit: Date) {
      return rows.filter((row) => row.occurredAt < limit).length;
    },
    async deleteExpired(limit: Date) {
      deletes += 1;
      const before = rows.length;
      const kept = rows.filter((row) => !(row.occurredAt < limit));
      rows.splice(0, rows.length, ...kept);
      return before - kept.length;
    },
  };
  const dry = await runJourneyRetention({ now, repository });
  assert.equal(dry.mode, "DRY_RUN");
  assert.equal(dry.expiredCount, 1);
  assert.equal(dry.deletedCount, 0);
  assert.equal(deletes, 0);
  assert.equal(rows.length, 3);
  const executed = await runJourneyRetention({ now, execute: true, repository });
  assert.equal(executed.mode, "EXECUTE");
  assert.equal(executed.deletedCount, 1);
  assert.equal(rows.length, 2);
  assert.equal(rows.some((row) => row.occurredAt.getTime() === cutoff.getTime()), true);
  const again = await runJourneyRetention({ now, execute: true, repository });
  assert.equal(again.expiredCount, 0);
  assert.equal(again.deletedCount, 0);
  const log = formatJourneyRetentionReport(executed);
  assert.match(log, /mode EXECUTE/);
  assert.match(log, /expiredCount 1/);
  assert.match(log, /deletedCount 1/);
  assert.equal(log.includes(ANON), false);
  assert.equal(log.includes("user_"), false);
});

test("cron de jornada exige segredo e executa sem devolver identificadores", async () => {
  const missing = await handleJourneyRetentionCron(new Request("https://alexandrefeio.com.br/api/cron/product-journey-retention"), {
    secret: undefined,
    run: async () => ({ mode: "EXECUTE", cutoff: "2025-10-26T15:00:00.000Z", expiredCount: 0, deletedCount: 0 }),
  });
  assert.equal(missing.status, 503);
  const absent = await handleJourneyRetentionCron(new Request("https://alexandrefeio.com.br/api/cron/product-journey-retention"), {
    secret: "cron-secret",
    run: async () => ({ mode: "EXECUTE", cutoff: "2025-10-26T15:00:00.000Z", expiredCount: 0, deletedCount: 0 }),
  });
  assert.equal(absent.status, 401);
  const wrong = await handleJourneyRetentionCron(new Request("https://alexandrefeio.com.br/api/cron/product-journey-retention", { headers: { authorization: "Bearer outro" } }), {
    secret: "cron-secret",
    run: async () => ({ mode: "EXECUTE", cutoff: "2025-10-26T15:00:00.000Z", expiredCount: 0, deletedCount: 0 }),
  });
  assert.equal(wrong.status, 401);
  let executed = false;
  const ok = await handleJourneyRetentionCron(new Request("https://alexandrefeio.com.br/api/cron/product-journey-retention", { headers: { authorization: "Bearer cron-secret" } }), {
    secret: "cron-secret",
    run: async () => {
      executed = true;
      return { mode: "EXECUTE", cutoff: "2025-10-26T15:00:00.000Z", expiredCount: 2, deletedCount: 2 };
    },
  });
  assert.equal(ok.status, 200);
  assert.equal(executed, true);
  const body = await ok.json();
  assert.deepEqual(body, { mode: "EXECUTE", cutoff: "2025-10-26T15:00:00.000Z", expiredCount: 2, deletedCount: 2 });
  const route = readFileSync("src/app/api/cron/product-journey-retention/route.ts", "utf8");
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /execute: true/);
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: Array<{ path: string; schedule: string }> };
  assert.deepEqual(vercel.crons.find((cron) => cron.path === "/api/cron/product-journey-retention"), {
    path: "/api/cron/product-journey-retention",
    schedule: "15 4 * * *",
  });
  assert.equal(vercel.crons.some((cron) => cron.path === "/api/cron/landing-retention"), true);
});

test("modelo, migration e privacidade não guardam IP, agente nem metadata livre", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const model = schema.slice(schema.indexOf("model JourneyEvent"), schema.indexOf("@@map(\"journey_event\")"));
  assert.match(model, /eventId\s+String\s+@unique/);
  assert.match(model, /eventName\s+String/);
  assert.match(model, /onDelete: Cascade/);
  assert.equal(model.includes("Json"), false);
  assert.equal(model.includes("ipAddress"), false);
  assert.equal(model.includes("userAgent"), false);
  assert.equal(model.includes("gclid"), false);
  assert.equal(model.includes("fbclid"), false);
  const sql = readFileSync("prisma/migrations/20261026160000_add_product_journey_event/migration.sql", "utf8");
  assert.match(sql, /CREATE TABLE "journey_event"/);
  assert.match(sql, /journey_event_eventId_key/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.equal(/DROP |TRUNCATE |DELETE FROM /i.test(sql), false);
  const privacy = readFileSync("src/app/(public)/privacidade/page.tsx", "utf8");
  assert.match(privacy, /Jornada e uso da plataforma/);
  assert.match(privacy, /identificador pseudônimo/);
  assert.match(privacy, /associado à conta/);
  assert.match(privacy, /consentimento de analytics/);
  assert.match(privacy, /12 meses/);
  assert.match(privacy, /não guarda o endereço IP bruto/);
  assert.match(privacy, /identificador analítico local é removido/);
  assert.equal(privacy.includes("dados totalmente anônimos"), false);
  assert.match(privacy, /APIMG/);
  assert.match(privacy, /não são encaminhados à OpenAI/);
  assert.match(privacy, /GTM/);
  const client = readFileSync("src/lib/product-journey/client.ts", "utf8");
  assert.match(client, /keepalive: true/);
  assert.equal(client.includes("from \"@/lib/analytics\""), false);
  assert.equal(/\btrackEvent\(/.test(client), false);
  const analytics = readFileSync("src/lib/analytics.ts", "utf8");
  assert.equal(analytics.includes("await persistJourneyEvent"), false);
  const emitted = {
    home_course_path_click: "src/components/home/CourseDecisionGuide.tsx",
    course_catalog_path_click: "src/components/course/CourseCatalog.tsx",
    course_catalog_click: "src/components/course/CourseCatalog.tsx",
    course_view: "src/components/course/CourseSales.tsx",
    course_complementary_click: "src/components/course/ComplementaryCourse.tsx",
    course_free_start: "src/components/course/CourseHero.tsx",
    lesson_started: "src/components/learning/LessonReader.tsx",
    lesson_completed: "src/lib/learning/progress.ts",
    diagnostic_started: "src/components/diagnostic/DiagnosticWizard.tsx",
    diagnostic_completed: "src/components/diagnostic/DiagnosticWizard.tsx",
    checkout_started: "src/components/commerce/CheckoutScreen.tsx",
    purchase_completed: "src/components/commerce/PurchaseBeacon.tsx",
    service_interest: "src/components/ui/ContactLink.tsx",
  } as const;
  for (const [event, file] of Object.entries(emitted)) {
    assert.equal(readFileSync(file, "utf8").includes(event), true, event);
  }
  const purchasePage = readFileSync("src/app/(app)/app/compras/[id]/page.tsx", "utf8");
  assert.match(purchasePage, /paid=\{order\.status === "PAID"\}/);
  const beacon = readFileSync("src/components/commerce/PurchaseBeacon.tsx", "utf8");
  assert.match(beacon, /if \(!paid\) return/);
});
