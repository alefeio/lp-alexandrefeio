const BUILD_PLACEHOLDER = "postgres://build:build@127.0.0.1:5432/build";

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
