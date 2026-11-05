import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBlogReadingPayload,
  clearBlogReadingClientId,
  readBlogReadingClientId,
  rememberBlogReadingClientId,
  resolveBlogReadingIdentities,
  sendBlogReadingUpdate,
} from "../src/lib/blog/reading/client";
import {
  applyObserverActivity,
  applyObserverDepth,
  applyObserverVisibility,
  createBlogReadingObserverState,
  markObserverFlushed,
  measureEditorialDepth,
  renewClientReadingAfterSeal,
  shouldFlushObserver,
  stopBlogReadingObserver,
  tickBlogReadingObserver,
} from "../src/lib/blog/reading/observer-core";
import { BLOG_READING_ACTIVITY_IDLE_MS, BLOG_READING_FLUSH_ACTIVE_MS, BLOG_READING_IDLE_MS } from "../src/lib/blog/reading/constants";
import { clearBlogReadingIdentity, BLOG_READER_KEY, BLOG_SESSION_KEY } from "../src/lib/blog/reading/identity";

const POST = "c123456789012345678901234";
const NOW = Date.parse("2026-11-05T15:00:00.000Z");

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    map,
  };
}

test("consentimento recusado e revogação não mantêm identidade editorial", () => {
  const local = memory();
  const session = memory();
  const ids = resolveBlogReadingIdentities({
    local,
    session,
    blogPostId: POST,
    now: NOW,
    randomUUID: () => "11111111-1111-4111-8111-111111111111",
  });
  assert.equal(ids.clientReadingId, "11111111-1111-4111-8111-111111111111");
  assert.ok(local.getItem(BLOG_READER_KEY));
  clearBlogReadingIdentity(local, session);
  assert.equal(local.getItem(BLOG_READER_KEY), null);
  assert.equal(session.getItem(BLOG_SESSION_KEY), null);
  assert.equal(readBlogReadingClientId(session, POST), null);
});

test("reload reutiliza clientReadingId e artigo diferente abre outra sessão", () => {
  const local = memory();
  const session = memory();
  let n = 0;
  const uuid = () => `11111111-1111-4111-8111-11111111111${n++}`;
  const first = resolveBlogReadingIdentities({ local, session, blogPostId: POST, now: NOW, randomUUID: uuid });
  const reload = resolveBlogReadingIdentities({ local, session, blogPostId: POST, now: NOW + 1000, randomUUID: uuid });
  assert.equal(reload.clientReadingId, first.clientReadingId);
  const other = resolveBlogReadingIdentities({
    local,
    session,
    blogPostId: "c123456789012345678901235",
    now: NOW + 2000,
    randomUUID: uuid,
  });
  assert.notEqual(other.clientReadingId, first.clientReadingId);
});

test("tempo ativo pausa com aba oculta e sem atividade recente", () => {
  let state = createBlogReadingObserverState({ clientReadingId: "11111111-1111-4111-8111-111111111111", blogPostId: POST, now: NOW });
  state = tickBlogReadingObserver(state, NOW + 5_000, { visible: true });
  assert.equal(state.activeTimeMs, 5_000);
  state = applyObserverVisibility(state, NOW + 5_000, false);
  state = tickBlogReadingObserver(state, NOW + 20_000, { visible: false });
  assert.equal(state.activeTimeMs, 5_000);
  state = applyObserverVisibility(state, NOW + 20_000, true);
  state = applyObserverActivity(state, NOW + 20_000);
  state = tickBlogReadingObserver(state, NOW + 20_000 + BLOG_READING_ACTIVITY_IDLE_MS + 1_000, { visible: true });
  assert.equal(state.activeTimeMs, 5_000);
});

test("profundidade usa o corpo editorial e marca final", () => {
  assert.deepEqual(
    measureEditorialDepth({ bodyTop: 100, bodyHeight: 400, viewportTop: 0, viewportHeight: 200 }),
    { percent: 25, reachedEnd: false },
  );
  assert.deepEqual(
    measureEditorialDepth({ bodyTop: 100, bodyHeight: 400, viewportTop: 0, viewportHeight: 500 }),
    { percent: 100, reachedEnd: true },
  );
  let state = createBlogReadingObserverState({ clientReadingId: "11111111-1111-4111-8111-111111111111", blogPostId: POST, now: NOW });
  state = applyObserverDepth(state, { percent: 25, reachedEnd: false });
  assert.equal(shouldFlushObserver(state, "depth"), true);
  state = markObserverFlushed(state);
  state = applyObserverDepth(state, { percent: 20, reachedEnd: false });
  assert.equal(state.maxScrollPercent, 25);
  assert.equal(shouldFlushObserver(state, "depth"), false);
  state = applyObserverDepth(state, { percent: 100, reachedEnd: true });
  assert.equal(state.reachedEnd, true);
  assert.equal(shouldFlushObserver(state, "depth"), true);
});

