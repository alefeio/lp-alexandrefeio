import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { handleBlogReadingRequest, type BlogReadingCommit, type BlogReadingCommitResult, type BlogReadingStore } from "../src/lib/blog/reading/ingest";
import { BLOG_READER_KEY, BLOG_READING_INDEX_KEY, BLOG_SESSION_KEY, clearBlogReadingIdentity, readOrCreateBlogReaderId } from "../src/lib/blog/reading/identity";
import { isDeepBlogReading, isEngagedBlogReading } from "../src/lib/blog/reading/metrics";
import { blogReadingRetentionCutoff, runBlogReadingRetention } from "../src/lib/blog/reading/retention";
import { handleBlogReadingRetentionCron } from "../src/lib/blog/reading/retention-cron";
import { blogReadingIngestEnabled, BLOG_READING_IDLE_MS, BLOG_READING_MAX_BODY_BYTES } from "../src/lib/blog/reading/constants";
import type { BlogClickRecord, BlogReadingRecord } from "../src/lib/blog/reading/lifecycle";
import { JOURNEY_ANONYMOUS_KEY } from "../src/lib/product-journey/identity";

const POST_ID = "c123456789012345678901234";
const OTHER_POST_ID = "c123456789012345678901235";
const READING = "11111111-1111-4111-8111-111111111111";
const OTHER_READING = "11111111-1111-4111-8111-111111111112";
const ANON = "22222222-2222-4222-8222-222222222222";
const OTHER_ANON = "22222222-2222-4222-8222-222222222223";
const TAB = "33333333-3333-4333-8333-333333333333";
const OTHER_TAB = "33333333-3333-4333-8333-333333333334";
const CLICK = "44444444-4444-4444-8444-444444444444";
const OTHER_CLICK = "44444444-4444-4444-8444-444444444445";
const NOW = Date.parse("2026-11-05T15:00:00.000Z");

function body(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    clientReadingId: READING,
    blogPostId: POST_ID,
    anonymousId: ANON,
    sessionId: TAB,
    activeTimeMs: 0,
    maxScrollPercent: 0,
    reachedEnd: false,
    ended: false,
    analyticsConsent: true,
    consentUpdatedAt: NOW,
    ...overrides,
  };
}

function cloneSessions(source: Map<string, BlogReadingRecord>) {
  return new Map([...source.entries()].map(([key, value]) => [key, { ...value }]));
}

function cloneClicks(source: Map<string, BlogClickRecord>) {
  return new Map([...source.entries()].map(([key, value]) => [key, { ...value }]));
}

function memoryStore(hooks?: { failClicks?: number; blindClicks?: number; arm?: () => BlogReadingCommitResult | null }) {
  const sessions = new Map<string, BlogReadingRecord>();
  const clicks = new Map<string, BlogClickRecord>();
  let sequence = 0;
  const state = { failClicks: hooks?.failClicks ?? 0, blindClicks: hooks?.blindClicks ?? 0 };
  const store: BlogReadingStore = {
    async findSession(clientReadingId) {
      return sessions.get(clientReadingId) ?? null;
    },
    async findClick(eventId) {
      if (state.blindClicks > 0) {
        state.blindClicks -= 1;
        return null;
      }
      const click = clicks.get(eventId);
      return click ? { readingSessionId: click.readingSessionId } : null;
    },
    async commit(input: BlogReadingCommit) {
      const armed = hooks?.arm?.() ?? null;
      if (armed) return armed;
      const sessionBackup = cloneSessions(sessions);
      const clickBackup = cloneClicks(clicks);
      const rollback = () => {
        sessions.clear();
        for (const [key, value] of sessionBackup) sessions.set(key, value);
        clicks.clear();
        for (const [key, value] of clickBackup) clicks.set(key, value);
      };
      try {
        if (input.kind === "create") {
          if (sessions.has(input.session.clientReadingId)) return "stale";
          sessions.set(input.session.clientReadingId, input.session);
        } else {
          const current = sessions.get(input.session.clientReadingId);
          if (!current || current.endedAt) return "stale";
          if (current.recordVersion !== input.session.recordVersion - 1) return "stale";
          if (current.anonymousId !== input.session.anonymousId || current.sessionId !== input.session.sessionId || current.blogPostId !== input.session.blogPostId) return "stale";
          if (input.session.activeTimeMs < current.activeTimeMs || input.session.maxScrollPercent < current.maxScrollPercent) return "stale";
          if (current.reachedEndAt && input.session.reachedEndAt === null) return "stale";
          sessions.set(input.session.clientReadingId, input.session);
        }
        if (input.click && state.failClicks > 0) {
          state.failClicks -= 1;
          throw new Error("falha entre sessão e clique");
        }
        if (input.click) {
          const existing = clicks.get(input.click.eventId);
          if (existing) {
            if (existing.readingSessionId === input.session.id) return "applied";
            rollback();
            return "click-conflict";
          }
          if (![...sessions.values()].some((session) => session.id === input.click?.readingSessionId)) throw new Error("clique sem sessão");
          clicks.set(input.click.eventId, input.click);
        }
        return "applied";
      } catch (error) {
        rollback();
        throw error;
      }
    },
  };
  return { store, sessions, clicks, nextId: () => `id-${++sequence}` };
}

