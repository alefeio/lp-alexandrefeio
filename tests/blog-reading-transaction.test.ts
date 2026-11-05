import assert from "node:assert/strict";
import test from "node:test";
import type { BlogReadingCommit, BlogReadingCommitResult } from "../src/lib/blog/reading/ingest";
import type { BlogClickRecord, BlogReadingRecord } from "../src/lib/blog/reading/lifecycle";
import { BlogReadingTxAbort } from "../src/lib/blog/reading/repository";

/**
 * Simulação transacional com commit/rollback explícitos.
 *
 * Não substitui PostgreSQL: não valida isolamento MVCC, locks nem aborto real do
 * motor. Comprova a política do `commit()` (abortar em click alheio; classificar
 * unicidade só após rollback) sem banco isolado neste ambiente.
 */

class SimulatedUniqueViolation extends Error {
  readonly code = "P2002";
  constructor() {
    super("unique");
    this.name = "SimulatedUniqueViolation";
  }
}

type Tables = {
  sessions: Map<string, BlogReadingRecord>;
  clicks: Map<string, BlogClickRecord>;
  byClient: Map<string, string>;
};

function emptyTables(): Tables {
  return { sessions: new Map(), clicks: new Map(), byClient: new Map() };
}

function cloneTables(source: Tables): Tables {
  return {
    sessions: new Map([...source.sessions.entries()].map(([key, value]) => [key, { ...value }])),
    clicks: new Map([...source.clicks.entries()].map(([key, value]) => [key, { ...value }])),
    byClient: new Map(source.byClient),
  };
}

function replaceTables(target: Tables, source: Tables) {
  target.sessions = source.sessions;
  target.clicks = source.clicks;
  target.byClient = source.byClient;
}

function versionMatches(current: BlogReadingRecord, next: BlogReadingRecord): boolean {
  if (current.endedAt) return false;
  if (current.recordVersion !== next.recordVersion - 1) return false;
  if (current.anonymousId !== next.anonymousId || current.sessionId !== next.sessionId || current.blogPostId !== next.blogPostId) return false;
  if (next.activeTimeMs < current.activeTimeMs || next.maxScrollPercent < current.maxScrollPercent) return false;
  if (current.reachedEndAt && next.reachedEndAt === null) return false;
  return true;
}

async function commitWithRollback(db: Tables, input: BlogReadingCommit): Promise<BlogReadingCommitResult> {
  const draft = cloneTables(db);
  try {
    if (input.kind === "create") {
      if (draft.byClient.has(input.session.clientReadingId)) throw new SimulatedUniqueViolation();
      draft.sessions.set(input.session.id, input.session);
      draft.byClient.set(input.session.clientReadingId, input.session.id);
    } else {
      const current = draft.sessions.get(input.session.id);
      if (!current || !versionMatches(current, input.session)) {
        return "stale";
      }
      draft.sessions.set(input.session.id, input.session);
    }
    if (!input.click) {
      replaceTables(db, draft);
      return "applied";
    }
    const currentClick = draft.clicks.get(input.click.eventId);
    if (currentClick) {
      if (currentClick.readingSessionId === input.session.id) {
        replaceTables(db, draft);
        return "applied";
      }
      throw new BlogReadingTxAbort("click-conflict");
    }
    if ([...draft.clicks.values()].some((click) => click.eventId === input.click?.eventId)) {
      throw new SimulatedUniqueViolation();
    }
    draft.clicks.set(input.click.eventId, input.click);
    replaceTables(db, draft);
    return "applied";
  } catch (error) {
    // Rollback: draft descartado. Não há queries no escopo abortado.
    if (error instanceof BlogReadingTxAbort) return error.result;
    if (error instanceof SimulatedUniqueViolation) {
      if (!input.click) return "stale";
      const winner = db.clicks.get(input.click.eventId);
      if (winner?.readingSessionId === input.session.id) return "stale";
      if (winner) return "click-conflict";
      return "stale";
    }
    throw error;
  }
}

function session(partial: Partial<BlogReadingRecord> & Pick<BlogReadingRecord, "id" | "clientReadingId">): BlogReadingRecord {
  const now = new Date("2026-11-05T15:00:00.000Z");
  return {
    blogPostId: "c123456789012345678901234",
    slugObserved: "artigo",
    anonymousId: "22222222-2222-4222-8222-222222222222",
    sessionId: "33333333-3333-4333-8333-333333333333",
    startedAt: now,
    lastActivityAt: now,
    endedAt: null,
    activeTimeMs: 0,
    maxScrollPercent: 0,
    reachedEndAt: null,
    referrerHost: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    schemaVersion: 1,
    recordVersion: 0,
    consentUpdatedAt: now,
    ...partial,
  };
}

