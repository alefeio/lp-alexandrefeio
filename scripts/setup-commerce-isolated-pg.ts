/**
 * Sobe Postgres 17 local descartável para QA de comércio e aplica migrations.
 * Não lê nem altera .env.local compartilhado. Não usa credenciais de Production.
 */
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import pg from "pg";
import { fingerprintDatabaseUrl, probeLiveDatabaseIdentity } from "../src/lib/db/urls";

const CONTAINER = "lp-commerce-qa-pg17";
const HOST = "127.0.0.1";
/** 55433 frequentemente ocupada por outros Postgres locais; 55434 é o alvo QA deste repo. */
const PORT = "55434";
const USER = "commerce_qa";
const DATABASE = "commerce_qa";
const IMAGE = "postgres:17";

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true, env });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForReady(url: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("Postgres isolado não ficou pronto a tempo.");
}

async function main() {
  const existing = await run("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER]);
  let password = process.env.COMMERCE_QA_PG_PASSWORD?.trim();

  if (existing === 0) {
    const running = await new Promise<string>((resolve) => {
      const child = spawn("docker", ["inspect", "-f", "{{.State.Running}}", CONTAINER], {
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      child.stdout?.on("data", (chunk) => {
        out += String(chunk);
      });
      child.on("exit", () => resolve(out.trim()));
    });
    if (running !== "true") {
      const startCode = await run("docker", ["start", CONTAINER]);
      if (startCode !== 0) throw new Error("Não foi possível iniciar o container isolado.");
    }
    if (!password) {
      throw new Error(
        "Container já existe. Defina COMMERCE_QA_PG_PASSWORD com a senha usada na criação (não reutilize Production).",
      );
    }
  } else {
    password = password || randomBytes(18).toString("base64url");
    const createCode = await run("docker", [
      "run",
      "-d",
      "--name",
      CONTAINER,
      "-e",
      `POSTGRES_USER=${USER}`,
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-e",
      `POSTGRES_DB=${DATABASE}`,
      "-p",
      `${HOST}:${PORT}:5432`,
      IMAGE,
    ]);
    if (createCode !== 0) throw new Error("Falha ao criar container Postgres 17 isolado.");
  }

  const url = `postgresql://${USER}:${encodeURIComponent(password)}@${HOST}:${PORT}/${DATABASE}`;
  await waitForReady(url);

  const fp = fingerprintDatabaseUrl(url);
  if (!fp || fp.hostClass !== "localhost" || fp.database !== DATABASE) {
    throw new Error("Fingerprint do isolado inválido após subida do container.");
  }

  const live = await probeLiveDatabaseIdentity(url);
  if (live.database !== DATABASE) {
    throw new Error(`Database vivo inesperado: ${live.database}`);
  }

  const envFile = [
    "# Gerado por scripts/setup-commerce-isolated-pg.ts — NÃO copiar para Production",
    "DATABASE_ENV=test",
    "ISOLATED_COMMERCE_DATABASE_TEST=1",
    "SHARED_DATABASE_TEST_CONFIRM=true",
    "MERCADO_PAGO_ENV=test",
    "COMMERCE_ENABLED=true",
    "NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=APP_USR-example-public",
    "MERCADO_PAGO_ACCESS_TOKEN=APP_USR-example-token",
    "MERCADO_PAGO_WEBHOOK_SECRET=example-webhook-secret",
    `ISOLATED_COMMERCE_DATABASE_URL=${url}`,
    `RUNTIME_DATABASE_URL=${url}`,
    `POSTGRES_URL=${url}`,
    `COMMERCE_QA_PG_PASSWORD=${password}`,
    "",
  ].join("\n");
  writeFileSync(".env.commerce-isolated.local", envFile, "utf8");

  const migrateEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_ENV: "test",
    VERCEL_ENV: "",
    POSTGRES_URL: url,
    RUNTIME_DATABASE_URL: url,
    ISOLATED_COMMERCE_DATABASE_URL: url,
    ISOLATED_COMMERCE_DATABASE_TEST: "1",
    UNIT_TEST_ISOLATION: "",
  };
  delete migrateEnv.VERCEL_ENV;
  delete migrateEnv.UNIT_TEST_ISOLATION;

  const migrateCode = await run("npx", ["prisma", "migrate", "deploy"], migrateEnv);
  if (migrateCode !== 0) throw new Error("migrate deploy no isolado falhou.");

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const tables = await client.query<{ relname: string }>(`
    SELECT relname FROM pg_class
    WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
      AND relname IN ('order', 'payment', 'order_item', 'order_item_lesson', 'entitlement', '_prisma_migrations')
    ORDER BY relname
  `);
  const migrations = await client.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM "_prisma_migrations"`);
  await client.end();

  const report = {
    container: CONTAINER,
    image: IMAGE,
    logicalName: DATABASE,
    user: USER,
    host: HOST,
    port: PORT,
    postgresVersion: live.version,
    userFingerprint: fingerprint(USER),
    valueHash12: fp.valueHash12,
    liveDatabase: live.database,
    liveUser: live.dbUser,
    serverAddr: live.serverAddr,
    tables: tables.rows.map((row) => row.relname),
    migrationsApplied: migrations.rows[0]?.c ?? 0,
    envFile: ".env.commerce-isolated.local",
    productionTouched: false,
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