function harness(options?: { published?: boolean; identityLimit?: number; abuseLimit?: number; failClicks?: number; blindClicks?: number; arm?: () => BlogReadingCommitResult | null }) {
  const db = memoryStore(options);
  let lookups = 0;
  let identityHits = 0;
  let abuseHits = 0;
  const published = new Map<string, string>([[POST_ID, "Artigo-Publicado"], [OTHER_POST_ID, "outro-artigo"]]);
  async function send(payload: unknown, init?: { now?: number; enabled?: boolean; headers?: Record<string, string> }) {
    const headers = { "content-type": "application/json", ...init?.headers };
    const response = await handleBlogReadingRequest(
      new Request("https://alexandrefeio.com.br/api/analytics/blog-reading", {
        method: "POST",
        headers,
        body: typeof payload === "string" ? payload : JSON.stringify(payload),
      }),
      {
        enabled: init?.enabled ?? true,
        now: init?.now ?? NOW,
        consumeAbuse: async () => {
          abuseHits += 1;
          return { allowed: abuseHits <= (options?.abuseLimit ?? 100) };
        },
        consumeIdentity: async () => {
          identityHits += 1;
          return { allowed: identityHits <= (options?.identityLimit ?? 100) };
        },
        findPublished: async (id) => {
          lookups += 1;
          if (options?.published === false) return null;
          const slug = published.get(id);
          return slug ? { id, slug } : null;
        },
        store: db.store,
        nextId: db.nextId,
      },
    );
    return response;
  }
  return { ...db, send, get lookups() { return lookups; }, get identityHits() { return identityHits; }, get abuseHits() { return abuseHits; } };
}

test("coleta desligada, prefetch e ausência de consentimento não gravam", async () => {
  assert.equal(blogReadingIngestEnabled({}), false);
  assert.equal(blogReadingIngestEnabled({ BLOG_READING_INGEST_ENABLED: "false" }), false);
  assert.equal(blogReadingIngestEnabled({ BLOG_READING_INGEST_ENABLED: "true" }), true);
  const off = harness();
  const disabled = await off.send(body(), { enabled: false });
  assert.equal(disabled.status, 404);
  assert.equal(off.sessions.size, 0);
  assert.equal(off.lookups, 0);
  const prefetch = harness();
  const skipped = await prefetch.send(body(), { headers: { purpose: "prefetch" } });
  assert.equal(skipped.status, 204);
  assert.equal(prefetch.sessions.size, 0);
  assert.equal(prefetch.lookups, 0);
  const denied = harness();
  const missingConsent = await denied.send(body({ analyticsConsent: false }));
  assert.equal(missingConsent.status, 400);
  assert.equal(denied.sessions.size, 0);
  const text = await missingConsent.json();
  assert.deepEqual(text, { ok: false });
});

