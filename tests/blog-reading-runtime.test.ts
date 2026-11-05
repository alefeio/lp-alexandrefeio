import assert from "node:assert/strict";
import test from "node:test";
import { readBlogReadingCheckpoint } from "../src/lib/blog/reading/checkpoint";
import type { BlogReadingSendBody, BlogReadingSendResult } from "../src/lib/blog/reading/client";
import { BLOG_READING_IDLE_MS } from "../src/lib/blog/reading/constants";
import { createBlogReadingRuntime } from "../src/lib/blog/reading/runtime";

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
  };
}

function harness(options?: {
  now?: { value: number };
  send?: (body: BlogReadingSendBody) => Promise<BlogReadingSendResult>;
}) {
  const local = memory();
  const session = memory();
  const clock = options?.now ?? { value: NOW };
  const sent: BlogReadingSendBody[] = [];
  const beacons: BlogReadingSendBody[] = [];
  let n = 0;
  const runtime = createBlogReadingRuntime({
    blogPostId: POST,
    local,
    session,
    now: () => clock.value,
    randomUUID: () => `11111111-1111-4111-8111-${String(++n).padStart(12, "0")}`,
    consentUpdatedAt: () => NOW,
    attributionRaw: () => null,
    send: async (body) => {
      sent.push(body);
      if (options?.send) return options.send(body);
      return { kind: "ok", status: 202 };
    },
    beacon: (body) => {
      beacons.push(body);
    },
  });
  return { runtime, local, session, clock, sent, beacons };
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("reload retoma tempo e profundidade sem regredir", async () => {
  const first = harness();
  first.runtime.start();
  await flush();
  first.clock.value = NOW + 5_000;
  first.runtime.noteActivity();
  first.runtime.tick();
  first.runtime.noteDepth({ percent: 50, reachedEnd: false });
  await flush();
  assert.equal(first.runtime.getState()?.activeTimeMs, 5_000);
  assert.equal(first.runtime.getState()?.maxScrollPercent, 50);
  first.runtime.dispose("unmount");

  const second = harness({ now: first.clock });
  // Reusa o mesmo session storage.
  const resumed = createBlogReadingRuntime({
    blogPostId: POST,
    local: first.local,
    session: first.session,
    now: () => first.clock.value,
    randomUUID: () => "22222222-2222-4222-8222-222222222222",
    consentUpdatedAt: () => NOW,
    send: async (body) => {
      second.sent.push(body);
      return { kind: "ok", status: 202 };
    },
    beacon: () => undefined,
  });
  resumed.start();
  await flush();
  assert.equal(resumed.getState()?.activeTimeMs, 5_000);
  assert.equal(resumed.getState()?.maxScrollPercent, 50);
  const checkpoint = readBlogReadingCheckpoint(first.session, POST, first.clock.value);
  assert.equal(checkpoint.kind, "resume");
  if (checkpoint.kind === "resume") {
    assert.equal(checkpoint.checkpoint.activeTimeMs, 5_000);
    assert.equal(checkpoint.checkpoint.maxScrollPercent, 50);
    assert.equal(resumed.getState()?.clientReadingId, checkpoint.checkpoint.clientReadingId);
  }
});

test("duas profundidades rápidas consolidam e abertura precede updates", async () => {
  const gate: { open: boolean } = { open: false };
  const { runtime, sent } = harness({
    send: async (body) => {
      if (body.activeTimeMs === 0 && body.maxScrollPercent === 0) {
        gate.open = true;
        return { kind: "ok", status: 202 };
      }
      if (!gate.open) return { kind: "reject", status: 400 };
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  runtime.noteDepth({ percent: 25, reachedEnd: false });
  runtime.noteDepth({ percent: 50, reachedEnd: false });
  await flush();
  assert.ok(sent.length >= 1);
  assert.equal(sent[0]?.maxScrollPercent, 0);
  assert.ok(runtime.isOpened());
  runtime.noteDepth({ percent: 75, reachedEnd: false });
  await flush();
  assert.ok(sent.some((body) => body.maxScrollPercent >= 50));
});

test("clique antes da abertura confirma espera e preserva eventId", async () => {
  const gate: { resolve: ((value: BlogReadingSendResult) => void) | null } = { resolve: null };
  const { runtime, sent } = harness({
    send: async (body) => {
      if (!body.click) {
        return await new Promise<BlogReadingSendResult>((resolve) => {
          gate.resolve = resolve;
        });
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  const eventId = runtime.reportClick({
    ctaName: "traffic_course",
    destinationType: "course",
    targetPath: "/cursos/trafego",
  });
  await flush();
  assert.equal(sent.filter((body) => body.click).length, 0);
  gate.resolve?.({ kind: "ok", status: 202 });
  await flush();
  const clickPayloads = sent.filter((body) => body.click);
  assert.equal(clickPayloads.length, 1);
  assert.equal(clickPayloads[0]?.click?.eventId, eventId);
});

test("revogação durante request pendente descarta resposta antiga", async () => {
  const gate: { resolve: ((value: BlogReadingSendResult) => void) | null } = { resolve: null };
  const { runtime, session } = harness({
    send: async () =>
      new Promise<BlogReadingSendResult>((resolve) => {
        gate.resolve = resolve;
      }),
  });
  runtime.start();
  await flush();
  const generation = runtime.getGeneration();
  runtime.dispose("revoke");
  gate.resolve?.({ kind: "ok", status: 202 });
  await flush();
  assert.notEqual(runtime.getGeneration(), generation);
  assert.equal(runtime.getState()?.stopped, true);
  assert.equal(readBlogReadingCheckpoint(session, POST, NOW).kind, "fresh");
});

test("resposta antiga após renovação não reativa a sessão anterior", async () => {
  const gate: { resolve: ((value: BlogReadingSendResult) => void) | null } = { resolve: null };
  let calls = 0;
  const { runtime } = harness({
    send: async () => {
      calls += 1;
      if (calls === 1) {
        return new Promise<BlogReadingSendResult>((resolve) => {
          gate.resolve = resolve;
        });
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  const generation = runtime.getGeneration();
  runtime.dispose("revoke");
  gate.resolve?.({ kind: "ok", status: 202 });
  await flush();
  assert.ok(runtime.getGeneration() > generation);
  assert.equal(runtime.getState()?.stopped, true);
});

test("409 sem idle local não renova artificialmente", async () => {
  const { runtime } = harness({
    send: async (body) => {
      if (body.activeTimeMs === 0) return { kind: "ok", status: 202 };
      return { kind: "closed", status: 409 };
    },
  });
  runtime.start();
  await flush();
  const id = runtime.getState()?.clientReadingId;
  runtime.noteDepth({ percent: 25, reachedEnd: false });
  await flush();
  assert.equal(runtime.getState()?.clientReadingId, id);
  assert.equal(runtime.getState()?.sealed, false);
});

test("retorno após 30 minutos inicia nova sessão", async () => {
  const { runtime, session, clock } = harness();
  runtime.start();
  await flush();
  const firstId = runtime.getState()?.clientReadingId;
  runtime.noteDepth({ percent: 30, reachedEnd: false });
  await flush();
  runtime.dispose("unmount");
  clock.value = NOW + BLOG_READING_IDLE_MS + 1_000;
  const again = createBlogReadingRuntime({
    blogPostId: POST,
    local: memory(),
    session,
    now: () => clock.value,
    randomUUID: () => "33333333-3333-4333-8333-333333333333",
    consentUpdatedAt: () => NOW,
    send: async () => ({ kind: "ok", status: 202 }),
    beacon: () => undefined,
  });
  again.start();
  await flush();
  assert.equal(again.getState()?.clientReadingId, "33333333-3333-4333-8333-333333333333");
  assert.notEqual(again.getState()?.clientReadingId, firstId);
  assert.equal(again.getState()?.activeTimeMs, 0);
});

test("falha de rede reutiliza o mesmo eventId no retry", async () => {
  let fails = 1;
  const { runtime, sent } = harness({
    send: async (body) => {
      if (body.click && fails > 0) {
        fails -= 1;
        return { kind: "network" };
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  const eventId = runtime.reportClick({
    ctaName: "traffic_course",
    destinationType: "course",
    targetPath: "/cursos/trafego",
    eventId: "44444444-4444-4444-8444-444444444444",
  });
  await flush();
  // Reprocessa a fila após network.
  runtime.noteActivity();
  runtime.tick();
  await flush();
  const clicks = sent.filter((body) => body.click?.eventId === eventId);
  assert.ok(clicks.length >= 1);
  assert.equal(eventId, "44444444-4444-4444-8444-444444444444");
});

test("dois cliques comerciais na mesma sessão preservam eventIds distintos", async () => {
  const { runtime, sent } = harness();
  runtime.start();
  await flush();
  const a = runtime.reportClick({ ctaName: "traffic_course", destinationType: "course", targetPath: "/cursos/trafego" });
  const b = runtime.reportClick({ ctaName: "traffic_service", destinationType: "service", targetPath: "/trafego-pago" });
  await flush();
  assert.notEqual(a, b);
  assert.ok(sent.some((body) => body.click?.eventId === a));
  assert.ok(sent.some((body) => body.click?.eventId === b));
});

test("checkpoint corrompido é descartado com segurança", () => {
  const session = memory();
  session.setItem("af_blog_reading_index_v1", "{not-json");
  assert.equal(readBlogReadingCheckpoint(session, POST, NOW).kind, "fresh");
  session.setItem("af_blog_reading_index_v1", JSON.stringify({ [POST]: { clientReadingId: "bad" } }));
  assert.equal(readBlogReadingCheckpoint(session, POST, NOW).kind, "fresh");
});
