import { createHash } from "node:crypto";

const BUILD_PLACEHOLDER = "postgres://build:build@127.0.0.1:5432/build";

export type DatabaseUrlFingerprint = {
  scheme: string;
  host: string;
  port: string;
  database: string;
  userFingerprint: string;
  valueHash12: string;
  hostClass: "prisma-postgres" | "neon" | "localhost" | "other";
};

/** Identidade física da URL sem expor credenciais. */
export function fingerprintDatabaseUrl(raw: string | undefined): DatabaseUrlFingerprint | null {
  if (!raw?.trim()) return null;
  try {
    const normalized = raw.trim().replace(/^postgres:\/\//i, "postgresql://");
    // prisma+postgres / accelerate não são connection string clássica — ainda assim hasheamos.
    if (!/^postgresql:\/\//i.test(normalized) && !/^postgres:\/\//i.test(raw.trim())) {
      const hostClass = /prisma\.io|accelerate/i.test(raw) ? "prisma-postgres" : "other";
      return {
        scheme: raw.trim().split(":")[0] || "unknown",
        host: "non-postgresql",
        port: "",
        database: "",
        userFingerprint: createHash("sha256").update("").digest("hex").slice(0, 12),
        valueHash12: createHash("sha256").update(raw.trim()).digest("hex").slice(0, 12),
        hostClass,
      };
    }
    const parsed = new URL(normalized);
    const host = (parsed.hostname || "").toLowerCase();
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("?")[0] || "");
    let hostClass: DatabaseUrlFingerprint["hostClass"] = "other";
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") hostClass = "localhost";
    else if (host.includes("prisma.io") || host.includes("db.prisma.io")) hostClass = "prisma-postgres";
    else if (host.includes("neon.tech") || host.includes("neon.")) hostClass = "neon";
    return {
      scheme: parsed.protocol.replace(/:$/, ""),
      host,
      port: parsed.port || "",
      database,
      userFingerprint: createHash("sha256").update(parsed.username || "").digest("hex").slice(0, 12),
      valueHash12: createHash("sha256").update(raw.trim()).digest("hex").slice(0, 12),
      hostClass,
    };
  } catch {
    return null;
  }
}

export type IsolatedCommerceLiveIdentity = {
  host: string;
  port: string;
  database: string;
  hostClass: DatabaseUrlFingerprint["hostClass"];
  userFingerprint: string;
  valueHash12: string;
};

export type IsolatedCommerceLiveResult =
  | { ok: true; identity: IsolatedCommerceLiveIdentity }
  | { ok: false; message: string; code: "blocked" | "misconfigured" };

export type LiveDatabaseProbe = {
  database: string;
  dbUser: string;
  serverAddr: string | null;
  version: string;
};

function samePhysicalTarget(a: DatabaseUrlFingerprint, b: DatabaseUrlFingerprint): boolean {
  return (
    a.host === b.host &&
    a.port === b.port &&
    a.database === b.database &&
    a.userFingerprint === b.userFingerprint
  );
}

/**
 * Gate de database-live de comércio: exige Postgres fisicamente isolado.
 * Recusa Production / host Prisma compartilhado aparente, mesmo com DATABASE_ENV=development.
 * Exige POSTGRES_URL + RUNTIME_DATABASE_URL + ISOLATED_COMMERCE_DATABASE_URL no mesmo alvo.
 */
