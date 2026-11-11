/**
 * Migrate deploy autorizado em Production (operador local).
 * Não altera DATABASE_ENV/VERCEL_ENV. Nunca roda no runtime Vercel.
 *
 * Uso (PowerShell):
 *   $env:PRODUCTION_MIGRATE_LOCAL_OPERATOR="1"
 *   $env:PRODUCTION_MIGRATE_CONFIRM="production"
 *   $env:PRODUCTION_MIGRATE_NAME="20261111010000_add_personal_note"
 *   $env:PRODUCTION_MIGRATE_HOST="db.prisma.io"
 *   npx tsx scripts/run-production-migrate.ts --migration 20261111010000_add_personal_note
 *
 * Pré-checagem sem escrita: acrescente --check
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import pg from "pg";
import { assertAuthorizedProductionMigrate, getMigrationDatabaseUrl } from "../src/lib/db/urls";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

function parseArgs(argv: string[]) {
  let migrationName = "";
  let checkOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") {
      checkOnly = true;
      continue;
    }
    if (arg === "--migration") {
      migrationName = argv[i + 1]?.trim() ?? "";
      i += 1;
      continue;
    }
    if (arg.startsWith("--migration=")) {
      migrationName = arg.slice("--migration=".length).trim();
    }
  }
  return { migrationName, checkOnly };
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function localMigrationNames(): string[] {
  return readdirSync(join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

type Preflight = {
  host: string;
  database: string;
  userFingerprint: string;
  dbUser: string;
  serverAddr: string | null;
  lessonNoteCount: number;
  personalNoteExists: boolean;
  pending: string[];
  inProgressOrFailed: string[];
  appliedCount: number;
};

async function readPreflight(connectionString: string): Promise<Preflight> {
  const parsed = new URL(connectionString.replace(/^postgres:\/\//i, "postgresql://"));
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 15000,
    statement_timeout: 20000,
    query_timeout: 20000,
  });
  await client.connect();
  try {
    const identity = await client.query<{
      db: string;
      db_user: string;
      server_addr: string | null;
    }>(`
      SELECT
        current_database() AS db,
        current_user AS db_user,
        inet_server_addr()::text AS server_addr
    `);

    const applied = await client.query<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at ASC
    `);

    const tables = await client.query<{ personal_note_exists: boolean }>(`
      SELECT to_regclass('public.personal_note') IS NOT NULL AS personal_note_exists
    `);

    const notes = await client.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM "lesson_note"`);

    const appliedNames = applied.rows
      .filter((row) => row.finished_at && !row.rolled_back_at)
      .map((row) => row.migration_name);
    const local = localMigrationNames();
    const pending = local.filter((name) => !appliedNames.includes(name));
    const inProgressOrFailed = applied.rows
      .filter((row) => !row.finished_at && !row.rolled_back_at)
      .map((row) => row.migration_name);

    return {
      host: parsed.hostname,
      database: identity.rows[0].db,
      userFingerprint: fingerprint(parsed.username),
      dbUser: identity.rows[0].db_user,
      serverAddr: identity.rows[0].server_addr,
      lessonNoteCount: notes.rows[0].c,
      personalNoteExists: tables.rows[0].personal_note_exists,
      pending,
      inProgressOrFailed,
      appliedCount: appliedNames.length,
    };
  } finally {
    await client.end();
  }
}

async function readPostflight(connectionString: string, migrationName: string) {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 15000,
    statement_timeout: 20000,
    query_timeout: 20000,
  });
  await client.connect();
  try {
    const migration = await client.query<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>(
      `
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = $1
      ORDER BY started_at DESC
      LIMIT 1
    `,
      [migrationName],
    );

    const structure = await client.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'personal_note'
      ORDER BY ordinal_position
    `);

    const indexes = await client.query<{ indexname: string }>(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'personal_note'
      ORDER BY indexname
    `);

    const fks = await client.query<{ constraint_name: string }>(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'personal_note'
        AND constraint_type = 'FOREIGN KEY'
      ORDER BY constraint_name
    `);

    const notes = await client.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM "lesson_note"`);
    const personal = await client.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM "personal_note"`);

    return {
      migration: migration.rows[0] ?? null,
      columns: structure.rows,
      indexes: indexes.rows.map((row) => row.indexname),
      foreignKeys: fks.rows.map((row) => row.constraint_name),
      lessonNoteCount: notes.rows[0].c,
      personalNoteCount: personal.rows[0].c,
    };
  } finally {
    await client.end();
  }
}

function runPrismaMigrateDeploy(): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const { migrationName, checkOnly } = parseArgs(process.argv.slice(2));
  if (!migrationName) {
    console.error("Uso: npx tsx scripts/run-production-migrate.ts --migration <name> [--check]");
    process.exit(1);
  }

  const auth = assertAuthorizedProductionMigrate({ migrationName });
  const connectionString = getMigrationDatabaseUrl();

  console.log(
    JSON.stringify(
      {
        phase: "authorize",
        databaseEnv: auth.databaseEnv,
        migrationName: auth.migrationName,
        host: auth.actualHost,
        checkOnly,
        localOperator: process.env.PRODUCTION_MIGRATE_LOCAL_OPERATOR === "1",
        platformRuntime: Boolean(
          process.env.VERCEL_REGION ||
            process.env.VERCEL_DEPLOYMENT_ID ||
            process.env.AWS_LAMBDA_FUNCTION_NAME,
        ),
      },
      null,
      2,
    ),
  );

  const before = await readPreflight(connectionString);
  console.log(
    JSON.stringify(
      {
        phase: "preflight",
        host: before.host,
        database: before.database,
        userFingerprint: before.userFingerprint,
        dbUser: before.dbUser,
        serverAddr: before.serverAddr,
        appliedCount: before.appliedCount,
        pending: before.pending,
        inProgressOrFailed: before.inProgressOrFailed,
        lessonNoteCount: before.lessonNoteCount,
        personalNoteExists: before.personalNoteExists,
      },
      null,
      2,
    ),
  );

  if (before.host.toLowerCase() !== auth.expectedHost) {
    throw new Error("Abortado: host observado na URL não confere com o autorizado.");
  }

  if (before.inProgressOrFailed.length > 0) {
    throw new Error(
      `Abortado: migration em andamento ou falhada: ${before.inProgressOrFailed.join(", ")}`,
    );
  }

  if (before.pending.length !== 1 || before.pending[0] !== migrationName) {
    throw new Error(
      `Abortado: pendências inesperadas (${before.pending.join(", ") || "nenhuma"}). Esperado somente ${migrationName}.`,
    );
  }

  if (checkOnly) {
    console.log(JSON.stringify({ phase: "check", ok: true, wrote: false }, null, 2));
    return;
  }

  const exitCode = await runPrismaMigrateDeploy();
  if (exitCode !== 0) {
    console.error(
      JSON.stringify(
        {
          phase: "migrate",
          ok: false,
          exitCode,
          note: "Interrompido. Não executar migrate resolve nem DROP sem nova autorização.",
        },
        null,
        2,
      ),
    );
    process.exit(exitCode);
  }

  const after = await readPostflight(connectionString, migrationName);
  console.log(
    JSON.stringify(
      {
        phase: "postflight",
        migration: after.migration
          ? {
              name: after.migration.migration_name,
              finished: Boolean(after.migration.finished_at),
              rolledBack: Boolean(after.migration.rolled_back_at),
            }
          : null,
        personalNoteColumns: after.columns.map((col) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable,
        })),
        indexes: after.indexes,
        foreignKeys: after.foreignKeys,
        counts: {
          lesson_note_before: before.lessonNoteCount,
          lesson_note_after: after.lessonNoteCount,
          personal_note_after: after.personalNoteCount,
        },
      },
      null,
      2,
    ),
  );

  if (!after.migration?.finished_at || after.migration.rolled_back_at) {
    throw new Error("Postflight: migration não registrada como concluída em _prisma_migrations.");
  }
  if (after.lessonNoteCount !== before.lessonNoteCount) {
    throw new Error(
      `Postflight: lesson_note mudou de ${before.lessonNoteCount} para ${after.lessonNoteCount}.`,
    );
  }
  if (after.columns.length === 0) {
    throw new Error("Postflight: tabela personal_note ausente.");
  }

  console.log(JSON.stringify({ phase: "done", ok: true }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "falha";
  console.error(message);
  process.exit(1);
});
