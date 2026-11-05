import assert from "node:assert/strict";
import test from "node:test";
import { createPrismaBlogReadingStore } from "../../src/lib/blog/reading/repository";
import type { BlogReadingRecord } from "../../src/lib/blog/reading/lifecycle";
import { getPrisma } from "../../src/lib/db/prisma";

/**
 * Atomicidade real no PostgreSQL isolado.
 * Ativar com ISOLATED_BLOG_READING_TEST=1 após aplicar a migration da fundação
 * em um banco dedicado (nunca o de production). Sem a flag, este arquivo é ignorado.
 */

const enabled = process.env.ISOLATED_BLOG_READING_TEST === "1";

function requireIsolated() {
  if (process.env.SHARED_DATABASE_TEST_CONFIRM !== "true") {
    assert.fail("SHARED_DATABASE_TEST_CONFIRM=true é obrigatório.");
  }
  if ((process.env.DATABASE_ENV ?? "").toLowerCase() !== "test") {
    assert.fail("DATABASE_ENV deve ser test.");
  }
  if ((process.env.VERCEL_ENV ?? "").toLowerCase() === "production") {
    assert.fail("VERCEL_ENV=production não pode executar este teste.");
  }
  if (!process.env.RUNTIME_DATABASE_URL?.trim()) {
    assert.fail("RUNTIME_DATABASE_URL do banco isolado é obrigatória.");
  }
}

function baseSession(overrides: Partial<BlogReadingRecord> & Pick<BlogReadingRecord, "id" | "clientReadingId">): BlogReadingRecord {
  const now = new Date();
  return {
    blogPostId: null,
    slugObserved: "live-atomicity",
    anonymousId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
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
    ...overrides,
  };
}

test(
  "PostgreSQL: click-conflict aborta e não confirma progresso parcial da sessão",
  { skip: enabled ? false : "Defina ISOLATED_BLOG_READING_TEST=1 em Postgres isolado com a migration da fundação." },
  async () => {
    requireIsolated();
    const prisma = getPrisma();
    const store = createPrismaBlogReadingStore();
    const ownerId = crypto.randomUUID();
    const rivalId = crypto.randomUUID();
    const ownerClient = crypto.randomUUID();
    const rivalClient = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const owner = baseSession({ id: ownerId, clientReadingId: ownerClient });
    const rival = baseSession({ id: rivalId, clientReadingId: rivalClient, anonymousId: crypto.randomUUID(), sessionId: crypto.randomUUID() });

    try {
      assert.equal(await store.commit({ kind: "create", session: owner, click: null }), "applied");
      assert.equal(await store.commit({ kind: "create", session: rival, click: null }), "applied");
      assert.equal(
        await store.commit({
          kind: "update",
          session: { ...rival, recordVersion: 1, activeTimeMs: 1_000, maxScrollPercent: 10, lastActivityAt: new Date() },
          click: {
            id: crypto.randomUUID(),
            eventId,
            readingSessionId: rivalId,
            blogPostId: null,
            ctaName: "traffic_course",
            destinationType: "course",
            targetPath: "/cursos/trafego",
            occurredAt: new Date(),
          },
        }),
        "applied",
      );

      const conflict = await store.commit({
        kind: "update",
        session: { ...owner, recordVersion: 1, activeTimeMs: 4_000, maxScrollPercent: 40, lastActivityAt: new Date() },
        click: {
          id: crypto.randomUUID(),
          eventId,
          readingSessionId: ownerId,
          blogPostId: null,
          ctaName: "traffic_course",
          destinationType: "course",
          targetPath: "/cursos/trafego",
          occurredAt: new Date(),
        },
      });
      assert.equal(conflict, "click-conflict");

      const persisted = await prisma.blogReadingSession.findUnique({ where: { id: ownerId } });
      assert.equal(persisted?.activeTimeMs, 0);
      assert.equal(persisted?.recordVersion, 0);
      const clicks = await prisma.blogCommercialClick.count({ where: { eventId } });
      assert.equal(clicks, 1);
    } finally {
      await prisma.blogCommercialClick.deleteMany({ where: { eventId } });
      await prisma.blogReadingSession.deleteMany({ where: { id: { in: [ownerId, rivalId] } } });
    }
  },
);