test("abertura válida cria uma sessão e o recarregamento não duplica", async () => {
  const db = harness();
  const created = await db.send(body({ attribution: { utm_source: "news", referrer: "https://news.example/artigo" } }));
  assert.equal(created.status, 202);
  assert.equal(db.sessions.size, 1);
  const session = db.sessions.get(READING);
  assert.equal(session?.activeTimeMs, 0);
  assert.equal(session?.recordVersion, 0);
  assert.equal(session?.blogPostId, POST_ID);
  assert.equal(session?.slugObserved, "artigo-publicado");
  assert.equal(session?.anonymousId, ANON);
  assert.equal(session?.utmSource, "news");
  assert.equal(session?.referrerHost, "news.example");
  assert.equal("userId" in (session ?? {}), false);
  const again = await db.send(body({ activeTimeMs: 2000, maxScrollPercent: 25 }), { now: NOW + 2000 });
  assert.equal(again.status, 202);
  assert.equal(db.sessions.size, 1);
  assert.equal(db.sessions.get(READING)?.activeTimeMs, 2000);
  assert.equal(db.sessions.get(READING)?.maxScrollPercent, 25);
  assert.equal(db.sessions.get(READING)?.recordVersion, 1);
  const elevated = harness();
  const rejected = await elevated.send(body({ activeTimeMs: 60_000 }));
  assert.equal(rejected.status, 400);
  assert.equal(elevated.sessions.size, 0);
});

test("rascunho e artigo inexistente não criam sessão", async () => {
  const draft = harness({ published: false });
  const hidden = await draft.send(body());
  assert.equal(hidden.status, 404);
  assert.equal(draft.sessions.size, 0);
  const missing = harness();
  const absent = await missing.send(body({ blogPostId: "c000000000000000000000099" }));
  assert.equal(absent.status, 404);
  assert.equal(missing.sessions.size, 0);
});

test("identificador incompatível não transfere a sessão", async () => {
  const db = harness();
  assert.equal((await db.send(body())).status, 202);
  const moved = await db.send(body({ anonymousId: OTHER_ANON, blogPostId: OTHER_POST_ID, clientReadingId: READING }), { now: NOW + 1000 });
  assert.equal(moved.status, 409);
  assert.equal(db.sessions.size, 1);
  assert.equal(db.sessions.get(READING)?.anonymousId, ANON);
  assert.equal(db.sessions.get(READING)?.blogPostId, POST_ID);
  const tampered = await db.send(body({ userId: "conta", activeTimeMs: 1000 }));
  assert.equal(tampered.status, 400);
  assert.equal(db.sessions.get(READING)?.activeTimeMs, 0);
  const email = await db.send(body({ attribution: { utm_source: "pessoa@email.com" }, activeTimeMs: 1000 }));
  assert.equal(email.status, 400);
});

test("reenvio fora de ordem não regride e incremento implausível é recusado", async () => {
  const db = harness();
  assert.equal((await db.send(body())).status, 202);
  assert.equal((await db.send(body({ activeTimeMs: 10_000, maxScrollPercent: 40 }), { now: NOW + 10_000 })).status, 202);
  const stale = await db.send(body({ activeTimeMs: 4_000, maxScrollPercent: 20 }), { now: NOW + 15_000 });
  assert.equal(stale.status, 200);
  assert.equal(db.sessions.get(READING)?.activeTimeMs, 10_000);
  assert.equal(db.sessions.get(READING)?.maxScrollPercent, 40);
  const jump = await db.send(body({ activeTimeMs: 130_000, maxScrollPercent: 45 }), { now: NOW + 15_000 });
  assert.equal(jump.status, 400);
  assert.equal(db.sessions.get(READING)?.activeTimeMs, 10_000);
  const regress = await db.send(body({ activeTimeMs: 20_000, maxScrollPercent: 15 }), { now: NOW + 20_000 });
  assert.equal(regress.status, 409);
  assert.equal(db.sessions.get(READING)?.maxScrollPercent, 40);
});

