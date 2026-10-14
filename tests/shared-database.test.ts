import assert from "node:assert/strict";
import test from "node:test";
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