export function evaluateIsolatedCommerceDatabaseLive(
  env: Record<string, string | undefined> = process.env,
): IsolatedCommerceLiveResult {
  if (env.ISOLATED_COMMERCE_DATABASE_TEST !== "1") {
    return {
      ok: false,
      code: "blocked",
      message:
        "ISOLATED_COMMERCE_DATABASE_TEST=1 é obrigatório. Não execute concorrência comercial no banco compartilhado.",
    };
  }
  if ((env.DATABASE_ENV ?? "").trim().toLowerCase() !== "test") {
    return {
      ok: false,
      code: "misconfigured",
      message: "DATABASE_ENV deve ser test no banco isolado de comércio (não disfarce Production como development).",
    };
  }
  if ((env.VERCEL_ENV ?? "").trim().toLowerCase() === "production") {
    return {
      ok: false,
      code: "blocked",
      message: "VERCEL_ENV=production não pode executar database-live de comércio.",
    };
  }
  if ((env.MERCADO_PAGO_ENV ?? "").trim().toLowerCase() === "production") {
    return {
      ok: false,
      code: "blocked",
      message: "MERCADO_PAGO_ENV=production é recusado nos testes isolados de comércio.",
    };
  }

  const isolated = env.ISOLATED_COMMERCE_DATABASE_URL?.trim();
  const runtime = env.RUNTIME_DATABASE_URL?.trim();
  const postgres = env.POSTGRES_URL?.trim();
  if (!isolated || !runtime || !postgres) {
    return {
      ok: false,
      code: "misconfigured",
      message:
        "Defina ISOLATED_COMMERCE_DATABASE_URL, RUNTIME_DATABASE_URL e POSTGRES_URL apontando ao mesmo Postgres isolado.",
    };
  }

  const isolatedFp = fingerprintDatabaseUrl(isolated);
  const runtimeFp = fingerprintDatabaseUrl(runtime);
  const postgresFp = fingerprintDatabaseUrl(postgres);
  if (!isolatedFp || !runtimeFp || !postgresFp) {
    return { ok: false, code: "misconfigured", message: "URLs do banco isolado de comércio são inválidas." };
  }
  if (isolatedFp.host === "non-postgresql" || runtimeFp.host === "non-postgresql" || postgresFp.host === "non-postgresql") {
    return {
      ok: false,
      code: "blocked",
      message: "URL não-PostgreSQL (ex.: accelerate) não serve como banco isolado de teste.",
    };
  }
  if (!samePhysicalTarget(isolatedFp, runtimeFp) || !samePhysicalTarget(isolatedFp, postgresFp)) {
    return {
      ok: false,
      code: "misconfigured",
      message:
        "ISOLATED_COMMERCE_DATABASE_URL, RUNTIME_DATABASE_URL e POSTGRES_URL devem apontar ao mesmo host/porta/database/usuário isolado.",
    };
  }
  if (isolatedFp.valueHash12 !== runtimeFp.valueHash12 || isolatedFp.valueHash12 !== postgresFp.valueHash12) {
    return {
      ok: false,
      code: "misconfigured",
      message: "As três URLs isoladas devem ser idênticas (mesmo fingerprint de conexão).",
    };
  }

  const productionHost = env.PRODUCTION_MIGRATE_HOST?.trim().toLowerCase();
  if (productionHost && isolatedFp.host === productionHost) {
    return {
      ok: false,
      code: "blocked",
      message: "Host coincide com PRODUCTION_MIGRATE_HOST — recusando banco de Production.",
    };
  }
  if (isolatedFp.hostClass === "prisma-postgres") {
    return {
      ok: false,
      code: "blocked",
      message: "Recusando host Prisma (db.prisma.io). Use Postgres isolado dedicado.",
    };
  }
  if (isolatedFp.hostClass !== "localhost") {
    return {
      ok: false,
      code: "blocked",
      message: "Nesta etapa o Postgres isolado de comércio deve ser local (127.0.0.1/localhost).",
    };
  }
  if (isolatedFp.database === "postgres" || isolatedFp.database === "") {
    return {
      ok: false,
      code: "blocked",
      message: "Use um database exclusivo de QA (não o database padrão 'postgres').",
    };
  }

  return {
    ok: true,
    identity: {
      host: isolatedFp.host,
      port: isolatedFp.port || "5432",
      database: isolatedFp.database,
      hostClass: isolatedFp.hostClass,
      userFingerprint: isolatedFp.userFingerprint,
      valueHash12: isolatedFp.valueHash12,
    },
  };
}

export function assertIsolatedCommerceDatabaseLive(
  env: Record<string, string | undefined> = process.env,
): IsolatedCommerceLiveResult & { ok: true } {
  const result = evaluateIsolatedCommerceDatabaseLive(env);
  if (!result.ok) throw new Error(result.message);
  return result;
}

/** Consulta identidade real da conexão (não confia só em hash de URL). */
export async function probeLiveDatabaseIdentity(connectionString: string): Promise<LiveDatabaseProbe> {
  const { Client } = await import("pg");
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    const result = await client.query<{
      database: string;
      db_user: string;
      server_addr: string | null;
      version: string;
    }>(`
      SELECT
        current_database() AS database,
        current_user AS db_user,
        inet_server_addr()::text AS server_addr,
        split_part(version(), ' ', 2) AS version
    `);
    const row = result.rows[0];
    if (!row) throw new Error("Probe de identidade do banco não retornou linhas.");
    return {
      database: row.database,
      dbUser: row.db_user,
      serverAddr: row.server_addr,
      version: row.version,
    };
  } finally {
    await client.end();
  }
}

/**
 * Confere URL declarada × identidade viva da sessão Postgres.
 * Falha imediatamente se parecer Production ou divergir do database esperado.
 */