test("retorno após 30 minutos encerra a sessão e não cria outra", async () => {
  const db = harness();
  assert.equal((await db.send(body())).status, 202);
  assert.equal((await db.send(body({ activeTimeMs: 5_000, maxScrollPercent: 30 }), { now: NOW + 5_000 })).status, 202);
  const late = await db.send(body({ activeTimeMs: 8_000, maxScrollPercent: 40 }), { now: NOW + 5_000 + BLOG_READING_IDLE_MS });
  assert.equal(late.status, 409);
  assert.equal(db.sessions.size, 1);
  assert.equal(db.sessions.get(READING)?.activeTimeMs, 5_000);
  assert.ok(db.sessions.get(READING)?.endedAt);
  const retry = await db.send(body({ clientReadingId: READING, activeTimeMs: 9_000 }), { now: NOW + 5_000 + BLOG_READING_IDLE_MS + 1_000 });
  assert.equal(retry.status, 409);
  assert.equal(db.sessions.size, 1);
});

test("abas diferentes criam sessões diferentes e a mesma aba troca de artigo sem fundir", async () => {
  const db = harness();
  assert.equal((await db.send(body())).status, 202);
  assert.equal((await db.send(body({ clientReadingId: OTHER_READING, sessionId: OTHER_TAB }))).status, 202);
  assert.equal(db.sessions.size, 2);
  assert.equal((await db.send(body({ clientReadingId: "55555555-5555-4555-8555-555555555555", blogPostId: OTHER_POST_ID }))).status, 202);
  assert.equal(db.sessions.size, 3);
  assert.equal(db.sessions.get(READING)?.blogPostId, POST_ID);
});

test("clique comercial duplicado não multiplica e não atravessa sessão", async () => {
  const db = harness();
  const click = { eventId: CLICK, ctaName: "traffic_course", destinationType: "course", targetPath: "/cursos/trafego" };
  assert.equal((await db.send(body({ click }))).status, 202);
  assert.equal((await db.send(body({ click, activeTimeMs: 1000, maxScrollPercent: 10 }), { now: NOW + 1000 })).status, 202);
  assert.equal(db.clicks.size, 1);
  const other = harness();
  assert.equal((await other.send(body({ click }))).status, 202);
  const crossed = await other.send(body({ clientReadingId: OTHER_READING, sessionId: OTHER_TAB, click }));
  assert.equal(crossed.status, 409);
  assert.equal(other.sessions.has(OTHER_READING), false);
  assert.equal(other.clicks.size, 1);
  assert.equal((await db.send(body({ click: { ...click, eventId: OTHER_CLICK, destinationType: "service", ctaName: "traffic_service" }, activeTimeMs: 2000, maxScrollPercent: 10 }), { now: NOW + 2000 })).status, 202);
  assert.equal(db.clicks.size, 2);
});

test("encerramento explícito impede atualização posterior", async () => {
  const db = harness();
  assert.equal((await db.send(body())).status, 202);
  assert.equal((await db.send(body({ activeTimeMs: 30_000, maxScrollPercent: 80, reachedEnd: true, ended: true }), { now: NOW + 30_000 })).status, 202);
  assert.ok(db.sessions.get(READING)?.endedAt);
  assert.ok(db.sessions.get(READING)?.reachedEndAt);
  const after = await db.send(body({ activeTimeMs: 40_000, maxScrollPercent: 90 }), { now: NOW + 35_000 });
  assert.equal(after.status, 409);
  assert.equal(db.sessions.get(READING)?.activeTimeMs, 30_000);
});

test("limites de corpo e de frequência recusam sem avançar a sessão", async () => {
  const limited = harness({ identityLimit: 2 });
  assert.equal((await limited.send(body())).status, 202);
  const duplicate = await limited.send(body());
  assert.equal(duplicate.status, 200);
  assert.equal(limited.identityHits, 2);
  const blocked = await limited.send(body({ activeTimeMs: 1000 }), { now: NOW + 1000 });
  assert.equal(blocked.status, 429);
  assert.equal(limited.sessions.get(READING)?.activeTimeMs, 0);
  const abuse = harness({ abuseLimit: 1 });
  assert.equal((await abuse.send(body())).status, 202);
  const abused = await abuse.send(body());
  assert.equal(abused.status, 429);
  const huge = harness();
  const oversized = await huge.send("x".repeat(BLOG_READING_MAX_BODY_BYTES + 1));
  assert.equal(oversized.status, 413);
  assert.equal(huge.sessions.size, 0);
});

