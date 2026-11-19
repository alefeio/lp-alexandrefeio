/**
 * Probe read-only da identidade do Postgres isolado de comércio.
 * Falha antes de migrate/deploy se o alvo não for localhost/commerce_qa.
 */
import {
  assertIsolatedCommerceLiveConnection,
  evaluateIsolatedCommerceDatabaseLive,
} from "../src/lib/db/urls";

async function main() {
  const evaluated = evaluateIsolatedCommerceDatabaseLive(process.env);
  if (!evaluated.ok) {
    console.error("[probe-commerce-isolated] BLOCKED:", evaluated.message);
    process.exit(2);
  }

  const probed = await assertIsolatedCommerceLiveConnection(process.env);
  const productionHost = (process.env.PRODUCTION_MIGRATE_HOST ?? "").trim().toLowerCase();
  if (productionHost && probed.declared.host === productionHost) {
    console.error("[probe-commerce-isolated] BLOCKED: host coincide com PRODUCTION_MIGRATE_HOST");
    process.exit(2);
  }
  if (probed.declared.hostClass !== "localhost") {
    console.error("[probe-commerce-isolated] BLOCKED: host não é localhost");
    process.exit(2);
  }
  if (probed.live.database !== "commerce_qa") {
    console.error(`[probe-commerce-isolated] BLOCKED: database vivo '${probed.live.database}' ≠ commerce_qa`);
    process.exit(2);
  }

  console.info(
    JSON.stringify({
      ok: true,
      host: probed.declared.host,
      port: probed.declared.port,
      database: probed.declared.database,
      valueHash12: probed.declared.valueHash12,
      userFingerprint: probed.declared.userFingerprint,
      liveDatabase: probed.live.database,
      liveUser: probed.live.dbUser,
      liveVersion: probed.live.version,
      serverAddr: probed.live.serverAddr,
      productionHostMatch: false,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
