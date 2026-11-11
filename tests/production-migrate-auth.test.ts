import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAuthorizedProductionMigrate,
  assertMigrationTargetAllowed,
  evaluateAuthorizedProductionMigrate,
  readMigrationDatabaseHost,
} from "../src/lib/db/urls";

const baseOk = {
  DATABASE_ENV: "production",
  PRODUCTION_MIGRATE_LOCAL_OPERATOR: "1",
  PRODUCTION_MIGRATE_CONFIRM: "production",
  PRODUCTION_MIGRATE_NAME: "20261111010000_add_personal_note",
  PRODUCTION_MIGRATE_HOST: "db.prisma.io",
  POSTGRES_URL: "postgresql://user:secret@db.prisma.io:5432/postgres",
};

test("assertMigrationTargetAllowed continua bloqueando Production", () => {
  assert.throws(
    () => assertMigrationTargetAllowed({ DATABASE_ENV: "production" }),
    /Refusing to migrate/,
  );
  assert.throws(
    () => assertMigrationTargetAllowed({ VERCEL_ENV: "production", DATABASE_ENV: "development" }),
    /VERCEL_ENV=production/,
  );
});

test("readMigrationDatabaseHost não depende de credenciais no retorno", () => {
  assert.equal(readMigrationDatabaseHost({ POSTGRES_URL: baseOk.POSTGRES_URL }), "db.prisma.io");
  assert.equal(readMigrationDatabaseHost({}), null);
});

test("produção autorizada exige confirmações e host coincidente", () => {
  const ok = evaluateAuthorizedProductionMigrate({
    env: baseOk,
    migrationName: "20261111010000_add_personal_note",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.actualHost, "db.prisma.io");
    assert.equal(ok.migrationName, "20261111010000_add_personal_note");
  }
});

test("VERCEL=1 de env pull local não bloqueia; runtime real sim", () => {
  const localPull = evaluateAuthorizedProductionMigrate({
    env: { ...baseOk, VERCEL: "1", VERCEL_ENV: "production" },
    migrationName: "20261111010000_add_personal_note",
  });
  assert.equal(localPull.ok, true);

  const platform = evaluateAuthorizedProductionMigrate({
    env: { ...baseOk, VERCEL: "1", VERCEL_REGION: "gru1" },
    migrationName: "20261111010000_add_personal_note",
  });
  assert.equal(platform.ok, false);
  if (!platform.ok) assert.match(platform.message, /runtime da plataforma/);
});

test("recusa sem confirmação de operador local", () => {
  const result = evaluateAuthorizedProductionMigrate({
    env: { ...baseOk, PRODUCTION_MIGRATE_LOCAL_OPERATOR: undefined },
    migrationName: "20261111010000_add_personal_note",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /LOCAL_OPERATOR/);
});

test("recusa rótulo não-production sem contornar para development", () => {
  const result = evaluateAuthorizedProductionMigrate({
    env: { ...baseOk, DATABASE_ENV: "development" },
    migrationName: "20261111010000_add_personal_note",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /DATABASE_ENV=production/);
});

test("recusa nome de migration divergente", () => {
  const result = evaluateAuthorizedProductionMigrate({
    env: baseOk,
    migrationName: "20260101000000_other",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /não confere/);
});

test("recusa host físico divergente", () => {
  const result = evaluateAuthorizedProductionMigrate({
    env: {
      ...baseOk,
      POSTGRES_URL: "postgresql://user:secret@elsewhere.example:5432/postgres",
    },
    migrationName: "20261111010000_add_personal_note",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /Host físico/);
});

test("assertAuthorizedProductionMigrate lança na recusa", () => {
  assert.throws(
    () =>
      assertAuthorizedProductionMigrate({
        env: { ...baseOk, PRODUCTION_MIGRATE_CONFIRM: "no" },
        migrationName: "20261111010000_add_personal_note",
      }),
    /PRODUCTION_MIGRATE_CONFIRM/,
  );
});