test("expurgo remove sessão vencida e o clique, e conserva o corte exato", async () => {
  const now = new Date("2026-11-05T15:00:00.000Z");
  const cutoff = blogReadingRetentionCutoff(now);
  const oldStart = new Date(cutoff.getTime() - 1);
  const sessions = [
    { id: "old", startedAt: oldStart },
    { id: "edge", startedAt: cutoff },
    { id: "fresh", startedAt: now },
  ];
  const clicks = [
    { id: "click-old", readingSessionId: "old" },
    { id: "click-fresh", readingSessionId: "fresh" },
  ];
  const report = await runBlogReadingRetention({
    now,
    execute: true,
    repository: {
      async countExpired(limit) {
        return sessions.filter((session) => session.startedAt < limit).length;
      },
      async deleteBatch(limit, size) {
        const ids = sessions.filter((session) => session.startedAt < limit).slice(0, size).map((session) => session.id);
        const idSet = new Set(ids);
        const removedClicks = clicks.filter((click) => idSet.has(click.readingSessionId)).length;
        for (let index = clicks.length - 1; index >= 0; index -= 1) {
          const click = clicks[index];
          if (click && idSet.has(click.readingSessionId)) clicks.splice(index, 1);
        }
        for (let index = sessions.length - 1; index >= 0; index -= 1) {
          const session = sessions[index];
          if (session && idSet.has(session.id)) sessions.splice(index, 1);
        }
        return { sessions: ids.length, clicks: removedClicks, fetched: ids.length };
      },
    },
  });
  assert.equal(report.mode, "EXECUTE");
  assert.equal(report.expiredCount, 1);
  assert.equal(report.deletedSessions, 1);
  assert.equal(report.deletedClicks, 1);
  assert.deepEqual(sessions.map((session) => session.id), ["edge", "fresh"]);
  assert.deepEqual(clicks.map((click) => click.id), ["click-fresh"]);
  assert.equal(JSON.stringify(report).includes(ANON), false);
  const cron = await handleBlogReadingRetentionCron(new Request("https://alexandrefeio.com.br/api/cron/blog-reading-retention", { headers: { authorization: "Bearer cron-secret" } }), {
    secret: "cron-secret",
    run: async () => report,
  });
  assert.equal(cron.status, 200);
  const cronBody = await cron.json();
  assert.equal(cronBody.deletedSessions, 1);
  assert.equal(JSON.stringify(cronBody).includes(ANON), false);
});

test("conflito de versão preserva a gravação mais recente e o retry reavalia", async () => {
  const gate: { run: (() => BlogReadingCommitResult) | null } = { run: null };
  const db = harness({ arm: () => gate.run?.() ?? null });
  assert.equal((await db.send(body())).status, 202);
  gate.run = () => {
    gate.run = null;
    const current = db.sessions.get(READING);
    if (!current) return "stale";
    db.sessions.set(READING, { ...current, activeTimeMs: 4_000, maxScrollPercent: 50, recordVersion: current.recordVersion + 1, lastActivityAt: new Date(NOW + 4_000) });
    return "stale";
  };
  const older = await db.send(body({ activeTimeMs: 2_000, maxScrollPercent: 20 }), { now: NOW + 5_000 });
  assert.equal(older.status, 200);
  assert.equal(db.sessions.get(READING)?.activeTimeMs, 4_000);
  assert.equal(db.sessions.get(READING)?.maxScrollPercent, 50);
  assert.equal(db.sessions.get(READING)?.recordVersion, 1);

  gate.run = () => {
    gate.run = null;
    const current = db.sessions.get(READING);
    if (!current) return "stale";
    db.sessions.set(READING, { ...current, activeTimeMs: 5_000, maxScrollPercent: 55, recordVersion: current.recordVersion + 1, lastActivityAt: new Date(NOW + 5_000) });
    return "stale";
  };
  const newer = await db.send(body({ activeTimeMs: 8_000, maxScrollPercent: 70 }), { now: NOW + 8_000 });
  assert.equal(newer.status, 202);
  assert.equal(db.sessions.get(READING)?.activeTimeMs, 8_000);
  assert.equal(db.sessions.get(READING)?.maxScrollPercent, 70);
  assert.equal(db.sessions.get(READING)?.recordVersion, 3);
});

