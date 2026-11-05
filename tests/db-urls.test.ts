import assert from "node:assert/strict";
import test from "node:test";
import { assertMigrationTargetAllowed } from "../src/lib/db/urls";

test("development, preview e test continuam permitidos", () => {
  assert.doesNotThrow(() => assertMigrationTargetAllowed({ DATABASE_ENV: "development" }));
  assert.doesNotThrow(() => assertMigrationTargetAllowed({ DATABASE_ENV: "preview" }));
  assert.doesNotThrow(() => assertMigrationTargetAllowed({ DATABASE_ENV: "test" }));
});

test("runtime Vercel Production permanece bloqueado", () => {
  assert.throws(
    () =>
      assertMigrationTargetAllowed(
        {
          VERCEL_ENV: "production",
          DATABASE_ENV: "production",
          MIGRATE_DEPLOY_CONFIRM: "production",
        },
        ["migrate", "deploy"],
      ),
    /VERCEL_ENV=production/,
  );
});

test("production exige confirmação explícita", () => {
  assert.throws(
    () => assertMigrationTargetAllowed({ DATABASE_ENV: "production" }, ["migrate", "status"]),
    /MIGRATE_DEPLOY_CONFIRM=production/,
  );
});

test("production confirmada aceita somente migrate status e deploy", () => {
  const env = { DATABASE_ENV: "production", MIGRATE_DEPLOY_CONFIRM: "production" };
  assert.doesNotThrow(() => assertMigrationTargetAllowed(env, ["migrate", "status"]));
  assert.doesNotThrow(() => assertMigrationTargetAllowed(env, ["migrate", "deploy"]));
  assert.throws(() => assertMigrationTargetAllowed(env, ["migrate", "dev"]), /migrate status or migrate deploy/);
  assert.throws(() => assertMigrationTargetAllowed(env, ["db", "push"]), /migrate status or migrate deploy/);
  assert.throws(() => assertMigrationTargetAllowed(env, ["migrate"]), /migrate status or migrate deploy/);
});

test("rótulo ausente continua recusado", () => {
  assert.throws(() => assertMigrationTargetAllowed({}), /DATABASE_ENV/);
});
