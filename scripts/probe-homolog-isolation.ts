/**
 * Compara identidade sanitizada do alvo de homologação com Production (sem expor credenciais).
 * Não aplica migration. Não altera env global.
 */
import { config as loadEnv } from "dotenv";
import {
  evaluateIsolatedCommerceDatabaseLive,
  fingerprintDatabaseUrl,
  probeLiveDatabaseIdentity,
} from "../src/lib/db/urls";

loadEnv({ path: ".env.commerce-isolated.local", override: true });
// Carrega .env.local sem sobrescrever as URLs isoladas já ativas.
loadEnv({ path: ".env.local" });

function sanitize(label: string, raw: string | undefined) {
  const fp = fingerprintDatabaseUrl(raw);
  if (!fp) return { label, present: false as const };
  return {
    label,
    present: true as const,
    hostClass: fp.hostClass,
    host: fp.host,
    port: fp.port,
    database: fp.database,
    userFingerprint: fp.userFingerprint,
    valueHash12: fp.valueHash12,
  };
}

async function main() {
  // Lê Production só para fingerprint — não usa essas URLs na conexão viva.
  const dotenv = await import("dotenv");
  const prodFile = dotenv.config({ path: ".env.local", processEnv: {} });
  const prodEnv = (prodFile.parsed ?? {}) as Record<string, string>;
  const productionCandidate = sanitize(
    "PRODUCTION_CANDIDATE",
    prodEnv.RUNTIME_DATABASE_URL || prodEnv.POSTGRES_URL || prodEnv.DATABASE_URL,
  );

  const isolatedEval = evaluateIsolatedCommerceDatabaseLive(process.env);
  const isolated = sanitize("ISOLATED_COMMERCE_DATABASE_URL", process.env.ISOLATED_COMMERCE_DATABASE_URL);
  const runtime = sanitize("RUNTIME_DATABASE_URL", process.env.RUNTIME_DATABASE_URL);
  const postgres = sanitize("POSTGRES_URL", process.env.POSTGRES_URL);
  const productionHost = process.env.PRODUCTION_MIGRATE_HOST?.trim().toLowerCase() || null;

  const sharesPhysicalProduction = Boolean(
    productionCandidate.present &&
      isolated.present &&
      productionCandidate.valueHash12 === isolated.valueHash12,
  );

  const report = {
    isolatedEvalOk: isolatedEval.ok,
    isolatedEvalMessage: isolatedEval.ok ? null : isolatedEval.message,
    productionHostConfigured: Boolean(productionHost),
    sharesProductionHost: Boolean(
      productionHost &&
        [isolated, runtime, postgres].some((row) => row.present && row.host.includes(productionHost)),
    ),
    sharesPhysicalProduction,
    productionCandidate,
    targets: { isolated, runtime, postgres },
  };

  if (isolatedEval.ok) {
    const live = await probeLiveDatabaseIdentity(process.env.ISOLATED_COMMERCE_DATABASE_URL!);
    console.info(JSON.stringify({ ...report, live: { database: live.database, dbUser: live.dbUser, version: live.version } }, null, 2));
  } else {
    console.info(JSON.stringify(report, null, 2));
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