test("encerramento por inatividade não apaga atualização que chegou antes", async () => {
  const gate: { run: (() => BlogReadingCommitResult) | null } = { run: null };
  const db = harness({ arm: () => gate.run?.() ?? null });
  assert.equal((await db.send(body())).status, 202);
  gate.run = () => {
    gate.run = null;
    const current = db.sessions.get(READING);
    if (!current) return "stale";
    db.sessions.set(READING, { ...current, activeTimeMs: 3_000, maxScrollPercent: 20, recordVersion: current.recordVersion + 1, lastActivityAt: new Date(NOW + BLOG_READING_IDLE_MS) });
    return "stale";
  };
  const late = await db.send(body({ activeTimeMs: 1_000, maxScrollPercent: 10 }), { now: NOW + BLOG_READING_IDLE_MS });
  assert.equal(late.status, 200);
  assert.equal(db.sessions.get(READING)?.endedAt ?? null, null);
  assert.equal(db.sessions.get(READING)?.activeTimeMs, 3_000);
});

test("clique repetido, falha parcial e expurgo não duplicam nem recriam a sessão", async () => {
  const raced = harness({ blindClicks: 2 });
  const click = { eventId: CLICK, ctaName: "traffic_course", destinationType: "course", targetPath: "/cursos/trafego" };
  assert.equal((await raced.send(body({ click }))).status, 202);
  assert.equal((await raced.send(body({ click, activeTimeMs: 1_000, maxScrollPercent: 10 }), { now: NOW + 1_000 })).status, 202);
  assert.equal(raced.clicks.size, 1);
  assert.equal(raced.sessions.get(READING)?.activeTimeMs, 1_000);

  const partial = harness({ failClicks: 1 });
  assert.equal((await partial.send(body({ click }))).status, 202);
  assert.equal(partial.clicks.size, 1);
  assert.equal((await partial.send(body({ click }))).status, 200);
  assert.equal(partial.clicks.size, 1);
  assert.equal(partial.sessions.size, 1);

  const purged = harness();
  assert.equal((await purged.send(body())).status, 202);
  purged.sessions.delete(READING);
  const after = await purged.send(body({ activeTimeMs: 5_000, maxScrollPercent: 25 }), { now: NOW + 5_000 });
  assert.equal(after.status, 400);
  assert.equal(purged.sessions.size, 0);
});

test("expurgo anda em lotes e não inclui o instante exato do corte", async () => {
  const now = new Date("2026-11-05T15:00:00.000Z");
  const cutoff = blogReadingRetentionCutoff(now);
  const sessions = [
    ...[1, 2, 3, 4, 5].map((item) => ({ id: `old-${item}`, startedAt: new Date(cutoff.getTime() - item) })),
    { id: "edge", startedAt: cutoff },
  ];
  const clicks = [{ id: "click-old-1", readingSessionId: "old-1" }];
  const sizes: number[] = [];
  const report = await runBlogReadingRetention({
    now,
    execute: true,
    batchSize: 2,
    repository: {
      async countExpired(limit) {
        return sessions.filter((session) => session.startedAt < limit).length;
      },
      async deleteBatch(limit, size) {
        sizes.push(size);
        const ids = sessions.filter((session) => session.startedAt < limit).slice(0, size).map((session) => session.id);
        const idSet = new Set(ids);
        const removedClicks = clicks.filter((click) => idSet.has(click.readingSessionId)).length;
        for (let index = clicks.length - 1; index >= 0; index -= 1) {
          const click = clicks[index];
          if (click && idSet.has(click.readingSessionId)) clicks.splice(index, 1);
        }
        for (let index = sessions.length - 1; index >= 0; index -= 1) {
          const session = sessions[index];
          if (session && idSet.has(session.id)) sessions.splice(index, 1);
        }
        return { sessions: ids.length, clicks: removedClicks, fetched: ids.length };
      },
    },
  });
  assert.deepEqual(sizes, [2, 2, 2]);
  assert.equal(report.deletedSessions, 5);
  assert.equal(report.deletedClicks, 1);
  assert.equal(report.batchesRun, 3);
  assert.equal(report.truncated, false);
  assert.deepEqual(sessions.map((session) => session.id), ["edge"]);
  assert.equal(clicks.length, 0);

  const leftover = [
    ...[1, 2, 3, 4, 5].map((item) => ({ id: `left-${item}`, startedAt: new Date(cutoff.getTime() - item) })),
    { id: "edge-2", startedAt: cutoff },
  ];
  const capped = await runBlogReadingRetention({
    now,
    execute: true,
    batchSize: 2,
    maxBatches: 2,
    repository: {
      async countExpired(limit) {
        return leftover.filter((session) => session.startedAt < limit).length;
      },
      async deleteBatch(limit, size) {
        const ids = leftover.filter((session) => session.startedAt < limit).slice(0, size).map((session) => session.id);
        const idSet = new Set(ids);
        for (let index = leftover.length - 1; index >= 0; index -= 1) {
          const session = leftover[index];
          if (session && idSet.has(session.id)) leftover.splice(index, 1);
        }
        return { sessions: ids.length, clicks: 0, fetched: ids.length };
      },
    },
  });
  assert.equal(capped.deletedSessions, 4);
  assert.equal(capped.batchesRun, 2);
  assert.equal(capped.truncated, true);
  assert.equal(leftover.filter((session) => session.startedAt < cutoff).length, 1);
});