function click(partial: Partial<BlogClickRecord> & Pick<BlogClickRecord, "id" | "eventId" | "readingSessionId">): BlogClickRecord {
  return {
    blogPostId: "c123456789012345678901234",
    ctaName: "traffic_course",
    destinationType: "course",
    targetPath: "/cursos/trafego",
    occurredAt: new Date("2026-11-05T15:00:00.000Z"),
    ...partial,
  };
}

test("eventId de outra sessão não altera a sessão atual (rollback)", async () => {
  const db = emptyTables();
  const owner = session({ id: "s-owner", clientReadingId: "cr-owner", recordVersion: 0, activeTimeMs: 0 });
  const rival = session({
    id: "s-rival",
    clientReadingId: "cr-rival",
    anonymousId: "22222222-2222-4222-8222-222222222223",
    sessionId: "33333333-3333-4333-8333-333333333334",
  });
  db.sessions.set(owner.id, owner);
  db.byClient.set(owner.clientReadingId, owner.id);
  db.sessions.set(rival.id, rival);
  db.byClient.set(rival.clientReadingId, rival.id);
  db.clicks.set("evt-shared", click({ id: "c1", eventId: "evt-shared", readingSessionId: rival.id }));

  const result = await commitWithRollback(db, {
    kind: "update",
    session: { ...owner, recordVersion: 1, activeTimeMs: 5_000, maxScrollPercent: 40, lastActivityAt: new Date("2026-11-05T15:00:05.000Z") },
    click: click({ id: "c2", eventId: "evt-shared", readingSessionId: owner.id }),
  });

  assert.equal(result, "click-conflict");
  assert.equal(db.sessions.get(owner.id)?.activeTimeMs, 0);
  assert.equal(db.sessions.get(owner.id)?.recordVersion, 0);
  assert.equal(db.clicks.get("evt-shared")?.readingSessionId, rival.id);
});

test("falha ao inserir clique desfaz a mutação da sessão", async () => {
  const db = emptyTables();
  const open = session({ id: "s1", clientReadingId: "cr1" });
  const created = await commitWithRollback(db, {
    kind: "create",
    session: open,
    click: null,
  });
  assert.equal(created, "applied");

  db.clicks.set("evt-1", click({ id: "foreign", eventId: "evt-1", readingSessionId: "other-session" }));

  const raced = await commitWithRollback(db, {
    kind: "update",
    session: { ...open, recordVersion: 1, activeTimeMs: 2_000, maxScrollPercent: 10, lastActivityAt: new Date("2026-11-05T15:00:02.000Z") },
    click: click({ id: "mine", eventId: "evt-1", readingSessionId: open.id }),
  });
  assert.equal(raced, "click-conflict");
  assert.equal(db.sessions.get(open.id)?.activeTimeMs, 0);
  assert.equal(db.sessions.get(open.id)?.recordVersion, 0);
});

test("dois commits com o mesmo eventId persistem no máximo um clique", async () => {
  const db = emptyTables();
  const a = session({ id: "sa", clientReadingId: "cra", activeTimeMs: 0 });
  const b = session({
    id: "sb",
    clientReadingId: "crb",
    anonymousId: "22222222-2222-4222-8222-222222222223",
    sessionId: "33333333-3333-4333-8333-333333333334",
  });
  assert.equal(await commitWithRollback(db, { kind: "create", session: a, click: null }), "applied");
  assert.equal(await commitWithRollback(db, { kind: "create", session: b, click: null }), "applied");

  const first = await commitWithRollback(db, {
    kind: "update",
    session: { ...a, recordVersion: 1, activeTimeMs: 1_000, maxScrollPercent: 5, lastActivityAt: new Date("2026-11-05T15:00:01.000Z") },
    click: click({ id: "ca", eventId: "evt-dup", readingSessionId: a.id }),
  });
  const second = await commitWithRollback(db, {
    kind: "update",
    session: { ...b, recordVersion: 1, activeTimeMs: 1_000, maxScrollPercent: 5, lastActivityAt: new Date("2026-11-05T15:00:01.000Z") },
    click: click({ id: "cb", eventId: "evt-dup", readingSessionId: b.id }),
  });

  assert.equal(first, "applied");
  assert.equal(second, "click-conflict");
  assert.equal(db.clicks.size, 1);
  assert.equal(db.clicks.get("evt-dup")?.readingSessionId, a.id);
  assert.equal(db.sessions.get(b.id)?.activeTimeMs, 0);
});