export async function assertIsolatedCommerceLiveConnection(
  env: Record<string, string | undefined> = process.env,
): Promise<{ declared: IsolatedCommerceLiveIdentity; live: LiveDatabaseProbe }> {
  const declared = assertIsolatedCommerceDatabaseLive(env);
  const url = env.ISOLATED_COMMERCE_DATABASE_URL?.trim();
  if (!url) throw new Error("ISOLATED_COMMERCE_DATABASE_URL ausente no probe.");

  const live = await probeLiveDatabaseIdentity(url);
  if (live.database !== declared.identity.database) {
    throw new Error(
      `Database vivo '${live.database}' diverge do declarado '${declared.identity.database}'.`,
    );
  }
  if (live.database === "postgres") {
    throw new Error("Conexão viva no database 'postgres' — recusado para QA isolado.");
  }
  if (live.serverAddr && !["127.0.0.1", "::1", "0.0.0.0"].includes(live.serverAddr)) {
    // Em Docker Desktop no Windows, inet_server_addr pode ser o IP da bridge; host da URL já foi validado como localhost.
    const host = declared.identity.host;
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
      throw new Error(`server_addr=${live.serverAddr} não é local — possível Production.`);
    }
  }
  const productionHost = env.PRODUCTION_MIGRATE_HOST?.trim().toLowerCase();
  if (productionHost && declared.identity.host === productionHost) {
    throw new Error("Probe recusou host de Production.");
  }
  return { declared: declared.identity, live };
}

/**
 * Runtime da aplicação. Somente a URL pooled.
 * DATABASE_URL fica no ambiente, mas não entra aqui, para não usar a conexão direta no serverless.
 */
export function getRuntimeDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const url = env.RUNTIME_DATABASE_URL?.trim();
  if (url) return url;

  if (env.NEXT_PHASE === "phase-production-build") {
    return BUILD_PLACEHOLDER;
  }

  throw new Error("RUNTIME_DATABASE_URL is not set");
}

/**
 * Migrations e CLI. Somente a conexão direta.
 * PRISMA_DATABASE_URL não entra neste caminho.
 */
export function getMigrationDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const url = env.POSTGRES_URL?.trim();
  if (url) return url;

  const command = process.argv.join(" ");
  if (command.includes("generate")) {
    return BUILD_PLACEHOLDER;
  }

  throw new Error("POSTGRES_URL is not set");
}

/**
 * DATABASE_ENV é o rótulo do runtime da aplicação.
 * Não identifica o banco físico: development e production podem usar o mesmo Postgres.
 */
export function databaseEnvIdentifiesPhysicalDatabase(): boolean {
  return false;
}

export function readDatabaseEnvLabel(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const explicit = env.DATABASE_ENV?.trim().toLowerCase();
  if (explicit) return explicit;

  const vercel = env.VERCEL_ENV?.trim().toLowerCase();
  if (vercel === "preview" || vercel === "development" || vercel === "production") {
    return vercel;
  }

  return undefined;
}

/**
 * Impede migrate deploy dentro do runtime da Vercel.
 * DATABASE_ENV=development não significa banco descartável: a migration altera o schema compartilhado.
 * Production usa `assertAuthorizedProductionMigrate` + `scripts/run-production-migrate.ts`.
 */
export function assertMigrationTargetAllowed(
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.VERCEL_ENV === "production") {
    throw new Error("Refusing to migrate while VERCEL_ENV=production");
  }

  const label = readDatabaseEnvLabel(env);
  if (label === "development" || label === "preview" || label === "test") {
    return;
  }

  throw new Error("Refusing to migrate without DATABASE_ENV=development, preview, or test");
}