test("métricas derivadas e identidade editorial ficam separadas da jornada", () => {
  assert.equal(isEngagedBlogReading({ activeTimeMs: 29_999, maxScrollPercent: 50 }), false);
  assert.equal(isEngagedBlogReading({ activeTimeMs: 30_000, maxScrollPercent: 50 }), true);
  assert.equal(isDeepBlogReading({ activeTimeMs: 60_000, maxScrollPercent: 74, reachedEnd: false }), false);
  assert.equal(isDeepBlogReading({ activeTimeMs: 60_000, maxScrollPercent: 75, reachedEnd: false }), true);
  assert.equal(isDeepBlogReading({ activeTimeMs: 60_000, maxScrollPercent: 10, reachedEnd: true }), true);
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const storage = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  });
  const localStore = storage(local);
  const sessionStore = storage(session);
  localStore.setItem(JOURNEY_ANONYMOUS_KEY, "jornada");
  readOrCreateBlogReaderId(localStore, NOW, () => ANON);
  assert.equal(localStore.getItem(JOURNEY_ANONYMOUS_KEY), "jornada");
  assert.match(localStore.getItem(BLOG_READER_KEY) ?? "", new RegExp(ANON));
  sessionStore.setItem(BLOG_SESSION_KEY, TAB);
  sessionStore.setItem(BLOG_READING_INDEX_KEY, "[]");
  clearBlogReadingIdentity(localStore, sessionStore);
  assert.equal(localStore.getItem(BLOG_READER_KEY), null);
  assert.equal(sessionStore.getItem(BLOG_SESSION_KEY), null);
  assert.equal(localStore.getItem(JOURNEY_ANONYMOUS_KEY), "jornada");
  const consent = readFileSync("src/lib/consent-store.ts", "utf8");
  assert.match(consent, /clearBlogReadingIdentity/);
  const privacy = readFileSync("src/app/(public)/privacidade/page.tsx", "utf8");
  assert.match(privacy, /pseudônimo editorial/);
  assert.match(privacy, /não é, por si, um pedido de eliminação/i);
  assert.match(privacy, /12 meses/);
  const route = readFileSync("src/app/api/analytics/blog-reading/route.ts", "utf8");
  assert.match(route, /blogReadingIngestEnabled/);
  assert.equal(route.includes("getSession"), false);
  assert.equal(route.includes("userId"), false);
  const migration = readFileSync("prisma/migrations/20261105033000_add_blog_reading_foundation/migration.sql", "utf8");
  assert.match(migration, /recordVersion/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.equal(migration.includes("engagementLevel"), false);
  assert.equal(migration.toLowerCase().includes("userid"), false);
  assert.equal(migration.toLowerCase().includes("email"), false);
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /model BlogReadingSession/);
  assert.match(schema, /model BlogCommercialClick/);
  assert.equal(schema.includes("engagementLevel"), false);
});