test("retry com eventId da mesma sessão é idempotente e preserva progresso", async () => {
  const db = emptyTables();
  const open = session({ id: "s-same", clientReadingId: "cr-same" });
  assert.equal(await commitWithRollback(db, { kind: "create", session: open, click: null }), "applied");

  const once = await commitWithRollback(db, {
    kind: "update",
    session: { ...open, recordVersion: 1, activeTimeMs: 3_000, maxScrollPercent: 20, lastActivityAt: new Date("2026-11-05T15:00:03.000Z") },
    click: click({ id: "c-same", eventId: "evt-same", readingSessionId: open.id }),
  });
  assert.equal(once, "applied");

  const again = await commitWithRollback(db, {
    kind: "update",
    session: {
      ...open,
      recordVersion: 2,
      activeTimeMs: 4_000,
      maxScrollPercent: 25,
      lastActivityAt: new Date("2026-11-05T15:00:04.000Z"),
    },
    click: click({ id: "c-same-2", eventId: "evt-same", readingSessionId: open.id }),
  });
  assert.equal(again, "applied");
  assert.equal(db.clicks.size, 1);
  assert.equal(db.sessions.get(open.id)?.activeTimeMs, 4_000);
  assert.equal(db.sessions.get(open.id)?.recordVersion, 2);
});

test("P2002 classificado após rollback força stale na mesma sessão e não confirma parcial", async () => {
  const db = emptyTables();
  const open = session({ id: "s-p2002", clientReadingId: "cr-p2002", recordVersion: 0, activeTimeMs: 1_000, maxScrollPercent: 10 });
  db.sessions.set(open.id, open);
  db.byClient.set(open.clientReadingId, open.id);
  db.clicks.set("evt-race", click({ id: "already", eventId: "evt-race", readingSessionId: open.id }));

  // Simula corrida: find prévio viu ausência, create do clique estoura unicidade.
  const draftOnly = async (): Promise<BlogReadingCommitResult> => {
    const draft = cloneTables(db);
    try {
      draft.sessions.set(open.id, {
        ...open,
        recordVersion: 1,
        activeTimeMs: 5_000,
        maxScrollPercent: 30,
        lastActivityAt: new Date("2026-11-05T15:00:05.000Z"),
      });
      if (draft.clicks.has("evt-race")) throw new SimulatedUniqueViolation();
      replaceTables(db, draft);
      return "applied";
    } catch (error) {
      if (error instanceof SimulatedUniqueViolation) {
        const winner = db.clicks.get("evt-race");
        if (winner?.readingSessionId === open.id) return "stale";
        if (winner) return "click-conflict";
        return "stale";
      }
      throw error;
    }
  };

  assert.equal(await draftOnly(), "stale");
  assert.equal(db.sessions.get(open.id)?.activeTimeMs, 1_000);
  assert.equal(db.sessions.get(open.id)?.recordVersion, 0);

  const retry = await commitWithRollback(db, {
    kind: "update",
    session: {
      ...open,
      recordVersion: 1,
      activeTimeMs: 5_000,
      maxScrollPercent: 30,
      lastActivityAt: new Date("2026-11-05T15:00:05.000Z"),
    },
    click: click({ id: "ignored", eventId: "evt-race", readingSessionId: open.id }),
  });
  assert.equal(retry, "applied");
  assert.equal(db.sessions.get(open.id)?.activeTimeMs, 5_000);
  assert.equal(db.clicks.size, 1);
});

test("conflito de versão não reabre sessão encerrada", async () => {
  const db = emptyTables();
  const closed = session({
    id: "s-closed",
    clientReadingId: "cr-closed",
    recordVersion: 2,
    activeTimeMs: 9_000,
    endedAt: new Date("2026-11-05T15:10:00.000Z"),
  });
  db.sessions.set(closed.id, closed);
  db.byClient.set(closed.clientReadingId, closed.id);

  const result = await commitWithRollback(db, {
    kind: "update",
    session: {
      ...closed,
      recordVersion: 3,
      activeTimeMs: 10_000,
      endedAt: null,
      lastActivityAt: new Date("2026-11-05T15:10:30.000Z"),
    },
    click: null,
  });
  assert.equal(result, "stale");
  assert.ok(db.sessions.get(closed.id)?.endedAt);
  assert.equal(db.sessions.get(closed.id)?.activeTimeMs, 9_000);
});
