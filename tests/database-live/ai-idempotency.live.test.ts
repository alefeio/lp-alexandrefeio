import assert from "node:assert/strict";
import test from "node:test";
import {
  AiIdempotencyOwnershipError,
  completeAiOperation,
  fingerprintAiParams,
  markAiOperationProviderDispatched,
  reserveAiOperation,
} from "../../src/lib/ai/idempotency";
import { runGuardedAiOperation } from "../../src/lib/ai/idempotency-guard";
import { createPrismaAiIdempotencyStore } from "../../src/lib/ai/idempotency-prisma";
import { getPrisma } from "../../src/lib/db/prisma";

/**
 * Atomicidade real + fencing no PostgreSQL **isolado**.
 *
 * Cenários separados:
 * A) 50 reservas iniciais simultâneas → 1 autorização
 * B) 50 recuperações simultâneas de lease expirado sem despacho → 1 autorização
 *
 * Recusa o banco compartilhado de development/production do site.
 */

function safeDbIdentity(url: string | undefined): { hostSuffix: string; dbName: string } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.hostname.split(".");
    const hostSuffix = parts.slice(-3).join(".") || parsed.hostname;
    const dbName = parsed.pathname.replace(/^\//, "").split("?")[0] || "";
    return { hostSuffix, dbName };
  } catch {
    return null;
  }
}

function assertIsolatedTarget() {
  if (process.env.SHARED_DATABASE_TEST_CONFIRM !== "true") {
    assert.fail("SHARED_DATABASE_TEST_CONFIRM=true é obrigatório.");
  }
  if (process.env.ISOLATED_AI_IDEMPOTENCY_TEST !== "1") {
    assert.fail("ISOLATED_AI_IDEMPOTENCY_TEST=1 é obrigatório para o teste de fencing no Postgres.");
  }
  if ((process.env.DATABASE_ENV ?? "").toLowerCase() !== "test") {
    assert.fail("DATABASE_ENV deve ser test no banco isolado.");
  }
  if ((process.env.VERCEL_ENV ?? "").toLowerCase() === "production") {
    assert.fail("VERCEL_ENV=production não pode executar este teste.");
  }

  const isolated = process.env.ISOLATED_AI_IDEMPOTENCY_DATABASE_URL?.trim();
  const runtime = process.env.RUNTIME_DATABASE_URL?.trim();
  if (!isolated || !runtime) {
    assert.fail("Defina ISOLATED_AI_IDEMPOTENCY_DATABASE_URL e RUNTIME_DATABASE_URL no banco isolado.");
  }

  const isolatedId = safeDbIdentity(isolated);
  const runtimeId = safeDbIdentity(runtime);
  if (!isolatedId || !runtimeId) {
    assert.fail("URLs de banco isolado inválidas.");
  }
  if (isolatedId.hostSuffix !== runtimeId.hostSuffix || isolatedId.dbName !== runtimeId.dbName) {
    assert.fail("RUNTIME_DATABASE_URL deve apontar para o mesmo host/db isolado declarado em ISOLATED_AI_IDEMPOTENCY_DATABASE_URL.");
  }

  if (isolatedId.dbName === "postgres" && isolatedId.hostSuffix.includes("prisma.io")) {
    assert.fail("Recusando host Prisma compartilhado aparente. Use um Postgres isolado dedicado.");
  }

  console.info("[ai-idempotency-live]", {
    databaseEnv: process.env.DATABASE_ENV,
    hostSuffix: runtimeId.hostSuffix,
    dbName: runtimeId.dbName,
  });
}

async function requireTestUser() {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    assert.fail("Banco isolado sem usuário seed sintético.");
  }
  return { prisma, userId: user.id };
}

async function cleanupKey(prisma: ReturnType<typeof getPrisma>, idempotencyKey: string) {
  await prisma.$executeRaw`
    DELETE FROM "ai_operation_reservation"
    WHERE "idempotencyKey" = ${idempotencyKey}
  `;
}

test("A) PostgreSQL: 50 reservas iniciais simultâneas → uma autorização", async () => {
  assertIsolatedTarget();
  const { prisma, userId } = await requireTestUser();
  const store = createPrismaAiIdempotencyStore();
  const idempotencyKey = `live-A-${Date.now()}`;
  const fingerprintHash = fingerprintAiParams({ live: "A", key: idempotencyKey });

  const results = await Promise.all(Array.from({ length: 50 }, () => reserveAiOperation({
    userId,
    featureKey: "landing_page_copy",
    idempotencyKey,
    fingerprintHash,
    store,
  })));

  assert.equal(results.filter((row) => row.kind === "authorized").length, 1);
  assert.equal(results.filter((row) => row.kind === "in_progress").length, 49);

  await cleanupKey(prisma, idempotencyKey);
});

