import assert from "node:assert/strict";
import test from "node:test";
import {
  AiIdempotencyOwnershipError,
  completeAiOperation,
  fingerprintAiParams,
  markAiOperationProviderDispatched,
  reserveAiOperation,
} from "../../src/lib/ai/idempotency";
import { createPrismaAiIdempotencyStore } from "../../src/lib/ai/idempotency-prisma";
import { getPrisma } from "../../src/lib/db/prisma";

/**
 * Atomicidade real + fencing no PostgreSQL **isolado**.
 *
 * Recusa o banco compartilhado de development/production do site.
 * Exige:
 * - SHARED_DATABASE_TEST_CONFIRM=true
 * - ISOLATED_AI_IDEMPOTENCY_TEST=1
 * - ISOLATED_AI_IDEMPOTENCY_DATABASE_URL (mesmo host/db que RUNTIME_DATABASE_URL da sessão)
 * - DATABASE_ENV=test
 *
 * Não imprime credenciais. Não aplica schema em Production.
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

  // Heurística: nomes típicos do projeto compartilhado não são aceitos como isolados.
  if (isolatedId.dbName === "postgres" && isolatedId.hostSuffix.includes("prisma.io")) {
    assert.fail("Recusando host Prisma compartilhado aparente. Use um Postgres isolado dedicado.");
  }

  console.info("[ai-idempotency-live]", {
    databaseEnv: process.env.DATABASE_ENV,
    hostSuffix: runtimeId.hostSuffix,
    dbName: runtimeId.dbName,
  });
}

test("2) concorrência PostgreSQL: uma autorização e fencing impede despacho/finalização antiga", async () => {
  assertIsolatedTarget();

  const prisma = getPrisma();
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    assert.fail("Banco isolado sem usuário seed.");
  }

  const store = createPrismaAiIdempotencyStore();
  const idempotencyKey = `live-burst-${Date.now()}`;
  const fingerprintHash = fingerprintAiParams({ live: true, key: idempotencyKey });
  const now = new Date();

  const first = await reserveAiOperation({
    userId: user.id,
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
  const results = await Promise.all(Array.from({ length: 50 }, () => reserveAiOperation({
    userId: user.id,
    featureKey: "landing_page_copy",
    idempotencyKey,
    fingerprintHash,
    store,
    now: later,
    ttlMs: 120_000,
  })));

  const authorized = results.filter((row) => row.kind === "authorized");
  assert.equal(authorized.length, 1);
  const winner = authorized[0];
  if (!winner || winner.kind !== "authorized") return;
  assert.equal(winner.reservation.generation, stale.generation + 1);

  await assert.rejects(
    () => markAiOperationProviderDispatched(store, stale, later),
    (error: unknown) => error instanceof AiIdempotencyOwnershipError,
  );
  const staleComplete = await completeAiOperation(store, stale, later);
  assert.equal(staleComplete, null);

  const dispatched = await markAiOperationProviderDispatched(store, winner.reservation, later);
  assert.equal(dispatched.providerDispatched, true);
  const completed = await completeAiOperation(store, winner.reservation, later);
  assert.ok(completed);
  assert.equal(completed.status, "COMPLETED");

  await prisma.$executeRaw`
    DELETE FROM "ai_operation_reservation"
    WHERE "idempotencyKey" = ${idempotencyKey}
  `;
});