/** Host da URL de migration, sem expor credenciais. */
export function readMigrationDatabaseHost(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env.POSTGRES_URL?.trim();
  if (!raw) return null;
  try {
    const normalized = raw.replace(/^postgres:\/\//i, "postgresql://");
    return new URL(normalized).hostname || null;
  } catch {
    return null;
  }
}

export type AuthorizedProductionMigrateInput = {
  env?: Record<string, string | undefined>;
  /** Nome exato da pasta/migration autorizada (única permitida nesta execução). */
  migrationName: string;
};

export type AuthorizedProductionMigrateResult =
  | {
      ok: true;
      databaseEnv: "production";
      migrationName: string;
      expectedHost: string;
      actualHost: string;
    }
  | { ok: false; message: string };

function isVercelPlatformRuntime(env: Record<string, string | undefined>): boolean {
  // VERCEL=1 aparece no `vercel env pull` local; região/deployment id só existem no runtime.
  return Boolean(
    env.VERCEL_REGION?.trim() ||
      env.VERCEL_DEPLOYMENT_ID?.trim() ||
      env.AWS_LAMBDA_FUNCTION_NAME?.trim(),
  );
}

/**
 * Modo explícito para migrate em Production por operador local.
 * Preserva DATABASE_ENV/VERCEL_ENV reais; não substitui rótulos por development/preview.
 * Nunca autoriza execução no runtime da plataforma Vercel.
 */
export function evaluateAuthorizedProductionMigrate(
  input: AuthorizedProductionMigrateInput,
): AuthorizedProductionMigrateResult {
  const env = input.env ?? process.env;
  const migrationName = input.migrationName.trim();

  if (!migrationName) {
    return { ok: false, message: "migrationName é obrigatório." };
  }

  if (isVercelPlatformRuntime(env)) {
    return {
      ok: false,
      message: "Migrate de Production recusado no runtime da plataforma Vercel.",
    };
  }

  if (env.PRODUCTION_MIGRATE_LOCAL_OPERATOR?.trim() !== "1") {
    return {
      ok: false,
      message: "Exige PRODUCTION_MIGRATE_LOCAL_OPERATOR=1 (somente operador local).",
    };
  }

  const databaseEnv = env.DATABASE_ENV?.trim().toLowerCase();
  if (databaseEnv !== "production") {
    return {
      ok: false,
      message: "Migrate autorizado de Production exige DATABASE_ENV=production (rótulo real).",
    };
  }

  if (env.PRODUCTION_MIGRATE_CONFIRM?.trim() !== "production") {
    return {
      ok: false,
      message: "Confirme com PRODUCTION_MIGRATE_CONFIRM=production.",
    };
  }

  const confirmedName = env.PRODUCTION_MIGRATE_NAME?.trim();
  if (!confirmedName) {
    return { ok: false, message: "Defina PRODUCTION_MIGRATE_NAME com a migration exata." };
  }
  if (confirmedName !== migrationName) {
    return {
      ok: false,
      message: "PRODUCTION_MIGRATE_NAME não confere com a migration solicitada.",
    };
  }

  const expectedHost = env.PRODUCTION_MIGRATE_HOST?.trim().toLowerCase();
  if (!expectedHost) {
    return {
      ok: false,
      message: "Defina PRODUCTION_MIGRATE_HOST com o host físico esperado (ex.: db.prisma.io).",
    };
  }

  const actualHost = readMigrationDatabaseHost(env)?.toLowerCase() ?? null;
  if (!actualHost) {
    return { ok: false, message: "POSTGRES_URL ausente ou inválida para conferência de host." };
  }
  if (actualHost !== expectedHost) {
    return {
      ok: false,
      message: "Host físico de POSTGRES_URL não confere com PRODUCTION_MIGRATE_HOST.",
    };
  }

  return {
    ok: true,
    databaseEnv: "production",
    migrationName,
    expectedHost,
    actualHost,
  };
}

export function assertAuthorizedProductionMigrate(input: AuthorizedProductionMigrateInput): {
  databaseEnv: "production";
  migrationName: string;
  expectedHost: string;
  actualHost: string;
} {
  const result = evaluateAuthorizedProductionMigrate(input);
  if (!result.ok) {
    throw new Error(result.message);
  }
  return {
    databaseEnv: result.databaseEnv,
    migrationName: result.migrationName,
    expectedHost: result.expectedHost,
    actualHost: result.actualHost,
  };
}

/** Catálogo e seed gravam no banco compartilhado. Exigem confirmação explícita. */
export function sharedCatalogWriteAllowed(
  env: Record<string, string | undefined> = process.env,
): { ok: true } | { ok: false; message: string } {
  if (env.VERCEL_ENV === "production") {
    return { ok: false, message: "catalog:deploy não roda dentro do runtime de production." };
  }
  const label = readDatabaseEnvLabel(env);
  if (label === "production") {
    if (env.CATALOG_DEPLOY_CONFIRM !== "production") {
      return { ok: false, message: "catalog:deploy com DATABASE_ENV=production exige CATALOG_DEPLOY_CONFIRM=production." };
    }
    return { ok: true };
  }
  if (label !== "development" && label !== "test") {
    return { ok: false, message: "catalog:deploy só aceita DATABASE_ENV=development, test ou production confirmado." };
  }
  if (env.CATALOG_DEPLOY_CONFIRM !== "shared") {
    return { ok: false, message: "O banco é compartilhado com production. Confirme com CATALOG_DEPLOY_CONFIRM=shared." };
  }
  return { ok: true };
}
