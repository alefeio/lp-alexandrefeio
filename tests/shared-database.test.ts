import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getPrisma } from "../src/lib/db/prisma";
import { databaseEnvIdentifiesPhysicalDatabase, sharedCatalogWriteAllowed } from "../src/lib/db/urls";
import { planUsedContent } from "../src/lib/learning/content-guard";
import { preserveCommerce } from "../src/lib/learning/catalog-commerce";

const stored = {
  blockKey: "mapa",
  position: 1,
  countsForProgress: true,
  required: true,
  retiredAt: null,
  type: "TEXT",
  payload: { type: "TEXT", body: "texto" },
};

test("DATABASE_ENV não identifica o banco físico e o catálogo exige confirmação", () => {
  assert.equal(databaseEnvIdentifiesPhysicalDatabase(), false);
  assert.equal(preserveCommerce(), true);
  assert.equal(preserveCommerce({ preserveCommerceStatus: false }), false);
  assert.equal(sharedCatalogWriteAllowed({ DATABASE_ENV: "development" }).ok, false);
  assert.equal(sharedCatalogWriteAllowed({ DATABASE_ENV: "development", CATALOG_DEPLOY_CONFIRM: "shared" }).ok, true);
  assert.equal(sharedCatalogWriteAllowed({ DATABASE_ENV: "production" }).ok, false);
  assert.equal(sharedCatalogWriteAllowed({ DATABASE_ENV: "production", CATALOG_DEPLOY_CONFIRM: "production" }).ok, true);
  assert.equal(sharedCatalogWriteAllowed({ VERCEL_ENV: "production", DATABASE_ENV: "development", CATALOG_DEPLOY_CONFIRM: "shared" }).ok, false);
});

test("conteúdo em uso para se um bloco muda e aceita só chave nova", () => {
  const desired = [{ blockKey: "mapa", position: 1, countsForProgress: true, required: true, data: { type: "TEXT" as const, body: "texto" } }];
  assert.equal(planUsedContent([stored], desired, false).kind, "replace");
  assert.equal(planUsedContent([stored], desired, true).kind, "skip");
  const changed = planUsedContent([stored], [{ ...desired[0], data: { type: "TEXT", body: "outro" } }], true);
  assert.equal(changed.kind, "stop");
  const removed = planUsedContent([stored], [], true);
  assert.equal(removed.kind, "stop");
  const appended = planUsedContent(
    [stored],
    [...desired, { blockKey: "novo", position: 2, countsForProgress: false, required: false, data: { type: "TEXT" as const, body: "extra" } }],
    true,
  );
  assert.equal(appended.kind, "append");
  if (appended.kind === "append") assert.deepEqual(appended.keys, ["novo"]);
});

test("a suíte padrão recusa o client do banco compartilhado", () => {
  const previous = process.env.UNIT_TEST_ISOLATION;
  process.env.UNIT_TEST_ISOLATION = "1";
  try {
    assert.throws(() => getPrisma(), /banco compartilhado/);
  } finally {
    if (previous == null) delete process.env.UNIT_TEST_ISOLATION;
    else process.env.UNIT_TEST_ISOLATION = previous;
  }
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  const liveRunner = readFileSync("scripts/run-database-live-tests.ts", "utf8");
  const mercadoPagoRunner = readFileSync("scripts/run-mercado-pago-live-tests.ts", "utf8");
  assert.equal(pkg.scripts.test.includes("database-live"), false);
  assert.equal(pkg.scripts.test.includes("mercado-pago.live"), false);
  assert.match(liveRunner, /SHARED_DATABASE_TEST_CONFIRM !== "true"/);
  assert.match(mercadoPagoRunner, /MP_LIVE_TEST !== "1"/);
  assert.match(mercadoPagoRunner, /MERCADO_PAGO_ENV === "production"/);
  assert.equal(pkg.scripts.build.includes("database-live"), false);
  assert.equal(pkg.scripts.postinstall.includes("database-live"), false);
});