test("B) PostgreSQL: 50 recuperações simultâneas de lease expirado → uma autorização", async () => {
  assertIsolatedTarget();
  const { prisma, userId } = await requireTestUser();
  const store = createPrismaAiIdempotencyStore();
  const idempotencyKey = `live-B-${Date.now()}`;
  const fingerprintHash = fingerprintAiParams({ live: "B", key: idempotencyKey });
  const now = new Date();

  const seed = await reserveAiOperation({
    userId,
    featureKey: "landing_page_copy",
    idempotencyKey,
    fingerprintHash,
    store,
    now,
    ttlMs: 1,
  });
  assert.equal(seed.kind, "authorized");
  if (seed.kind !== "authorized") return;

  const later = new Date(now.getTime() + 5_000);
  const results = await Promise.all(Array.from({ length: 50 }, () => reserveAiOperation({
    userId,
    featureKey: "landing_page_copy",
    idempotencyKey,
    fingerprintHash,
    store,
    now: later,
    ttlMs: 120_000,
  })));

  const authorized = results.filter((row) => row.kind === "authorized");
  assert.equal(authorized.length, 1);
  if (authorized[0]?.kind === "authorized") {
    assert.equal(authorized[0].reservation.generation, seed.reservation.generation + 1);
  }

  await cleanupKey(prisma, idempotencyKey);
});

test("PostgreSQL fencing: despacho/finalização da geração antiga após reclaim", async () => {
  assertIsolatedTarget();
  const { prisma, userId } = await requireTestUser();
  const store = createPrismaAiIdempotencyStore();
  const idempotencyKey = `live-fence-${Date.now()}`;
  const fingerprintHash = fingerprintAiParams({ live: "fence", key: idempotencyKey });
  const now = new Date();

  const first = await reserveAiOperation({
    userId,
    featureKey: "landing_page_copy",
    idempotencyKey,
    fingerprintHash,
    store,
    now,
    ttlMs: 1,
  });
  assert.equal(first.kind, "authorized");
  if (first.kind !== "authorized") return;
  const stale = first.reservation;

  const later = new Date(now.getTime() + 5_000);
  const second = await reserveAiOperation({
    userId,
    featureKey: "landing_page_copy",
    idempotencyKey,
    fingerprintHash,
    store,
    now: later,
    ttlMs: 120_000,
  });
  assert.equal(second.kind, "authorized");
  if (second.kind !== "authorized") return;

  await assert.rejects(
    () => markAiOperationProviderDispatched(store, stale, later),
    (error: unknown) => error instanceof AiIdempotencyOwnershipError,
  );
  assert.equal(await completeAiOperation(store, stale, later), null);

  const dispatched = await markAiOperationProviderDispatched(store, second.reservation, later);
  assert.equal(dispatched.providerDispatched, true);
  const completed = await completeAiOperation(store, second.reservation, later);
  assert.ok(completed);
  assert.equal(completed.status, "COMPLETED");

  await cleanupKey(prisma, idempotencyKey);
});

test("PostgreSQL: despacho tardio após lease expirado sem reclaim prévio", async () => {
  assertIsolatedTarget();
  const { prisma, userId } = await requireTestUser();
  const store = createPrismaAiIdempotencyStore();
  const idempotencyKey = `live-late-${Date.now()}`;
  const fingerprintHash = fingerprintAiParams({ live: "late", key: idempotencyKey });
  const now = new Date();

  const reserved = await reserveAiOperation({
    userId,
    featureKey: "landing_page_copy",
    idempotencyKey,
    fingerprintHash,
    store,
    now,
    ttlMs: 1,
  });
  assert.equal(reserved.kind, "authorized");
  if (reserved.kind !== "authorized") return;

  const later = new Date(now.getTime() + 5_000);
  await assert.rejects(
    () => markAiOperationProviderDispatched(store, reserved.reservation, later),
    (error: unknown) => error instanceof AiIdempotencyOwnershipError,
  );

  await cleanupKey(prisma, idempotencyKey);
});

test("PostgreSQL: resultado incerto bloqueia nova chamada paga", async () => {
  assertIsolatedTarget();
  const { prisma, userId } = await requireTestUser();
  const store = createPrismaAiIdempotencyStore();
  const idempotencyKey = `live-uncertain-${Date.now()}`;
  const fingerprintHash = fingerprintAiParams({ live: "uncertain", key: idempotencyKey });
  let providerCalls = 0;

  const first = await runGuardedAiOperation({
    userId,
    featureKey: "landing_page_copy",
    idempotencyKey,
    fingerprintHash,
    store,
    execute: async ({ confirmDispatch }) => {
      await confirmDispatch();
      providerCalls += 1;
      return { ok: false as const, failureKind: "uncertain" as const, uncertain: true };
    },
  });
  assert.equal(first.ok, false);
  assert.equal(providerCalls, 1);

  const second = await runGuardedAiOperation({
    userId,
    featureKey: "landing_page_copy",
    idempotencyKey,
    fingerprintHash,
    store,
    execute: async ({ confirmDispatch }) => {
      await confirmDispatch();
      providerCalls += 1;
      return { ok: true as const, value: "blocked" };
    },
  });
  assert.equal(second.ok, false);
  assert.equal("block" in second && second.block, "unknown_blocked");
  assert.equal(providerCalls, 1);

  await cleanupKey(prisma, idempotencyKey);
});
