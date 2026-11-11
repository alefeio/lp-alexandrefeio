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
