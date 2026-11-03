import assert from "node:assert/strict";
import test from "node:test";
import { fingerprintAiParams, reserveAiOperation } from "../../src/lib/ai/idempotency";
import { createPrismaAiIdempotencyStore } from "../../src/lib/ai/idempotency-prisma";
import { getPrisma } from "../../src/lib/db/prisma";

/**
 * Atomicidade real no PostgreSQL.
 * Requer SHARED_DATABASE_TEST_CONFIRM=true e banco NÃO-Production
 * (via npm run test:database-live).
 *
 * Se a migration `ai_operation_reservation` ainda não estiver aplicada
 * neste banco isolado, o teste falha de forma explícita — não usa Production.
 */
test("4) concorrência com PostgreSQL: exatamente uma autorização em 50 paralelas", async () => {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) {
    assert.fail("Banco de teste isolado sem usuário. Não usar Production.");
  }

  const store = createPrismaAiIdempotencyStore();
  const idempotencyKey = `live-burst-${Date.now()}`;
  const fingerprintHash = fingerprintAiParams({ live: true, key: idempotencyKey });

  const results = await Promise.all(Array.from({ length: 50 }, () => reserveAiOperation({
    userId: user.id,
    featureKey: "landing_page_copy",
    idempotencyKey,
    fingerprintHash,
    store,
  })));

  const authorized = results.filter((row) => row.kind === "authorized");
  const inProgress = results.filter((row) => row.kind === "in_progress");
  assert.equal(authorized.length, 1);
  assert.equal(inProgress.length, 49);

  await prisma.$executeRaw`
    DELETE FROM "ai_operation_reservation"
    WHERE "idempotencyKey" = ${idempotencyKey}
  `;
});