test("inatividade longa sela e renovação cria novo clientReadingId", () => {
  let state = createBlogReadingObserverState({ clientReadingId: "11111111-1111-4111-8111-111111111111", blogPostId: POST, now: NOW });
  state = applyObserverActivity(state, NOW);
  state = tickBlogReadingObserver(state, NOW + BLOG_READING_IDLE_MS, { visible: true });
  assert.equal(state.sealed, true);
  const renewed = renewClientReadingAfterSeal(state, "22222222-2222-4222-8222-222222222222", NOW + BLOG_READING_IDLE_MS + 1);
  assert.equal(renewed.clientReadingId, "22222222-2222-4222-8222-222222222222");
  assert.equal(renewed.activeTimeMs, 0);
  assert.equal(renewed.sealed, false);
});

test("abertura grava zero e flush consolida tempo acumulado", () => {
  let state = createBlogReadingObserverState({ clientReadingId: "11111111-1111-4111-8111-111111111111", blogPostId: POST, now: NOW });
  assert.equal(shouldFlushObserver(state, "open"), true);
  assert.equal(state.activeTimeMs, 0);
  state = tickBlogReadingObserver(state, NOW + BLOG_READING_FLUSH_ACTIVE_MS, { visible: true });
  assert.equal(shouldFlushObserver(state, "interval"), true);
  state = markObserverFlushed(state);
  assert.equal(shouldFlushObserver(state, "interval"), false);
});

test("payload versionado e clique comercial entram no contrato", () => {
  const body = buildBlogReadingPayload({
    clientReadingId: "11111111-1111-4111-8111-111111111111",
    blogPostId: POST,
    anonymousId: "22222222-2222-4222-8222-222222222222",
    sessionId: "33333333-3333-4333-8333-333333333333",
    activeTimeMs: 0,
    maxScrollPercent: 0,
    reachedEnd: false,
    ended: false,
    consentUpdatedAt: NOW,
    attributionRaw: JSON.stringify({ utm_source: "news", referrer: "https://news.example/x" }),
    click: {
      eventId: "44444444-4444-4444-8444-444444444444",
      ctaName: "traffic_course",
      destinationType: "course",
      targetPath: "/cursos/trafego",
    },
  });
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.analyticsConsent, true);
  assert.equal(body.click?.destinationType, "course");
  assert.equal(body.attribution?.utm_source, "news");
});

test("status HTTP do observador distingue ok, fechado, limite e rede", async () => {
  const body = buildBlogReadingPayload({
    clientReadingId: "11111111-1111-4111-8111-111111111111",
    blogPostId: POST,
    anonymousId: "22222222-2222-4222-8222-222222222222",
    sessionId: "33333333-3333-4333-8333-333333333333",
    activeTimeMs: 0,
    maxScrollPercent: 0,
    reachedEnd: false,
    ended: false,
    consentUpdatedAt: NOW,
  });
  assert.deepEqual(await sendBlogReadingUpdate(body, { fetchImpl: async () => new Response(null, { status: 202 }) }), { kind: "ok", status: 202 });
  assert.deepEqual(await sendBlogReadingUpdate(body, { fetchImpl: async () => new Response(null, { status: 200 }) }), { kind: "ok", status: 200 });
  assert.deepEqual(await sendBlogReadingUpdate(body, { fetchImpl: async () => new Response(null, { status: 409 }) }), { kind: "closed", status: 409 });
  assert.deepEqual(await sendBlogReadingUpdate(body, { fetchImpl: async () => new Response(null, { status: 429 }) }), { kind: "limited", status: 429 });
  assert.deepEqual(await sendBlogReadingUpdate(body, { fetchImpl: async () => new Response(null, { status: 404 }) }), { kind: "disabled", status: 404 });
  assert.deepEqual(await sendBlogReadingUpdate(body, { fetchImpl: async () => { throw new Error("offline"); } }), { kind: "network" });
});

test("parada explícita impede novos ticks e limpa índice ao fechar", () => {
  const session = memory();
  rememberBlogReadingClientId(session, POST, "11111111-1111-4111-8111-111111111111");
  let state = createBlogReadingObserverState({ clientReadingId: "11111111-1111-4111-8111-111111111111", blogPostId: POST, now: NOW });
  state = stopBlogReadingObserver(state);
  const next = tickBlogReadingObserver(state, NOW + 5_000, { visible: true });
  assert.equal(next.activeTimeMs, 0);
  clearBlogReadingClientId(session, POST);
  assert.equal(readBlogReadingClientId(session, POST), null);
});
