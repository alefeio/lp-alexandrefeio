import assert from "node:assert/strict";
import test from "node:test";
import { readBlogReadingCheckpoint, writeBlogReadingCheckpoint } from "../src/lib/blog/reading/checkpoint";
import type { BlogReadingSendBody, BlogReadingSendResult } from "../src/lib/blog/reading/client";
import {
  BLOG_READING_FLUSH_ACTIVE_MS,
  BLOG_READING_IDLE_MS,
  BLOG_READING_MIN_SEND_GAP_MS,
  BLOG_READING_RATE_LIMIT,
  BLOG_READING_RATE_WINDOW_SECONDS,
  BLOG_READING_RETRY_BACKOFF_MS,
} from "../src/lib/blog/reading/constants";
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
  instantRetry?: boolean;
}) {
  const local = memory();
  const session = memory();
  const clock = options?.now ?? { value: NOW };
  const sent: BlogReadingSendBody[] = [];
  const beacons: BlogReadingSendBody[] = [];
  const scheduled: Array<{ fn: () => void; ms: number }> = [];
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
    schedule: (fn, ms) => {
      if (options?.instantRetry) {
        const handle = setTimeout(fn, 0);
        return { cancel: () => clearTimeout(handle) };
      }
      scheduled.push({ fn, ms });
      return {
        cancel: () => {
          const index = scheduled.findIndex((row) => row.fn === fn);
          if (index >= 0) scheduled.splice(index, 1);
        },
      };
    },
  });
  return {
    runtime,
    local,
    session,
    clock,
    sent,
    beacons,
    scheduled,
    runScheduled() {
      const rows = scheduled.splice(0, scheduled.length);
      for (const row of rows) row.fn();
    },
  };
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
  const { runtime, sent, runScheduled } = harness({
    instantRetry: false,
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
  runScheduled();
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

test("fila cheia com request pendente não remove o item em voo", async () => {
  const gate: { resolve: ((value: BlogReadingSendResult) => void) | null } = { resolve: null };
  const { runtime, sent } = harness({
    send: async (body) => {
      if (!body.click && body.activeTimeMs === 0 && body.maxScrollPercent === 0) {
        return await new Promise<BlogReadingSendResult>((resolve) => {
          gate.resolve = resolve;
        });
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  for (let i = 0; i < 20; i += 1) {
    runtime.noteDepth({ percent: Math.min(100, 25 + i), reachedEnd: false });
  }
  assert.ok(runtime.getQueueSize() <= 8);
  gate.resolve?.({ kind: "ok", status: 202 });
  await flush();
  assert.equal(sent[0]?.activeTimeMs, 0);
  assert.ok(runtime.isOpened());
});

test("dois cliques sobem na fila e não são descartados por updates passivos", async () => {
  const gate: { resolve: ((value: BlogReadingSendResult) => void) | null } = { resolve: null };
  const { runtime, sent } = harness({
    send: async (body) => {
      if (body.activeTimeMs === 0 && !body.click) {
        return await new Promise<BlogReadingSendResult>((resolve) => {
          gate.resolve = resolve;
        });
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  const a = runtime.reportClick({ ctaName: "traffic_course", destinationType: "course", targetPath: "/cursos/a" });
  const b = runtime.reportClick({ ctaName: "traffic_service", destinationType: "service", targetPath: "/cursos/b" });
  for (let i = 0; i < 12; i += 1) runtime.noteDepth({ percent: 40, reachedEnd: false });
  gate.resolve?.({ kind: "ok", status: 202 });
  await flush();
  assert.ok(sent.some((body) => body.click?.eventId === a));
  assert.ok(sent.some((body) => body.click?.eventId === b));
});

test("sessão ociosa por mais de 30 minutos não cria visita fantasma", async () => {
  const { runtime, clock, sent } = harness();
  runtime.start();
  await flush();
  const firstId = runtime.getState()?.clientReadingId;
  const opensBefore = sent.filter((body) => body.activeTimeMs === 0 && !body.click && !body.ended).length;
  clock.value = NOW + BLOG_READING_IDLE_MS;
  runtime.tick();
  await flush();
  assert.equal(runtime.getState()?.sealed, true);
  clock.value = NOW + BLOG_READING_IDLE_MS + 60_000;
  runtime.tick();
  await flush();
  assert.equal(runtime.getState()?.clientReadingId, firstId);
  assert.equal(runtime.getState()?.sealed, true);
  const opensAfter = sent.filter((body) => body.activeTimeMs === 0 && !body.click && !body.ended).length;
  assert.equal(opensAfter, opensBefore);
  assert.equal(opensAfter, 1);
});

test("nova interação após idle abre outro clientReadingId", async () => {
  const { runtime, clock } = harness();
  runtime.start();
  await flush();
  const firstId = runtime.getState()?.clientReadingId;
  clock.value = NOW + BLOG_READING_IDLE_MS;
  runtime.tick();
  await flush();
  assert.equal(runtime.getState()?.sealed, true);
  runtime.noteActivity();
  await flush();
  assert.equal(runtime.getState()?.sealed, false);
  assert.notEqual(runtime.getState()?.clientReadingId, firstId);
  assert.equal(runtime.getState()?.activeTimeMs, 0);
});

test("leitura ativa de 15 minutos respeita cadência sob a cota", async () => {
  const { runtime, clock, sent } = harness();
  runtime.start();
  await flush();
  const windowMs = BLOG_READING_RATE_WINDOW_SECONDS * 1000;
  const sendTimes: number[] = [NOW];
  for (let elapsed = BLOG_READING_FLUSH_ACTIVE_MS; elapsed <= 15 * 60_000; elapsed += BLOG_READING_FLUSH_ACTIVE_MS) {
    clock.value = NOW + elapsed;
    runtime.noteActivity();
    runtime.tick();
    await flush();
    if (sent.length > sendTimes.length) {
      for (let i = sendTimes.length; i < sent.length; i += 1) sendTimes.push(clock.value);
    }
    if (clock.value - sendTimes[sendTimes.length - 1]! < BLOG_READING_MIN_SEND_GAP_MS) {
      clock.value = sendTimes[sendTimes.length - 1]! + BLOG_READING_MIN_SEND_GAP_MS;
      await flush();
      if (sent.length > sendTimes.length) {
        for (let i = sendTimes.length; i < sent.length; i += 1) sendTimes.push(clock.value);
      }
    }
  }
  const nonClick = sent.filter((body) => !body.click);
  let maxInWindow = 0;
  for (let i = 0; i < sendTimes.length; i += 1) {
    const start = sendTimes[i]!;
    let count = 0;
    for (let j = i; j < sendTimes.length; j += 1) {
      if (sendTimes[j]! - start >= windowMs) break;
      count += 1;
    }
    maxInWindow = Math.max(maxInWindow, count);
  }
  assert.ok(maxInWindow <= BLOG_READING_RATE_LIMIT);
  assert.ok(nonClick.length < Math.ceil((15 * 60_000) / 15_000));
  assert.ok(nonClick.length >= 1);
});

test("429 aplica backoff sem loop imediato", async () => {
  let limited = true;
  const { runtime, sent, scheduled, runScheduled } = harness({
    send: async (body) => {
      if (body.click) return { kind: "ok", status: 202 };
      if (limited) {
        limited = false;
        return { kind: "limited", status: 429 };
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  assert.ok(scheduled.length >= 1);
  assert.ok(scheduled[0]!.ms >= 2000);
  const before = sent.length;
  await flush();
  assert.equal(sent.length, before);
  runScheduled();
  await flush();
  assert.ok(runtime.isOpened());
});

test("progresso durante request pendente permanece elegível e só confirma o enviado", async () => {
  const gate: { resolve: ((value: BlogReadingSendResult) => void) | null } = { resolve: null };
  const { runtime, clock } = harness({
    send: async (body) => {
      if (body.activeTimeMs === 0 && body.maxScrollPercent === 0) return { kind: "ok", status: 202 };
      if (body.activeTimeMs > 0 && !gate.resolve) {
        return await new Promise<BlogReadingSendResult>((resolve) => {
          gate.resolve = resolve;
        });
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  clock.value = NOW + BLOG_READING_FLUSH_ACTIVE_MS;
  runtime.noteActivity();
  runtime.tick();
  await flush();
  clock.value = NOW + BLOG_READING_FLUSH_ACTIVE_MS + 5_000;
  runtime.noteActivity();
  runtime.tick();
  assert.equal(runtime.getState()?.activeTimeMs, BLOG_READING_FLUSH_ACTIVE_MS + 5_000);
  gate.resolve?.({ kind: "ok", status: 202 });
  await flush();
  assert.equal(runtime.getConfirmed()?.activeTimeMs, BLOG_READING_FLUSH_ACTIVE_MS);
  assert.equal(runtime.getState()?.activeTimeMs, BLOG_READING_FLUSH_ACTIVE_MS + 5_000);
});

test("abertura reconstruída após falhas de rede volta a zero", async () => {
  let fails = 2;
  const { runtime, sent, runScheduled } = harness({
    send: async (body) => {
      if (body.activeTimeMs === 0 && !body.click && fails > 0) {
        fails -= 1;
        return { kind: "network" };
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  runScheduled();
  await flush();
  runScheduled();
  await flush();
  const opens = sent.filter((body) => body.activeTimeMs === 0 && body.maxScrollPercent === 0 && !body.click);
  assert.ok(opens.length >= 2);
  assert.ok(opens.every((body) => body.activeTimeMs === 0 && body.maxScrollPercent === 0));
  assert.ok(runtime.isOpened());
});

test("429 não dispara segunda tentativa antes do backoff", async () => {
  let limited = true;
  const { runtime, sent, scheduled, runScheduled } = harness({
    send: async () => {
      if (limited) {
        limited = false;
        return { kind: "limited", status: 429 };
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  assert.equal(sent.length, 1);
  assert.equal(scheduled.length, 1);
  assert.ok(scheduled[0]!.ms >= BLOG_READING_RETRY_BACKOFF_MS);
  const before = sent.length;
  runtime.noteActivity();
  runtime.noteDepth({ percent: 25, reachedEnd: false });
  await flush();
  assert.equal(sent.length, before);
  runScheduled();
  await flush();
  assert.ok(sent.length > before);
  assert.ok(runtime.isOpened());
});

test("falha de rede respeita a mesma espera de backoff", async () => {
  let fails = 1;
  const { runtime, sent, scheduled, runScheduled } = harness({
    send: async () => {
      if (fails > 0) {
        fails -= 1;
        return { kind: "network" };
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  assert.equal(sent.length, 1);
  assert.equal(scheduled.length, 1);
  assert.ok(scheduled[0]!.ms >= BLOG_READING_RETRY_BACKOFF_MS);
  const before = sent.length;
  await flush();
  assert.equal(sent.length, before);
  runScheduled();
  await flush();
  assert.equal(sent.length, before + 1);
});

test("gap de 20 segundos não provoca loop síncrono", async () => {
  const { runtime, clock, sent, scheduled, runScheduled, session } = harness();
  writeBlogReadingCheckpoint(session, POST, {
    clientReadingId: "11111111-1111-4111-8111-000000000099",
    activeTimeMs: BLOG_READING_FLUSH_ACTIVE_MS,
    maxScrollPercent: 0,
    reachedEnd: false,
    lastActivityAt: NOW,
    opened: false,
  });
  runtime.start();
  await flush();
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.activeTimeMs, 0);
  assert.equal(scheduled.length, 1);
  assert.ok(scheduled[0]!.ms > 0);
  assert.ok(scheduled[0]!.ms <= BLOG_READING_MIN_SEND_GAP_MS);
  const before = sent.length;
  await flush();
  assert.equal(sent.length, before);
  clock.value += scheduled[0]!.ms;
  runScheduled();
  await flush();
  assert.ok(sent.length > before);
  assert.ok(sent.some((body) => body.activeTimeMs >= BLOG_READING_FLUSH_ACTIVE_MS));
});

test("novo enqueue durante backoff não ignora o bloqueio", async () => {
  let limited = true;
  const { runtime, sent, scheduled, runScheduled } = harness({
    send: async (body) => {
      if (body.activeTimeMs === 0 && body.maxScrollPercent === 0 && !body.click) {
        if (limited) {
          limited = false;
          return { kind: "limited", status: 429 };
        }
        return { kind: "ok", status: 202 };
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  assert.equal(sent.length, 1);
  const backoffMs = scheduled[0]!.ms;
  assert.ok(backoffMs >= BLOG_READING_RETRY_BACKOFF_MS);
  runtime.noteDepth({ percent: 50, reachedEnd: false });
  runtime.reportClick({
    ctaName: "traffic_course",
    destinationType: "course",
    targetPath: "/cursos/trafego",
  });
  await flush();
  assert.equal(sent.length, 1);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]!.ms, backoffMs);
  runScheduled();
  await flush();
  assert.ok(sent.length >= 2);
  assert.ok(runtime.isOpened());
});

test("profundidade 50 → clique → profundidade 75 mantém sequência válida", async () => {
  const gate: { resolve: ((value: BlogReadingSendResult) => void) | null } = { resolve: null };
  let openedOnce = false;
  const { runtime, clock, sent } = harness({
    send: async (body) => {
      if (body.activeTimeMs === 0 && body.maxScrollPercent === 0 && !body.click) {
        openedOnce = true;
        return { kind: "ok", status: 202 };
      }
      if (openedOnce && !gate.resolve && !body.click) {
        return await new Promise<BlogReadingSendResult>((resolve) => {
          gate.resolve = resolve;
        });
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  clock.value = NOW + BLOG_READING_FLUSH_ACTIVE_MS;
  runtime.noteActivity();
  runtime.tick();
  await flush();
  assert.equal(typeof gate.resolve, "function");
  runtime.noteDepth({ percent: 50, reachedEnd: false });
  const eventId = runtime.reportClick({
    ctaName: "traffic_course",
    destinationType: "course",
    targetPath: "/cursos/trafego",
  });
  runtime.noteDepth({ percent: 75, reachedEnd: false });
  gate.resolve?.({ kind: "ok", status: 202 });
  await flush();
  const afterInterval = sent.slice(2);
  assert.ok(afterInterval.length >= 2);
  let previousScroll = sent[1]?.maxScrollPercent ?? 0;
  let previousTime = sent[1]?.activeTimeMs ?? 0;
  let clickCount = 0;
  for (const body of afterInterval) {
    assert.ok(body.maxScrollPercent >= previousScroll);
    assert.ok(body.activeTimeMs >= previousTime);
    previousScroll = body.maxScrollPercent;
    previousTime = body.activeTimeMs;
    if (body.click) {
      clickCount += 1;
      assert.equal(body.click.eventId, eventId);
      assert.ok(body.maxScrollPercent >= 50);
    }
  }
  assert.equal(clickCount, 1);
  assert.ok(afterInterval.some((body) => body.maxScrollPercent >= 75));
  assert.ok((runtime.getConfirmed()?.maxScrollPercent ?? 0) >= 50);
});

test("revogação cancela timers pendentes", async () => {
  let limited = true;
  const { runtime, sent, scheduled, runScheduled } = harness({
    send: async () => {
      if (limited) {
        limited = false;
        return { kind: "limited", status: 429 };
      }
      return { kind: "ok", status: 202 };
    },
  });
  runtime.start();
  await flush();
  assert.equal(sent.length, 1);
  assert.equal(scheduled.length, 1);
  runtime.dispose("revoke");
  assert.equal(scheduled.length, 0);
  const before = sent.length;
  runScheduled();
  await flush();
  assert.equal(sent.length, before);
  assert.equal(runtime.getState()?.stopped, true);
});
